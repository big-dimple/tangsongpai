import type {PlayingCard} from '../cards/types';
import {stableHash} from '../domain/hash';
import type {Command} from '../domain/run';
import type {HandSelectionUpdate} from './HandSelectionGesture';
import type {NoviceGuideHint} from './NoviceGuide';

const PREFIX='tangsongpai-novice-hand-interaction-v1:';
export type FlushPlan='draw'|'score';
export type HandSort='rank'|'suit';
type Lesson={sortId?:string;sortHash?:string;sortMode?:HandSort;sweepId?:string;sweepHash?:string;flushPlan?:FlushPlan};
type Seat={visible:boolean;hit:{y:number}};

/** Only trace uninterrupted cards in one visible row. Prefer the player's example. */
export function noviceSwipePath(hand:readonly PlayingCard[],seats:readonly Seat[],mode:HandSort,preferred:readonly string[]=[],disabled:readonly string[]=[]):string[] {
 const wanted=new Set(preferred),blocked=new Set(disabled);
 let best:string[]=[],current:string[]=[],rowStart:string[]=[],fallback:string[]=[];
 let previous:PlayingCard|undefined,previousY:number|undefined;
 for(const [index,card] of hand.entries()){
  const seat=seats[index];
  if(!seat?.visible||blocked.has(card.id)){previous=undefined;previousY=undefined;current=[];rowStart=[];continue;}
  const sameRow=previousY!==undefined&&Math.abs(previousY-seat.hit.y)<=2;
  if(!sameRow){current=[];rowStart=[];}
  if(rowStart.length<2)rowStart.push(card.id);
  if(!fallback.length&&rowStart.length===2)fallback=[...rowStart];
  if(!sameRow||previous?.[mode]!==card[mode])current=[];
  if(wanted.size&&!wanted.has(card.id))current=[];
  else {
   if(current.length<5)current.push(card.id);
   if(current.length>=2&&current.length>best.length)best=[...current];
  }
  previous=card;previousY=seat.hit.y;
 }
 return best.length||wanted.size?best:fallback;
}

/** Offer a real table action. The underlying hand, choices and resource counts stay player-owned. */
export function handControlHint(hint:NoviceGuideHint,options:{mode:HandSort;needsSort:boolean;path:readonly string[];coarse:boolean}):NoviceGuideHint {
 if(options.needsSort){
  const rank=options.mode==='rank';
  return {...hint,cue:'先去理牌区',body:rank?'点「点数」把对子排在一起。「花色」适合找同花。':'点「花色」把同花色排在一起。「点数」适合找对子。',
   recommendedCardIds:[],gesture:undefined,gestureCardIds:undefined,focus:rank?'sort-rank':'sort-suit'};
 }
 const path=options.path;
 if(path.length<2)return hint;
 const how=options.coarse?'沿亮线横滑连选，松手看预估。从已选牌起滑可连撤。':'按住鼠标左键沿亮线拖动，松开看预估。从已选牌起拖可连撤。';
 return {...hint,cue:'试试横滑选牌',body:how,
  focus:undefined,recommendedCardIds:[path[0],path[path.length-1]],gesture:'sweep',gestureCardIds:[...path]};
}

/** Sort and swipe are independent skills, each backed by the published checkpoint where it happened. */
export class NoviceHandLesson {
 private value:Lesson={};
 revision=0;
 private readonly key:string;
 constructor(readonly runId:string){
  this.key=PREFIX+runId;
  try{
   const data=JSON.parse(localStorage.getItem(this.key)??'null');
   if(!data)return;
   if(typeof data.sortId==='string'&&typeof data.sortHash==='string'){
    this.value.sortId=data.sortId;this.value.sortHash=data.sortHash;
    this.value.sortMode=data.sortMode==='rank'?'rank':'suit'; // Older lessons only recorded suit sorting.
   }
   if(typeof data.sweepId==='string'&&typeof data.sweepHash==='string'){
    this.value.sweepId=data.sweepId;this.value.sweepHash=data.sweepHash;
   }else if(data.swept===true){this.value.sweepId=this.value.sortId;this.value.sweepHash=this.value.sortHash;}
   this.value.flushPlan=data.flushPlan==='score'?'score':data.flushPlan==='draw'||data.flushIntroSeen===true?'draw':undefined;
  }catch{/* Optional storage can be unavailable. Keep the lesson playable in memory. */}
 }
 private save():void {this.revision++;try{localStorage.setItem(this.key,JSON.stringify(this.value));}catch{/* UI preferences must not block play. */}}
 private receipt(journal:readonly Command[],id?:string,hash?:string):Command|undefined {
  if(!id||!hash)return;
  const command=journal.find(c=>c.runId===this.runId&&c.commandId===id);
  return command&&stableHash(command)===hash?command:undefined;
 }
 sortMode(journal:readonly Command[]):HandSort|undefined {
  return this.receipt(journal,this.value.sortId,this.value.sortHash)?.action.type==='ReorderHand'?this.value.sortMode:undefined;
 }
 swept(journal:readonly Command[]):boolean {return !!this.receipt(journal,this.value.sweepId,this.value.sweepHash);}
 flushPlan():FlushPlan|undefined {return this.value.flushPlan;}
 chooseFlushPlan(plan:FlushPlan):void {this.value.flushPlan=plan;this.save();}
 recordSort(mode:HandSort,command:Command):void {
  if(command.runId!==this.runId||command.action.type!=='ReorderHand')return;
  this.value={...this.value,sortId:command.commandId,sortHash:stableHash(command),sortMode:mode};this.save();
 }
 recordSweep(update:HandSelectionUpdate,initialIds:readonly string[],journal:readonly Command[]):boolean {
  const command=journal.at(-1);
  if(!command||command.runId!==this.runId||update.phase!=='committed'||update.limitReached)return false;
  const initial=new Set(initialIds),selected=new Set(update.selectedIds);
  const changed=[...new Set(update.visitedIds)].filter(id=>update.mode==='select'?!initial.has(id)&&selected.has(id):initial.has(id)&&!selected.has(id));
  if(changed.length<2)return false;
  if(!this.swept(journal)){this.value.sweepId=command.commandId;this.value.sweepHash=stableHash(command);this.save();}
  return true;
 }
}
