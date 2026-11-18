import {stableHash} from '../domain/hash';
import type {Command,R2RunState} from '../domain/run';
import type {NoviceGuideHint} from './NoviceGuide';
import type {shopLayout} from './ShopLayout';
import type {Box} from './layout';

/** This is presentation state, not a game checkpoint or proof of a purchase. */
export const NOVICE_OWNED_LESSON_PREFIX='tangsongpai-novice-owned-v1:';
type ReorderAttempt={seq:number;stageIndex:number;ids:string[]};
type Record={identity:string;offerId:string;purchaseSeq:number;stageIndex:number;opened:boolean;expanded:boolean;openSeq:number;secondPrompt:boolean;lifted?:true;reorder?:ReorderAttempt};
const memory=new Map<string,Record>(),unpersisted=new Set<string>();
const identity=(s:R2RunState)=>JSON.stringify([s.runId,s.seed,s.characterId,s.contentVersion,s.contentHash,s.mode,s.difficulty,s.challengeId,s.tourMode]);
const key=(s:R2RunState)=>NOVICE_OWNED_LESSON_PREFIX+s.runId;

function read(s:R2RunState):Record|undefined {
 const k=key(s);if(unpersisted.has(k))return memory.get(k);
 try {
  const p=JSON.parse(localStorage.getItem(k)??'null');
  if(!p||p.identity!==identity(s)||typeof p.offerId!=='string'||!Number.isInteger(p.purchaseSeq)||p.purchaseSeq<1||
     !Number.isInteger(p.stageIndex)||typeof p.opened!=='boolean')return;
  const reorder=p.reorder&&Number.isInteger(p.reorder.seq)&&Array.isArray(p.reorder.ids)&&p.reorder.ids.every((id:unknown)=>typeof id==='string')
   ?{seq:p.reorder.seq as number,stageIndex:Number.isInteger(p.reorder.stageIndex)?p.reorder.stageIndex:p.stageIndex,ids:p.reorder.ids as string[]}:undefined;
  const result:Record={identity:p.identity,offerId:p.offerId,purchaseSeq:p.purchaseSeq,stageIndex:p.stageIndex,opened:p.opened,
   expanded:typeof p.expanded==='boolean'?p.expanded:p.opened,openSeq:Number.isInteger(p.openSeq)?p.openSeq:p.purchaseSeq,secondPrompt:p.secondPrompt===true,...(p.lifted===true?{lifted:true as const}:{}),...(reorder?{reorder}:{})};
  memory.set(k,result);return result;
 }catch{return memory.get(k);}
}
function write(s:R2RunState,p:Record):void {
 const k=key(s);memory.set(k,p);
 try{localStorage.setItem(k,JSON.stringify(p));unpersisted.delete(k);}catch{unpersisted.add(k);}
}

/** Arm when the enrolled guide asks to acquire a playable first card. An attempt is
 * harmless until its exact command appears in the published saved journal. */
export function armNoviceOwnedLesson(s:R2RunState,hint:NoviceGuideHint|undefined,offerId:string):void {
 if(s.phase!=='shop'||s.jokers.length!==0||!(hint?.step==='shop'||hint?.step==='payoff'&&hint.fact?.purchaseStatus==='sold'))return;
 write(s,{identity:identity(s),offerId,purchaseSeq:s.commandSeq+1,stageIndex:s.stageIndex,opened:false,expanded:false,openSeq:s.commandSeq,secondPrompt:false});
}

function committed(s:R2RunState,journal:readonly Command[],seq:number,predicate:(command:Command)=>boolean):Command|undefined {
 const command=journal.find(c=>c.expectedSeq+1===seq&&c.runId===s.runId&&predicate(c));
 return command&&s.receipts.some(r=>r.seq===seq&&r.commandId===command.commandId&&r.fingerprint===stableHash(command))?command:undefined;
}

/** A marker is insufficient: use the guide's validated journal and the real,
 * still-owned instance. Missing, rolled-back, imported or old runs stay safe. */
