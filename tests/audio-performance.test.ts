import {afterEach,expect,it,vi} from 'vitest';
import {AudioEngine} from '../src/audio/AudioEngine';
import type {PerformanceAudioCue} from '../src/audio/PerformanceAudio';
import {FOLEY_SAMPLES} from '../src/audio/foley';
import {EFFECT_VOICE_BUDGET,SCORE_GAIN_BUDGET,SCORE_VOICE_BUDGET} from '../src/audio/mixPolicy';
import {actualMultiplier} from '../src/domain/openingShow';
import {Rational} from '../src/domain/rational';
import {scoreEnergyFixture,energySend} from '../harness/fixtures/score-energy';
import {heroAttachmentFixture} from '../harness/fixtures/hero-attachments';
import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';

const fixture=()=>{
 vi.stubGlobal('document',{hidden:false});vi.stubGlobal('window',{});vi.useFakeTimers();
 const sources:any[]=[],param=()=>({value:1,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()}),gain=()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()});
 const engine=new AudioEngine(),inside=engine as any;
 const context={currentTime:1,state:'running',resume:vi.fn(async()=>{}),suspend:vi.fn(async()=>{}),createGain:gain,createBufferSource:()=>{const source={buffer:null,playbackRate:param(),start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),onended:null};sources.push(source);return source;}};
 inside.context=context;inside.gains={master:gain(),sfx:gain(),ui:gain(),music:gain()};inside.unlocked=true;inside.loadScoreSamples=vi.fn(async()=>{});
 for(const name of [...FOLEY_SAMPLES.map(s=>s.name),'cloth2'])inside.scoreSamples.set(name,{name,duration:.8});
 const f=scoreEnergyFixture('multiply'),state=energySend(f.state,{type:'PlayAssistedHand',selectedIds:f.selectedIds,assistIds:f.assistIds}),score=state.lastTrace!,owner={state,score};
 const event=score.events.find(e=>actualMultiplier(e))!,controller=new AbortController();
 const cue:PerformanceAudioCue={owner,runId:state.runId,generation:7,eventId:event.eventId,sourceId:event.sourceInstanceId,phase:'impact',targetIds:event.targetCardId?[event.targetCardId]:[...score.sets.activeScoringIds],
  beat:{windup:80,flight:60,impact:300,rest:30,phrase:{paired:true,accentWeight:.6,notePulse:2}},signal:controller.signal,replay:false};
 return {engine,inside,context,sources,state,score,owner,event,controller,cue};
};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

it('paired musical impacts keep a higher pentatonic rebound and recorded bell at every pulse',()=>{
 for(let pulse=0;pulse<5;pulse++){
  const {engine,context,sources,cue}=fixture();engine.consumePerformance({...cue,beat:{...cue.beat,phrase:{...cue.beat.phrase,notePulse:pulse}}});
  const first=sources.find(s=>s.buffer.name.startsWith('sfx-penta-'));expect(first).toBeDefined();expect(first.playbackRate.value).toBe(.75);const count=sources.length;
  context.currentTime+=.075;engine.consumePerformance({...cue,phase:'rebound',beat:{...cue.beat,phrase:{...cue.beat.phrase,notePulse:(pulse+2)%5}}});
  const second=sources.slice(count),note=second.find(s=>s.buffer.name.startsWith('sfx-penta-'));
  expect(note?.buffer.name).toBe(first.buffer.name);expect(note.playbackRate.value).toBeGreaterThan(first.playbackRate.value);
  expect(second.some(s=>s.buffer.name.startsWith('impactBell_'))).toBe(true);expect(second.every(s=>s.start.mock.calls[0][0]===1.075)).toBe(true);
  expect(sources.every(s=>s.playbackRate.value<=1.14)).toBe(true);
 }
});
it('paired ordinary arrivals retain a physical body and true multiplication stays heavier',()=>{
 const {engine,inside,context}=fixture();engine.scoreImpact({},'ordinary','add',0,0,{paired:true,accentWeight:1});
 const ordinary=[...inside.voices] as any[];expect(ordinary.some(v=>v.source.buffer.name==='impactSoft_heavy_000')).toBe(true);
 const gain=ordinary.reduce((n,v)=>n+v.nominalGain,0);context.currentTime+=1;engine.scoreImpact({},'multiply','multiply',0,0,{paired:true,accentWeight:1});
 const multiply=[...inside.voices].filter((v:any)=>v.startsAt===2) as any[];expect(multiply.reduce((n,v)=>n+v.nominalGain,0)).toBeGreaterThan(gain);
});
it('an impact rejected by the voice budget cannot produce an orphan rebound after capacity returns',()=>{
 const {engine,inside,sources,cue,context}=fixture();
 for(let i=0;i<EFFECT_VOICE_BUDGET;i++)inside.voices.add({bus:'sfx',priority:4,semantic:'award',startsAt:1,endsAt:2});
 engine.consumePerformance(cue);expect(sources).toHaveLength(0);inside.voices.clear();context.currentTime+=.075;
 engine.consumePerformance({...cue,phase:'rebound'});expect(sources).toHaveLength(0);
});

