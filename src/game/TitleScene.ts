import {GAME_NAME} from './Brand';
import {warmOpeningImages} from './StageImageWarmup';
import {paperSceneStart} from './PaperFlow';
import Phaser from 'phaser';
import {AudioEngine} from '../audio/AudioEngine';
import {gameSession} from './session';
import {prepareSavedTutorial,routeSavedRun} from './RunMenu';
import {selectionModeName} from './ModeSelectDialog';
import {characterForRun} from './CharacterRunCopy';
import {HomePage} from './HomePage';
import {mountTangSongEnsembleBurst} from './TangSongEntranceBurst';
import {firstPlayerStatus,installTitleNewGameHandler,type FirstPlayerStatus} from './TutorialEntry';
import {startGuidedTutorial} from './GuidedTutorial';
import {restoreNoviceGuide} from './NoviceGuide';

/** The paper home shares loading artwork; native actions keep the original new/continue routes. */
export class TitleScene extends Phaser.Scene {
  private leaving=false;
  private seed?:string;
  private home?:HomePage;
  private confirmation?:Phaser.Time.TimerEvent;
  private entranceDispose?:()=>void;
  private firstPlayer:FirstPlayerStatus='unknown';
  private checkingFirstPlayer=false;
  private checkedFirstPlayer=false;
  private entering=false;
  private launchingTutorial=false;
  private entryGeneration=0;
  private entryMessage='';
  private openingReady?:()=>void;
  private readonly audio=AudioEngine.shared;
  constructor(){super('title');}
  init(data?:{seed?:string;onReady?:()=>void}):void {this.seed=data?.seed??new URLSearchParams(location.search).get('seed')??undefined;this.openingReady=data?.onReady;}
  create():void {
    this.leaving=false;this.entering=false;this.launchingTutorial=false;this.firstPlayer='unknown';this.checkingFirstPlayer=false;this.checkedFirstPlayer=false;this.entryMessage='';this.entryGeneration++;this.audio.setScene('menu');this.cameras.main.setBackgroundColor('#F3EADB');
    this.home?.destroy();this.home=new HomePage({start:()=>void this.enterNew(),tutorial:()=>void this.enterTutorial(),resume:()=>void this.continueRun(),skipTutorial:()=>this.skipTutorial()});
    const removeTitleNewGame=installTitleNewGameHandler(()=>void this.enterNew());this.render();warmOpeningImages(this);
    this.entranceDispose?.();
    this.entranceDispose=mountTangSongEnsembleBurst(document.body,{reducedMotion:this.reducedMotion()});
    const dismissEntrance=()=>{this.entranceDispose?.();this.entranceDispose=undefined;};
    const interaction=(event:Event)=>{if(event.isTrusted)dismissEntrance();};
    const visibility=()=>{if(document.hidden)dismissEntrance();};
    window.addEventListener('pointerdown',interaction,{capture:true});window.addEventListener('keydown',interaction,{capture:true});document.addEventListener('visibilitychange',visibility);
    this.openingReady?.();this.openingReady=undefined;
    this.game.canvas.setAttribute('aria-label',GAME_NAME+' · 首页');this.game.canvas.setAttribute('aria-hidden','true');
    const keyboardOpen=(event:KeyboardEvent)=>{
      const element=document.activeElement;
      if(element!==document.body&&element!==this.game.canvas||document.querySelector('dialog[open]'))return;
      event.preventDefault();const saved=gameSession().run;
      if(saved&&['idle','readonly'].includes(saved.status))void this.continueRun();else void this.enterNew();
    };
    this.input.keyboard?.on('keydown-ENTER',keyboardOpen);this.input.keyboard?.on('keydown-SPACE',keyboardOpen);
    const stopTitle=()=>{if(this.scene.isActive())this.scene.stop();};
    const siblings=['character-select','shop','game','intermission'].map(key=>this.scene.get(key));
    siblings.forEach(scene=>scene.events.on(Phaser.Scenes.Events.START,stopTitle));
    const unsubscribe=gameSession().subscribe(()=>{if(this.scene.isActive()&&!this.leaving)this.render();});
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.leaving=true;this.entryGeneration++;unsubscribe();removeTitleNewGame();this.input.keyboard?.off('keydown-ENTER',keyboardOpen);this.input.keyboard?.off('keydown-SPACE',keyboardOpen);
      this.entranceDispose?.();this.entranceDispose=undefined;
      window.removeEventListener('pointerdown',interaction,{capture:true});window.removeEventListener('keydown',interaction,{capture:true});document.removeEventListener('visibilitychange',visibility);
      this.confirmation?.remove();this.confirmation=undefined;this.home?.destroy();this.home=undefined;this.game.canvas.removeAttribute('aria-hidden');
      siblings.forEach(scene=>scene.events.off(Phaser.Scenes.Events.START,stopTitle));
    });
  }
  private reducedMotion():boolean {return gameSession().reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  private render():void {
    if(this.leaving)return;
    const session=gameSession(),saved=session.run;
    if(saved)this.firstPlayer='returning';
    else if(session.persistentReady&&!this.checkingFirstPlayer&&!this.checkedFirstPlayer&&this.firstPlayer==='unknown'){
      this.checkingFirstPlayer=true;const generation=this.entryGeneration;
      void firstPlayerStatus(session).then(status=>{if(generation!==this.entryGeneration||this.leaving)return;this.firstPlayer=status;this.checkingFirstPlayer=false;this.checkedFirstPlayer=true;this.render();});
    }
    const showTutorialSkip=!saved&&this.firstPlayer!=='returning',firstPlayer=!saved&&this.firstPlayer==='first';
    this.home?.update({summary:saved?[characterForRun(saved.state).name,selectionModeName(saved.state)+'模式',...(saved.state.tourMode==='endless'?['无尽']:[]),'第 '+saved.state.chapter.toLocaleString('zh-CN')+' 章','金币 '+saved.state.gold.toLocaleString('zh-CN')]:undefined,canContinue:!!saved&&['idle','readonly'].includes(saved.status)&&!this.entering,canStart:!session.working&&!this.entering,canTutorial:!session.working&&!this.entering&&session.persistentReady&&(!saved||session.lease.writable),showTutorialSkip,canSkipTutorial:!session.working&&!this.launchingTutorial,checkingHistory:this.entering&&!this.launchingTutorial,firstPlayer,notice:!!session.notice||!!this.entryMessage,message:this.entryMessage||undefined,reduced:this.reducedMotion()});
  }
  private ordinaryNew():void {
    this.confirmTitle(()=>{this.audio.curtainOpen();paperSceneStart(this,'character-select',{seed:this.seed},true);});
  }
  private skipTutorial():void {
    if(this.leaving||this.launchingTutorial||gameSession().working)return;
    this.entryGeneration++;this.entering=false;this.ordinaryNew();
  }
  private async enterNew():Promise<void> {
    const session=gameSession();if(this.leaving||this.entering||session.working)return;
    const generation=++this.entryGeneration;this.checkingFirstPlayer=false;this.entering=true;this.entryMessage='';this.render();
    try {
      // Give normal boot recovery a moment to finish, while keeping the explicit
      // skip action available if storage is slow or inaccessible.
      if(!session.persistentReady&&!session.run&&!session.storageUnavailable){
        await new Promise<void>(resolve=>{
          let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);unsubscribe();resolve();};
          const unsubscribe=session.subscribe(()=>{if(session.persistentReady||session.run||session.storageUnavailable)finish();});
          const timer=setTimeout(finish,2700);
        });
      }
      if(generation!==this.entryGeneration||this.leaving)return;
      const status=await Promise.race([firstPlayerStatus(session),new Promise<FirstPlayerStatus>(resolve=>setTimeout(()=>resolve('unknown'),2000))]);
      if(generation!==this.entryGeneration||this.leaving)return;
      if(status!=='first'){this.ordinaryNew();return;}
      this.launchingTutorial=true;this.render();
      const run=await startGuidedTutorial(session,{requireEmptyHistory:true});
      if(generation!==this.entryGeneration||this.leaving)return;
      if(!run||session.run!==run||run.status!=='idle'){
        this.entryMessage=session.notice||'教程尚未开始。请在菜单中重试保存，或直接选择普通游戏。';return;
      }
      this.confirmTitle(()=>{this.audio.curtainOpen();routeSavedRun(this.game);});
    }finally {
      if(generation===this.entryGeneration&&!this.leaving){this.entering=false;this.launchingTutorial=false;this.render();}
    }
  }
  private async enterTutorial():Promise<void> {
    const session=gameSession();if(this.leaving||this.entering||session.working)return;
    if(session.run&&!window.confirm('开始新手首战会切换当前对局，并可能覆盖旧的教程进度。建议先导出需要保留的进度。确定开始吗？'))return;
    const generation=++this.entryGeneration;this.checkingFirstPlayer=false;this.entering=true;this.entryMessage='';this.render();
    try {
      if(!session.loaded||session.storageUnavailable||session.pendingRun||session.run&&!session.lease.writable){
        this.entryMessage='暂时无法开始新手首战，请先完成保存或在这里继续游戏。';return;
      }
      if(session.run&&!await session.run.flush()){this.entryMessage='当前进度尚未保存，请先在菜单中重试保存。';return;}
      if(generation!==this.entryGeneration||this.leaving)return;
      restoreNoviceGuide();this.launchingTutorial=true;this.render();
      const run=await startGuidedTutorial(session);
      if(generation!==this.entryGeneration||this.leaving)return;
      if(!run||session.run!==run||run.status!=='idle'){
        this.entryMessage=session.notice||'新手首战尚未开始，请检查保存状态后重试。';return;
      }
      this.confirmTitle(()=>{this.audio.curtainOpen();routeSavedRun(this.game);});
    }finally {
      if(generation===this.entryGeneration&&!this.leaving){this.entering=false;this.launchingTutorial=false;this.render();}
    }
  }
  private async continueRun():Promise<void> {
    const session=gameSession(),saved=session.run;if(this.leaving||this.entering||session.working||!saved||!['idle','readonly'].includes(saved.status))return;
    this.entering=true;this.entryMessage='';this.render();
    try {
      if((!session.lease.writable||saved.status==='readonly')&&!await session.takeOver())return;
      const current=session.run;if(!current||!await prepareSavedTutorial(current)||session.run!==current){this.entryMessage='教程进度尚未保存，请在菜单中重试保存。';return;}
      this.confirmTitle(()=>{this.audio.titleBell();routeSavedRun(this.game);});
    }finally {if(!this.leaving){this.entering=false;this.render();}}
  }
  private confirmTitle(leave:()=>void):void {
    this.leaving=true;this.home?.confirm();this.audio.titleConfirm();
    if(this.reducedMotion()){leave();return;}
    this.confirmation=this.time.delayedCall(200,()=>{this.confirmation=undefined;if(this.scene.isActive())leave();});
  }
}
