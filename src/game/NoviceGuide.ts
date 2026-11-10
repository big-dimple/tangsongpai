import {rankLabel} from '../cards/types';
import {stableHash} from '../domain/hash';
import {Rational} from '../domain/rational';
import {applyCommand,type Command,type R2RunState} from '../domain/run';
import {r2DiscardCost} from '../domain/r2Run';
import {routeStarterStartCommand} from '../domain/r2RouteStarter';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {r2PurchasePrice} from '../domain/r2Shop';
import {r2JokerCapacity} from '../domain/r2Resources';
import {prepareBossSuitRescueAction} from '../domain/r2BossSuitRescue';
import {GUIDED_TUTORIAL_SEED,isGuidedTutorialRunId} from './RunLaunch';
import {cardDisplayName} from './tangsongCardNames';
import {fractionText,heatText} from './scoreText';
import {stageNotice} from './stageNotice';
import {noviceContributionPrefix,novicePurchaseAdvice,novicePurchasedContribution,novicePurchaseTarget,type NovicePurchase} from './NovicePurchaseGuide';

/** Optional presentation preferences only. Game progress always comes from the saved run. */
export const NOVICE_GUIDE_KEY='tangsongpai-novice-guide-v1';
export const NOVICE_GUIDE_PENDING_PREFIX='tangsongpai-novice-start:';
export const NOVICE_GUIDE_PREFERENCES_EVENT='tangsongpai-novice-guide-preferences';
export type NoviceGuideStep='pair'|'discard'|'independent'|'shop'|'payoff'|'skill'|'complete'|'replay';
export interface NoviceGuideFact {
 pairScore?:string;
 pairHeat?:string;
 pairMultiplier?:string;
 pairBaseHeat?:string;
 pairBaseMultiplier?:string;
 pairCardHeat?:string;
 pairCardHeats?:string[];
 pairTarget?:string;
 pairStageHeat?:string;
 pairRemaining?:string;
 purchaseInstanceId?:string;
 purchaseDefinitionId?:string;
 eventId?:string;
 finalScore?:string;
 contribution?:string;
 briefContribution?:string;
 skillEventId?:string;
 skillContribution?:string;
}
export interface NoviceGuideHint {
 step:NoviceGuideStep;
 cue:string;
 body:string;
 details?:string;
 /** Condition and fixed effect without a previous-hand explanation, for live selection. */
 payoffAction?:string;
 recommendedCardIds?:string[];
 choices?:{id:string;label:string;cardIds:string[];selected?:boolean}[];
 offerIds?:string[];
 focus?:'play'|'discard'|'hero'|'score'|'goal'|'sort-suit';
 gesture?:'sweep'|'hold-drag';
 fact?:NoviceGuideFact;
}
type Preferences={disabled:boolean;enrolled?:string;muted:boolean;skipped:NoviceGuideStep[]};
const allSteps:readonly NoviceGuideStep[]=['pair','discard','independent','shop','payoff','skill','complete','replay'];
const empty=():Preferences=>({disabled:false,muted:false,skipped:[]});
const runKey=(s:R2RunState)=>JSON.stringify([s.runId,s.seed,s.characterId,s.contentVersion,s.contentHash,s.mode,s.difficulty,s.challengeId,s.tourMode]);
function decode(raw:string|null):Preferences {
 try {
  const p=JSON.parse(raw??'null');
  if(p&&typeof p.disabled==='boolean'&&typeof p.muted==='boolean'&&Array.isArray(p.skipped))return {
   disabled:p.disabled,muted:p.muted,enrolled:typeof p.enrolled==='string'?p.enrolled:undefined,
   skipped:p.skipped.filter((v:unknown):v is NoviceGuideStep=>typeof v==='string'&&allSteps.includes(v as NoviceGuideStep))
  };
 } catch { /* A broken preference must not prevent a saved game from loading. */ }
 return empty();
}
let fallback=empty(),unpersisted=false;
function read():Preferences {
 if(unpersisted)return fallback;
 try {return fallback=decode(localStorage.getItem(NOVICE_GUIDE_KEY));} catch {return fallback;}
}
function notifyPreferences():void {
 try {if(typeof window!=='undefined')window.dispatchEvent(new Event(NOVICE_GUIDE_PREFERENCES_EVENT));} catch {/* Optional UI notification. */}
}
function write(p:Preferences):void {
 fallback=p;
 try {localStorage.setItem(NOVICE_GUIDE_KEY,JSON.stringify(p));unpersisted=false;} catch {unpersisted=true;}
 notifyPreferences();
}
const isGuided=(s:R2RunState)=>s.mode==='tutorial'&&s.difficulty===0&&s.characterId==='erxiang'&&
 s.seed===GUIDED_TUTORIAL_SEED&&s.tourMode==='normal'&&s.challengeId===null&&!s.programsEnabled&&isGuidedTutorialRunId(s.runId);