it('uses one saved identity for immediate impact and actual rebound callbacks, without a timer or duplicate layers',async()=>{
 const {engine,sources,context,cue}=fixture();engine.consumePerformance({...cue,generation:999,phase:'rebound'});expect(sources).toHaveLength(0);
 engine.consumePerformance(cue);expect(sources.map(s=>s.buffer.name)).toEqual(['impactGlass_heavy_002','sfx-wardrum-mult-hit','sfx-penta-3-jiao']);
 expect(sources.every(s=>s.start.mock.calls[0][0]===1)).toBe(true);engine.consumePerformance({...cue,kind:'key'});expect(sources).toHaveLength(3);
 await vi.advanceTimersByTimeAsync(60000);expect(sources).toHaveLength(3);expect(vi.getTimerCount()).toBe(0);
 context.currentTime=1.09;engine.consumePerformance({...cue,phase:'rebound'});expect(sources).toHaveLength(5);expect(sources[4].buffer.name).toMatch(/^impactBell_/);expect(sources.slice(3).every(s=>s.start.mock.calls[0][0]===1.09)).toBe(true);
 engine.consumePerformance({...cue,phase:'rebound'});expect(sources).toHaveLength(5);
});

it.each([1,2,4] as const)('keeps the body and crisp envelopes separate inside the %sx shared impact window',speed=>{
 const {engine,inside,sources,cue}=fixture();engine.consumePerformance({...cue,speed});
 const voices=[...inside.voices] as any[],body=voices.find(v=>v.source.buffer.name==='sfx-wardrum-mult-hit'),crisp=voices.find(v=>v.source.buffer.name.includes('Glass'));
 expect(body.endsAt-body.startsAt).toBeCloseTo(Math.min(.14,.3/speed));expect(crisp.endsAt-crisp.startsAt).toBeCloseTo(.045);
 expect(sources.every(s=>s.start.mock.calls[0][0]===1)).toBe(true);expect(body.endsAt-body.startsAt).toBeGreaterThan(crisp.endsAt-crisp.startsAt);
});

it('ordinary saved +M cannot become a multiply accent even when the caller labels it multiply',()=>{
 const {engine,sources,cue}=fixture(),f=heroAttachmentFixture('erxiang'),state=energySend(f.state,f.action),score=state.lastTrace!,add=savedHeroAttachment(score,'erxiang')!.event;
 expect(add.operation).toBe('add-multiplier');expect(actualMultiplier(add)).toBeUndefined();expect(Rational.fromJSON(add.after.M).compare(Rational.fromJSON(add.before.M))).toBeGreaterThan(0);
 engine.consumePerformance({...cue,owner:{state,score},runId:state.runId,eventId:add.eventId,sourceId:add.sourceInstanceId,targetIds:[f.targetId!],kind:'multiply'});
 expect(sources.length).toBeGreaterThan(0);expect(sources.some(s=>/Glass|wardrum/.test(s.buffer.name))).toBe(false);
});

