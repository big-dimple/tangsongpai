import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {MAX_INTEGER_DIGITS,type Fraction} from '../domain/rational';

export interface ScoreHighMultiplierCue {
  rootId:string;
  eventId:string;
  kind:'one-shot'|'overkill-two-x';
  tier:1|2;
}

type ExactFraction={n:bigint;d:bigint};

/** Read persisted fractions without rounding, including values larger than Number. */
function exact(value:Fraction):ExactFraction|undefined {
  if(!value||typeof value.n!=='string'||typeof value.d!=='string'||
    !/^-?(0|[1-9]\d*)$/.test(value.n)||!/^[1-9]\d*$/.test(value.d)||
    value.n.replace(/^-/,'').length>MAX_INTEGER_DIGITS||value.d.length>MAX_INTEGER_DIGITS)return;
  return {n:BigInt(value.n),d:BigInt(value.d)};
}

function integerScore(value:unknown):bigint|undefined {
  return typeof value==='string'&&value.length<=MAX_INTEGER_DIGITS&&/^(0|[1-9]\d*)$/.test(value)?BigInt(value):undefined;
}

const scoringPhases:readonly ScoreEvent['phase'][]=['base','onCardScore','onHeldCard','characterScore','jokerScore','routeGrowth'];

function canInspect(trace:ScoreTrace|null|undefined,replay:boolean,targetHeat?:string):trace is ScoreTrace {
  const target=integerScore(targetHeat),final=trace?integerScore(trace.finalScore):undefined;
  return !!trace&&!replay&&trace.rulesVersion==='r2'&&!!trace.rng&&Array.isArray(trace.events)&&target!==undefined&&target>0n&&final!==undefined&&final>=target;
}

function eventScores(trace:ScoreTrace,event:ScoreEvent):{before:bigint;after:bigint}|undefined {
  if(event.reasonKey==='amo.exile'){
    const before=integerScore(trace.amoExile?.beforeScore),after=integerScore(trace.amoExile?.afterScore);
    if(!trace.amoExile?.use||before===undefined||after===undefined)return;
    return {before,after};
  }
  const h0=exact(event.before.H),h1=exact(event.after.H),m0=exact(event.before.M),m1=exact(event.after.M);
  if(!h0||!h1||!m0||!m1||h0.n<0n||h1.n<0n||m0.n<0n||m1.n<0n)return;
  return {before:(h0.n*m0.n)/(h0.d*m0.d),after:(h1.n*m1.n)/(h1.d*m1.d)};
}

/** The caller supplies only an event already belonging to this trace. */
function cueForScoreEvent(trace:ScoreTrace,event:ScoreEvent,targetHeat:string):ScoreHighMultiplierCue|undefined {
  if(event.rootId!==trace.rootId||!scoringPhases.includes(event.phase))return;
  const target=integerScore(targetHeat),final=integerScore(trace.finalScore);
  if(!target||target<=0n||final===undefined||final<target)return;
  const scores=eventScores(trace,event);
  if(!scores||scores.after<target||(event.phase!=='base'&&scores.before>=target))return;
  const tier:1|2=final>=target*2n?2:1;
  return {rootId:trace.rootId,eventId:event.eventId,kind:tier===2?'overkill-two-x':'one-shot',tier};
}

/**
 * Inspect a committed scoring trace against the current stage target, never a hand preview.
 * Ignites only when a single committed hand scores at least targetHeat; replays stay quiet.
 */
export function scoreHighMultiplierCue(trace:ScoreTrace|null|undefined,eventId:string,replay:boolean,targetHeat?:string):ScoreHighMultiplierCue|undefined {
  if(!canInspect(trace,replay,targetHeat))return;
  const event=trace.events.find(saved=>saved.eventId===eventId&&saved.rootId===trace.rootId);
  return event?cueForScoreEvent(trace,event,targetHeat!):undefined;
}

/** Select the first eligible committed event in trace order with one pass. */
export function firstScoreHighMultiplierCue(trace:ScoreTrace|null|undefined,replay:boolean,targetHeat?:string):ScoreHighMultiplierCue|undefined {
  if(!canInspect(trace,replay,targetHeat))return;
  for(const event of trace.events){
    const cue=cueForScoreEvent(trace,event,targetHeat!);if(cue)return cue;
  }
}