const localPending=new Set<string>();
const pendingKey=(runId:string)=>NOVICE_GUIDE_PENDING_PREFIX+runId;
function hasPending(runId:string):boolean {
 if(localPending.has(runId))return true;
 try{return localStorage.getItem(pendingKey(runId))==='1';}catch{return false;}
}

/** Record the local start intent before committing a new run. This is never a game-progress fact. */
export function markNoviceStart(runId:string):boolean {
 if(!isGuidedTutorialRunId(runId))return false;
 localPending.add(runId);
 // Each visit gets its own key, so another tab cannot replace or clear it.
 try{localStorage.setItem(pendingKey(runId),'1');}catch{/* This page can still finish its own start in memory. */}
 return true;
}
/** Cancel only the matching start intent. */
export function clearPendingNoviceStart(runId:string):void {
 localPending.delete(runId);
 try{localStorage.removeItem(pendingKey(runId));}catch{/* An orphaned nonce cannot authorize a different run. */}
}
/** Only a locally initiated or already enrolled visit may resume its automatic opening. */
export function mayResumeNoviceOpening(s:R2RunState):boolean {
 const p=read();return isGuided(s)&&(hasPending(s.runId)||p.enrolled===runKey(s));
}
/** An explicitly imported checkpoint is never proof that this device started its lesson. */
export function suppressImportedNovice(s:R2RunState):void {
 if(!isGuided(s))return;
 clearPendingNoviceStart(s.runId);
 const p=read();if(p.enrolled===runKey(s))write({...p,enrolled:undefined,muted:false,skipped:[]});
}
function openingSaved(s:R2RunState):boolean {
 if(s.stageIndex!==0||s.commandSeq<1||s.commandSeq>3)return false;
 const start=routeStarterStartCommand(s);
 const has=(seq:number,command:Command)=>s.receipts.some(r=>r.seq===seq&&r.commandId===command.commandId&&r.fingerprint===stableHash(command));
 if(!has(1,start))return false;
 if(s.commandSeq===1)return s.phase==='shop'&&s.stage===null;
 const leave:Command={runId:s.runId,commandId:`${s.runId}/command/2`,expectedSeq:1,action:{type:'LeaveShop'}};
 if(!has(2,leave))return false;
 if(s.commandSeq===2)return s.phase==='stage-ready'&&s.stage===null;
 const enter:Command={runId:s.runId,commandId:`${s.runId}/command/3`,expectedSeq:2,action:prepareBossSuitRescueAction(s,{type:'EnterStage'})};
 return s.phase==='await-input'&&s.stage?.index===0&&has(3,enter);
}
/** Invoke only after the locally initiated opening checkpoint was committed and published. */
export function enrollNoviceGuide(s:R2RunState):void {
 if(!isGuided(s))return;
 const p=read(),key=runKey(s);if(p.enrolled===key){clearPendingNoviceStart(s.runId);return;}
 if(!hasPending(s.runId)||!openingSaved(s))return;
 write({...p,enrolled:key,muted:false,skipped:[]});clearPendingNoviceStart(s.runId);
}
/** Clear the marker only after a replacement/import actually succeeded. */
export function stopNoviceGuide():void {const p=read();write({...p,enrolled:undefined,muted:false,skipped:[]});}
export function noviceGuideDisabled():boolean {return read().disabled;}
/** Whether this exact run retains the guide, including when its hint is temporarily muted. */
export function noviceGuideEnrolled(s:R2RunState):boolean {const p=read();return !p.disabled&&isGuided(s)&&p.enrolled===runKey(s);}
/** Re-enable preferences; this never enrolls a different or existing old run. */
export function restoreNoviceGuide():void {const p=read();write({...p,disabled:false,muted:false,skipped:[]});}
export function dismissNoviceGuide(s:R2RunState,scope:'step'|'run'|'forever',journal?:readonly Command[]):void {
 const p=read();
 if(scope==='forever'){write({...p,disabled:true});return;}
 if(!isGuided(s)||p.enrolled!==runKey(s))return;
 if(scope==='run'){write({...p,muted:true});return;}
 const step=deriveHint(s,journal).step;
 write({...p,skipped:[...new Set([...p.skipped,step])]});
}

