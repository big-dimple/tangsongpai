import {afterEach,describe,expect,it,vi} from 'vitest';
import {AudioEngine,OPENING_MOTIF_OFFSET} from '../src/audio/AudioEngine';
import {FOLEY,FOLEY_SAMPLES,MOTIF_GONG,PENTA_PITCH} from '../src/audio/foley';
import {MAX_RECORDED_RATE,SCORE_GAIN_BUDGET} from '../src/audio/mixPolicy';
import {STAGE_ROOM,connectStageRoom,stageRoomImpulse} from '../src/audio/stageRoom';

afterEach(()=>vi.unstubAllGlobals());
const param=(value=1)=>({value,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()});
const node=(kind:string)=>({kind,gain:param(),connect:vi.fn(),disconnect:vi.fn()});
/** A context with a convolver, as real browsers provide. */
function roomContext(){
  const created:any[]=[];
  const context:any={sampleRate:48000,currentTime:2,state:'running',
    createGain:()=>{const n=node('gain');created.push(n);return n;},
    createConvolver:()=>{const n={...node('convolver'),buffer:null as unknown,normalize:false};created.push(n);return n;},
    createBuffer:(channels:number,length:number,rate:number)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {channels,length,rate,getChannelData:(i:number)=>data[i]};}};
  return {context,created};
}
/** The engine fixture used by the other audio suites: a dry context without a convolver. */
function fixture(){
  vi.stubGlobal('document',{hidden:false});const sources:any[]=[];
  const gain=()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()});
  const engine=new AudioEngine(),inside=engine as any;
  inside.context={currentTime:1,state:'running',createGain:gain,createOscillator:vi.fn(()=>{throw Error('no synthesis');}),createBiquadFilter:()=>({type:'',Q:param(),frequency:param(),connect:vi.fn(),disconnect:vi.fn()}),
    createBufferSource:()=>{const source={buffer:null as any,playbackRate:param(),start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),onended:null};sources.push(source);return source;}};
  inside.gains={master:gain(),sfx:gain(),ui:gain(),music:gain()};inside.unlocked=true;
  for(const name of [...FOLEY_SAMPLES.map(a=>a.name),'cloth2'])inside.scoreSamples.set(name,{name,duration:.55});
  return {engine,inside,sources};
}
const pitches=(kind:keyof typeof FOLEY)=>FOLEY[kind].layers.map(layer=>({hz:PENTA_PITCH[layer.samples[0] as keyof typeof PENTA_PITCH]*(layer.rate??1),delay:layer.delay??0,gain:layer.gain,rate:layer.rate??1}));
const cents=(a:number,b:number)=>1200*Math.log2(a/b);

