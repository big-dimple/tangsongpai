import type {PerformanceAudioCue} from '../audio/PerformanceAudio';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {CHARACTER_IDS,type CharacterId} from '../domain/characters';
import {savedHeroAttachment} from './HeroAttachmentFacts';
import type {HeroAttachmentPhaseEvent} from './HeroAttachmentPhases';
import {scoreContributions} from './ScoreContribution';
import {Rational} from '../domain/rational';
import {heroScoreAction} from './HeroScoreAction';

/** Card instance endpoints of a saved score event, never an inferred hero multiplier. */
export function savedScoreTargetIds(trace:ScoreTrace,event:ScoreEvent):string[]|undefined {
 if(event.rootId!==trace.rootId||!trace.events.some(e=>e===event||e.eventId===event.eventId&&JSON.stringify(e)===JSON.stringify(event)))return;
 if(event.targetCardId)return trace.cards.some(c=>c.id===event.targetCardId)?[event.targetCardId]:undefined;
 if(event.sourceType==='character'&&CHARACTER_IDS.includes(event.sourceDefinitionId as CharacterId)){
  const action=heroScoreAction(trace,event);if(action)return [...action.targetIds];
  const saved=savedHeroAttachment(trace,event.sourceDefinitionId as CharacterId);
  if(saved?.event.eventId===event.eventId)return [...new Set(saved.targetIds??[])];
 }
 return [];
}

/** One event descriptor, reused by its real arrival and rebound callbacks.
 * It schedules nothing. Audio owns admission/dedup; EffectQueue owns cancellation. */
export function scorePerformanceCue(owner:{state:{runId:string};score:ScoreTrace;replay:boolean},event:ScoreEvent,
 context:{generation:number;signal:AbortSignal},beat:PerformanceAudioCue['beat'],speed:1|2|4,
 phase:PerformanceAudioCue['phase'],number?:Pick<PerformanceAudioCue,'kind'|'tier'|'chain'>):PerformanceAudioCue|undefined {
 const targetIds=savedScoreTargetIds(owner.score,event);if(!targetIds||context.signal.aborted)return;
 return {owner,runId:owner.state.runId,generation:context.generation,eventId:event.eventId,sourceId:event.sourceInstanceId,targetIds,beat,speed,
  signal:context.signal,replay:owner.replay,phase,...number};
}

/** Only a real saved hero source stream can activate score audio. Availability,
 * preview and local cleanup phases are observations, never extra beats or awards. */
export function attachmentPerformanceCue(owner:{state:{runId:string};score:ScoreTrace;replay:boolean;generation:number},
 observation:HeroAttachmentPhaseEvent,beat:PerformanceAudioCue['beat'],speed:1|2|4):PerformanceAudioCue|undefined {
 const context=observation.context;
 if(observation.phase!=='source'||observation.motion!=='full'||!context||context.generation!==owner.generation||!observation.eventId||!observation.sourceTargetIds.length)return;
 const event=owner.score.events.find(e=>e.eventId===observation.eventId);
 if(!event||event.sourceType!=='character'||!scoreContributions(event).some(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))>0))return;
 const targets=savedScoreTargetIds(owner.score,event);
 const costs=heroScoreAction(owner.score,event)?.costIds??[];
 const group=owner.score.erxiangGroup&&event.reasonKey==='erxiang.handoff'?savedHeroAttachment(owner.score,'erxiang')?.targetIds??[]:[];
 if(!targets||observation.targetIds.some(id=>!targets.includes(id)&&!costs.includes(id)&&!group.includes(id))||observation.sourceTargetIds.some(id=>!observation.targetIds.includes(id)))return;
 return scorePerformanceCue(owner,event,context,beat,speed,'activate');
}
