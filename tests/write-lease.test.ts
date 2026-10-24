import {afterEach,describe,expect,it,vi} from 'vitest';
import {WriteLease} from '../src/platform/WriteLease';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function setup(request?:ReturnType<typeof vi.fn>){vi.stubGlobal('navigator',request?{locks:{request}}:{});vi.stubGlobal('window',globalThis);vi.stubGlobal('BroadcastChannel',undefined);}
describe('page writer capability',()=>{
 it('grants an available browser lock and releases it on drop',async()=>{
  let finished=false;const request=vi.fn(async(_name,_options,callback)=>{await callback({name:'tangsongpai-writer'});finished=true;});setup(request);
  const lease=new WriteLease();expect(await lease.claim()).toBe(true);expect(lease.writable).toBe(true);expect(lease.elsewhere).toBe(false);lease.drop();await vi.waitFor(()=>expect(finished).toBe(true));
 });
 it('identifies an actually held lock without becoming writable',async()=>{
  const request=vi.fn(async(_name,_options,callback)=>callback(null));setup(request);const lease=new WriteLease();expect(await lease.claim()).toBe(false);expect(lease.writable).toBe(false);expect(lease.elsewhere).toBe(true);
 });
 it('a rejected lock API uses revision protection instead of claiming another page exists',async()=>{
  setup(vi.fn().mockRejectedValue(new DOMException('denied','SecurityError')));const lease=new WriteLease();expect(await lease.claim()).toBe(true);expect(lease.elsewhere).toBe(false);
 });
 it('a synchronously denied lock request also uses revision protection',async()=>{
  setup(vi.fn(()=>{throw new DOMException('denied','SecurityError');}));const lease=new WriteLease();expect(await lease.claim()).toBe(true);expect(lease.elsewhere).toBe(false);
 });
 it('missing locks or a denied broadcast channel still permits atomic revision saves',async()=>{
  setup();vi.stubGlobal('BroadcastChannel',class {constructor(){throw new DOMException('denied','SecurityError');}});const lease=new WriteLease();expect(await lease.claim()).toBe(true);expect(lease.elsewhere).toBe(false);
 });
 it('an explicit continue that times out remains blocked and never falls back past a live holder',async()=>{
  vi.useFakeTimers();setup(vi.fn((_name,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))));
  const lease=new WriteLease(),result=lease.claim(true);await vi.advanceTimersByTimeAsync(2001);expect(await result).toBe(false);expect(lease.writable).toBe(false);expect(lease.elsewhere).toBe(true);
 });
});
