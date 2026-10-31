import {rankLabel} from '../cards/types';
import {stableHash} from '../domain/hash';
import {Rational} from '../domain/rational';
import {applyCommand,type Command,type R2RunState} from '../domain/run';
import {routeStarterStartCommand} from '../domain/r2RouteStarter';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {r2PurchasePrice} from '../domain/r2Shop';
import {r2JokerCapacity} from '../domain/r2Resources';
import {r2DiscardCost} from '../domain/r2Run';
import {prepareBossSuitRescueAction} from '../domain/r2BossSuitRescue';
import {GUIDED_TUTORIAL_SEED,isGuidedTutorialRunId} from './RunLaunch';
import {cardDisplayName} from './tangsongCardNames';
import {fractionText} from './scoreText';
import {characterForRun} from './CharacterRunCopy';
import {OPENING_ROUTES} from './HeroOpeningCopy';

/** Optional presentation preferences only. Game progress always comes from the saved run. */
export const NOVICE_GUIDE_KEY='tangsongpai-novice-guide-v1';
export const NOVICE_GUIDE_PENDING_PREFIX='tangsongpai-novice-start:';
export const NOVICE_GUIDE_PREFERENCES_EVENT='tangsongpai-novice-guide-preferences';
export type NoviceGuideStep='pair'|'discard'|'independent'|'shop'|'payoff'|'complete'|'replay';
export interface NoviceGuideFact {
 pairScore?:string;
 pairHeat?:string;
 pairMultiplier?:string;
 purchaseInstanceId?:string;
 purchaseDefinitionId?:string;
 eventId?:string;
 finalScore?:string;
 contribution?:string;
}
export interface NoviceGuideHint {
 step:NoviceGuideStep;
 cue:string;
 body:string;
 details?:string;
 recommendedCardIds?:string[];
 offerIds?:string[];
 fact?:NoviceGuideFact;
}
type Preferences={disabled:boolean;enrolled?:string;muted:boolean;skipped:NoviceGuideStep[]};
const allSteps:readonly NoviceGuideStep[]=['pair','discard','independent','shop','payoff','complete','replay'];
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
 purchase?:{instanceId:string;definitionId:string;stageIndex:number};event?:ScoreEvent;payoff?:ScoreTrace;payoffEvents?:ScoreEvent[]};
