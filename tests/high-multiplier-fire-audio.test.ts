import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AudioEngine,type HighMultiplierFireOptions} from '../src/audio/AudioEngine';
import {createHighMultiplierFire,HIGH_MULTIPLIER_FIRE_SECONDS} from '../src/audio/HighMultiplierFire';
import {FOLEY_SAMPLES} from '../src/audio/foley';
import {EFFECT_VOICE_BUDGET} from '../src/audio/mixPolicy';

function fixture(){
  const sources:any[]=[],buffers:any[]=[];
  const param=()=>({value:0,setValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const gain=()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()});
  const context:any={currentTime:1,state:'running',sampleRate:8000,createGain:gain,
    createBuffer:(_channels:number,length:number,rate:number)=>{const data=new Float32Array(length),buffer={duration:length/rate,getChannelData:()=>data};buffers.push(buffer);return buffer;},
    createBufferSource:()=>{const source:any={buffer:null,playbackRate:{value:1},start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),onended:null};sources.push(source);return source;},
    createBiquadFilter:()=>({type:'',Q:{value:0},frequency:param(),connect:vi.fn(),disconnect:vi.fn()}),
    suspend:vi.fn(async()=>{}),resume:vi.fn(async()=>{})};
  const engine=new AudioEngine(),inside=engine as any,gains={master:gain(),music:gain(),sfx:gain(),ui:gain()};
  Object.assign(inside,{context,gains,unlocked:true});
  for(const {name} of FOLEY_SAMPLES)inside.scoreSamples.set(name,{name,duration:1});
  const controller=new AbortController();
  const options:HighMultiplierFireOptions={signal:controller.signal,speed:1,reducedMotion:false,replay:false};
  return {engine,inside,context,gains,sources,buffers,controller,options};
}

beforeEach(()=>{vi.stubGlobal('document',{hidden:false});vi.stubGlobal('window',{});});
afterEach(()=>vi.unstubAllGlobals());

