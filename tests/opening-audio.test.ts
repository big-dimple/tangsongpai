import {afterEach,expect,it,vi} from 'vitest';
import {installOpeningAudio} from '../src/audio/OpeningAudio';
const fixture=()=>{
 const hint:any={setAttribute:vi.fn(),remove:vi.fn(),parentElement:undefined,hidden:false};
 const body={append:vi.fn((child:any)=>child.parentElement=body)},loading={append:vi.fn((child:any)=>child.parentElement=loading)};
 let inLoading=true,refresh=()=>{};
 const doc:any={body,createElement:()=>hint,querySelector:()=>inLoading?loading:null};
 const handlers=new Map<string,(event:any)=>void>();const target:any={addEventListener:vi.fn((name,handler)=>handlers.set(name,handler)),removeEventListener:vi.fn()};
 const disconnect=vi.fn();vi.stubGlobal('MutationObserver',class{constructor(fn:()=>void){refresh=fn;}observe(){}disconnect=disconnect;});
 let state=()=>{};const unsubscribe=vi.fn();const audio={startOpeningMusic:vi.fn(),needsGestureUnlock:true,musicNeedsGesture:true,unlock:vi.fn(async()=>{}),onMusicStateChange:vi.fn(fn=>{state=fn;fn();return unsubscribe;})};
 const stop=installOpeningAudio(audio,doc,target);
 return {hint,body,loading,doc,target,audio,handlers,stop,disconnect,unsubscribe,state:()=>state(),removeLoading:()=>{inLoading=false;refresh();}};
};
afterEach(()=>vi.unstubAllGlobals());
it('starts once, keeps the hint within the loading dialog then moves it out when loading finishes',()=>{
 const f=fixture();expect(f.audio.startOpeningMusic).toHaveBeenCalledOnce();expect(f.hint.parentElement).toBe(f.loading);expect(f.hint.hidden).toBe(false);
 f.removeLoading();expect(f.hint.parentElement).toBe(f.body);f.audio.musicNeedsGesture=false;f.state();expect(f.hint.hidden).toBe(true);
 f.stop();expect(f.disconnect).toHaveBeenCalledOnce();expect(f.unsubscribe).toHaveBeenCalledOnce();expect(f.hint.remove).toHaveBeenCalledOnce();expect(f.target.removeEventListener).toHaveBeenCalledTimes(2);
});
it('only trusted click/Enter/Space may retry and ordinary clicks do not resume already running audio',()=>{
 const f=fixture(),click=f.handlers.get('click')!,key=f.handlers.get('keydown')!;
 click({isTrusted:false,type:'click'});key({isTrusted:true,type:'keydown',key:'ArrowLeft'});expect(f.audio.unlock).not.toHaveBeenCalled();
 click({isTrusted:true,type:'click'});key({isTrusted:true,type:'keydown',key:'Enter'});key({isTrusted:true,type:'keydown',key:' '});expect(f.audio.unlock).toHaveBeenCalledTimes(3);
 f.audio.needsGestureUnlock=false;click({isTrusted:true,type:'click'});expect(f.audio.unlock).toHaveBeenCalledTimes(3);f.stop();
});
