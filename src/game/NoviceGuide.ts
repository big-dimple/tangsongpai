import {rankLabel} from '../cards/types';
import {stableHash} from '../domain/hash';
import {Rational} from '../domain/rational';
import {applyCommand,type Command,type R2RunState} from '../domain/run';
import {routeStarterStartCommand} from '../domain/r2RouteStarter';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {r2PurchasePrice} from '../domain/r2Shop';
import {r2JokerCapacity} from '../domain/r2Resources';
import {prepareBossSuitRescueAction} from '../domain/r2BossSuitRescue';
import {GUIDED_TUTORIAL_SEED,isGuidedTutorialRunId} from './RunLaunch';
import {cardDisplayName} from './tangsongCardNames';
import {fractionText,heatText} from './scoreText';

/** Optional presentation preferences only. Game progress always comes from the saved run. */
export const NOVICE_GUIDE_KEY='tangsongpai-novice-guide-v1';
export const NOVICE_GUIDE_PENDING_PREFIX='tangsongpai-novice-start:';
export const NOVICE_GUIDE_PREFERENCES_EVENT='tangsongpai-novice-guide-preferences';
export type NoviceGuideStep='pair'|'discard'|'independent'|'shop'|'payoff'|'skill'|'skill-practice'|'complete'|'replay';
export interface NoviceGuideFact {
 pairScore?:string;
 pairHeat?:string;
 pairMultiplier?:string;
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
 recommendedCardIds?:string[];
 offerIds?:string[];
 focus?:'play'|'discard'|'hero'|'score'|'goal';
 fact?:NoviceGuideFact;
}
type Preferences={disabled:boolean;enrolled?:string;muted:boolean;skipped:NoviceGuideStep[]};
const allSteps:readonly NoviceGuideStep[]=['pair','discard','independent','shop','payoff','skill','skill-practice','complete','replay'];
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