it.each(['amo','touye','laohuan','erxiang','azao','xiemu'] as const)('%s consumes actual saved command facts without inventing a multiplier for retained cards',hero=>{
 const {engine,sources,cue}=fixture(),f=heroAttachmentFixture(hero),state=energySend(f.state,f.action);
 if(hero==='laohuan'){
  expect(state.lastTrace).toEqual(f.state.lastTrace);
  engine.consumePerformance({...cue,owner:{state},runId:state.runId,eventId:state.receipts.at(-1)!.commandId+'/laohuan-refill',sourceId:state.runId+'/character',phase:'activate',targetIds:f.targetIds});
  expect(sources).toHaveLength(2);expect(sources.some(s=>/Glass|wardrum/.test(s.buffer.name))).toBe(false);return;
 }
 const score=state.lastTrace!,saved=savedHeroAttachment(score,hero)!;expect(saved).toBeDefined();
 engine.consumePerformance({...cue,owner:{state,score},runId:state.runId,eventId:saved.event.eventId,sourceId:saved.event.sourceInstanceId,targetIds:saved.targetIds??[],kind:'multiply'});
 expect(sources.length).toBeGreaterThan(0);expect(sources.some(s=>s.buffer.name==='sfx-wardrum-mult-hit')).toBe(!!actualMultiplier(saved.event));
});

it('saved action IDs are independent from candidate and score IDs; selection refreshes cannot replay an activation',()=>{
 const {engine,inside,sources,cue}=fixture(),owner={runId:cue.runId};
 const activate={...cue,owner,eventId:'saved-discard/xin-refill-lock',phase:'activate' as const,targetIds:[]};engine.consumePerformance(activate);const count=sources.length;expect(count).toBe(2);
 for(let i=0;i<20;i++)engine.consumePerformance(activate);expect(sources).toHaveLength(count);expect(sources.every(s=>!/Glass|wardrum|temple/.test(s.buffer.name))).toBe(true);
 inside.context.currentTime+=.2;engine.consumePerformance({...activate,eventId:'saved-refill/laohuan-refill',targetIds:['actual/retained']});expect(sources).toHaveLength(count+2);
});

it('only the real final-score event can request the saved-score award, once',()=>{
 const {engine,sources,cue,score}=fixture();engine.consumePerformance({...cue,phase:'settle',eventId:'award'});engine.consumePerformance({...cue,phase:'settle'});expect(sources).toHaveLength(0);
 const final=score.events.find(e=>e.phase==='finalScore')!;engine.consumePerformance({...cue,eventId:final.eventId,sourceId:final.sourceInstanceId,phase:'settle',targetIds:[]});const count=sources.length;expect(count).toBeGreaterThan(0);
 engine.consumePerformance({...cue,eventId:final.eventId,sourceId:final.sourceInstanceId,phase:'settle',targetIds:[]});expect(sources).toHaveLength(count);
});

it('cross-run, generation, signal and target mismatches cannot steal an armed rebound',()=>{
 const {engine,sources,cue,context}=fixture();engine.consumePerformance(cue);const count=sources.length;
 for(const wrong of [{runId:'other-run'},{generation:8},{sourceId:'wrong/source'},{signal:new AbortController().signal},{targetIds:['wrong/card']},{targetIds:[...cue.targetIds,...cue.targetIds]}])engine.consumePerformance({...cue,...wrong,phase:'rebound'});
 expect(sources).toHaveLength(count);context.currentTime+=.09;engine.consumePerformance({...cue,phase:'rebound'});expect(sources).toHaveLength(count+2);
});