type Facts={pair?:ScoreTrace;pairTarget?:string;pairStageHeat?:string;discarded:boolean;independent:boolean;cleared:boolean;
 purchase?:NovicePurchase;purchaseStatus?:'ready'|'disabled'|'no-scoring'|'sold';attempt?:{trace:ScoreTrace;playIndex:number};event?:ScoreEvent;payoff?:ScoreTrace;payoffEvents?:ScoreEvent[];
 skill?:ScoreTrace};
const factCache=new WeakMap<R2RunState,{journal:readonly Command[];facts:Facts}>();
const fraction=(v:{n:string;d:string})=>v.d==='1'?v.n:`${v.n}/${v.d}`;
const positive=(value:string)=>/^\d+$/.test(value)&&BigInt(value)>0n;
/** Only show equality when the displayed product is the exact saved integer. */
export function novicePairResultCue(trace:Pick<ScoreTrace,'accumulator'|'finalScore'>):string {
 const {H:h,M:m}=trace.accumulator;
 const exact=BigInt(h.n)*BigInt(m.n)===BigInt(trace.finalScore)*BigInt(h.d)*BigInt(m.d);
 const formula=`${fraction(h)} 筹码 × ${fraction(m)} 倍率 = ${trace.finalScore} 分`;
 return exact&&formula.length<=28?formula:`对子得 ${heatText(trace.finalScore)} 分`;
}
const sameFraction=(a:{n:string;d:string},b:{n:string;d:string})=>Rational.fromJSON(a).compare(Rational.fromJSON(b))===0;
const ordinaryCardEvents=(trace:ScoreTrace)=>trace.events.filter(e=>e.phase==='onCardScore'&&e.sourceType==='card'&&e.sourceDefinitionId.startsWith('rank-')&&e.operation==='add-heat');

/** Compact arithmetic only when the complete saved event chain proves it. */
export function novicePairBreakdownCue(trace:ScoreTrace):string {
 const base=trace.events[0],ordinary=ordinaryCardEvents(trace);
 if(!base||base.phase!=='base'||base.operation!=='base'||!ordinary.length||ordinary.length!==trace.sets.activeScoringIds.length||
    new Set(ordinary.map(e=>e.targetCardId)).size!==ordinary.length||
    ordinary.some(e=>e.retriggerDepth!==0||!e.targetCardId||!trace.sets.activeScoringIds.includes(e.targetCardId)||e.value.d!=='1'||!positive(e.value.n)))return novicePairResultCue(trace);
 let previous=base.after;
 for(const event of trace.events.slice(1)){
  if(!sameFraction(event.before.H,previous.H)||!sameFraction(event.before.M,previous.M)||!sameFraction(event.before.M,event.after.M))return novicePairResultCue(trace);
  if(ordinary.includes(event)){
   if(!sameFraction(Rational.fromJSON(event.after.H).add(Rational.fromJSON(event.before.H).multiply(new Rational(-1n))).toJSON(),event.value))return novicePairResultCue(trace);
  }else if(!sameFraction(event.before.H,event.after.H))return novicePairResultCue(trace);
  previous=event.after;
 }
 if(!sameFraction(previous.H,trace.accumulator.H)||!sameFraction(previous.M,trace.accumulator.M))return novicePairResultCue(trace);
 const {H:h,M:m}=trace.accumulator;
 if(BigInt(h.n)*BigInt(m.n)!==BigInt(trace.finalScore)*BigInt(h.d)*BigInt(m.d))return novicePairResultCue(trace);
 const formula=`基础${fraction(base.after.H)}+牌点${ordinary.map(e=>fraction(e.value)).join('+')}=${fraction(h)}筹码；×${fraction(m)}倍率=${trace.finalScore}分`;
 return formula.length<=38?formula:novicePairResultCue(trace);
}
/** Recompute from the canonical start and every persisted command, then verify the saved end state.
 * No result assembled during replay is used if the journal is absent, truncated or mismatched. */
