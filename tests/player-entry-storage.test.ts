import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {SaveSlots} from '../src/application/SavedRun';
import {GameSession} from '../src/game/session';
let delayedRead:(()=>Promise<SaveSlots>)|undefined;
let slots:SaveSlots,failRead=false,blocked=false,failWrite=false,hangRead=false;
vi.mock('../src/platform/IndexedDbSave',()=>({IndexedDbSave:class{
 canWrite=()=>true;
 async read(){if(delayedRead){const read=delayedRead;delayedRead=undefined;return read();}if(hangRead)return new Promise<SaveSlots>(()=>{});if(failRead)throw new DOMException('denied','SecurityError');return structuredClone(slots);}
 async readPartition(){return this.read();}
 async commit(rev:number,current:SaveSlots['current'],previous:SaveSlots['previous']){if(failWrite)throw new DOMException('quota','QuotaExceededError');if(!this.canWrite())throw Error('read-only');if(slots.revision!==rev)throw Error('write-conflict');slots={revision:rev+1,current:structuredClone(current),previous:structuredClone(previous)};return slots.revision;}
}}));
vi.mock('../src/platform/WriteLease',()=>({WriteLease:class{
 writable=false;elsewhere=false;onChange=()=>{};
  drop=vi.fn(()=>{this.writable=false;this.elsewhere=false;this.onChange();});
 claim=vi.fn(async()=>{this.writable=!blocked;this.elsewhere=blocked;this.onChange();return !blocked;});
}}));
beforeEach(()=>{slots={revision:0,current:null,previous:null};failRead=false;failWrite=false;blocked=false;hangRead=false;delayedRead=undefined;vi.stubGlobal('document',{hidden:false,addEventListener:()=>{}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function savedOldRun(){const s=new GameSession();await s.initialize();await s.start('old-unfinished','amo');s.lease.drop();return structuredClone(slots);}
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
  const before=await savedOldRun();hangRead=true;vi.useFakeTimers();
  try {
   const s=new GameSession(),initializing=s.initialize();
   await vi.advanceTimersByTimeAsync(2500);await initializing;
   expect(s.loaded).toBe(true);expect(s.storageUnavailable).toBe(false);expect(s.notice).toContain('读取超时');
   const run=await s.start('timeout-new','amo');expect(run?.status).toBe('idle');expect(run?.state.seed).toBe('timeout-new');expect(slots).toEqual(before);expect(s.notice).toContain('刷新会丢失');expect(s.working).toBe(false);
  } finally {vi.useRealTimers();}
 });
 it('a failed first save remains pending and retries the same run exactly once',async()=>{
  const s=new GameSession();await s.initialize();failWrite=true;expect(await s.start('quota-case','amo')).toBeUndefined();expect(slots.current).toBeNull();const pending=s.pendingRun!.exportJSON();
  failWrite=false;expect(await s.retry()).toBe(true);expect(s.run!.exportJSON()).toBe(pending);expect(slots.revision).toBe(1);
 });
 it('replaces a normally restored unfinished run without exiting and restores the new persisted run after refresh',async()=>{
  const before=await savedOldRun(),s=new GameSession();await s.initialize();
  expect(s.state()?.seed).toBe('old-unfinished');
  const run=await s.start('normal-new','amo');expect(run?.status).toBe('idle');
  expect(slots.previous).toEqual(before.current);s.lease.drop();
  const refreshed=new GameSession();await refreshed.initialize();expect(refreshed.state()).toEqual(run!.state);
 });
 it('immediately starts during a hung restore and remains playable after the obsolete timeout',async()=>{
  const before=await savedOldRun();hangRead=true;vi.useFakeTimers();
  const s=new GameSession(),boot=s.initialize();expect(s.working).toBe(false);expect(s.loaded).toBe(false);
  const run=await s.start('immediate-new','amo');
  expect(run?.status).toBe('idle');expect(s.lease.writable).toBe(true);expect(slots).toEqual(before);
  expect(s.notice).toContain('暂存于内存');expect(s.notice).toContain('刷新会丢失');
  await vi.advanceTimersByTimeAsync(2500);await boot;expect(s.run).toBe(run);expect(s.working).toBe(false);
  expect((await run!.dispatch({type:'LeaveShop'})).ok).toBe(true);expect(slots).toEqual(before);
 });
 it.each(['success','failure'] as const)('ignores late boot read %s without replacing or poisoning the new run',async(outcome)=>{
  const before=await savedOldRun(),read=deferred<SaveSlots>();delayedRead=()=>read.promise;
  const s=new GameSession(),boot=s.initialize(),run=await s.start('late-new','amo'),notice=s.notice;
  if(outcome==='success')read.resolve(before);else read.reject(Error('late storage denial'));
  await boot;expect(s.run).toBe(run);expect(s.storageUnavailable).toBe(false);expect(s.notice).toBe(notice);
  expect(slots).toEqual(before);expect(run?.status).toBe('idle');expect(s.working).toBe(false);expect(s.lease.writable).toBe(true);
 });
 it('isolates the second boot read after a writer claim without dropping the new writer',async()=>{
  const before=await savedOldRun(),read=deferred<SaveSlots>(),s=new GameSession();
  const diskRead=vi.spyOn(s.storage,'read');
  diskRead.mockImplementationOnce(async()=>structuredClone(before)).mockImplementationOnce(()=>read.promise);
  const boot=s.initialize();await vi.waitFor(()=>expect(diskRead).toHaveBeenCalledTimes(2));
  const run=await s.start('second-read-new','amo');read.resolve(before);await boot;
  expect(s.run).toBe(run);expect(run?.status).toBe('idle');expect(slots).toEqual(before);expect(s.lease.writable).toBe(true);
 });
 it('late lease acquisition cannot overwrite the new run or drop its writer',async()=>{
  const before=await savedOldRun(),claim=deferred<boolean>(),s=new GameSession();
  vi.spyOn(s.lease,'claim').mockImplementation(async()=>{const ok=await claim.promise;s.lease.writable=ok;s.lease.onChange();return ok;});
  const boot=s.initialize();await vi.waitFor(()=>expect(s.lease.claim).toHaveBeenCalledOnce());
  const starting=s.start('late-lease-new','amo');claim.resolve(true);const run=await starting;await boot;
  expect(s.run).toBe(run);expect(run?.status).toBe('idle');expect(slots).toEqual(before);expect(s.lease.writable).toBe(true);
 });
 it('memory play survives same-page reinitialization; refresh restores old data, then normal new play persists',async()=>{
  const before=await savedOldRun(),read=deferred<SaveSlots>();delayedRead=()=>read.promise;
  const s=new GameSession(),boot=s.initialize(),temporary=await s.start('temporary-new','amo');read.resolve(before);await boot;
  await s.initialize();expect(s.run).toBe(temporary);expect(s.notice).toContain('刷新会丢失');s.lease.drop();
  const refreshed=new GameSession();await refreshed.initialize();expect(refreshed.state()?.seed).toBe('old-unfinished');expect(slots).toEqual(before);
  const durable=await refreshed.start('recovered-new','amo');expect((await durable!.dispatch({type:'LeaveShop'})).ok).toBe(true);refreshed.lease.drop();
  const again=new GameSession();await again.initialize();expect(again.state()).toEqual(durable!.state);expect(again.notice).not.toContain('暂存于内存');
 });
 it('takeover of memory play keeps the controller on the same memory store',async()=>{
  const before=await savedOldRun(),read=deferred<SaveSlots>();delayedRead=()=>read.promise;
  const s=new GameSession(),boot=s.initialize(),run=await s.start('memory-takeover','amo');read.resolve(before);await boot;
  s.lease.drop();expect(await s.takeOver()).toBe(true);expect(s.state()).toEqual(run!.state);
  expect((await s.run!.dispatch({type:'LeaveShop'})).ok).toBe(true);expect(slots).toEqual(before);expect(s.notice).toContain('暂存于内存');
 });
 it('late boot completion cannot release the busy guard of a new launch',async()=>{
  const before=await savedOldRun(),read=deferred<SaveSlots>();delayedRead=()=>read.promise;
  const s=new GameSession(),boot=s.initialize(),claim=deferred<boolean>();
  vi.spyOn(s.lease,'claim').mockImplementation(async()=>{const ok=await claim.promise;s.lease.writable=ok;s.lease.onChange();return ok;});
  const starting=s.start('busy-new','amo');read.resolve(before);await boot;
  expect(s.working).toBe(true);expect(await s.start('must-not-start','amo')).toBeUndefined();
  claim.resolve(true);expect((await starting)?.state.seed).toBe('busy-new');expect(s.working).toBe(false);
 });
 it('failed normal replacement retains the old disk data and retries the exact candidate before refresh',async()=>{
  const before=await savedOldRun(),s=new GameSession();await s.initialize();failWrite=true;
  expect(await s.start('quota-new','amo')).toBeUndefined();expect(slots).toEqual(before);expect(s.state()?.seed).toBe('old-unfinished');const candidate=s.pendingRun!.exportJSON();
  failWrite=false;expect(await s.retry()).toBe(true);expect(s.run!.exportJSON()).toBe(candidate);expect(slots.previous).toEqual(before.current);s.lease.drop();
  const refreshed=new GameSession();await refreshed.initialize();expect(refreshed.state()?.seed).toBe('quota-new');
 });
 it('a failed boot read allows explicit memory play while preserving the old checkpoint',async()=>{
  const before=await savedOldRun();failRead=true;const s=new GameSession();await s.initialize();
  const run=await s.start('denied-new','amo');expect(run?.status).toBe('idle');expect(slots).toEqual(before);expect(s.notice).toContain('暂存于内存');
 });
 it('first new game with no previous save survives refresh',async()=>{
  const s=new GameSession();await s.initialize();const run=await s.start('first-refresh','amo');s.lease.drop();
  const refreshed=new GameSession();await refreshed.initialize();expect(refreshed.state()).toEqual(run!.state);expect(slots.previous).toBeNull();
 });
});
