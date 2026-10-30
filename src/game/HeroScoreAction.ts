import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import type {CharacterId} from '../domain/characters';
import {Rational} from '../domain/rational';
import {savedHeroAttachment,retainedRefillImpact} from './HeroAttachmentFacts';
import {scoreContributions,type ScoreContribution} from './ScoreContribution';
import type {CommandResult,R2RunState} from '../domain/run';

export interface SavedHeroCharge {eventId:string;sourceInstanceId:string;before:number;after:number;targetIds:string[];gained:boolean}
/** Charge is a saved hand receipt, never an invented ScoreEvent or multiplier. */
export function savedHeroCharge(before:R2RunState,result:CommandResult<R2RunState>):SavedHeroCharge|undefined {
 if(!result.ok||result.duplicate||before.characterId!=='azao'||before.phase!=='await-input')return;
 const after=result.state,trace=after.lastTrace,charge=trace?.azaoCharge;
 if(after.runId!==before.runId||after.characterId!==before.characterId||after.commandSeq!==before.commandSeq+1||result.receipt.seq!==after.commandSeq||!trace||!charge||charge.release||charge.before.charge!==before.stage?.azaoCharge?.charge||charge.before.charge===charge.after.charge||
  !result.events.some(e=>e.type==='hand-scored-r2'&&e.score.rootId===trace.rootId&&JSON.stringify(e.score)===JSON.stringify(trace)))return;
 return {eventId:result.receipt.commandId+'/azao-charge',sourceInstanceId:after.runId+'/character',before:charge.before.charge,after:charge.after.charge,targetIds:[...trace.sets.activeScoringIds],gained:charge.after.charge>charge.before.charge};
}

export interface HeroScoreAction {
 hero:CharacterId;eventId:string;sourceInstanceId:string;
 kind:'exile'|'assist'|'handoff'|'release'|'wager-won'|'wager-lost'|'retained-card';
 /** Beneficiaries for a gain, pending new cards for a failed wager. Cost cards are separate. */
 targetIds:string[];costIds:string[];positive:boolean;contributions:ScoreContribution[];
 cost?:{kind:'gold'|'charge';before:number;after:number};
}

/** No predicted outcomes or generic selected cards: all roles come from the saved trace. */
export function heroScoreAction(trace:ScoreTrace,event:ScoreEvent,retainedIds:readonly string[]=[]):HeroScoreAction|undefined {
 if(event.rootId!==trace.rootId||!trace.events.some(e=>e===event||e.eventId===event.eventId&&JSON.stringify(e)===JSON.stringify(event)))return;
 const contributions=scoreContributions(event),positive=contributions.some(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))>0);
 if(!contributions.length)return;
 const retained=retainedRefillImpact(event,retainedIds);
 if(retained&&positive)return {hero:'laohuan',eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,kind:'retained-card',targetIds:[retained],costIds:[],positive,contributions};
 if(event.sourceType!=='character')return;
 const hero=event.sourceDefinitionId as CharacterId,saved=savedHeroAttachment(trace,hero);
 if(hero==='erxiang'&&trace.erxiangGroup&&event.reasonKey==='erxiang.handoff'&&event.targetCardId&&positive)return {hero,eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,kind:'handoff',targetIds:[event.targetCardId],costIds:[],positive,contributions};
 if(saved?.event.eventId!==event.eventId)return;
 const main=trace.sets.activeScoringIds.length?trace.sets.activeScoringIds:trace.sets.playedIds;
 const common={hero,eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,positive,contributions,costIds:[] as string[]};
 if(hero==='amo')return trace.amoExile?.use?{...common,kind:'exile',targetIds:[...main],costIds:[...trace.amoExile.discardedIds]}:{...common,kind:'assist',targetIds:[...saved.targetIds??[]]};
 if(hero==='laohuan'&&trace.laohuanFind?.multiplier&&positive)return {...common,kind:'release',targetIds:[...trace.laohuanFind.activeIds]};
 if(hero==='erxiang'&&positive)return {...common,kind:'handoff',targetIds:[...saved.targetIds??[]]};
 if(hero==='azao'&&trace.azaoCharge?.release&&positive)return {...common,kind:'release',targetIds:[...trace.sets.activeScoringIds],cost:{kind:'charge',before:trace.azaoCharge.before.charge,after:trace.azaoCharge.after.charge}};
 if(hero==='xiemu'&&trace.xiemuBurn?.cost&&positive)return {...common,kind:'release',targetIds:[...trace.sets.activeScoringIds],cost:{kind:'gold',before:trace.xiemuBurn.goldBefore,after:trace.xiemuBurn.goldAfter}};
 if(hero==='touye'&&trace.touyeWager?.commit){
  if(trace.touyeWager.outcome==='won'&&positive)return {...common,kind:'wager-won',targetIds:[...trace.touyeWager.core?.activeNewIds??saved.targetIds??[]]};
  if(trace.touyeWager.outcome==='lost'&&!positive)return {...common,kind:'wager-lost',targetIds:[...trace.touyeWager.commit.refill?.refilledIds??[]]};
 }
}

/** The saved gain controls an accent, never new score arithmetic. Retained-card
 * ordinary points keep their running pace instead of charging on every card. */
export function heroImpactBeat(action:HeroScoreAction,base:import('./scorePresentation').ScoreBeat,speed=1):import('./scorePresentation').ScoreBeat {
 if(!action.positive||action.kind==='retained-card'||!base.strike)return base;
 const rate=[1,2,4].includes(speed)?speed:1,strong=action.contributions.some(c=>c.kind==='multiply'&&Rational.fromJSON(c.before).n!==0n&&Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before).multiply(new Rational(3n)))>=0);
 const windup=Math.max(base.windup,strong?210:160,(strong?75:55)*rate),flight=Math.max(base.flight,strong?170:145,60*rate),hold=Math.max(base.strike.hold,strong?70:55,45*rate),recovery=Math.max(base.strike.recovery,strong?280:220,80*rate),rest=Math.max(base.rest,strong?70:45,20*rate);
 return {...base,windup,flight,impact:hold+recovery,rest,strike:{hold,recovery},phrase:base.phrase?{...base.phrase,accentWeight:Math.max(base.phrase.accentWeight,strong?1:.85)}:undefined};
}

/** Cost and target facts are from this saved action; the existing caption owns display. */
export function heroImpactDetail(action:HeroScoreAction):string|undefined {
 if(action.cost){const cost=action.cost,spent=cost.before-cost.after;return cost.kind==='charge'?'消耗'+spent+'层（'+cost.before+'→'+cost.after+'）':'扣'+spent+'金（'+cost.before+'→'+cost.after+'）';}
 if(action.kind==='handoff')return '牌值转倍率';
}
