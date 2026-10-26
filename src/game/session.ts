import {stopFirstChapterGuide} from './FirstChapterGuide';
import {launchIdentity,type RunLaunchIntent} from './RunLaunch';
import {SavedRun,type SaveSlots,type SaveStore} from '../application/SavedRun';
import {MAX_IMPORT_BYTES,readCheckpoint,restoreSlots} from '../application/checkpoint';
import {createRun,type R2RunState} from '../domain/run';
import type {CharacterId} from '../domain/characters';
import {IndexedDbSave} from '../platform/IndexedDbSave';
import {WriteLease} from '../platform/WriteLease';
import {r2RunModeConfig,r2ModeStorageKey,type R2ModeSelection} from '../content/r2Modes';
import {recordSavedRunProgress} from '../platform/RunProgress';

class VolatileSaveStore implements SaveStore {
  private slots:SaveSlots={revision:0,current:null,previous:null};
  async read():Promise<SaveSlots>{return structuredClone(this.slots);}
  async readPartition():Promise<SaveSlots>{return this.read();}
  async commit(expectedRevision:number,current:Parameters<SaveStore['commit']>[1],previous:Parameters<SaveStore['commit']>[2]):Promise<number>{
    if(expectedRevision!==this.slots.revision)throw Error('write-conflict');
    this.slots={revision:expectedRevision+1,current:structuredClone(current),previous:previous?structuredClone(previous):null};
    return this.slots.revision;
  }
}