export function noviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined) {
 if(!hint||!['payoff','skill','skill-practice'].includes(hint.step)||(s.phase!=='shop'&&s.phase!=='await-input'))return;
 const p=read(s);if(!p||s.stageIndex<p.stageIndex)return;
 const purchase=committed(s,journal,p.purchaseSeq,c=>c.action.type==='BuyOffer'&&c.action.offerId===p.offerId);
 if(!purchase||!s.jokers.some(j=>j.instanceId===`${s.runId}/joker/${purchase.commandId}`))return;
 const reordered=!!p.reorder&&!!committed(s,journal,p.reorder.seq,c=>c.action.type==='ReorderJokers'&&
  JSON.stringify(c.action.ids)===JSON.stringify(p.reorder!.ids));
 // In a later shop, resume only when there are actually multiple cards to
 // rearrange; do not repeat a finished lesson in subsequent shops.
 if(s.phase==='shop'&&s.stageIndex>p.stageIndex&&(s.jokers.length<2||reordered&&p.reorder?.stageIndex!==s.stageIndex))return;
 // A second owned card reveals the rail, including a purchase saved by retry.
 // The instance may have since been sold; the matching saved sale still proves its kind.
 const purchasedAfterOpen=journal.some(c=>{
  if(c.expectedSeq+1<=p.openSeq||c.action.type!=='BuyOffer')return false;
  const id=`${s.runId}/joker/${c.commandId}`;
  return s.jokers.some(j=>j.instanceId===id)||journal.some(sale=>sale.action.type==='SellJoker'&&sale.action.instanceId===id);
 });
 return {opened:p.opened,expanded:purchasedAfterOpen?s.jokers.length>=2:p.expanded,reordered,...(p.lifted?{lifted:true}:{}),...(p.secondPrompt?{secondPrompt:true}:{})};
}

/** A real lift has no game command. Its lesson belongs to the saved purchase. */
export function recordNoviceOwnedLift(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s);if(!p||p.lifted||s.jokers.length!==1||!noviceOwnedLesson(s,journal,hint))return;
 write(s,{...p,lifted:true});
}

/** Record only an actual click that made the real rail visible. */
export function openNoviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s);if(!p||!noviceOwnedLesson(s,journal,hint))return;
 write(s,{...p,opened:true,expanded:true,openSeq:s.commandSeq});
}
/** The player explicitly moves from the five-slot explanation to browsing. */
export function advanceNoviceSecondOffer(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s),lesson=noviceOwnedLesson(s,journal,hint);
 if(!p||!lesson||s.jokers.length!==1||p.secondPrompt)return;
 write(s,{...p,secondPrompt:true});
}

/** Keep a deliberate re-fold across a refresh without changing lesson progress. */
export function closeNoviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s);if(!p||!noviceOwnedLesson(s,journal,hint)?.expanded)return;
 write(s,{...p,expanded:false,openSeq:s.commandSeq});
}

/** Called for a real drag before dispatch, so retrying a failed save can still
 * be recognized. The journal/receipt check, not this intent, proves success. */
export function attemptNoviceOwnedReorder(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined,ids:readonly string[]):void {
 const p=read(s),lesson=noviceOwnedLesson(s,journal,hint);if(!p||!lesson||lesson.reordered||s.jokers.length<2)return;
 const current=s.jokers.map(j=>j.instanceId);
 if(ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.includes(id))||ids.every((id,i)=>id===current[i]))return;
 write(s,{...p,reorder:{seq:s.commandSeq+1,stageIndex:s.stageIndex,ids:[...ids]}});
}

export type NoviceOwnedFocus='toggle'|'slots'|'offer'|'tab'|'shelf'|'play'|'reroll'|'none';
type Rail={count:number;finePointer?:boolean;reverse?:boolean;names?:string[];swipedBeforeLift?:boolean};
const orderRule=(reverse?:boolean)=>reverse?'本关的整手效果从右到左结算':'同阶段的唐宋牌通常从左到右触发';
const orderExample='假设同一阶段有两张牌生效，一张加 1 倍率，一张把倍率乘 2。从 2 倍起，先加后乘是 6 倍，先乘后加是 5 倍。';
export function noviceOwnedPractice(hint:NoviceGuideHint,rail:Rail):NoviceGuideHint {
 const single=rail.count===1;
 const body=single?(rail.finePointer?'在牌面按住鼠标左键不动':'手指按住牌面不动')+'，等牌浮起再松手。有两张就能拖动换位。':
  (rail.finePointer?'在第 1 张按住鼠标左键不动，等牌浮起，再拖到第 2 张后松开。':'按住第 1 张不动，等牌浮起，再拖到第 2 张后松手。')+'同阶段先加倍率再乘，得分可能更高。';
 return {...hint,cue:rail.swipedBeforeLift?'先按住别滑':single?'长按这张唐宋牌':'试试调整顺序',body,beat:orderRule(rail.reverse),details:orderExample,
  focus:undefined,recommendedCardIds:[],choices:undefined,gesture:single?'hold':'hold-drag'};
}
export function noviceOwnedSaved(hint:NoviceGuideHint,rail:Rail):NoviceGuideHint {
 const names=rail.names??[];
 const order=names.length?'左起依次是'+names.join('、')+'。':'';
 return {...hint,cue:'顺序已保存',beat:orderRule(rail.reverse),body:order+'例如从 2 倍起，先加 1 再乘 2 得 6 倍，反过来是 5 倍。',details:orderExample,
  focus:undefined,recommendedCardIds:[],choices:undefined,gesture:undefined};
}
/** Keep the entire PC rail legible, including labels outside the card hitboxes.
 * Leave the blank sidebar below the chapter button available for the hint. */