describe('high multiplier flame audio',()=>{
  it('synthesizes a deterministic, finite, bounded and non-silent buffer without recorded assets',()=>{
    const {context}=fixture(),a=createHighMultiplierFire(context),b=createHighMultiplierFire(context);
    expect(a.duration).toBe(HIGH_MULTIPLIER_FIRE_SECONDS);
    const samples=a.getChannelData(0),copy=b.getChannelData(0);
    expect(samples).toEqual(copy);
    expect(samples.every(Number.isFinite)).toBe(true);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(1);
    expect(Math.sqrt(samples.reduce((sum:number,n:number)=>sum+n*n,0)/samples.length)).toBeGreaterThan(.05);
    const energy=samples.reduce((sum:number,n:number)=>sum+n*n,0);
    const change=samples.reduce((sum:number,n:number,i:number)=>i?sum+(n-samples[i-1])**2:sum,0);
    expect(change/energy).toBeLessThan(.8); // Bounds sharp sample-to-sample energy at this fixture's 8 kHz.
    expect(samples.at(-1)).toBeCloseTo(samples[0],7); // The sustained loop has no boundary click.
  });

  it.each([1,2,4] as const)('sustains at %ix until the owner requests a fade without changing pitch',speed=>{
    const {engine,inside,context,gains,sources,options}=fixture();
    const fire=engine.playHighMultiplierFire({...options,speed});
    expect(sources).toHaveLength(1);
    const source=sources[0],voice=[...inside.voices][0] as any,duration=.45/speed;
    expect(source.start).toHaveBeenCalledWith(context.currentTime);
    expect(source.loop).toBe(true);expect(source.stop).not.toHaveBeenCalled();
    expect(source.playbackRate.value).toBe(1);
    expect(voice.gain.connect).toHaveBeenCalledWith(gains.sfx);
    fire.fadeOut(450/speed);
    expect(source.stop).toHaveBeenCalledWith(context.currentTime+duration);
    expect(voice.gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0,context.currentTime+duration);
    expect(voice.peak).toBeLessThanOrEqual(.06);
  });

  it('stops safely when asked to fade for an invalid duration',()=>{
    const {engine,inside,sources,options}=fixture(),fire=engine.playHighMultiplierFire(options);
    fire.fadeOut(Number.NaN);expect(inside.voices.size).toBe(0);expect(sources[0].disconnect).toHaveBeenCalledOnce();
  });

  it('layers over a real score impact without consuming its numeric voice budget or shortening its fire tail',()=>{
    const {engine,inside,sources,options}=fixture();
    engine.playHighMultiplierFire(options);
    const fire=[...inside.voices][0] as any;
    engine.scoreImpact({},'actual-event','multiply');
    expect(sources).toHaveLength(4);
    expect([...inside.voices].filter((v:any)=>v.scoreAccent)).toHaveLength(3);
    expect(inside.voices.has(fire)).toBe(true);
    expect(fire.gain.gain.cancelScheduledValues).not.toHaveBeenCalled();
  });

  it('keeps a single fire, reuses the generated buffer, and makes stale disposers harmless',()=>{
    const {engine,inside,context,sources,buffers,options}=fixture();
    const first=engine.playHighMultiplierFire(options);
    for(let i=0;i<40;i++)engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(1);expect(inside.voices.size).toBe(1);
    first.stop();first.stop();expect(inside.voices.size).toBe(0);
    context.currentTime+=.1;
    const second=engine.playHighMultiplierFire(options);first.stop();
    expect(sources).toHaveLength(2);expect(buffers).toHaveLength(1);expect(inside.voices.size).toBe(1);
    second.stop();expect(inside.voices.size).toBe(0);
  });

  it('cleans up on ended or abort, including its abort listener',()=>{
    const {engine,inside,sources,controller,options}=fixture();
    const remove=vi.spyOn(controller.signal,'removeEventListener');
    engine.playHighMultiplierFire(options);sources[0].onended();
    expect(inside.voices.size).toBe(0);expect(remove).toHaveBeenCalledWith('abort',expect.any(Function));
    engine.playHighMultiplierFire(options);controller.abort();
    expect(inside.voices.size).toBe(0);expect(sources.every(s=>s.disconnect.mock.calls.length===1)).toBe(true);
  });

  it.each(['abort','reduced','replay','volume','mute','hidden','background','not-running'] as const)('does not queue a missed %s cue',boundary=>{
    const {engine,context,sources,controller,options}=fixture();
    if(boundary==='abort')controller.abort();
    if(boundary==='reduced')options.reducedMotion=true;
    if(boundary==='replay')options.replay=true;
    if(boundary==='volume')engine.setVolume('sfx',0);
    if(boundary==='mute')engine.muted=true;
    if(boundary==='hidden')vi.stubGlobal('document',{hidden:true});
    if(boundary==='background')engine.setSuspended(true);
    if(boundary==='not-running')context.state='suspended';
    engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(0);
    engine.setVolume('sfx',.8);engine.muted=false;vi.stubGlobal('document',{hidden:false});engine.setSuspended(false);context.state='running';
    expect(sources).toHaveLength(0);
  });

  it.each(['volume','master','mute','background','scene','cancel','score-stop','dispose'] as const)('%s immediately releases a playing fire',boundary=>{
    const {engine,inside,sources,options}=fixture();const dispose=engine.playHighMultiplierFire(options);
    if(boundary==='volume')engine.setVolume('sfx',0);
    if(boundary==='master')engine.setVolume('master',0);
    if(boundary==='mute')engine.muted=true;
    if(boundary==='background')engine.setSuspended(true);
    if(boundary==='scene')engine.setScene('table');
    if(boundary==='cancel')engine.cancelPresentation();
    if(boundary==='score-stop')engine.stopScoreFire();
    if(boundary==='dispose')dispose.stop();
    expect(inside.voices.size).toBe(0);expect(sources[0].disconnect).toHaveBeenCalledOnce();
    dispose.stop();engine.stopScoreFire();expect(sources[0].disconnect).toHaveBeenCalledOnce();
  });

  it('does not evict existing or already scheduled effects when the shared voice budget is full',()=>{
    const {engine,inside,sources,options}=fixture(),stop=vi.fn();
    for(let i=0;i<EFFECT_VOICE_BUDGET;i++)inside.voices.add({bus:'sfx',startsAt:i===0?1.5:1,endsAt:2,source:{stop}});
    engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(0);expect(inside.voices.size).toBe(EFFECT_VOICE_BUDGET);expect(stop).not.toHaveBeenCalled();
  });

  it('lets a full mix reclaim the fire before dropping a stronger score impact',()=>{
    const {engine,inside,sources,options}=fixture();
    engine.playHighMultiplierFire(options);
    const fire=[...inside.voices][0] as any,stop=vi.fn(),disconnect=vi.fn();
    for(let i=0;i<EFFECT_VOICE_BUDGET-1;i++)inside.voices.add({bus:'sfx',startsAt:1,endsAt:2,priority:i<2?0:4,source:{stop,disconnect},gain:{disconnect}});
    engine.scoreImpact({},'stronger-committed-event','multiply');
    expect(inside.voices.has(fire)).toBe(false);
    expect(sources).toHaveLength(4);
    expect([...inside.voices].filter((v:any)=>v.scoreAccent)).toHaveLength(3);
    expect(inside.voices.size).toBe(EFFECT_VOICE_BUDGET);
  });

  it('releases its voice and listener if starting the browser source fails',()=>{
    const {engine,inside,context,controller,options}=fixture(),original=context.createBufferSource;
    context.createBufferSource=()=>{const source=original();source.start.mockImplementation(()=>{throw new Error('device unavailable');});return source;};
    const remove=vi.spyOn(controller.signal,'removeEventListener');
    const dispose=engine.playHighMultiplierFire(options);
    expect(inside.voices.size).toBe(0);expect(remove).toHaveBeenCalledWith('abort',expect.any(Function));
    expect(()=>dispose.stop()).not.toThrow();
  });
});