function savedFacts(state:R2RunState,journal?:readonly Command[]):Facts|undefined {
 if(!journal||journal.length!==state.commandSeq-1)return;
 const cached=factCache.get(state);if(cached?.journal===journal)return cached.facts;
 try {
  const start=routeStarterStartCommand(state),receipt=state.receipts.find(r=>r.seq===1);
  if(!receipt||receipt.commandId!==start.commandId||receipt.fingerprint!==stableHash(start))return;
  const initial=applyCommand(null,start);if(!initial.ok||!initial.state||initial.state.rulesVersion!=='r2')return;
  let current=initial.state as R2RunState;const facts:Facts={discarded:false,independent:false,cleared:false};
  const purchases:NovicePurchase[]=[],attempts=new Map<string,{trace:ScoreTrace;playIndex:number}>();
  for(const command of journal){
   const before=current,result=applyCommand(before,command);
   if(!result.ok||result.duplicate)return;
   current=result.state;
   const action=command.action,trace=current.lastTrace;
   const scored=action.type==='PlayHand'&&trace?.rootId===`${state.runId}/hand/${command.commandId}`?trace:undefined;
   const hadPair=!!facts.pair;
   if(!facts.pair&&before.stage?.index===0&&scored?.handType==='pair'&&positive(scored.finalScore)){
    facts.pair=scored;facts.pairTarget=before.stage.targetHeat;facts.pairStageHeat=current.stage?.heat;
   }
   if(!facts.discarded&&before.stage?.index===0&&action.type==='DiscardHand'&&
     current.handOrder.some(id=>!before.handOrder.includes(id)))facts.discarded=true;
   if(hadPair&&before.stage?.index===0&&scored&&positive(scored.finalScore))facts.independent=true;
   if(before.stage?.index===0&&current.stage?.clearId===`${state.runId}/clear/0`)facts.cleared=true;
   if(!facts.event&&before.phase==='shop'&&before.stageIndex>=1&&action.type==='BuyOffer'){
    const added=current.jokers.find(j=>!before.jokers.some(old=>old.instanceId===j.instanceId));
    if(added)purchases.push({instanceId:added.instanceId,definitionId:added.definitionId,stageIndex:before.stageIndex});
   }
   if(!facts.event&&before.stage&&scored){
    const available=purchases.filter(p=>before.stage!.index>=p.stageIndex&&scored.sourceJokers.some(j=>j.instanceId===p.instanceId&&j.definitionId===p.definitionId));
    const contribution=novicePurchasedContribution(scored,available);
    if(contribution){
     facts.purchase=contribution.purchase;facts.event=contribution.event;facts.payoff=scored;facts.payoffEvents=contribution.events;
    }else for(const purchase of available)attempts.set(purchase.instanceId,{trace:scored,playIndex:before.stage.playIndex+1});
   }
   if(scored&&!facts.skill&&scored.erxiangHandoff?.targetId&&scored.events.some(e=>e.sourceDefinitionId==='erxiang'&&e.reasonKey==='erxiang.handoff'))facts.skill=scored;
  }
  if(stableHash(current)!==stableHash(state))return;
  if(!facts.event){
   const target=novicePurchaseTarget(state,purchases);
   if(target){
    facts.purchase=target.purchase;facts.purchaseStatus=target.status;
    const attempt=attempts.get(target.purchase.instanceId);
    if(attempt?.trace.rootId===state.lastTrace?.rootId)facts.attempt=attempt;
   }
  }
  if(Object.isFrozen(state)&&Object.isFrozen(journal))factCache.set(state,{journal,facts});
  return facts;
 }catch{return;}
}

