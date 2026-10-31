import {FIRST_GUIDE_KEY} from './FirstChapterGuide';
import {NOVICE_GUIDE_KEY} from './NoviceGuide';
import {RUN_PROGRESS_KEY} from '../platform/RunProgress';

export type FirstPlayerStatus='first'|'returning'|'unknown';
interface HistorySession {
  readonly persistentReady:boolean;
  readonly run?:unknown;
  readonly pendingRun?:unknown;
  readonly storage:{exportRetained():Promise<string>};
}

/** Unknown storage is never evidence of a new player. Check all partitions, including
 * damaged and retained records, instead of only the currently selected checkpoint. */
export async function firstPlayerStatus(session:HistorySession,storage?:Pick<Storage,'getItem'>):Promise<FirstPlayerStatus> {
  if(!session.persistentReady)return 'unknown';
  if(session.run||session.pendingRun)return 'returning';
  try {
    const local=storage??globalThis.localStorage;
    // Even malformed or empty legacy progress is evidence of an earlier player.
    if([RUN_PROGRESS_KEY,FIRST_GUIDE_KEY,NOVICE_GUIDE_KEY].some(key=>local.getItem(key)!==null))return 'returning';
    const snapshot:unknown=JSON.parse(await session.storage.exportRetained());
    if(!session.persistentReady)return 'unknown';
    if(session.run||session.pendingRun)return 'returning';
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return 'unknown';
    const data=snapshot as {format?:unknown;records?:unknown};
    if(data.format!=='tangsongpai-storage-backup'||!Array.isArray(data.records))return 'unknown';
    // Recheck localStorage after the asynchronous IndexedDB scan.
    if([RUN_PROGRESS_KEY,FIRST_GUIDE_KEY,NOVICE_GUIDE_KEY].some(key=>local.getItem(key)!==null))return 'returning';
    return data.records.length?'returning':'first';
  }catch{return 'unknown';}
}

type ReplayHandler=()=>Promise<boolean>;
let replayHandler:ReplayHandler|undefined;
/** The menu owns the Phaser game; the mode dialog can request the same replay route. */
export function installTutorialReplayHandler(handler:ReplayHandler):()=>void {
  replayHandler=handler;
  return ()=>{if(replayHandler===handler)replayHandler=undefined;};
}
export async function requestTutorialReplay():Promise<boolean> {
  return replayHandler?replayHandler():false;
}

let titleNewGameHandler:(()=>void)|undefined;
/** The menu's home-screen new-game action uses the same first-player decision. */
export function installTitleNewGameHandler(handler:()=>void):()=>void {
  titleNewGameHandler=handler;
  return ()=>{if(titleNewGameHandler===handler)titleNewGameHandler=undefined;};
}
export function requestTitleNewGame():boolean {
  if(!titleNewGameHandler)return false;
  titleNewGameHandler();return true;
}
