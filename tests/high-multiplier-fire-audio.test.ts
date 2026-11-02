import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AudioEngine,type HighMultiplierFireOptions} from '../src/audio/AudioEngine';
import {HIGH_MULTIPLIER_FIRE_SAMPLE} from '../src/audio/HighMultiplierFire';
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
  inside.scoreSamples.set(HIGH_MULTIPLIER_FIRE_SAMPLE.name,{name:HIGH_MULTIPLIER_FIRE_SAMPLE.name,duration:24});
  const controller=new AbortController();
  const options:HighMultiplierFireOptions={signal:controller.signal,speed:1,reducedMotion:false,replay:false};
  return {engine,inside,context,gains,sources,buffers,controller,options};
}

beforeEach(()=>{vi.stubGlobal('document',{hidden:false});vi.stubGlobal('window',{});});
afterEach(()=>vi.unstubAllGlobals());

describe('high multiplier flame audio',()=>{
  it('plays the decoded local fire asset as soon as it becomes available during the same flame',()=>{
    const {engine,inside,sources,options}=fixture(),asset=inside.scoreSamples.get(HIGH_MULTIPLIER_FIRE_SAMPLE.name);
    inside.scoreSamples.delete(HIGH_MULTIPLIER_FIRE_SAMPLE.name);inside.scoreSampleTask=new Promise(()=>{});
    const fire=engine.playHighMultiplierFire(options);engine.playHighMultiplierFire(options);expect(sources).toHaveLength(0);
    inside.scoreSamples.set(HIGH_MULTIPLIER_FIRE_SAMPLE.name,asset);for(const ready of inside.highMultiplierFireWaiters)ready();
    expect(sources).toHaveLength(1);expect(sources[0].buffer).toBe(asset);
    expect(HIGH_MULTIPLIER_FIRE_SAMPLE.runtimePath).toBe('assets/audio/high-multiplier/low-fire-v2.mp3');
    fire.fadeOut(450);expect(sources[0].stop).toHaveBeenCalled();
  });

  it.each(['fade','stop','abort','mute','volume','master','background','cancel','scene'] as const)('does not start a still-loading fire after %s',boundary=>{
    const {engine,inside,sources,controller,options}=fixture(),asset=inside.scoreSamples.get(HIGH_MULTIPLIER_FIRE_SAMPLE.name);
    inside.scoreSamples.delete(HIGH_MULTIPLIER_FIRE_SAMPLE.name);inside.scoreSampleTask=new Promise(()=>{});
    const fire=engine.playHighMultiplierFire(options);
    if(boundary==='fade')fire.fadeOut(450);
    if(boundary==='stop')fire.stop();
    if(boundary==='abort')controller.abort();
    if(boundary==='mute')engine.muted=true;
    if(boundary==='volume')engine.setVolume('sfx',0);
    if(boundary==='master')engine.setVolume('master',0);
    if(boundary==='background')engine.setSuspended(true);
    if(boundary==='cancel')engine.cancelPresentation();
    if(boundary==='scene')engine.setScene('table');
    engine.muted=false;engine.setVolume('sfx',.8);
    inside.scoreSamples.set(HIGH_MULTIPLIER_FIRE_SAMPLE.name,asset);for(const ready of inside.highMultiplierFireWaiters)ready();
    expect(sources).toHaveLength(0);expect(inside.pendingHighMultiplierFire).toBeUndefined();expect(inside.highMultiplierFireWaiters.size).toBe(0);
  });

  it('plays a fresh fire after unmuting without reviving the cancelled one',()=>{
    const {engine,inside,sources,options}=fixture(),asset=inside.scoreSamples.get(HIGH_MULTIPLIER_FIRE_SAMPLE.name);
    inside.scoreSamples.delete(HIGH_MULTIPLIER_FIRE_SAMPLE.name);inside.scoreSampleTask=new Promise(()=>{});
    engine.playHighMultiplierFire(options);engine.muted=true;engine.muted=false;
    inside.scoreSamples.set(HIGH_MULTIPLIER_FIRE_SAMPLE.name,asset);for(const ready of inside.highMultiplierFireWaiters)ready();
    expect(sources).toHaveLength(0);
    engine.playHighMultiplierFire(options);expect(sources).toHaveLength(1);
  });

  it('clears a failed pending load and allows the next flame to try again',async()=>{
    const {engine,inside,sources,options}=fixture(),asset=inside.scoreSamples.get(HIGH_MULTIPLIER_FIRE_SAMPLE.name);
    inside.scoreSamples.delete(HIGH_MULTIPLIER_FIRE_SAMPLE.name);inside.scoreSampleTask=Promise.resolve();
    engine.playHighMultiplierFire(options);await Promise.resolve();await Promise.resolve();
    expect(inside.pendingHighMultiplierFire).toBeUndefined();expect(inside.highMultiplierFireWaiters.size).toBe(0);
    inside.scoreSamples.set(HIGH_MULTIPLIER_FIRE_SAMPLE.name,asset);engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(1);
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
    expect(voice.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.08,context.currentTime+.28/speed);
    fire.fadeOut(450/speed);
    expect(source.stop).toHaveBeenCalledWith(context.currentTime+duration);
    expect(voice.gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0,context.currentTime+duration);
    expect(voice.peak).toBeLessThanOrEqual(.08);
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

  it('keeps a single fire, reuses the decoded asset, and makes stale disposers harmless',()=>{
    const {engine,inside,context,sources,options}=fixture();
    const first=engine.playHighMultiplierFire(options);
    for(let i=0;i<40;i++)engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(1);expect(inside.voices.size).toBe(1);
    first.stop();first.stop();expect(inside.voices.size).toBe(0);
    context.currentTime+=.1;
    const second=engine.playHighMultiplierFire(options);first.stop();
    expect(sources).toHaveLength(2);expect(sources[1].buffer).toBe(sources[0].buffer);expect(inside.voices.size).toBe(1);
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

  it('uses one dedicated fire slot without evicting full or already scheduled effects',()=>{
    const {engine,inside,sources,options}=fixture(),stop=vi.fn();
    for(let i=0;i<EFFECT_VOICE_BUDGET;i++)inside.voices.add({bus:'sfx',startsAt:i===0?1.5:1,endsAt:2,source:{stop}});
    engine.playHighMultiplierFire(options);
    expect(sources).toHaveLength(1);expect(inside.voices.size).toBe(EFFECT_VOICE_BUDGET+1);expect(stop).not.toHaveBeenCalled();
  });

  it('keeps the fire while a full mix reclaims weaker tails for a stronger score impact',()=>{
    const {engine,inside,sources,options}=fixture();
    engine.playHighMultiplierFire(options);
    const fire=[...inside.voices][0] as any,stop=vi.fn(),disconnect=vi.fn();
    for(let i=0;i<EFFECT_VOICE_BUDGET-1;i++)inside.voices.add({bus:'sfx',startsAt:1,endsAt:2,priority:i<2?0:4,source:{stop,disconnect},gain:{disconnect}});
    engine.scoreImpact({},'stronger-committed-event','multiply');
    expect(inside.voices.has(fire)).toBe(true);
    expect(sources).toHaveLength(4);
    expect([...inside.voices].filter((v:any)=>v.scoreAccent)).toHaveLength(3);
    expect(inside.voices.size).toBe(EFFECT_VOICE_BUDGET+1);
  });

  it('keeps the fire at the global retention cap by releasing the oldest other voice',()=>{
    const {engine,inside,options}=fixture();engine.playHighMultiplierFire(options);
    const fire=[...inside.voices][0],stop=vi.fn(),disconnect=vi.fn();
    for(let i=0;i<31;i++)inside.voices.add({bus:'sfx',source:{stop,disconnect},gain:{disconnect}});
    inside.retain({bus:'ui',source:{stop,disconnect},gain:{disconnect}});
    expect(inside.voices.has(fire)).toBe(true);expect(inside.voices.size).toBe(32);expect(stop).toHaveBeenCalledOnce();
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