function pairIds(s:R2RunState):string[] {
 const allowed=s.handOrder.filter(id=>!s.stage?.disabledIds.includes(id));
 const fives=['clubs-5','hearts-5'];if(fives.every(id=>allowed.includes(id)))return fives;
 for(const id of allowed){
  const first=s.deckInstances.find(card=>card.id===id);if(!first)continue;
  const second=allowed.find(other=>other!==id&&s.deckInstances.find(card=>card.id===other)?.rank===first.rank);
  if(second)return [id,second];
 }
 return [];
}
const easyIds=['b02','mantangcai','a03','a09','a08','b07','c02','c03','d07','f03','pengci'];
/** Describe only events the purchased instance actually produced in that saved hand. */
function contribution(events:readonly ScoreEvent[]):string {
 const event=events[0],same=events.filter(e=>e.operation===event.operation&&e.value.n===event.value.n&&e.value.d===event.value.d&&e.reasonKey===event.reasonKey);
 const value=fractionText(event.value),targets=same.map(e=>e.targetCardId);
 if((event.operation==='add-multiplier'||event.operation==='add-heat')&&same.length>1){
  const stat=event.operation==='add-multiplier'?'倍率':'筹码';
  if(same.every(e=>e.phase==='onCardScore'&&e.targetCardId)&&new Set(targets).size===same.length)return `让${same.length}张计分牌各加 ${value} ${stat}`;
  return `触发${same.length}次，每次加 ${value} ${stat}`;
 }
 if(event.operation==='add-multiplier')return `让倍率 +${value}`;
 if(event.operation==='add-heat')return `让筹码 +${value}`;
 if(event.operation==='multiply-multiplier')return `让倍率 ×${value}`;
 if(event.operation==='retrigger-card')return `让计分牌额外计分 ${value} 次`;
 const heat=Rational.fromJSON(event.after.H).compare(Rational.fromJSON(event.before.H))>0;
 return heat?`让筹码 ${fractionText(event.before.H)} → ${fractionText(event.after.H)}`:`让倍率 ${fractionText(event.before.M)} → ${fractionText(event.after.M)}`;
}
function briefContribution(events:readonly ScoreEvent[]):string {
 const event=events[0],same=events.filter(e=>e.operation===event.operation&&e.reasonKey===event.reasonKey);
 if(event.operation==='add-multiplier'||event.operation==='add-heat'){
  const key=event.operation==='add-multiplier'?'M':'H';
  const total=same.reduce((sum,e)=>{const before=Rational.fromJSON(e.before[key]),after=Rational.fromJSON(e.after[key]);return sum.add(after.add(new Rational(-before.n,before.d)));},new Rational(0n));
  return (event.operation==='add-multiplier'?'倍率':'筹码')+' +'+fractionText(total.toJSON());
 }
 if(event.operation==='multiply-multiplier'&&same.length===1)return '倍率 ×'+fractionText(event.value);
 if(event.operation==='retrigger-card')return '计分牌再次计分';
 return '已参与计分';
}
function offers(s:R2RunState):string[] {
 if(s.phase!=='shop'||s.stageIndex<1||!s.shop||s.jokers.length>=r2JokerCapacity(s))return [];
 return s.shop.offers.filter(o=>!o.consumed&&easyIds.includes(o.definitionId)&&!s.jokers.some(j=>j.definitionId===o.definitionId)&&r2PurchasePrice(s,o)<=s.gold)
  .sort((a,b)=>easyIds.indexOf(a.definitionId)-easyIds.indexOf(b.definitionId)).map(o=>o.offerId);
}
/** Discard is an option, never a prerequisite imposed by the guide. */
function discardAvailable(s:R2RunState):boolean {
 return !!s.stage&&s.phase==='await-input'&&s.drawPile.length>0&&s.stage.discardsLeft>=r2DiscardCost(s)&&s.gold>=(stageNotice(s)?.discardGoldCost??0);
}
function discardCostText(s:R2RunState):string {
 const gold=stageNotice(s)?.discardGoldCost??0;
 return `消耗${r2DiscardCost(s)}次弃牌额度${gold?`和${gold}金币`:''}，不消耗出牌次数`;
}
function deriveHint(s:R2RunState,journal?:readonly Command[]):NoviceGuideHint {
 const facts=savedFacts(s,journal);
 if(!facts)return {step:'replay',cue:'教学记录暂不可还原',body:'保存的命令记录不完整，无法确认练习进度。可以继续游戏或重新练习。'};
 const base=facts.pair?.events.find(e=>e.phase==='base'&&e.operation==='base');
 const cardHeats=facts.pair?ordinaryCardEvents(facts.pair).map(e=>fractionText(e.value)):[];
 const cardHeat=facts.pair?ordinaryCardEvents(facts.pair).reduce((sum,e)=>sum.add(Rational.fromJSON(e.value)),new Rational(0n)):undefined;
 const remaining=facts.pairTarget&&facts.pairStageHeat?BigInt(facts.pairTarget)-BigInt(facts.pairStageHeat):undefined;
 const fact:NoviceGuideFact={...(facts.pair?{pairScore:facts.pair.finalScore,pairHeat:fraction(facts.pair.accumulator.H),pairMultiplier:fraction(facts.pair.accumulator.M),
   ...(base?{pairBaseHeat:fraction(base.after.H),pairBaseMultiplier:fraction(base.after.M)}:{}),
   pairCardHeat:fractionText(cardHeat!.toJSON()),pairCardHeats:cardHeats,
   ...(facts.pairTarget&&facts.pairStageHeat?{pairTarget:facts.pairTarget,pairStageHeat:facts.pairStageHeat,pairRemaining:String(remaining!>0n?remaining:0n)}:{})}:{}),
  ...(facts.purchase?{purchaseInstanceId:facts.purchase.instanceId,purchaseDefinitionId:facts.purchase.definitionId}:{}),
  ...(facts.event?{eventId:facts.event.eventId,finalScore:facts.payoff!.finalScore,contribution:noviceContributionPrefix(facts.event)+contribution(facts.payoffEvents!),briefContribution:noviceContributionPrefix(facts.event)+briefContribution(facts.payoffEvents!)}:{}),
  ...(facts.skill?{skillEventId:facts.skill.events.find(e=>e.reasonKey==='erxiang.handoff')?.eventId,
    skillContribution:fractionText(facts.skill.events.filter(e=>e.reasonKey==='erxiang.handoff').reduce((sum,e)=>{const before=Rational.fromJSON(e.before.M),after=Rational.fromJSON(e.after.M);return sum.add(after.add(new Rational(-before.n,before.d)));},new Rational(0n)).toJSON())}:{})};
 if(facts.event&&facts.skill)return {step:'complete',cue:'首战教学完成',body:`刘娥已将${fact.skillContribution}点转为倍率。你已体验出牌、构筑和英雄技能。${s.phase==='run-lost'?'本局已结束，可以开始普通游戏。':'可继续本局，或开始普通游戏。'}`,fact};
 if(s.phase==='run-lost')return {step:'replay',cue:'可以再练一次',body:'本局已结束，练习尚未完成。可以重新练习，或开始普通局。',fact};
 if(facts.event){
  const elsewhere=s.phase!=='await-input'&&s.phase!=='pending-refill';
  return {step:'skill',cue:`${cardDisplayName(facts.purchase!.definitionId)} ${(fact.briefContribution??'').replace(/\s+/g,'')}`,body:elsewhere?'进入下一场，再试刘娥技能。':'选一对，再试刘娥技能。',recommendedCardIds:elsewhere?[]:pairIds(s),fact};
 }
 const openingDone=facts.cleared||s.stageIndex>0;
 // Clearing the real stage advances the lesson even if the player chose a
 // different winning hand or never needed to discard.
 if(!openingDone&&!facts.pair){
  const ids=pairIds(s),rank=ids.length?s.deckInstances.find(c=>c.id===ids[0])?.rank:undefined;
  const next=rank?`点两张 ${rankLabel(rank)}；花色可以不同。`:discardAvailable(s)?`可选不想留的牌点「弃牌」换新牌，${discardCostText(s)}；也可直接出牌。`:'当前无法换牌，可以自己选牌出牌。';
  const target=s.stage?`这一场累计${heatText(s.stage.targetHeat)}分过关。` : '';
  return {step:'pair',cue:s.lastTrace?'再找一对':'先找一对',body:target+next,recommendedCardIds:ids,fact};
 }
 if(!openingDone&&!facts.discarded&&!facts.independent&&discardAvailable(s)){
  const available=s.handOrder.filter(id=>!s.stage?.disabledIds.includes(id));
  const fours=['clubs-4','diamonds-4'];
  const recommended=fours.every(id=>available.includes(id))?fours:[...available].sort((a,b)=>
   (s.deckInstances.find(c=>c.id===a)?.rank??99)-(s.deckInstances.find(c=>c.id===b)?.rank??99)).slice(0,2);
  const reason=fours.every(id=>recommended.includes(id))?'可以保留红桃，试着换掉亮起的4。':'可以试着换掉亮起的低点牌。';
  const total=fact.pairStageHeat&&fact.pairTarget?`累计${heatText(fact.pairStageHeat)}/${heatText(fact.pairTarget)}分；`:'';
  return {step:'discard',cue:'试试换牌 · 可选',body:'选1–2张亮牌点「弃牌」换新牌，也可直接出牌。\n'+discardCostText(s)+'。',details:novicePairBreakdownCue(facts.pair!)+'\n'+total+reason,recommendedCardIds:recommended,fact};
 }
 if(!openingDone)return {step:'independent',cue:`累计 ${s.stage?.heat??'0'} / ${s.stage?.targetHeat??'目标'} 分`,body:'自己选1–5张牌出牌；也可参考牌型示例，想换牌时再用弃牌。',details:fact.pairScore?novicePairBreakdownCue(facts.pair!):undefined,fact};
 if(!facts.purchase){
  const ids=offers(s),offer=s.shop?.offers.find(o=>o.offerId===ids[0]);
  if(s.phase==='await-input'||s.phase==='pending-refill'||s.phase==='stage-ready')return {step:'shop',cue:'先完成当前牌局',body:'本场照常选牌出牌，想换牌时再弃牌。过关后到商店购买唐宋牌，再看它如何增加得分。',fact};
  return {step:'shop',cue:'过关了',body:s.phase==='shop'?(offer?`点「${cardDisplayName(offer.definitionId)}」看效果和价格。`:'看看商店里的唐宋牌，或继续游戏。'):'去商店看看唐宋牌。',offerIds:ids,fact};
 }
 const target={purchase:facts.purchase,status:facts.purchaseStatus??'ready'} as const;
 const advice=novicePurchaseAdvice(s,target,facts.attempt),name=cardDisplayName(facts.purchase.definitionId);
 const inShop=s.phase==='shop'||s.phase==='stage-ready'||s.phase==='stage-cleared';
 const body=advice.cause?`${advice.cause}${advice.action}`:inShop&&target.status==='ready'?`下一场：${advice.action}`:advice.action;
 return {step:'payoff',cue:advice.cause?`${name} · 未加成`:name,body,payoffAction:advice.action,recommendedCardIds:!inShop&&target.status==='ready'&&advice.pair?pairIds(s):[],fact};
}

