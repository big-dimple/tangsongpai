import {it,expect} from 'vitest';
import {heroAttachmentFixture} from '../harness/fixtures/hero-attachments';
import {energySend} from '../harness/fixtures/score-energy';
import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';
import {heroCardScoreStrikeCue} from '../src/game/JokerScoreStrike';
import {scorePhrase} from '../src/game/ScorePhrase';
import {savedScoreTargetIds,scorePerformanceCue,attachmentPerformanceCue} from '../src/game/ScorePerformance';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import type {HeroAttachmentPhaseEvent} from '../src/game/HeroAttachmentPhases';

it.each(['amo','erxiang','azao','xiemu','touye'] as const)('%s reuses saved source/instance targets and one descriptor for real arrival and rebound',hero=>{
 const f=heroAttachmentFixture(hero),state=energySend(f.state,f.action),score=state.lastTrace!,saved=savedHeroAttachment(score,hero)!,event=saved.event;
 const before=JSON.stringify(state),owner={state,score,replay:false},context={generation:3,signal:new AbortController().signal},beat=scorePhrase(score.events,'100',2,score).get(event.eventId)!;
 const impact=scorePerformanceCue(owner,event,context,beat,2,'impact')!,rebound=scorePerformanceCue(owner,event,context,{...beat,impact:40},2,'rebound')!;
 expect(impact.owner).toBe(owner);expect(impact.signal).toBe(context.signal);expect(impact).toMatchObject({runId:state.runId,generation:3,sourceId:event.sourceInstanceId,eventId:event.eventId,targetIds:saved.targetIds??[],speed:2,replay:false});
 expect(rebound).toMatchObject({owner,runId:impact.runId,generation:3,sourceId:impact.sourceId,eventId:impact.eventId,targetIds:impact.targetIds,signal:impact.signal});
 expect(JSON.stringify(state)).toBe(before);
});

it('candidate retention has no fabricated score event; its later ordinary card points retain card ownership',()=>{
 const f=heroAttachmentFixture('laohuan'),kept=energySend(f.state,f.action);expect(kept.lastTrace).toEqual(f.state.lastTrace);
 const state=energySend(kept,{type:'PlayHand',selectedIds:[f.selectedIds[0]]}),score=state.lastTrace!;
 const event=score.events.find(e=>e.sourceType==='card'&&e.targetCardId===f.selectedIds[0]&&e.operation==='add-heat')!;
 expect(savedScoreTargetIds(score,event)).toEqual([f.selectedIds[0]]);expect(heroCardScoreStrikeCue(score,event)).toBeUndefined();
});

it('the sample accepts one real saved handoff +M, rejecting forged/zero/cross-root and other hero arithmetic',()=>{
 const f=heroAttachmentFixture('erxiang'),state=energySend(f.state,f.action),score=state.lastTrace!,event=savedHeroAttachment(score,'erxiang')!.event;
 expect(heroCardScoreStrikeCue(score,event)).toMatchObject({eventId:event.eventId,sourceInstanceId:state.runId+'/character',contributions:[{target:'M',kind:'add'}]});
 for(const changed of [{...event,eventId:'forged'},{...event,after:event.before},{...event,rootId:'stale'},{...event,targetCardId:'not-real'},{...event,operation:'multiply-multiplier'}]){
  expect(heroCardScoreStrikeCue(score,changed)).toBeUndefined();expect(savedScoreTargetIds(score,changed)).toBeUndefined();
 }
 const abort=new AbortController();abort.abort();expect(scorePerformanceCue({state,score,replay:false},event,{generation:1,signal:abort.signal},scorePhrase(score.events,'100').get(event.eventId)!,1,'impact')).toBeUndefined();
});

it.each([1,2,4] as const)('the saved handoff uses phrase slots and a visible paired return at %sx; unrelated events keep their existing timing',speed=>{
 const f=heroAttachmentFixture('erxiang'),score=energySend(f.state,f.action).lastTrace!,event=savedHeroAttachment(score,'erxiang')!.event;
 const plain=scorePhrase(score.events,'100',speed),sample=scorePhrase(score.events,'100',speed,score),beat=sample.get(event.eventId)!;
 expect(beat.phrase?.paired).toBe(true);expect(beat.strike).toBeDefined();expect(beat.flight/speed).toBeGreaterThanOrEqual(60);
 const differences=score.events.filter(e=>e.eventId!==event.eventId&&sample.get(e.eventId)?.impact!==plain.get(e.eventId)?.impact);expect(differences).toEqual([]);
 let cursor=0;for(const e of score.events){const b=sample.get(e.eventId)!;expect(b.phrase!.start).toBe(cursor);expect(b.phrase!.arrival).toBe(cursor+b.windup+b.flight);cursor=b.phrase!.end;}
});

it('settlement carries the actual finalScore ID and replay flag rather than a constant award identifier',()=>{
 const f=heroAttachmentFixture('erxiang'),state=energySend(f.state,f.action),score=state.lastTrace!,event=score.events.find(e=>e.phase==='finalScore')!;
 const cue=scorePerformanceCue({state,score,replay:true},event,{generation:2,signal:new AbortController().signal},scorePhrase(score.events,'100').get(event.eventId)!,4,'settle')!;
 expect(cue).toMatchObject({eventId:event.eventId,sourceId:event.sourceInstanceId,phase:'settle',targetIds:[],replay:true});expect(cue.eventId).not.toBe('award');
});

it.each(['amo','erxiang','azao','xiemu','touye','laohuan'] as const)('%s visual observations preserve real receipt identity; previews, resume and local settle cannot create score sound',async hero=>{
 const f=await currentHeroReceipt(hero),context={generation:5,signal:new AbortController().signal},owner={state:f.after,score:f.trace,replay:false,generation:5};
 const event=f.cue?.event,beat=event?scorePhrase(f.trace.events,'100',1,f.trace).get(event.eventId)!:{windup:0,flight:0,impact:160,rest:0};
 const observation:HeroAttachmentPhaseEvent={owner:hero==='amo'?'discard':'card',activationId:f.eventId,eventId:event?.eventId,reasonKey:event?.reasonKey??'laohuan.refill',targetIds:f.targetIds,sourceTargetIds:f.targetIds,motion:'full',context,phase:'source'};
 const cue=attachmentPerformanceCue(owner,observation,beat,1);
 if(hero==='laohuan')expect(cue).toBeUndefined();else expect(cue).toMatchObject({owner,sourceId:event!.sourceInstanceId,eventId:event!.eventId,targetIds:hero==='amo'?f.trace.sets.activeScoringIds:hero==='erxiang'?[event!.targetCardId]:f.targetIds,phase:'activate'});
 for(const phase of ['committed','attached','impact','settled','suspended','resumed','cancelled'] as const)expect(attachmentPerformanceCue(owner,{...observation,phase},beat,1)).toBeUndefined();
 for(const wrong of [{eventId:undefined},{sourceTargetIds:[]},{targetIds:['not-saved']},{motion:'reduced' as const},{context:{...context,generation:6}},{context:undefined}])expect(attachmentPerformanceCue(owner,{...observation,...wrong},beat,1)).toBeUndefined();
});