export class GameSession {
  readonly storage=new IndexedDbSave();
  readonly lease=new WriteLease();
  run?:SavedRun;
  private replacement?:SavedRun;
  notice='';
  loaded=false;
  storageUnavailable=false;
  working=false;
  speed:1|2|4=1;
  reducedMotion=false;
  private listeners=new Set<()=>void>();
  /** A suspended IndexedDB open must never own the first-run route forever. */
  private saveStore:SaveStore=this.storage;
  private restoreGeneration=0;
  private restoreInFlight=false;
  private readonly restoreTimeoutMs=2500;
  constructor(){
    this.storage.canWrite=()=>this.lease.writable;
    this.lease.onChange=()=>{if(!this.lease.writable){this.run?.setReadOnly();this.replacement?.setReadOnly();}this.changed();};
    try {const s=JSON.parse(localStorage.getItem('tangsongpai-presentation-v1')??'null');if(s&&[1,2,4].includes(s.speed))this.speed=s.speed;if(typeof s?.reducedMotion==='boolean')this.reducedMotion=s.reducedMotion;}catch{/* Optional preferences cannot block a run. */}
    document.addEventListener('visibilitychange',()=>{if(document.hidden){void this.run?.flush();void this.replacement?.flush();}});
  }
  get pendingRun():SavedRun|undefined {return this.replacement;}
  subscribe(listener:()=>void):()=>void {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  private changed():void {
    if(this.saveStore!==this.storage&&!this.notice.includes('暂存于内存'))this.notice+=' 本页新局暂存于内存，刷新会丢失；旧存档保留。可导出本局；刷新后重试读取原存档。';
    this.listeners.forEach(listener=>listener());
  }
  private pendingNotice():string {
    return this.replacement?.status==='readonly'?'这次操作还没保存，请先取消，再在这里继续。原进度保留。':'新局或导入候选尚未保存，请重试保存、导出候选或取消。原进度保留。';
  }
  private readPartition(selection:R2ModeSelection&{contentVersion?:unknown;contentHash?:unknown}):Promise<SaveSlots>{
    const store=this.saveStore as SaveStore&{readPartition?:(selection:R2ModeSelection&{contentVersion?:unknown;contentHash?:unknown})=>Promise<SaveSlots>};
    return store.readPartition?store.readPartition(selection):store.read();
  }
  private blockPending():boolean {
    if(!this.replacement)return false;this.notice=this.pendingNotice();this.changed();return true;
  }
  async initialize():Promise<void> {
    if(this.working||this.restoreInFlight||this.run||this.blockPending())return;
    // Boot recovery is background work; the home new-game action must stay enabled.
    this.restoreInFlight=true;const generation=++this.restoreGeneration;this.changed();
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      const completed=await Promise.race([
        this.loadSavedRun(generation).then(()=>true),
        new Promise<false>(resolve=>{timeout=setTimeout(()=>resolve(false),this.restoreTimeoutMs);}),
      ]);
      if(!completed&&generation===this.restoreGeneration)this.enableVolatileStartup();
    }
    finally {if(timeout!==undefined)clearTimeout(timeout);if(generation===this.restoreGeneration){this.restoreInFlight=false;this.working=false;this.changed();}}
  }
  private enableVolatileStartup(timedOut=true):void {
    // In-memory saves keep the run playable while a wedged old IndexedDB
    // request is left to settle in the background. The old checkpoint is not
    // replaced or discarded; a later reload can still retry normal restore.
    this.restoreGeneration++;this.restoreInFlight=false;
    this.saveStore=new VolatileSaveStore();
    this.run=undefined;this.loaded=true;this.storageUnavailable=false;
    this.notice=timedOut?'旧存档读取超时。':'';
    this.lease.drop();this.working=false;this.changed();
  }
  private async loadSavedRun(generation=this.restoreGeneration):Promise<boolean> {
    const store=this.saveStore;
    try {
      let slots=await store.read(),restored=restoreSlots(slots);
      if(generation!==this.restoreGeneration)return false;
      // An empty home has no progress to protect and must not reserve the only writer.
      if(restored.checkpoint){
        const claimed=await this.lease.claim();
        if(generation!==this.restoreGeneration)return false;
        if(claimed){slots=await store.read();restored=restoreSlots(slots);}
      }
      if(generation!==this.restoreGeneration)return false;
      // Keep a memory-backed controller bound to its memory store on takeover.
      this.storageUnavailable=false;
      this.notice=restored.status==='backup'?'当前存档损坏，已读取上次有效备份；原数据仍保留，可导出。':restored.status==='invalid'?'存档损坏或版本不兼容，原数据已保留。可导出保留数据，或确认后开始新局。':'';
      if(restored.checkpoint)this.attach(SavedRun.restore(this.saveStore,slots));else this.run=undefined;
      this.loaded=true;
      return true;
    }catch{if(generation===this.restoreGeneration){this.storageUnavailable=true;this.notice='浏览器暂时无法读取进度，请重试。';}return false;}
    finally {if(generation===this.restoreGeneration)this.changed();}
  }
  private recordProgress(run:SavedRun):void {
    if(this.run!==run||this.replacement===run||run.status!=='idle'||this.saveStore!==this.storage||!this.lease.writable)return;
    if(run.state.mode!=='standard'||run.state.tourMode!=='normal'||run.state.phase!=='run-won')return;
    const result=recordSavedRunProgress(run.state);
    if(!result.ok)this.notice='本局已保存，解锁记录暂无法更新；恢复已保存的通关进度后可重试。';
  }
  private attach(run:SavedRun):void {
    this.run=run;run.onChange=()=>{this.recordProgress(run);this.changed();};if(!this.lease.writable)run.setReadOnly();this.recordProgress(run);this.changed();
  }
  private async publishReplacement(run:SavedRun):Promise<boolean> {
    if(await run.flush()){stopFirstChapterGuide();this.attach(run);return true;}
    this.replacement=run;run.onChange=()=>this.changed();if(!this.lease.writable)run.setReadOnly();
    this.notice=this.pendingNotice();this.changed();return false;
  }
  async start(seed:string,characterId:CharacterId,modeConfig?:R2ModeSelection,intent:RunLaunchIntent={kind:'new'}):Promise<SavedRun|undefined> {
    // Explicit new play supersedes only boot recovery, never an active save.
    if(intent.kind==='new'&&!this.run&&!this.replacement&&(this.restoreInFlight||(!this.working&&this.storageUnavailable)))this.enableVolatileStartup(false);
    if(this.working||this.blockPending())return;
    if(!this.loaded||this.storageUnavailable){this.notice='浏览器暂时无法保存，请重试。';this.changed();return;}
    this.working=true;this.notice='';this.changed();
    try {
      if(!this.lease.writable){
        if(!await this.lease.claim()){await this.loadSavedRun();this.notice='游戏已在另一页打开。可在这里继续。';return;}
        const latest=await this.saveStore.read().catch(error=>{this.storageUnavailable=true;throw error;}),restored=restoreSlots(latest);
        // A different page may have started a run after this empty home was opened.
        if(restored.checkpoint&&!this.run){this.attach(SavedRun.restore(this.saveStore,latest));this.notice='已找到保存的进度。可以继续本局，或重新选择新局。';return;}
        if(this.run?.status==='readonly')await this.loadSavedRun();
      }
      if(this.run&&!(await this.run.flush())){this.notice='本局尚未保存，请先重试或导出；未替换已有进度。';return;}
      if(intent.kind==='retry'&&(intent.run!==this.run?.state||seed!==intent.run.seed||r2ModeStorageKey(r2RunModeConfig(modeConfig??{mode:'standard',difficulty:0,challengeId:null,programsEnabled:true}),intent.run.contentHash)!==r2ModeStorageKey(intent.run,intent.run.contentHash)))throw Error('stale-retry-run');
      const r2Identity=launchIdentity(characterId,intent);
      const openingRoute=intent.kind==='new'?(intent.openingRoute??'group'):intent.run.openingRoute;
      const state=createRun({r2Identity,...(openingRoute===undefined?{}:{openingRoute}),seed,characterId,runId:`run/${seed}/${characterId}`,rulesVersion:'r2',...(modeConfig===undefined?{}:{modeConfig})});
      const slots=await this.readPartition(state).catch((error:unknown)=>{this.storageUnavailable=true;throw error;});
      const run=await SavedRun.start(this.saveStore,state,slots);
      if(!await this.publishReplacement(run))return;
      return run;
    }catch{this.notice='暂时无法开始新局，请重试。';}
    finally {this.working=false;this.changed();}
  }
  async takeOver():Promise<boolean> {
    if(this.restoreInFlight||this.working||this.blockPending())return false;this.working=true;this.changed();
    try {
      if(!await this.lease.claim()&&!await this.lease.claim(true)){this.notice='暂时无法在这里继续，请关闭另一游戏页面后重试。';return false;}
      return await this.loadSavedRun()&&this.lease.writable;
    }finally {this.working=false;this.changed();}
  }
  async importJSON(text:string):Promise<boolean> {
    if(this.restoreInFlight||this.working||this.blockPending())return false;
    if(!this.lease.writable){this.notice='游戏已在另一页打开。可在这里继续。';this.changed();return false;}
    this.working=true;this.changed();
    try {
      if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw Error('导入文件过大');
      const checked=readCheckpoint(JSON.parse(text));if(!checked.ok)throw Error(checked.code);
      if(this.run&&!await this.run.flush())throw Error('本局尚未保存，请先重试或导出');
      const run=await SavedRun.import(this.saveStore,checked.checkpoint,await this.readPartition(checked.checkpoint.state));
      this.notice='导入成功，已保存完整进度。';
      if(!await this.publishReplacement(run))return false;
      this.changed();return true;
    }catch(error){this.notice='导入失败：'+(error instanceof Error?error.message:'非法文件')+'。原进度未修改。';this.changed();return false;}
    finally {this.working=false;this.changed();}
  }
  preferences(speed:1|2|4,reducedMotion=this.reducedMotion):void {
    this.speed=speed;this.reducedMotion=reducedMotion;
    try {localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed,reducedMotion}));}catch{/* Playback remains usable when preferences cannot persist. */}
    window.dispatchEvent(new Event('tangsongpai-presentation'));this.changed();
  }
  async retry():Promise<boolean> {
    if(this.working)return false;
    const run=this.replacement??this.run;if(!run)return false;
    if(!this.lease.writable||run.status==='readonly'){
      run.setReadOnly();this.notice=this.replacement?this.pendingNotice():'游戏已在另一页打开。可在这里继续。';this.changed();return false;
    }
    const previousNotice=this.notice;this.working=true;this.notice='';this.changed();
    try {
      const result=await run.retry();
      if(!result.ok){this.notice=this.replacement?this.pendingNotice():previousNotice;return false;}
      if(this.replacement===run){stopFirstChapterGuide();this.replacement=undefined;this.notice='候选已保存，现已切换到该进度。';this.attach(run);}
      else if(!this.notice)this.notice='本局已保存。';
      return true;
    }finally {this.working=false;this.changed();}
  }
  async resumeMode(modeConfig:R2ModeSelection):Promise<boolean> {
    if(this.working||this.blockPending())return false;
    if(!this.loaded||!this.lease.writable){this.notice='浏览器暂时无法保存，或游戏已在另一页打开。请重试。';this.changed();return false;}
    this.working=true;this.notice='';this.changed();
    try {
      const selected=r2RunModeConfig(modeConfig);
      if(this.run&&!await this.run.flush())throw Error('本局尚未保存，请先重试或导出');
      const slots=await this.readPartition(selected),restored=restoreSlots(slots);
      if(!restored.checkpoint)throw Error(restored.status==='empty'?'所选模式尚无已保存进度':restored.code??'所选模式存档无效');
      const state=restored.checkpoint.state;
      if(r2ModeStorageKey(state,state.contentHash)!==r2ModeStorageKey(selected,state.contentHash))throw Error('所选模式与保存分区不一致');
      // Import only persists the existing checkpoint and meta pointer; it never applies StartRun or re-locks a chapter.
      const run=await SavedRun.import(this.saveStore,restored.checkpoint,slots);
      this.notice=restored.status==='backup'?'所选模式已从有效备份恢复；原数据仍保留，可导出。':'已恢复所选模式的完整进度。';
      if(!await this.publishReplacement(run))return false;
      return true;
    }catch(error){this.notice='无法切换进度：'+(error instanceof Error?error.message:'存储错误')+'。原进度未修改。';return false;}
    finally {this.working=false;this.changed();}
  }
  cancelPending():boolean {
    if(!this.replacement||this.working||this.replacement.status==='saving')return false;
    this.replacement.onChange=()=>{};this.replacement.setReadOnly();this.replacement=undefined;
    this.notice='已取消未保存候选；原进度仍保留。';this.changed();return true;
  }
  state():R2RunState|undefined {return this.run?.state;}
}

let session:GameSession|undefined;
export const gameSession=():GameSession=>session??=new GameSession();