const factCache=new WeakMap<R2RunState,{journal:readonly Command[];facts:Facts}>();
const fraction=(v:{n:string;d:string})=>v.d==='1'?v.n:`${v.n}/${v.d}`;
const positive=(value:string)=>/^\d+$/.test(value)&&BigInt(value)>0n;
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
  const stat=event.operation==='add-multiplier'?'倍率':'热度';
  if(same.every(e=>e.phase==='onCardScore'&&e.targetCardId)&&new Set(targets).size===same.length)return `让${same.length}张计分牌各加 ${value} ${stat}`;
  return `触发${same.length}次，每次加 ${value} ${stat}`;
 }
 if(event.operation==='add-multiplier')return `让倍率 +${value}`;
 if(event.operation==='add-heat')return `让热度 +${value}`;
 if(event.operation==='multiply-multiplier')return `让倍率 ×${value}`;
 if(event.operation==='retrigger-card')return `让计分牌额外计分 ${value} 次`;
 const heat=Rational.fromJSON(event.after.H).compare(Rational.fromJSON(event.before.H))>0;
 return heat?`让热度 ${fractionText(event.before.H)} → ${fractionText(event.after.H)}`:`让倍率 ${fractionText(event.before.M)} → ${fractionText(event.after.M)}`;
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
  ...(facts.event?{eventId:facts.event.eventId,finalScore:facts.payoff!.finalScore,contribution:contribution(facts.payoffEvents!)}:{})};
 if(facts.event){
  const heroEvent=facts.pair!.events.some(e=>e.sourceType==='character'&&e.sourceDefinitionId===s.characterId);
  const heroResult=heroEvent?'那手对子有刘娥的实际计分事件。':facts.pair!.erxiangHandoff?'那手对子没有选择使用刘娥技能。':'那手对子没有刘娥的计分事件。';
  const route=s.openingRoute&&OPENING_ROUTES[s.openingRoute];
  return {step:'complete',cue:'这张牌真的发挥了作用',body:`练习中「${cardDisplayName(facts.purchase!.definitionId)}」${fact.contribution}；那手共 ${facts.payoff!.finalScore} 分。此局使用刘娥，不计普通通关；普通局可换英雄和路线。`,
   details:`${heroResult}\n刘娥：${characterForRun(s).passiveDescription}\n路线：${route?`${route.title}侧重${route.play}`:'路线是重点培养牌型的参考。'}路线可调整，不限制出牌。`,fact};
 }
 if(s.phase==='run-lost')return {step:'replay',cue:'可以再练一次',body:'本局已结束，练习尚未完成。可以重新练习，或开始普通局。',fact};
 if(s.stageIndex>0&&(!facts.pair||!facts.discarded||!facts.independent))return {step:'replay',cue:'可以再练一次',body:'本场已结束，练习尚未完成。可以继续游戏，或重新开始练习。',fact};
 if(!facts.pair){
  const ids=pairIds(s),rank=ids.length?s.deckInstances.find(c=>c.id===ids[0])?.rank:undefined;
  const last=s.lastTrace?`上一手是${s.lastTrace.handType==='pair'?'对子':'其他牌型'}，得 ${s.lastTrace.finalScore} 分。`:'';
  if(!rank&&s.phase==='await-input'&&s.stage&&(s.drawPile.length===0||s.stage.discardsLeft===0&&s.stage.handsLeft<=1))return {step:'replay',cue:'可以重练找对子',body:'手中没有对子，也无法再换来牌。可以继续出牌，或重新练习。',fact};
  const next=rank?`试着选两张 ${rankLabel(rank)} 再出牌。`:s.stage&&s.stage.discardsLeft===0?'先出牌，补牌后再找同点数。':'可以先弃牌换牌，再找同点数。';
  return {step:'pair',cue:'认识牌面，自己选一对',body:`开局默认刘娥、同点方向，普通局可换。数字和 JQKA 是点数；♠黑桃、♥红桃、♣梅花、♦方片是花色。同点就是对子。${last}${next}`,recommendedCardIds:ids,fact};
 }
 if(!facts.discarded){
  if(s.stage?.index===0&&(s.stage.discardsLeft<=0||s.drawPile.length===0))return {step:'replay',cue:'这场暂时不能换牌',body:'本场弃牌次数或可抽的牌已用完。可以继续出牌，或重练换牌。',fact};
  const stage=s.stage;
  const replacement=stage&&s.handOrder.length===stage.handLimit&&s.drawPile.length>=5?'换等量新牌':'从牌堆补牌，牌不足会少补';
  return {step:'discard',cue:'看看目标，再试试弃牌',body:`对子得 ${fact.pairScore} 分（热度 ${fact.pairHeat} × 倍率 ${fact.pairMultiplier}）。目标 ${stage?.targetHeat??'见牌桌'}，现有 ${stage?.heat??'见牌桌'}；余出牌 ${stage?.handsLeft??'见牌桌'} 次、弃牌 ${stage?.discardsLeft??'见牌桌'} 次。选1–5张不要的牌，花${r2DiscardCost(s)}次弃牌${replacement}；抽牌不保证凑齐。`,fact};
 }
 if(!facts.independent)return {step:'independent',cue:'现在自己决定出什么',body:'已换入新牌。同花是5张相同花色；顺子是5张连续点数，如3、4、5接下去。现在自己选牌出手。',fact};
 if(!facts.cleared)return {step:'independent',cue:'继续向目标出牌',body:'你已经独立出过一手。继续选牌，达到本场目标；次数用完也可以重练。',fact};
 if(!facts.purchase)return {step:'shop',cue:'过关后看看商店',body:`首战过关！看看「${cardDisplayName('b02')}」：同点计分牌加倍率。看清价格后自行决定；没货也可选别的或留钱。`,offerIds:offers(s),fact};
 const owned=s.jokers.some(j=>j.instanceId===facts.purchase!.instanceId);
 return {step:'payoff',cue:'下一场试出这张牌的效果',body:owned?'查看新牌条件，自己选牌。触发时，计分明细才会显示它的真实贡献。':'之前买的牌已不在持牌中。可在商店选另一张，或重新练习。',recommendedCardIds:facts.purchase.definitionId==='b02'?pairIds(s):[],fact};
}
/** Pass the SavedRun's published state and journal; no unsaved candidate or local preference proves progress. */
export function noviceGuide(s:R2RunState,journal?:readonly Command[]):NoviceGuideHint|undefined {
 const p=read();if(p.disabled||p.muted||!isGuided(s)||p.enrolled!==runKey(s))return;
 const hint=deriveHint(s,journal);
 return p.skipped.includes(hint.step)?undefined:hint;
}