export function noviceOwnedLessonPcAvoid(p:ReturnType<typeof shopLayout>):Box[] {
 const pc=p.pc;if(!pc)return [];
 return [
  {x:p.x,y:0,width:p.w,height:pc.left.y},
  pc.ownedRail,pc.shopPanel,
  {x:pc.left.x,y:pc.left.y,width:pc.left.width,height:p.chapter.y+p.chapter.height-pc.left.y},
  {x:pc.left.x,y:pc.left.y+pc.left.height-44,width:pc.left.width,height:44},
 ];
}
/** The caller supplies actual layout visibility; no hint asks for an impossible move. */
export function presentNoviceOwnedLesson(hint:NoviceGuideHint,lesson:{reordered:boolean;lifted?:boolean;secondPrompt?:boolean}|undefined,layout:Rail & {collapsed:boolean;canExpand:boolean;secondOffer?:{id:string;name:string};secondLocation?:'tab'|'more'|'none'}):{hint:NoviceGuideHint;focus:NoviceOwnedFocus} {
 if(hint.focus==='reroll')return {hint,focus:'reroll'};
 if(hint.offerIds?.length&&hint.step==='payoff'&&hint.fact?.purchaseStatus!=='ready')return {hint,focus:'offer'};
 if(!lesson)return {hint,focus:hint.step==='payoff'?'play':'none'};
 const tryCard={id:'novice-try-card',label:'上桌试牌',cardIds:[]};
 const secondCard={id:'novice-second-card',label:'挑第二张练换位',cardIds:[]};
 const acquired=hint.fact?.purchaseDefinitionId?'已入手 · '+hint.cue:undefined;
 if(layout.collapsed){
  if(layout.canExpand)return {hint:{...hint,beat:acquired,cue:'展开已拥有牌',body:'点亮起的箭头看唐宋牌。长按不动等牌浮起，有两张时能拖动换位。',details:orderExample,choices:layout.count===1?[tryCard,secondCard]:[tryCard]},focus:'toggle'};
  return {hint:{...hint,beat:acquired,cue:'下一手试试新牌',body:'上桌可长按唐宋牌，等牌浮起。有两张时能拖动换位。',details:orderExample,choices:[tryCard]},focus:'play'};
 }
 if(layout.count===1){
  if(!lesson.secondPrompt)return {hint:{...hint,beat:acquired,cue:layout.swipedBeforeLift&&!lesson.lifted?'先按住别滑':'这里有五个槽',body:'长按不动，等牌浮起。有两张时可拖动换位。'+orderRule(layout.reverse)+'。',details:[hint.payoffAction,orderExample].filter(Boolean).join('\n'),gesture:lesson.lifted?undefined:'hold',choices:[tryCard,secondCard]},focus:'slots'};
  if(layout.secondOffer)return {hint:{...hint,cue:'再看看一张牌',body:`点亮的「${layout.secondOffer.name}」可查看效果和价格，也可选别的或进入牌桌。`,gesture:undefined,choices:undefined,offerIds:[layout.secondOffer.id]},focus:'offer'};
  if(layout.secondLocation==='tab')return {hint:{...hint,cue:'再看看唐宋牌',body:'点「唐宋牌」看看其他牌，也可直接进入牌桌。',gesture:undefined,choices:undefined,offerIds:[]},focus:'tab'};
  if(layout.secondLocation==='more')return {hint:{...hint,cue:'再看看唐宋牌',body:'翻页或下滑看看其他牌，也可直接进入牌桌。',gesture:undefined,choices:undefined,offerIds:[]},focus:'shelf'};
  return {hint:{...hint,cue:'继续下一场',body:'目前没有可买的第二张，先进入牌桌；之后还可以再买。',gesture:undefined,choices:undefined,offerIds:[]},focus:'play'};
 }
 if(!lesson.reordered)return {hint:noviceOwnedPractice(hint,layout),focus:'slots'};
 return {hint:noviceOwnedSaved(hint,layout),focus:'play'};
}