type Facts={pair?:ScoreTrace;discarded:boolean;independent:boolean;cleared:boolean;
 purchase?:{instanceId:string;definitionId:string;stageIndex:number};event?:ScoreEvent;payoff?:ScoreTrace;payoffEvents?:ScoreEvent[];
 skill?:ScoreTrace;skillPractice?:boolean};
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
function contributes(e:ScoreEvent):boolean {
 if(e.sourceType!=='joker'||!['onCardScore','onHeldCard','jokerScore'].includes(e.phase))return false;
 if(e.operation==='retrigger-card')return BigInt(e.value.n)>0n;
 return Rational.fromJSON(e.after.H).compare(Rational.fromJSON(e.before.H))>0||Rational.fromJSON(e.after.M).compare(Rational.fromJSON(e.before.M))>0;
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
  for(const command of journal){
   const before=current,result=applyCommand(before,command);
   if(!result.ok||result.duplicate)return;
   current=result.state;
   const action=command.action,trace=current.lastTrace;
   const scored=action.type==='PlayHand'&&trace?.rootId===`${state.runId}/hand/${command.commandId}`?trace:undefined;
   if(!facts.pair&&before.stage?.index===0&&scored?.handType==='pair'&&positive(scored.finalScore))facts.pair=scored;
   else if(facts.pair&&!facts.discarded&&before.stage?.index===0&&action.type==='DiscardHand'&&
     current.handOrder.some(id=>!before.handOrder.includes(id)))facts.discarded=true;
   else if(facts.pair&&facts.discarded&&!facts.independent&&before.stage?.index===0&&scored&&positive(scored.finalScore))facts.independent=true;
   if(before.stage?.index===0&&current.stage?.clearId===`${state.runId}/clear/0`)facts.cleared=true;
   if(!facts.event&&facts.independent&&facts.cleared&&before.phase==='shop'&&before.stageIndex>=1&&action.type==='BuyOffer'){
    const added=current.jokers.find(j=>!before.jokers.some(old=>old.instanceId===j.instanceId));
    if(added)facts.purchase={instanceId:added.instanceId,definitionId:added.definitionId,stageIndex:before.stageIndex};
   }
   if(!facts.event&&facts.purchase&&before.stage&&before.stage.index>=facts.purchase.stageIndex&&scored){
    const events=scored.events.filter(e=>e.sourceInstanceId===facts.purchase!.instanceId&&e.sourceDefinitionId===facts.purchase!.definitionId&&contributes(e));
    if(events.length){facts.event=events[0];facts.payoff=scored;facts.payoffEvents=events;}
   }
   if(facts.event&&scored){
    if(!facts.skill&&scored.erxiangHandoff?.targetId&&scored.events.some(e=>e.sourceDefinitionId==='erxiang'&&e.reasonKey==='erxiang.handoff'))facts.skill=scored;
    else if(facts.skill&&scored.rootId!==facts.skill.rootId&&positive(scored.finalScore))facts.skillPractice=true;
   }
  }
  if(stableHash(current)!==stableHash(state))return;
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
 const event=events[0],same=events.filter(e=>e.operation===event.operation);
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
function deriveHint(s:R2RunState,journal?:readonly Command[]):NoviceGuideHint {
 const facts=savedFacts(s,journal);
 if(!facts)return {step:'replay',cue:'教学记录暂不可还原',body:'保存的命令记录不完整，无法确认练习进度。可以继续游戏或重新练习。'};
 const fact:NoviceGuideFact={...(facts.pair?{pairScore:facts.pair.finalScore,pairHeat:fraction(facts.pair.accumulator.H),pairMultiplier:fraction(facts.pair.accumulator.M)}:{}),
  ...(facts.purchase?{purchaseInstanceId:facts.purchase.instanceId,purchaseDefinitionId:facts.purchase.definitionId}:{}),
  ...(facts.event?{eventId:facts.event.eventId,finalScore:facts.payoff!.finalScore,contribution:contribution(facts.payoffEvents!),briefContribution:briefContribution(facts.payoffEvents!)}:{}),
  ...(facts.skill?{skillEventId:facts.skill.events.find(e=>e.reasonKey==='erxiang.handoff')?.eventId,
    skillContribution:fractionText(facts.skill.events.filter(e=>e.reasonKey==='erxiang.handoff').reduce((sum,e)=>{const before=Rational.fromJSON(e.before.M),after=Rational.fromJSON(e.after.M);return sum.add(after.add(new Rational(-before.n,before.d)));},new Rational(0n)).toJSON())}:{})};
 if(facts.skillPractice)return {step:'complete',cue:'练习完成',body:'你已学会出牌、换牌和技能。',fact};
 if(s.phase==='run-lost')return {step:'replay',cue:'可以再练一次',body:'本局已结束，练习尚未完成。可以重新练习，或开始普通局。',fact};
 if(facts.skill){
  // The fixed tutorial's next real stage can be B01. Keep its actual discard
  // cost visible without interrupting the one-hand practice with a full Boss briefing.
  const firstB01=s.phase==='await-input'&&s.stage?.boss?.definitionId==='B01'&&s.stage.playIndex===0;
  return firstB01?{step:'skill-practice',cue:`${fact.skillContribution} 点转为倍率`,body:'先自己出一手；出牌前弃牌要用 2 次。',fact}
   :{step:'skill-practice',cue:'刘娥技能生效了',body:`${fact.skillContribution} 点转为倍率。${s.phase==='await-input'?'再自己打一手。':'下场自己打一手。'}`,fact};
 }
 if(facts.event){
  const elsewhere=s.phase!=='await-input'&&s.phase!=='pending-refill';
  return {step:'skill',cue:`${cardDisplayName(facts.purchase!.definitionId)}：${fact.briefContribution}`,body:elsewhere?'进入下一场，再试刘娥技能。':'选一对，再试刘娥技能。',recommendedCardIds:elsewhere?[]:pairIds(s),fact};
 }
 if((s.phase==='stage-cleared'||s.stageIndex>0)&&(!facts.pair||!facts.discarded||!facts.independent))return {step:'replay',cue:'可以再练一次',body:'本场已结束，练习尚未完成。可以继续游戏，或重新开始练习。',fact};
 if(!facts.pair){
  const ids=pairIds(s),rank=ids.length?s.deckInstances.find(c=>c.id===ids[0])?.rank:undefined;
  if(!rank&&s.phase==='await-input'&&s.stage&&(s.drawPile.length===0||s.stage.discardsLeft===0&&s.stage.handsLeft<=1))return {step:'replay',cue:'可以重练找对子',body:'手中没有对子，也无法再换来牌。可以继续出牌，或重新练习。',fact};
  const next=rank?`点两张 ${rankLabel(rank)}；花色可以不同。`:s.stage&&s.stage.discardsLeft===0?'先出牌，补牌后再找对子。':'先弃牌换牌，再找同点数。';
  return {step:'pair',cue:s.lastTrace?'再找一对':'先找一对',body:next,recommendedCardIds:ids,fact};
 }
 if(!facts.discarded){
  if(s.stage?.index===0&&(s.stage.discardsLeft<=0||s.drawPile.length===0))return {step:'replay',cue:'这场暂时不能换牌',body:'本场弃牌次数或可抽的牌已用完。可以继续出牌，或重练换牌。',fact};
  return {step:'discard',cue:novicePairResultCue(facts.pair!),body:'选不要的牌，点「弃牌」换新牌。',fact};
 }
 if(!facts.independent)return {step:'independent',cue:`累计 ${s.stage?.targetHeat??'目标'} 分过关`,body:'自己选牌，再点「出牌」。',fact};
 if(!facts.cleared)return {step:'independent',cue:'继续向目标出牌',body:'自己选牌，累计达到目标分数。',fact};
 if(!facts.purchase)return {step:'shop',cue:'过关了',body:s.phase==='shop'?`点「${cardDisplayName('b02')}」看效果和价格。`:'去商店看看唐宋牌。',offerIds:offers(s),fact};
 const owned=s.jokers.some(j=>j.instanceId===facts.purchase!.instanceId);
 const when=s.phase==='shop'?'下一场':'这场';
 const payoff=s.phase==='shop'?'进入下一场，试试这张牌。':facts.purchase.definitionId==='b02'?'选两张同点数的牌，打出看看。':'按这张牌的条件选牌并打出。';
 return {step:'payoff',cue:`${when}试出这张牌的效果`,body:owned?payoff:'之前买的牌已不在持牌中。可在商店选另一张，或重新练习。',recommendedCardIds:facts.purchase.definitionId==='b02'?pairIds(s):[],fact};
}

/** Unsaved selection affects only the next prompt, never saved tutorial progress. */
export function liveNoviceGuide(hint:NoviceGuideHint,selectedIds:readonly string[],skill:{available:boolean;chosen:boolean;enabled:boolean;canDiscard:boolean}):NoviceGuideHint {
 const selected=new Set(selectedIds),recommended=hint.recommendedCardIds??[];
 if(hint.step==='pair'&&recommended.length===2){
  const chosen=recommended.filter(id=>selected.has(id)).length,extra=selected.size-chosen;
  if(extra>0)return {...hint,cue:'再找一对',body:'先取消这张牌。',recommendedCardIds:[...selected].filter(id=>!recommended.includes(id)).slice(0,1)};
  if(chosen===2)return {...hint,cue:'对子选好了',body:'点「出牌」，看看得分。',recommendedCardIds:[],focus:'play'};
  if(chosen===1)return {...hint,cue:'再选另一张',body:'点数相同，就是对子。',recommendedCardIds:recommended.filter(id=>!selected.has(id))};
 }
 if(hint.step==='discard'&&selected.size)return {...hint,cue:'准备换牌',body:'点「弃牌」，换入新牌。',focus:'discard'};
 if((hint.step==='independent'||hint.step==='skill-practice')&&selected.size)return {...hint,body:'点「出牌」，看看结果。',focus:'play'};
 if(hint.step==='payoff'&&recommended.length===2&&selected.size===2&&recommended.every(id=>selected.has(id)))
  return {...hint,cue:'牌选好了',body:'点「出牌」，看看这张牌的作用。',recommendedCardIds:[],focus:'play'};
 if((hint.step==='payoff'||hint.step==='skill')&&recommended.length===2&&!skill.available){
  const extra=[...selected].filter(id=>!recommended.includes(id));
  if(extra.length)return {...hint,body:'先取消这张牌。',recommendedCardIds:extra.slice(0,1)};
  if(selected.size===1)return {...hint,body:'再选另一张同点数的牌。',recommendedCardIds:recommended.filter(id=>!selected.has(id))};
 }
 if(hint.step==='skill'){
  if(!skill.enabled)return {...hint,body:'本场技能不可用，下一场再试。',recommendedCardIds:[]};
  if(skill.chosen)return {...hint,cue:'技能已选',body:'点「确认出牌」发动技能。',recommendedCardIds:[],focus:'play'};
  if(skill.available)return {...hint,cue:'牌点可转为倍率',body:'点刘娥技能，再选一张牌。',recommendedCardIds:[],focus:'hero'};
  if(!recommended.length){
   if(selected.size)return {...hint,body:skill.canDiscard?'点「弃牌」，换牌找对子。':'先出牌补牌，再找对子。',focus:skill.canDiscard?'discard':'play'};
   return {...hint,body:skill.canDiscard?'手里没对子，先弃牌换一换。':'先出牌补牌，再找对子。'};
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
