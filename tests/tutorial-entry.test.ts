import {describe,expect,it,vi} from 'vitest';
import {firstPlayerStatus,installTitleNewGameHandler,installTutorialReplayHandler,requestTitleNewGame,requestTutorialReplay} from '../src/game/TutorialEntry';
import {RUN_PROGRESS_KEY} from '../src/platform/RunProgress';
import {FIRST_GUIDE_KEY} from '../src/game/FirstChapterGuide';
import {NOVICE_GUIDE_KEY} from '../src/game/NoviceGuide';

const backup=(records:unknown[]=[])=>JSON.stringify({format:'tangsongpai-storage-backup',records});
const local=(values=new Map<string,string>())=>({getItem:(key:string)=>values.get(key)??null});
const session=()=>({persistentReady:true,run:undefined as unknown,pendingRun:undefined as unknown,storage:{exportRetained:vi.fn().mockResolvedValue(backup())}});

describe('first-player history checks',()=>{
 it('recognises a new player only after a successful persistent empty-store read',async()=>{
  const s=session();expect(await firstPlayerStatus(s,local())).toBe('first');expect(s.storage.exportRetained).toHaveBeenCalledOnce();
  s.persistentReady=false;expect(await firstPlayerStatus(s,local())).toBe('unknown');
 });
 it('keeps active, damaged, retained and orphaned saved records out of automatic tutorial',async()=>{
  const s=session();s.run={};expect(await firstPlayerStatus(s,local())).toBe('returning');s.run=undefined;s.pendingRun={};expect(await firstPlayerStatus(s,local())).toBe('returning');
  s.pendingRun=undefined;
  for(const record of [{key:'meta',value:{revision:7}},{key:'retained:old:1',value:{current:'bad'}},{key:'orphan',value:{current:'bad'}}]){
   s.storage.exportRetained.mockResolvedValueOnce(backup([record]));expect(await firstPlayerStatus(s,local())).toBe('returning');
  }
 });
 it('treats even corrupt prior progress and guide preferences as existing history',async()=>{
  for(const key of [RUN_PROGRESS_KEY,FIRST_GUIDE_KEY,NOVICE_GUIDE_KEY])expect(await firstPlayerStatus(session(),local(new Map([[key,'{']])))).toBe('returning');
 });
 it('returns unknown on errors, malformed snapshots, or inaccessible local storage',async()=>{
  const s=session();s.storage.exportRetained.mockRejectedValueOnce(Error('blocked'));expect(await firstPlayerStatus(s,local())).toBe('unknown');
  for(const raw of ['{','null','{}',JSON.stringify({format:'tangsongpai-storage-backup',records:null})]){s.storage.exportRetained.mockResolvedValueOnce(raw);expect(await firstPlayerStatus(s,local())).toBe('unknown');}
  expect(await firstPlayerStatus(s,{getItem:()=>{throw Error('denied');}})).toBe('unknown');
 });
 it('rechecks both the session and history after the asynchronous read',async()=>{
  const s=session(),values=new Map<string,string>();let finish!:(value:string)=>void;
  s.storage.exportRetained.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
  const first=firstPlayerStatus(s,local(values));values.set(RUN_PROGRESS_KEY,'old');finish(backup());expect(await first).toBe('returning');
  values.clear();s.storage.exportRetained.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
  const second=firstPlayerStatus(s,local(values));s.run={};finish(backup());expect(await second).toBe('returning');
  s.run=undefined;s.storage.exportRetained.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
  const third=firstPlayerStatus(s,local(values));s.persistentReady=false;finish(backup());expect(await third).toBe('unknown');
 });
});

it('dispatches manual replay only to the currently installed game handler',async()=>{
 expect(await requestTutorialReplay()).toBe(false);
 const first=vi.fn().mockResolvedValue(true),second=vi.fn().mockResolvedValue(false);
 const removeFirst=installTutorialReplayHandler(first);expect(await requestTutorialReplay()).toBe(true);
 const removeSecond=installTutorialReplayHandler(second);removeFirst();expect(await requestTutorialReplay()).toBe(false);expect(second).toHaveBeenCalledOnce();
 removeSecond();expect(await requestTutorialReplay()).toBe(false);
});
it('lets the menu request the active home scene’s new-game decision',()=>{
 expect(requestTitleNewGame()).toBe(false);
 const first=vi.fn(),second=vi.fn(),removeFirst=installTitleNewGameHandler(first);
 expect(requestTitleNewGame()).toBe(true);expect(first).toHaveBeenCalledOnce();
 const removeSecond=installTitleNewGameHandler(second);removeFirst();expect(requestTitleNewGame()).toBe(true);expect(second).toHaveBeenCalledOnce();
 removeSecond();expect(requestTitleNewGame()).toBe(false);
});
