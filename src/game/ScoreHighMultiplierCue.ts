import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {MAX_INTEGER_DIGITS,type Fraction} from '../domain/rational';

export interface ScoreHighMultiplierCue {
  rootId:string;
  eventId:string;
  kind:'crossed-ten'|'doubled-at-ten';
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

const scoringPhases:readonly ScoreEvent['phase'][]=['onCardScore','onHeldCard','characterScore','jokerScore','routeGrowth'];
const multiplyOperations=['multiply-multiplier','read-coefficient','rescue-multiplier','route-factor'];

function canInspect(trace:ScoreTrace|null|undefined,replay:boolean):trace is ScoreTrace {
  return !!trace&&!replay&&trace.rulesVersion==='r2'&&!!trace.rng&&Array.isArray(trace.events);
}

/** The caller supplies only an event already belonging to this trace. */
function cueForScoreEvent(trace:ScoreTrace,event:ScoreEvent):ScoreHighMultiplierCue|undefined {
  if(event.rootId!==trace.rootId||!scoringPhases.includes(event.phase))return;
  const h0=exact(event.before.H),h1=exact(event.after.H),m0=exact(event.before.M),m1=exact(event.after.M);
  if(!h0||!h1||!m0||!m1||h0.n<0n||h1.n<0n||m0.n<0n||m1.n<0n||
    m1.n<10n*m1.d||m1.n*m0.d<=m0.n*m1.d)return;

  // Exile floors the pre-multiplied score before applying its bonus. Its saved
  // before/after values, rather than floor(H * M after), own the real result.
  if(event.reasonKey==='amo.exile'){
    const before=integerScore(trace.amoExile?.beforeScore),after=integerScore(trace.amoExile?.afterScore);
    if(!trace.amoExile?.use||before===undefined||after===undefined||after<=before)return;
  }else if(h1.n*m1.n/(h1.d*m1.d)<=h0.n*m0.n/(h0.d*m0.d))return;

  if(m0.n<10n*m0.d)return {rootId:trace.rootId,eventId:event.eventId,kind:'crossed-ten'};
  if(multiplyOperations.includes(event.operation)&&m1.n*m0.d>=2n*m0.n*m1.d)
    return {rootId:trace.rootId,eventId:event.eventId,kind:'doubled-at-ten'};
}

/**
 * Inspect a committed scoring trace, never a hand preview.
 * One hand can yield several eligible events; the presentation owns its own cap
 * and cancellation. Replay is explicit so opening the saved history stays quiet.
 */
export function scoreHighMultiplierCue(trace:ScoreTrace|null|undefined,eventId:string,replay:boolean):ScoreHighMultiplierCue|undefined {
  if(!canInspect(trace,replay))return;
  const event=trace.events.find(saved=>saved.eventId===eventId&&saved.rootId===trace.rootId);
  return event?cueForScoreEvent(trace,event):undefined;
}

/** Select the first eligible committed event in trace order with one pass. */
export function firstScoreHighMultiplierCue(trace:ScoreTrace|null|undefined,replay:boolean):ScoreHighMultiplierCue|undefined {
  if(!canInspect(trace,replay))return;
  for(const event of trace.events){
    const cue=cueForScoreEvent(trace,event);if(cue)return cue;
  }
}
