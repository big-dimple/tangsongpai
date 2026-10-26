import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {SaveSlots} from '../src/application/SavedRun';
import {GameSession} from '../src/game/session';
let slots:SaveSlots,failRead=false,blocked=false,failWrite=false,hangRead=false;
vi.mock('../src/platform/IndexedDbSave',()=>({IndexedDbSave:class{
 canWrite=()=>true;
 async read(){if(hangRead)return new Promise<SaveSlots>(()=>{});if(failRead)throw new DOMException('denied','SecurityError');return structuredClone(slots);}
 async readPartition(){return this.read();}
 async commit(rev:number,current:SaveSlots['current'],previous:SaveSlots['previous']){if(failWrite)throw new DOMException('quota','QuotaExceededError');if(!this.canWrite())throw Error('read-only');if(slots.revision!==rev)throw Error('write-conflict');slots={revision:rev+1,current:structuredClone(current),previous:structuredClone(previous)};return slots.revision;}
}}));
vi.mock('../src/platform/WriteLease',()=>({WriteLease:class{
 writable=false;elsewhere=false;onChange=()=>{};
  drop=vi.fn();
 claim=vi.fn(async()=>{this.writable=!blocked;this.elsewhere=blocked;this.onChange();return !blocked;});
}}));
beforeEach(()=>{slots={revision:0,current:null,previous:null};failRead=false;failWrite=false;blocked=false;hangRead=false;vi.stubGlobal('document',{hidden:false,addEventListener:()=>{}});});
afterEach(()=>vi.unstubAllGlobals());
describe('new player and persisted-run entry',()=>{
 it('an empty home does not hold a writer; its first real new run acquires one and saves',async()=>{
  const s=new GameSession();await s.initialize();expect(s.loaded).toBe(true);expect(s.run).toBeUndefined();expect(s.lease.claim).not.toHaveBeenCalled();expect(s.notice).toBe('');
  const run=await s.start('new-player','amo');expect(run?.status).toBe('idle');expect(slots.revision).toBe(1);expect(s.lease.claim).toHaveBeenCalledTimes(1);
 });
 it('two empty homes are harmless; an intervening saved run is read before replacement',async()=>{
  const a=new GameSession(),b=new GameSession();await a.initialize();await b.initialize();await a.start('first-player','amo');const before=structuredClone(slots);
  expect(await b.start('new-attempt','amo')).toBeUndefined();expect(b.state()?.seed).toBe('first-player');expect(slots).toEqual(before);expect(b.notice).toContain('已找到保存的进度');
 });
 it('a live other page keeps its save unchanged; continuing here reloads the latest complete state',async()=>{
  const a=new GameSession();await a.initialize();await a.start('live-page','amo');const before=structuredClone(slots);blocked=true;
  const b=new GameSession();await b.initialize();expect(b.run?.status).toBe('readonly');expect(await b.start('no-overwrite','amo')).toBeUndefined();expect(slots).toEqual(before);
  blocked=false;expect(await b.takeOver()).toBe(true);expect(b.run?.status).toBe('idle');expect(b.state()).toEqual(a.state());expect(slots).toEqual(before);
 });
 it('storage denial is separate from concurrency and can recover in the same page',async()=>{
  failRead=true;const s=new GameSession();await s.initialize();expect(s.loaded).toBe(false);expect(s.storageUnavailable).toBe(true);expect(s.notice).not.toMatch(/另一页|写入|接管/);
  failRead=false;await s.initialize();expect(s.loaded).toBe(true);expect(s.storageUnavailable).toBe(false);expect(await s.start('recovered','amo')).toBeDefined();
 });
 it('bounds a hung restore so a new run can enter without replacing the old checkpoint',async()=>{
  hangRead=true;vi.useFakeTimers();
  try {
   const s=new GameSession(),initializing=s.initialize();
   await vi.advanceTimersByTimeAsync(2500);await initializing;
   expect(s.loaded).toBe(true);expect(s.storageUnavailable).toBe(false);expect(s.notice).toContain('读取超时');
   const run=await s.start('timeout-new','amo');expect(run?.status).toBe('idle');expect(run?.state.seed).toBe('timeout-new');
  } finally {vi.useRealTimers();}
 });
 it('lets a new mobile launch supersede an in-flight restore immediately',async()=>{
  hangRead=true;
  const s=new GameSession(),initializing=s.initialize();
  const run=await s.start('immediate-new','amo');
  expect(run?.state.seed).toBe('immediate-new');expect(s.loaded).toBe(true);expect(s.notice).toBe('');
  await Promise.race([initializing,new Promise(resolve=>setTimeout(resolve,20))]);
 });
 it('a failed first save remains pending and retries the same run exactly once',async()=>{
  const s=new GameSession();await s.initialize();failWrite=true;expect(await s.start('quota-case','amo')).toBeUndefined();expect(slots.current).toBeNull();const pending=s.pendingRun!.exportJSON();
  failWrite=false;expect(await s.retry()).toBe(true);expect(s.run!.exportJSON()).toBe(pending);expect(slots.revision).toBe(1);
 });
});