describe('small timber stage room',()=>{
  it('is a short, dark, deterministic impulse with no click at either end',()=>{
    const [left,right]=stageRoomImpulse(48000),[again]=stageRoomImpulse(48000);
    expect(left.length).toBe(Math.round(STAGE_ROOM.seconds*48000));expect(STAGE_ROOM.seconds).toBeLessThanOrEqual(.5);
    expect([...left.subarray(0,400)]).toEqual([...again.subarray(0,400)]);expect([...left.subarray(2000,2400)]).not.toEqual([...right.subarray(2000,2400)]);
    for(const data of [left,right]){
      expect(data.every(Number.isFinite)).toBe(true);
      // Unit energy: the return level equals the send level, independent of the browser.
      expect(data.reduce((sum,v)=>sum+v*v,0)).toBeCloseTo(1,4);expect(Math.max(...data.map(Math.abs))).toBeLessThan(.5);
      // Pre-delay is silent and the cut end has faded out.
      expect(data.subarray(0,Math.round(STAGE_ROOM.preDelay*48000)-1).every(v=>v===0)).toBe(true);expect(Math.abs(data[data.length-1])).toBeLessThan(1e-3);
      const rms=(from:number,to:number)=>Math.sqrt(data.subarray(Math.floor(from*data.length),Math.floor(to*data.length)).reduce((s,v)=>s+v*v,0)/((to-from)*data.length));
      expect(rms(.75,1)).toBeLessThan(rms(0,.25)*.05);
      // The tail loses its top end: fewer zero crossings late than early.
      const crossings=(from:number,to:number)=>{let n=0;for(let i=Math.floor(from*data.length)+1;i<Math.floor(to*data.length);i++)if(data[i-1]<0!==data[i]<0)n++;return n;};
      expect(crossings(.6,.9)).toBeLessThan(crossings(.05,.35));
    }
    expect(stageRoomImpulse(Number.NaN)[0].length).toBe(Math.round(STAGE_ROOM.seconds*48000));
  });
  it('sends effects and UI through one room ahead of the master, and stays dry where unsupported',()=>{
    const sfx=node('sfx'),ui=node('ui'),master=node('master');
    expect(connectStageRoom({sampleRate:48000,createGain:()=>node('gain')} as any,sfx as any,ui as any,master as any)).toBeUndefined();expect(sfx.connect).not.toHaveBeenCalled();
    const {context,created}=roomContext(),room=connectStageRoom(context,sfx as any,ui as any,master as any)!;
    const convolver=created.find(n=>n.kind==='convolver'),[sfxSend,uiSend,back]=created.filter(n=>n.kind==='gain');
    expect(convolver.buffer.channels).toBe(2);expect(convolver.buffer.length).toBe(Math.round(STAGE_ROOM.seconds*48000));expect(convolver.normalize).toBe(false);
    expect(sfxSend.gain.value).toBe(STAGE_ROOM.sfxSend);expect(uiSend.gain.value).toBe(STAGE_ROOM.uiSend);expect(STAGE_ROOM.sfxSend).toBeLessThanOrEqual(.2);
    expect(sfx.connect).toHaveBeenCalledWith(sfxSend);expect(ui.connect).toHaveBeenCalledWith(uiSend);expect(sfxSend.connect).toHaveBeenCalledWith(convolver);expect(uiSend.connect).toHaveBeenCalledWith(convolver);
    expect(convolver.connect).toHaveBeenCalledWith(back);expect(back.connect).toHaveBeenCalledWith(master);
    room.close(3);expect(back.gain.setValueAtTime).toHaveBeenLastCalledWith(0,3);
    room.open(4,.45);expect(back.gain.setValueAtTime.mock.calls.slice(-2)).toEqual([[0,4],[0,4.45]]);expect(back.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1,4.45+STAGE_ROOM.reopenRamp);
  });
  it('builds the room with the application context, keeps music dry and closes it for mute, zero volume and background',()=>{
    vi.stubGlobal('document',{hidden:false});
    const {context,created}=roomContext();
    Object.assign(context,{addEventListener:vi.fn(),resume:vi.fn(async()=>{}),suspend:vi.fn(async()=>{}),
      createDynamicsCompressor:()=>({threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect:vi.fn()}),
      createWaveShaper:()=>({curve:null,oversample:'',connect:vi.fn()})});
    vi.stubGlobal('window',{AudioContext:function(){return context;}});
    const engine=new AudioEngine(),inside=engine as any;inside.ensureContext();
    const convolver=created.find(n=>n.kind==='convolver'),gains=inside.gains,sends=created.filter(n=>n.kind==='gain'&&n.connect.mock.calls.some((c:any[])=>c[0]===convolver));
    expect(sends).toHaveLength(2);expect(gains.sfx.connect.mock.calls.map((c:any[])=>c[0])).toContain(sends[0]);expect(gains.ui.connect.mock.calls.map((c:any[])=>c[0])).toContain(sends[1]);
    expect(gains.music.connect.mock.calls.map((c:any[])=>c[0])).toEqual([gains.master]);
    const back=created.find(n=>n.kind==='gain'&&n.connect.mock.calls.some((c:any[])=>c[0]===gains.master)&&!Object.values(gains).includes(n));
    const zeroed=()=>back.gain.setValueAtTime.mock.calls.filter((c:number[])=>c[0]===0&&c[1]===context.currentTime).length;
    engine.muted=true;expect(zeroed()).toBe(1);expect(back.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    engine.muted=false;expect(back.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1,context.currentTime+STAGE_ROOM.reopenAfter+STAGE_ROOM.reopenRamp);
    const reopened=back.gain.linearRampToValueAtTime.mock.calls.length;
    engine.setVolume('sfx',0);engine.setVolume('sfx',0);expect(back.gain.linearRampToValueAtTime.mock.calls).toHaveLength(reopened);
    engine.setVolume('sfx',.5);engine.setVolume('sfx',.6);expect(back.gain.linearRampToValueAtTime.mock.calls).toHaveLength(reopened+1);
    engine.setSuspended(true);expect(back.gain.setValueAtTime).toHaveBeenLastCalledWith(0,context.currentTime);
    engine.setSuspended(false);expect(back.gain.linearRampToValueAtTime.mock.calls).toHaveLength(reopened+2);
    // A skipped presentation hushes the room once and lets it return.
    engine.cancelPresentation();expect(back.gain.linearRampToValueAtTime.mock.calls).toHaveLength(reopened+3);
  });
});

describe('Tang-Song motif and stage seal',()=>{
  it('tunes every phrase from recorded pentatonic tones within the decoder range and the mix budget',()=>{
    for(const kind of ['motifOpen','motifCloseTable','motifCloseBoss'] as const){
      const notes=pitches(kind);
      for(const note of notes){expect(note.rate).toBeGreaterThanOrEqual(.65);expect(note.rate).toBeLessThanOrEqual(MAX_RECORDED_RATE);expect(note.gain).toBeLessThanOrEqual(.022);}
      expect(notes.reduce((sum,n)=>sum+n.gain,0)).toBeLessThanOrEqual(SCORE_GAIN_BUDGET);
      expect(FOLEY[kind].layers.every(layer=>layer.samples.length===1&&layer.samples[0] in PENTA_PITCH)).toBe(true);
    }
  });
  it('opens with zhi–yu–gong–shang–jiao rising to the upper gong, in the key of the menu recording',()=>{
    const notes=pitches('motifOpen'),gong=MOTIF_GONG.menu;
    expect(notes.map(n=>Math.round(cents(n.hz,gong)))).toEqual([-500,-300,0,200,400,1200]);
    for(let i=1;i<notes.length;i++){expect(notes[i].hz).toBeGreaterThan(notes[i-1].hz);expect(notes[i].delay).toBeGreaterThan(notes[i-1].delay);}
    expect(notes[5].gain).toBeGreaterThan(notes[0].gain);
  });
  it.each([['motifCloseTable','table'],['motifCloseBoss','boss']] as const)('closes %s with shang falling to gong over a gong one octave below',(kind,scene)=>{
    const [shang,gong,pad]=pitches(kind),tonic=MOTIF_GONG[scene];
    expect(Math.round(cents(shang.hz,tonic))).toBe(200);expect(Math.round(cents(gong.hz,tonic))).toBe(0);expect(Math.round(cents(pad.hz,tonic))).toBe(-1200);
    expect(gong.delay).toBeGreaterThan(shang.delay);expect(pad.delay).toBe(gong.delay);
  });
  it('plays the opening motif once per page load, clear of the confirm and curtain attacks',()=>{
    const {engine,sources}=fixture();
    engine.titleConfirm();engine.curtainOpen();const before=sources.length;
    engine.openingMotif();const motif=sources.slice(before);
    expect(motif.map(s=>s.buffer.name)).toEqual(FOLEY.motifOpen.layers.map(layer=>layer.samples[0]));
    const starts=(list:any[])=>list.map(s=>s.start.mock.calls[0][0] as number),earlier=starts(sources.slice(0,before));
    expect(Math.min(...starts(motif))).toBeCloseTo(1+OPENING_MOTIF_OFFSET,6);
    for(const at of starts(motif))for(const attack of earlier)expect(Math.abs(at-attack)).toBeGreaterThanOrEqual(.04);
    engine.openingMotif();expect(sources).toHaveLength(before+motif.length);
  });
  it('keeps the opening motif for a later entry when sound was off the first time',()=>{
    const {engine,sources}=fixture();engine.muted=true;engine.openingMotif();expect(sources).toHaveLength(0);
    engine.muted=false;engine.openingMotif();expect(sources).toHaveLength(FOLEY.motifOpen.layers.length);
  });
  it('lands the seal as wood, table and the closing motif only: no bell, no synthesis',()=>{
    const {engine,inside,sources}=fixture();engine.sealStamp();
    expect(sources.map(s=>s.buffer.name)).toEqual(['impactWood_heavy_000','impactSoft_heavy_000',...FOLEY.motifCloseTable.layers.map(l=>l.samples[0])]);
    expect(sources.some(s=>/bell/i.test(s.buffer.name))).toBe(false);expect(inside.context.createOscillator).not.toHaveBeenCalled();
    // The motif follows the landing instead of masking it.
    const starts=sources.map(s=>s.start.mock.calls[0][0] as number);expect(Math.min(...starts.slice(2))).toBeGreaterThanOrEqual(starts[0]+.08);
    const boss=fixture();boss.engine.sealStamp(true);
    expect(boss.sources.slice(2).map(s=>s.playbackRate.value)).toEqual(FOLEY.motifCloseBoss.layers.map(l=>l.rate));
    expect(boss.sources[0].playbackRate.value).toBeLessThan(sources[0].playbackRate.value);
    engine.cancelPresentation();expect(inside.voices.size).toBe(0);
  });
  it('follows the faster presentation and every silence preference',()=>{
    const fast=fixture();fast.engine.sealStamp(false,4);const normal=fixture();normal.engine.sealStamp(false,1);
    const gap=(list:any[])=>list[3].start.mock.calls[0][0]-list[0].start.mock.calls[0][0];
    expect(gap(fast.sources)).toBeCloseTo(gap(normal.sources)/2,6);
    const muted=fixture();muted.engine.muted=true;muted.engine.sealStamp();expect(muted.sources).toHaveLength(0);
    const silent=fixture();silent.engine.setVolume('sfx',0);silent.engine.sealStamp();silent.engine.openingMotif();expect(silent.sources).toHaveLength(0);
    const hidden=fixture();hidden.engine.setSuspended(true);hidden.engine.sealStamp(true);expect(hidden.sources).toHaveLength(0);
  });
});