it.each(['abort','cancel','scene','mute','suspend','replay','zero','missing'] as const)('%s cannot produce a delayed impact or orphan rebound after recovery',boundary=>{
 const {engine,inside,sources,cue,controller,context}=fixture();
 if(boundary==='mute')engine.setVolume('sfx',0);if(boundary==='replay')cue.replay=true;if(boundary==='zero')cue.beat.impact=0;if(boundary==='missing')inside.scoreSamples.clear();
 engine.consumePerformance(cue);if(boundary==='abort')controller.abort();if(boundary==='cancel')engine.cancelPresentation();if(boundary==='scene')engine.setScene('shop');if(boundary==='suspend')engine.setSuspended(true);
 const count=sources.length;for(const name of FOLEY_SAMPLES.map(s=>s.name))inside.scoreSamples.set(name,{name,duration:.8});engine.setVolume('sfx',.8);context.currentTime+=.15;engine.setSuspended(false);
 engine.consumePerformance({...cue,replay:false,beat:{...cue.beat,impact:300}});engine.consumePerformance({...cue,replay:false,phase:'rebound'});expect(sources).toHaveLength(count);
});

it('the rebound retains the admitted first-hit pitch and weight even if later metadata changes',()=>{
 const {engine,inside,context,sources,cue}=fixture();engine.consumePerformance(cue);const rate=sources[2].playbackRate.value;
 context.currentTime+=.09;engine.consumePerformance({...cue,kind:'key',phase:'rebound',beat:{...cue.beat,phrase:{paired:true,accentWeight:1,notePulse:4}}});
 expect(sources[3].buffer.name).toBe('sfx-penta-3-jiao');expect(sources[3].playbackRate.value).toBeCloseTo(rate*2**(3/12),6);expect([...inside.voices].at(-1).nominalGain).toBeCloseTo(.012*.6,6);
});

it('unmuting allows future saved events of the same presentation without replaying its muted event',()=>{
 const {engine,context,sources,cue,score}=fixture();engine.setVolume('sfx',0);engine.consumePerformance(cue);engine.setVolume('sfx',.8);engine.consumePerformance(cue);expect(sources).toHaveLength(0);
 const next=score.events.find(e=>e.phase==='onCardScore'&&e.operation==='add-heat'&&e.value.n!=='0')!;
 context.currentTime+=.2;engine.consumePerformance({...cue,eventId:next.eventId,sourceId:next.sourceInstanceId,targetIds:[next.targetCardId!]});expect(sources.length).toBeGreaterThan(0);
});

it('cancel invalidates an old owner while a new run owner can play, without resetting preferences',()=>{
 const {engine,sources,cue,context}=fixture();engine.setVolume('music',.07);engine.setVolume('sfx',.81);engine.consumePerformance(cue);engine.cancelPresentation();const count=sources.length;
 context.currentTime+=.2;engine.consumePerformance({...cue,phase:'activate',eventId:'stale-activation'});expect(sources).toHaveLength(count);
 engine.consumePerformance({...cue,owner:{...cue.owner},generation:8});expect(sources.length).toBeGreaterThan(count);expect(engine.getVolume('music')).toBe(.07);expect(engine.getVolume('sfx')).toBe(.81);
});

it('long mixed activation/impact/rebound sequences keep the original global numeric caps and clean abort ownership',()=>{
 const {engine,inside,context,sources,cue,score,controller}=fixture(),saved=JSON.stringify(score);
 for(let i=0;i<60;i++){
  context.currentTime=1+i*.025;
  engine.consumePerformance({...cue,eventId:'saved/action/'+i,phase:'activate'});
  const event={...score.events.find(e=>e.eventId===cue.eventId)!,eventId:'saved/impact/'+i};
  // Controlled committed-event copies exercise overlap; no scene command/RNG is called.
  const owner={state:{runId:cue.runId},score:{...score,events:[event]}};const hit={...cue,owner,eventId:event.eventId};engine.consumePerformance(hit);engine.consumePerformance({...hit,phase:'rebound'});
  const active=[...inside.voices].filter((v:any)=>v.startsAt<=context.currentTime&&v.endsAt>context.currentTime) as any[];
  expect(active.length).toBeLessThanOrEqual(SCORE_VOICE_BUDGET);expect(active.reduce((n,v)=>n+v.nominalGain,0)).toBeLessThanOrEqual(SCORE_GAIN_BUDGET);
 }
 expect(JSON.stringify(score)).toBe(saved);expect(sources.every(s=>s.playbackRate.value<=1.14)).toBe(true);controller.abort();expect(inside.voices.size).toBe(0);
});
