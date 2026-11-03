import {rankLabel,SUIT_SYMBOL} from '../cards/types';
import {HAND_LABELS} from '../content/handLabels';
import type {Condition,R2JokerDefinition,R2JokerInstance} from '../content/r2Schema';
import {r2JokerDefinitionFor,r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import type {R2RunState} from '../domain/run';
import {Rational} from '../domain/rational';
import {r2ScoringDisabledJokerIds,type ScoreEvent,type ScoreTrace} from '../domain/scoreR2';
import {cardDisplayName} from './tangsongCardNames';
import {editionLabel} from './r2ToolInfo';
import {fractionText} from './scoreText';
import type {Edition} from '../cards/types';

/** The instance was actually acquired by a saved BuyOffer command. */
export interface NovicePurchase {instanceId:string;definitionId:string;stageIndex:number}
export interface NovicePurchaseTarget {purchase:NovicePurchase;status:'ready'|'disabled'|'no-scoring'|'sold'}

function contributes(e:ScoreEvent):boolean {
 if(e.sourceType!=='joker'||!['onCardScore','onHeldCard','jokerScore'].includes(e.phase))return false;
 if(e.operation==='retrigger-card')return BigInt(e.value.n)>0n;
 return Rational.fromJSON(e.after.H).compare(Rational.fromJSON(e.before.H))>0||Rational.fromJSON(e.after.M).compare(Rational.fromJSON(e.before.M))>0;
}

/** Purchases must come from verified commands. Match the actual saved source
 * instances and follow event order when several purchases contribute. */
export function novicePurchasedContribution(trace:ScoreTrace,purchases:readonly NovicePurchase[]) {
 const available=purchases.filter(p=>trace.sourceJokers.some(j=>j.instanceId===p.instanceId&&j.definitionId===p.definitionId));
 const first=trace.events.find(e=>contributes(e)&&available.some(p=>p.instanceId===e.sourceInstanceId&&p.definitionId===e.sourceDefinitionId));
 if(!first)return;
 const purchase=available.find(p=>p.instanceId===first.sourceInstanceId&&p.definitionId===first.sourceDefinitionId)!;
 const events=trace.events.filter(e=>e.sourceInstanceId===purchase.instanceId&&e.sourceDefinitionId===purchase.definitionId&&contributes(e));
 return {purchase,event:first,events};
}

export function noviceContributionPrefix(event:ScoreEvent):string {
 if(!event.reasonKey.startsWith('edition.'))return '';
 return editionLabel(event.reasonKey.split('.')[1] as Edition)+'版次：';
}

function scoreHooks(definition:R2JokerDefinition) {
 return definition.hooks.filter(h=>['onCardScore','onHeldCard','jokerScore'].includes(h.phase));
}
function disabledIds(s:R2RunState):string[] {
 const stage=s.stage?.index===s.stageIndex?s.stage:null;
 return r2ScoringDisabledJokerIds(stage?.boss,s.jokers,r2JokerDefinitionsFor(s),stage?.sealedJokerIds,stage?.challengeDisabledJokerId);
}

/** Keep the earliest usable saved purchase; switch only if it is gone or cannot
 * contribute to scoring now. Never confuse another instance of the same card. */
export function novicePurchaseTarget(s:R2RunState,purchases:readonly NovicePurchase[]):NovicePurchaseTarget|undefined {
 const disabled=new Set(disabledIds(s));
 const held=purchases.filter(p=>s.jokers.some(j=>j.instanceId===p.instanceId&&j.definitionId===p.definitionId));
 const scoring=held.filter(p=>{
  const joker=s.jokers.find(j=>j.instanceId===p.instanceId)!;
  return scoreHooks(r2JokerDefinitionFor(s,p.definitionId)).length>0||!!joker.edition&&joker.edition!=='none';
 });
 const enabled=scoring.find(p=>!disabled.has(p.instanceId));
 if(enabled)return {purchase:enabled,status:'ready'};
 if(scoring.length)return {purchase:scoring[0],status:'disabled'};
 if(held.length)return {purchase:held[0],status:'no-scoring'};
 const last=purchases.at(-1);return last?{purchase:last,status:'sold'}:undefined;
}

const types=(values:Extract<Condition,{kind:'hand-type-in'}>['values'])=>values.map(t=>HAND_LABELS[t]).join('、');
const ranks=(values:readonly number[])=>values.map(r=>rankLabel(r as Parameters<typeof rankLabel>[0])).join('、');
const suits=(values:Extract<Condition,{kind:'suit-in'}>['values'])=>values.map(s=>SUIT_SYMBOL[s]).join('、');

/** Short action copy comes from the definition for this run's content identity. */
function conditionAction(c:Condition):string|undefined {
 switch(c.kind){
  case 'paired-rank':return `打出至少${c.minimum}张同点牌，让其中一张有效计分。`;
  case 'rank-in':return `出牌时，让${ranks(c.values)}参与有效计分。`;
  case 'suit-in':return `出牌时，让${suits(c.values)}花色的牌参与有效计分。`;
  case 'played-count':return `选择并打出${c.equals}张牌。`;
  case 'played-count-maximum':return `选择并打出1–${c.maximum}张牌。`;
  case 'hand-type-in':return `可试${types(c.values.slice(0,3))}${c.values.length>3?'等':''}牌型。`;
  case 'all-played-active':return `打出至少${c.minimum}张，并让每张都有效计分。`;
  case 'resource':return c.resource==='play-index'?`在本场第${c.equals}手出牌时生效。`:undefined;
  default:return;
 }
}

/** A single unconditional value in the saved identity's definition is not a
 * predicted score. Decline partial descriptions of compound, growing, random,
 * state-dependent or edition-bearing effects. */
function fixedEffectAction(definition:R2JokerDefinition,joker:R2JokerInstance|undefined):string|undefined {
 if(definition.hooks.length!==1||definition.modifiers?.length||joker?.edition&&joker.edition!=='none')return;
 const hook=definition.hooks[0];if(hook.operations.length!==1)return;
 const operation=hook.operations[0];
 if(operation.kind!=='add-heat'&&operation.kind!=='add-multiplier'||Rational.fromJSON(operation.value).compare(new Rational(0n))<=0)return;
 const effect=`+${fractionText(operation.value)}${operation.kind==='add-heat'?'筹码':'倍率'}`,condition=hook.condition;
 if(hook.phase==='onCardScore')switch(condition.kind){
  case 'paired-rank':return `出≥${condition.minimum}张同点牌，有效计分各${effect}`;
  case 'suit-in':return `出${condition.values.map(s=>SUIT_SYMBOL[s]).join('或')}，有效计分各${effect}`;
  case 'rank-in':return `出${ranks(condition.values)}，有效计分各${effect}`;
  default:return;
 }
 if(hook.phase==='jokerScore')switch(condition.kind){
  case 'played-count':return `恰好打出${condition.equals}张，整手${effect}。`;
  case 'played-count-maximum':return `打出1–${condition.maximum}张，整手${effect}。`;
  case 'hand-type-in':return `打出${types(condition.values.slice(0,3))}${condition.values.length>3?'等':''}牌型，整手${effect}。`;
  case 'all-played-active':return `打出至少${condition.minimum}张，全部有效计分时整手${effect}。`;
  case 'always':return `任意牌型，整手${effect}。`;
  default:return;
 }
 return;
}

/** Only name a missed condition when the actual saved hand proves it failed. */
function missedCondition(c:Condition,trace:ScoreTrace,playIndex:number):string|undefined {
 const played=trace.cards.filter(card=>trace.sets.playedIds.includes(card.id));
 const active=trace.cards.filter(card=>trace.sets.activeScoringIds.includes(card.id));
 switch(c.kind){
  case 'paired-rank':{
   const matches=(rank:number)=>played.filter(p=>p.rank===rank).length>=c.minimum;
   if(active.some(card=>matches(card.rank)))return;
   if(played.some(card=>matches(card.rank)))return c.minimum===2?'同点未计分；':`${c.minimum}张同点未计分；`;
   return c.minimum===2?'上手无同点；':`上手无${c.minimum}张同点；`;
  }
  case 'rank-in':return active.some(card=>c.values.includes(card.rank))?undefined:`上手无${ranks(c.values)}计分；`;
  case 'suit-in':return active.some(card=>c.values.includes(card.suit))?undefined:`上手无${suits(c.values)}计分；`;
  case 'played-count':return played.length===c.equals?undefined:`上手打出${played.length}张，需${c.equals}张。`;
  case 'played-count-maximum':return played.length<=c.maximum?undefined:`上手打出${played.length}张，需不超过${c.maximum}张。`;
  case 'hand-type-in':return c.values.includes(trace.handType)?undefined:`上手是${HAND_LABELS[trace.handType]}，需${types(c.values)}。`;
  case 'all-played-active':return played.length<c.minimum?`上手打出${played.length}张，需至少${c.minimum}张。`:played.length===active.length?undefined:'上手有牌未参与有效计分。';
  case 'resource':return c.resource==='play-index'&&playIndex!==c.equals?`上手是本场第${playIndex}手，需第${c.equals}手。`:undefined;
  default:return;
 }
}

export function novicePurchaseAdvice(s:R2RunState,target:NovicePurchaseTarget,attempt?:{trace:ScoreTrace;playIndex:number}) {
 const name=cardDisplayName(target.purchase.definitionId),definition=r2JokerDefinitionFor(s,target.purchase.definitionId),hooks=scoreHooks(definition);
 const pair=hooks.some(h=>h.phase==='onCardScore'&&h.condition.kind==='paired-rank'&&h.condition.minimum===2);
 if(target.status==='sold')return {action:`${name}已不在持有牌中。可在商店购买其他唐宋牌，或继续游戏。`,pair:false};
 if(target.status==='disabled')return {action:`${name}本场计分效果暂不可用；可换用其他唐宋牌或下一场再试。`,pair:false};
 if(target.status==='no-scoring')return {action:`${name}没有出牌计分效果；可继续游戏，或购买有计分效果的唐宋牌。`,pair:false};
 const condition=hooks.length===1?hooks[0].condition:undefined;
 const heldRank=hooks.length===1&&hooks[0].phase==='onHeldCard'&&condition?.kind==='rank-in';
 const owned=s.jokers.find(j=>j.instanceId===target.purchase.instanceId&&j.definitionId===target.purchase.definitionId);
 let action=fixedEffectAction(definition,owned)??(heldRank?`将${ranks(condition.values)}留在手中，再出牌。`:condition&&conditionAction(condition));
 if(condition?.kind==='resource'&&condition.resource==='play-index'&&s.stage?.index===s.stageIndex&&s.stage.playIndex>=condition.equals)
  action=`本场时机已过；下场第${condition.equals}手试试。`;
 // An edition, multiple hooks, random result, or another rule can also affect
 // the outcome. State a specific cause only when the one known condition failed.
 const joker=attempt?.trace.sourceJokers.find(j=>j.instanceId===target.purchase.instanceId);
 const sourceEvents=attempt?.trace.events.filter(e=>e.sourceType==='joker'&&e.sourceInstanceId===target.purchase.instanceId&&e.sourceDefinitionId===target.purchase.definitionId&&['onCardScore','onHeldCard','jokerScore'].includes(e.phase))??[];
 const disabled=attempt&&r2ScoringDisabledJokerIds(attempt.trace.bossContext.boss,attempt.trace.sourceJokers,r2JokerDefinitionsFor(s),attempt.trace.bossContext.sealedJokerIds,attempt.trace.bossContext.challengeDisabledJokerId).includes(target.purchase.instanceId);
 const missed=attempt&&condition&&!heldRank&&(!joker?.edition||joker.edition==='none')?missedCondition(condition,attempt.trace,attempt.playIndex):undefined;
 const cause=disabled?'上手这张唐宋牌的计分效果受限制。':missed??(sourceEvents.some(e=>e.operation==='read-growth'&&BigInt(e.value.n)===0n)?'上手读取的已积累加成为0。':undefined);
 return {action:action??`查看${name}的效果条件，选牌出牌。`,cause:attempt?(cause??`上手未记录${name}加成。`):undefined,pair};
}
