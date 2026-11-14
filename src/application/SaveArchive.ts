import {r2ModeStorageKey} from '../content/r2Modes';
import {readCheckpoint,restoreSlots,type Checkpoint} from './checkpoint';
import type {SaveSlots} from './SavedRun';

export const MAX_SAVE_FILE_BYTES=128*1024*1024;
export interface SaveRecord {key:string;value:unknown}
export interface SaveArchive {
  format:'tangsongpai-storage-backup';
  version?:1;
  records:SaveRecord[];
  /** Absent in legacy exports; null means there was no unlock record. */
  progress?:string|null;
}

/** The old "retained data" button could export an empty file on a new profile. */
export function archiveHasContent(archive:SaveArchive):boolean {
  return archive.progress!=null||archive.records.some(row=>row.key!=='meta');
}

/** Accept previous raw-storage exports as well as complete save files. */
export function readSaveArchive(value:unknown):SaveArchive {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('存档格式不正确');
  const data=value as Record<string,unknown>;
  if(data.format!=='tangsongpai-storage-backup'||(data.version!==undefined&&data.version!==1)||
    !Array.isArray(data.records)||data.records.length>5000||
    Object.keys(data).some(key=>!['format','version','records','progress'].includes(key))||
    (Object.hasOwn(data,'progress')&&data.progress!==null&&typeof data.progress!=='string'))throw Error('存档格式不正确');
  const keys=new Set<string>(),records:SaveRecord[]=[];
  for(const item of data.records){
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('存档内容不正确');
    const row=item as Record<string,unknown>,key=row.key;
    if(typeof key!=='string'||!key||key.length>1024||keys.has(key)||!Object.hasOwn(row,'value')||
      Object.keys(row).some(field=>field!=='key'&&field!=='value'))throw Error('存档内容不正确');
    keys.add(key);records.push({key,value:row.value});
  }
  const meta=records.find(row=>row.key==='meta')?.value;
  if(meta!==undefined){
    if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('存档内容不正确');
    const info=meta as Record<string,unknown>;
    if(!Number.isSafeInteger(info.revision)||(info.revision as number)<0||typeof info.slotKey!=='string'||
      (info.slotKey!==''&&!keys.has(info.slotKey)))throw Error('存档内容不正确');
    const active=records.find(row=>row.key===info.slotKey)?.value;
    if(active!==undefined&&(!active||typeof active!=='object'||Array.isArray(active)))throw Error('存档内容不正确');
    const slots=active as {current?:unknown;previous?:unknown}|undefined;
    const restored=slots&&restoreSlots({revision:0,current:slots.current??null,previous:slots.previous??null});
    if(restored?.checkpoint&&r2ModeStorageKey(restored.checkpoint.state,restored.checkpoint.state.contentHash)!==info.slotKey)
      throw Error('存档内容不正确');
  }
  return {format:'tangsongpai-storage-backup',...(data.version===1?{version:1}:{}),records,
    ...(Object.hasOwn(data,'progress')?{progress:data.progress as string|null}:{})};
}

export function archiveSlots(archive:SaveArchive,revision=0):SaveSlots {
  const meta=archive.records.find(row=>row.key==='meta')?.value as {slotKey?:string}|undefined;
  const slots=archive.records.find(row=>row.key===meta?.slotKey)?.value as {current?:unknown;previous?:unknown;guidedOpeningSuppressedRunIds?:unknown}|undefined;
  const ids=Array.isArray(slots?.guidedOpeningSuppressedRunIds)?slots.guidedOpeningSuppressedRunIds.filter((id):id is string=>typeof id==='string').slice(0,2):[];
  return {revision,current:slots?.current??null,previous:slots?.previous??null,...(ids.length?{guidedOpeningSuppressedRunIds:ids}:{})};
}

/** Include a result that could not yet be persisted without losing the old slot. */
export function archiveWithCandidate(archive:SaveArchive,checkpoint:Checkpoint,suppressed=false):void {
  const key=r2ModeStorageKey(checkpoint.state,checkpoint.state.contentHash),records=archive.records;
  const existing=records.find(row=>row.key===key);
  const old=existing?.value as {current?:unknown;previous?:unknown;guidedOpeningSuppressedRunIds?:unknown}|undefined;
  const checked=old?.current?readCheckpoint(old.current):undefined;
  if(existing){
    let retained=`retained:${key}:export`,suffix=0;
    while(records.some(row=>row.key===retained))retained=`retained:${key}:export:${++suffix}`;
    records.push({key:retained,value:existing.value});
  }
  const previous=checked?.ok&&r2ModeStorageKey(checked.checkpoint.state,checked.checkpoint.state.contentHash)===key?checked.checkpoint:old?.previous??null;
  const previousRead=readCheckpoint(previous),retainedIds=[checkpoint.state.runId,...(previousRead.ok?[previousRead.checkpoint.state.runId]:[])];
  const ids=Array.isArray(old?.guidedOpeningSuppressedRunIds)?old.guidedOpeningSuppressedRunIds.filter((id):id is string=>typeof id==='string'&&retainedIds.includes(id)):[];
  if(suppressed&&!ids.includes(checkpoint.state.runId))ids.unshift(checkpoint.state.runId);
  const value={current:checkpoint,previous,...(ids.length?{guidedOpeningSuppressedRunIds:ids.slice(0,2)}:{})};
  if(existing)existing.value=value;else records.push({key,value});
  const meta=records.find(row=>row.key==='meta');
  const revision=(meta?.value as {revision?:number}|undefined)?.revision??0;
  if(meta)meta.value={revision,slotKey:key};else records.push({key:'meta',value:{revision,slotKey:key}});
}