/** Unsaved selection affects only the next prompt, never saved tutorial progress. */
export function liveNoviceGuide(hint:NoviceGuideHint,selectedIds:readonly string[],skill:{available:boolean;chosen:boolean;enabled:boolean;canDiscard:boolean;discardCost?:number;discardGoldCost?:number}):NoviceGuideHint {
 const selected=new Set(selectedIds),recommended=hint.recommendedCardIds??[];
 const discardCost=`消耗${skill.discardCost??1}次弃牌额度${skill.discardGoldCost?`和${skill.discardGoldCost}金币`:''}，不消耗出牌次数`;
 if(hint.step==='pair'&&recommended.length===2){
  const chosen=recommended.filter(id=>selected.has(id)).length,extra=selected.size-chosen;
  if(extra>0)return {...hint,cue:'也可自己选牌',body:'点已选牌取消，或自己选对子。',recommendedCardIds:[]};
  if(chosen===2)return {...hint,cue:'对子选好了',body:'点「出牌」，看看得分。',recommendedCardIds:[],focus:'play'};
  if(chosen===1)return {...hint,cue:'再选另一张',body:'点数相同，就是对子。',recommendedCardIds:recommended.filter(id=>!selected.has(id))};
 }
 if(hint.step==='discard'&&selected.size){
  if(!skill.canDiscard)return {...hint,cue:'可以继续出牌',body:'当前无法再换牌，点「出牌」继续。',recommendedCardIds:[],focus:'play'};
  const example=selected.size<=2&&[...selected].every(id=>recommended.includes(id));
  return {...hint,cue:example?'选好了，试试换牌':'出牌或换牌，由你选择',body:`点「弃牌」换掉已选${selected.size}张，${discardCost}；也可直接出牌。`,recommendedCardIds:[],focus:example?'discard':undefined};
 }
 if(hint.step==='independent'&&selected.size)return {...hint,body:'点「出牌」，看看结果。',focus:'play'};
 if(hint.step==='payoff'&&recommended.length===2&&selected.size===2&&recommended.every(id=>selected.has(id))){
  const name=hint.fact?.purchaseDefinitionId?cardDisplayName(hint.fact.purchaseDefinitionId):'唐宋牌';
  return {...hint,cue:`${name} · 出牌`,body:hint.payoffAction??hint.body,recommendedCardIds:[],focus:'play'};
 }
 if(hint.step==='payoff'&&selected.size&&recommended.length===2){
  const name=hint.fact?.purchaseDefinitionId?cardDisplayName(hint.fact.purchaseDefinitionId):hint.cue;
  if(selected.size===1&&recommended.includes([...selected][0]))return {...hint,cue:name,body:hint.payoffAction??hint.body,recommendedCardIds:recommended.filter(id=>!selected.has(id))};
  return {...hint,cue:name,body:hint.payoffAction??hint.body,recommendedCardIds:[]};
 }
 if(hint.step==='skill'&&recommended.length===2&&!skill.available){
  const extra=[...selected].filter(id=>!recommended.includes(id));
  if(extra.length)return {...hint,body:'也可自行选牌，选好后试刘娥技能。',recommendedCardIds:[]};
  if(selected.size===1)return {...hint,body:'再选另一张同点数的牌。',recommendedCardIds:recommended.filter(id=>!selected.has(id))};
 }
 if(hint.step==='skill'){
  if(!skill.enabled)return {...hint,body:'本场技能不可用，下一场再试。',recommendedCardIds:[]};
  if(skill.chosen)return {...hint,cue:'技能已选',body:'点「确认出牌」发动技能。',recommendedCardIds:[],focus:'play'};
  if(skill.available)return {...hint,cue:'牌点可转为倍率',body:'点刘娥技能，再选一张牌。',recommendedCardIds:[],focus:'hero'};
  if(!recommended.length){
   if(selected.size)return {...hint,body:skill.canDiscard?`可直接出牌；想找适合技能的组合，也可弃掉已选牌换新牌，${discardCost}。`:'可先出牌，再从补回的牌中找适合技能的组合。',focus:'play'};
   return {...hint,body:skill.canDiscard?`技能需要对子或更高牌型。可自己选牌；想换牌时，选1–5张点「弃牌」，${discardCost}。`:'技能需要对子或更高牌型。当前无法换牌，可先自己选牌出牌。'};
  }
 }
 return hint;
}
/** Pass the SavedRun's published state and journal; no unsaved candidate or local preference proves progress. */
export function noviceGuide(s:R2RunState,journal?:readonly Command[]):NoviceGuideHint|undefined {
 const p=read();if(p.disabled||p.muted||!isGuided(s)||p.enrolled!==runKey(s))return;
 const hint=deriveHint(s,journal);
 return p.skipped.includes(hint.step)?undefined:hint;
}
