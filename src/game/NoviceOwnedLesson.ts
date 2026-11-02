import {stableHash} from '../domain/hash';
import type {Command,R2RunState} from '../domain/run';
import type {NoviceGuideHint} from './NoviceGuide';
import type {shopLayout} from './ShopLayout';
import type {Box} from './layout';

/** This is presentation state, not a game checkpoint or proof of a purchase. */
export const NOVICE_OWNED_LESSON_PREFIX='tangsongpai-novice-owned-v1:';
type ReorderAttempt={seq:number;stageIndex:number;ids:string[]};
type Record={identity:string;offerId:string;purchaseSeq:number;stageIndex:number;opened:boolean;expanded:boolean;openSeq:number;reorder?:ReorderAttempt};
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
   expanded:typeof p.expanded==='boolean'?p.expanded:p.opened,openSeq:Number.isInteger(p.openSeq)?p.openSeq:p.purchaseSeq,...(reorder?{reorder}:{})};
  memory.set(k,result);return result;
 }catch{return memory.get(k);}
}
function write(s:R2RunState,p:Record):void {
 const k=key(s);memory.set(k,p);
 try{localStorage.setItem(k,JSON.stringify(p));unpersisted.delete(k);}catch{unpersisted.add(k);}
}

/** Arm only while the enrolled guide asks for the first purchase. An attempt is
 * harmless until its exact command appears in the published saved journal. */
export function armNoviceOwnedLesson(s:R2RunState,hint:NoviceGuideHint|undefined,offerId:string):void {
 if(s.phase!=='shop'||s.jokers.length!==0||hint?.step!=='shop')return;
 write(s,{identity:identity(s),offerId,purchaseSeq:s.commandSeq+1,stageIndex:s.stageIndex,opened:false,expanded:false,openSeq:s.commandSeq});
}

function committed(s:R2RunState,journal:readonly Command[],seq:number,predicate:(command:Command)=>boolean):Command|undefined {
 const command=journal.find(c=>c.expectedSeq+1===seq&&c.runId===s.runId&&predicate(c));
 return command&&s.receipts.some(r=>r.seq===seq&&r.commandId===command.commandId&&r.fingerprint===stableHash(command))?command:undefined;
}

/** A marker is insufficient: use the guide's validated journal and the real,
 * still-owned instance. Missing, rolled-back, imported or old runs stay safe. */
export function noviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined) {
 const p=read(s);
 if(!p||!hint||!['payoff','skill','skill-practice'].includes(hint.step)||s.phase!=='shop'||s.stageIndex<p.stageIndex)return;
 const purchase=committed(s,journal,p.purchaseSeq,c=>c.action.type==='BuyOffer'&&c.action.offerId===p.offerId);
 if(!purchase||!s.jokers.some(j=>j.instanceId===`${s.runId}/joker/${purchase.commandId}`))return;
 const reordered=!!p.reorder&&!!committed(s,journal,p.reorder.seq,c=>c.action.type==='ReorderJokers'&&
  JSON.stringify(c.action.ids)===JSON.stringify(p.reorder!.ids));
 // In a later shop, resume only when there are actually multiple cards to
 // rearrange; do not repeat a finished lesson in subsequent shops.
 if(s.stageIndex>p.stageIndex&&(s.jokers.length<2||reordered&&p.reorder?.stageIndex!==s.stageIndex))return;
 // Each new Joker purchase folds the rail, including a purchase saved by retry.
 // The instance may have since been sold; the matching saved sale still proves its kind.
 const purchasedAfterOpen=journal.some(c=>{
  if(c.expectedSeq+1<=p.openSeq||c.action.type!=='BuyOffer')return false;
  const id=`${s.runId}/joker/${c.commandId}`;
  return s.jokers.some(j=>j.instanceId===id)||journal.some(sale=>sale.action.type==='SellJoker'&&sale.action.instanceId===id);
 });
 return {opened:p.opened,expanded:p.expanded&&!purchasedAfterOpen,reordered};
}

/** Record only an actual click that made the real rail visible. */
export function openNoviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s);if(!p||!noviceOwnedLesson(s,journal,hint))return;
 write(s,{...p,opened:true,expanded:true,openSeq:s.commandSeq});
}
/** Keep a deliberate re-fold across a refresh without changing lesson progress. */
export function closeNoviceOwnedLesson(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined):void {
 const p=read(s);if(!p||!p.expanded||!noviceOwnedLesson(s,journal,hint))return;
 write(s,{...p,expanded:false});
}

/** Called for a real drag before dispatch, so retrying a failed save can still
 * be recognized. The journal/receipt check, not this intent, proves success. */
export function attemptNoviceOwnedReorder(s:R2RunState,journal:readonly Command[],hint:NoviceGuideHint|undefined,ids:readonly string[]):void {
 const p=read(s),lesson=noviceOwnedLesson(s,journal,hint);if(!p||!lesson||lesson.reordered||s.jokers.length<2)return;
 const current=s.jokers.map(j=>j.instanceId);
 if(ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.includes(id))||ids.every((id,i)=>id===current[i]))return;
 write(s,{...p,reorder:{seq:s.commandSeq+1,stageIndex:s.stageIndex,ids:[...ids]}});
}

export type NoviceOwnedFocus='toggle'|'slots'|'play'|'none';
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
export function presentNoviceOwnedLesson(hint:NoviceGuideHint,lesson:{reordered:boolean}|undefined,layout:{collapsed:boolean;canExpand:boolean;count:number;finePointer?:boolean}):{hint:NoviceGuideHint;focus:NoviceOwnedFocus} {
 if(!lesson)return {hint,focus:hint.step==='payoff'?'play':'none'};
 if(layout.collapsed){
  if(layout.canExpand)return {hint:{...hint,cue:'展开已拥有牌',body:'点上箭头，展开已拥有牌区域。'},focus:'toggle'};
  return {hint:{...hint,cue:'查看已拥有牌',body:'当前屏幕空间不足以展开牌列；调整窗口大小后可查看。'},focus:'none'};
 }
 if(layout.count===1)return {hint:{...hint,cue:'这里有五个槽',body:layout.finePointer?'现在只有一张。以后有多张时，按住鼠标左键，等牌抬起后拖到另一张再松开换序。':'现在只有一张。以后有多张时，按住牌不松手，等抬起后拖到另一张再松手换序。'},focus:'slots'};
 if(!lesson.reordered)return {hint:{...hint,cue:'试试调整顺序',body:layout.finePointer?'按住鼠标左键，等牌抬起后拖到另一张再松开换序。这里共有五个槽。':'按住牌不松手，等抬起后拖到另一张再松手换序。这里共有五个槽。',gesture:'hold-drag'},focus:'slots'};
 return {hint:{...hint,cue:'顺序已保存',body:'可以继续整理，或进入下一场试试效果。'},focus:'play'};
}
