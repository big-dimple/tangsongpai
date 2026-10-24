import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {actualMultiplier} from '../domain/openingShow';
import {Rational} from '../domain/rational';
import {numberImpact} from './ScoreEnergy';
import {hasActualBenefit} from './JokerExperience';
import {scoreBeat,type ScoreBeat,type ScorePhraseGesture} from './scorePresentation';
import {scoreContributions} from './ScoreContribution';
import {jokerStrikeBeat} from './JokerScoreStrike';
import {heroScoreAction,heroImpactBeat} from './HeroScoreAction';
import {OWNED_SOURCE_REBOUND} from './OwnedJokerScoreMotion';

/** Read-only phrase over the committed order. No sorting, score arithmetic,
 * independent timers, or mutation of a trace. The Scene consumes each beat once. */
export function scorePhrase(events:readonly ScoreEvent[],target:string,speed=1,trace?:ScoreTrace,retainedIds:readonly string[]=[]):Map<string,ScoreBeat>{
 const beats=new Map<string,ScoreBeat>(),rate=[1,2,4].includes(speed)?speed:1;
 const eligible=(e:ScoreEvent)=>!['base','finalScore','afterHand','onStageClear','beforeFailure'].includes(e.phase)&&(!!numberImpact(e,target)||e.sourceType==='joker'&&hasActualBenefit(e));
 const gains=events.filter(eligible),multiplies=gains.filter(e=>actualMultiplier(e));
 // One key multiplier, strongest actual factor; the last equal factor closes its run.
 const accent=multiplies.reduce<ScoreEvent|undefined>((best,e)=>!best||actualMultiplier(e)!.compare(actualMultiplier(best)!)>=0?e:best,undefined);
 let pulse=0,sourcePulse=0,cursor=0,settled=false,previousSource:string|undefined;
 for(const event of events){
  const base=scoreBeat(event,pulse),gain=eligible(event),repeat=gain&&previousSource===event.sourceInstanceId,heroAction=trace&&heroScoreAction(trace,event,retainedIds);
  const progress=Math.min(1,pulse/Math.max(1,gains.length-1));
  let role:ScorePhraseGesture['role'],weight:number,paired=false,windup:number,flight:number,impact:number,rest:number,budget=0;
  if(event.phase==='finalScore'){role='settle';weight=1;windup=Math.max(160,90*rate);flight=0;impact=Math.max(430,160*rate);rest=Math.max(140,60*rate);settled=true;}
  else if(settled||['afterHand','onStageClear','beforeFailure'].includes(event.phase)){role='receipt';weight=.22;windup=12;flight=0;impact=85;rest=16;}
  else if(gain){
   role=event===accent?'accent':pulse===0?'opening':'run';
   const multiplier=!!actualMultiplier(event),numeric=scoreContributions(event).length>0;
   const owned=event.sourceType==='joker';
   weight=role==='accent'?1:role==='opening'?.72:Math.min(.82,(owned?[.58,.76,.52,.8]:[.32,.48,.28,.54])[pulse%4]+progress*.04)*(multiplier?.72:1);
   paired=event.sourceType==='joker'||heroAction?.positive===true;
   budget=role==='accent'?Math.max(640,350*rate):role==='opening'?Math.max(420,260*rate):owned?Math.max(Math.round(350-65*progress),Math.round(190-15*progress)*rate):Math.max(Math.round(270-80*progress),Math.round(90-30*progress)*rate);
   if(role==='accent'){windup=160;flight=115;impact=285;rest=80;}
   else if(role==='opening'){windup=Math.max(110,55*rate);flight=Math.max(80,40*rate);impact=Math.max(180,95*rate);rest=30;}
   else {windup=Math.max(Math.round(50-22*progress)-(repeat?10:0),4*rate);flight=Math.max(Math.round(70-30*progress),14*rate);impact=Math.max(Math.round(130-40*progress),30*rate);rest=Math.max(8,Math.round(22-12*progress));}
   // Retriggers have a source double-beat, but no invented H/M flight. Their
   // visible reversal shares the same clock and does not hold the old 221ms floor.
   if(owned&&!numeric){windup=Math.max(Math.round(80-25*progress),24*rate);flight=0;impact=Math.max(Math.round(210-50*progress),Math.ceil(50/OWNED_SOURCE_REBOUND)*rate);}
   pulse++;previousSource=event.sourceInstanceId;
  }else {role='notice';weight=.32;windup=35;flight=0;impact=130;rest=35;previousSource=undefined;}
  if(!base.flight)flight=0;
  if(gain&&event.sourceType!=='joker')impact+=Math.max(0,budget-windup-flight-impact-rest);
  if(gain&&event.sourceType==='joker'&&!scoreContributions(event).length)rest+=Math.max(0,budget-windup-flight-impact-rest);
  const notePulse=role==='accent'||role==='settle'?0:[0,2,1,3,2,4,1,0][Math.max(0,pulse-1)%8];
  let beat:ScoreBeat={...base,windup,flight,impact,rest,phrase:{role,pulse:gain?pulse-1:pulse,progress,notePulse,sourcePulse,accentWeight:weight,paired,budgetMs:budget,start:cursor,arrival:0,end:0}};
  if(heroAction&&!heroAction.positive)beat={...beat,windup:Math.max(beat.windup,20*rate),flight:0,impact:Math.max(beat.impact,95*rate),rest:Math.max(beat.rest,25*rate)};
  if(gain&&(event.sourceType==='joker'||heroAction?.positive===true)&&scoreContributions(event).some(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))>0))beat=jokerStrikeBeat(beat,scoreContributions(event).some(c=>c.kind==='multiply'),rate);
  if(heroAction)beat=heroImpactBeat(heroAction,beat,rate);
  if(gain&&event.sourceType==='joker')sourcePulse++;
  beat.phrase!.arrival=cursor+beat.windup+beat.flight;cursor=beat.phrase!.arrival+beat.impact+beat.rest;beat.phrase!.end=cursor;
  beats.set(event.eventId,beat);
 }
 return beats;
}
