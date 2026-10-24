import type {ScoreTrace} from '../domain/scoreR2';
import {Rational} from '../domain/rational';
import {scoreArrivalKind} from './mixPolicy';

/** Structural subset of ScoreBeat; the presentation owns its clock and phases. */
export interface PerformanceAudioBeat {
 windup:number;flight:number;impact:number;rest:number;
 phrase?:{paired?:boolean;accentWeight?:number;notePulse?:number;pulse?:number};
}
export interface PerformanceAudioCue {
 owner:object;runId:string;generation:number;eventId:string;sourceId:string;
 phase:'activate'|'impact'|'rebound'|'settle';targetIds:readonly string[];
 beat:PerformanceAudioBeat;signal:AbortSignal;replay:boolean;
 speed?:1|2|4;kind?:'add'|'key'|'multiply';tier?:number;chain?:number;
}
export function performanceAudioFacts(cue:PerformanceAudioCue){
 if(!cue.owner||typeof cue.owner!=='object'||typeof cue.runId!=='string'||!cue.runId||typeof cue.eventId!=='string'||!cue.eventId||typeof cue.sourceId!=='string'||!cue.sourceId||typeof cue.replay!=='boolean'||!Number.isSafeInteger(cue.generation)||cue.generation<0||
  !['activate','impact','rebound','settle'].includes(cue.phase)||!cue.signal||typeof cue.signal.addEventListener!=='function'||
  !Array.isArray(cue.targetIds)||cue.targetIds.some(id=>typeof id!=='string'||!id)||new Set(cue.targetIds).size!==cue.targetIds.length||
  !cue.beat||[cue.beat.windup,cue.beat.flight,cue.beat.impact,cue.beat.rest].some(n=>!Number.isFinite(n)||n<0)||cue.kind!==undefined&&!['add','key','multiply'].includes(cue.kind))return;
 const owner=cue.owner as {score?:ScoreTrace;runId?:string;generation?:number;state?:{runId?:string}};
 const run=owner.state?.runId??owner.runId;if(run!==undefined&&run!==cue.runId)return;
 if(owner.generation!==undefined&&owner.generation!==cue.generation)return;
 const speed=cue.speed===2||cue.speed===4?cue.speed:1,durationMs=cue.beat.impact/speed;
 if(cue.phase==='activate')return {kind:'key' as const,durationMs};
 const score=owner.score;if(!Array.isArray(score?.events)||!score.rootId)return;
 const event=score.events.find(e=>e.eventId===cue.eventId);
 if(!score||!event||event.rootId!==score.rootId||event.sourceInstanceId!==cue.sourceId)return;
 if(cue.phase==='settle')return event.phase==='finalScore'?{kind:'award' as const,durationMs}:undefined;
 if(['base','finalScore','afterHand','onStageClear','beforeFailure'].includes(event.phase))return;
 try {
  if(Rational.fromJSON(event.after.H).compare(Rational.fromJSON(event.before.H))<=0&&Rational.fromJSON(event.after.M).compare(Rational.fromJSON(event.before.M))<=0)return;
  return {kind:scoreArrivalKind(owner,cue.eventId,cue.kind??'add'),durationMs};
 }catch{return;}
}
