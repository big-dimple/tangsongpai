import type {PlayingCard} from '../cards/types';
import {stableHash} from '../domain/hash';
import type {Command} from '../domain/run';
import type {HandSelectionUpdate} from './HandSelectionGesture';

const PREFIX='tangsongpai-novice-hand-interaction-v1:';
type Lesson={sortId?:string;sortHash?:string;swept:boolean;flushIntroSeen?:boolean;flushSortedSeen?:boolean};

/** The longest consecutive same-suit run, as it is actually arranged on the table. */
export function consecutiveSuitCards(hand:readonly PlayingCard[]):string[] {
 let best:PlayingCard[]=[],current:PlayingCard[]=[];
 for(const card of hand){
  current=current.length&&current[0].suit===card.suit?[...current,card]:[card];
  if(current.length>best.length)best=current;
 }
 return best.length>=2?best.slice(0,5).map(card=>card.id):[];
}

/** UI lesson progress; the associated sort must still exist in the saved journal. */
export class NoviceHandLesson {
 private value:Lesson={swept:false};
 private readonly key:string;
 constructor(readonly runId:string){
  this.key=PREFIX+runId;
  try{
   const data=JSON.parse(localStorage.getItem(this.key)??'null');
   if(data&&typeof data.swept==='boolean')this.value={swept:data.swept,
    ...(typeof data.sortId==='string'&&typeof data.sortHash==='string'?{sortId:data.sortId,sortHash:data.sortHash}:{}),
    flushIntroSeen:data.flushIntroSeen===true,flushSortedSeen:data.flushSortedSeen===true};
  }catch{/* The lesson remains usable in memory if optional local storage is unavailable. */}
 }
 private save():void {try{localStorage.setItem(this.key,JSON.stringify(this.value));}catch{/* Preferences must never block the game. */}}
 sorted(journal:readonly Command[]):boolean {
  const valid=!!this.value.sortId&&!!this.value.sortHash&&journal.some(command=>command.runId===this.runId&&command.commandId===this.value.sortId&&command.action.type==='ReorderHand'&&stableHash(command)===this.value.sortHash);
  if(!valid&&this.value.sortId){this.value={swept:false,flushIntroSeen:this.value.flushIntroSeen};this.save();}
  return valid;
 }
 swept(journal:readonly Command[]):boolean {return this.sorted(journal)&&this.value.swept;}
 flushIntroSeen():boolean {return this.value.flushIntroSeen===true;}
 flushSortedSeen(journal:readonly Command[]):boolean {return this.sorted(journal)&&this.value.flushSortedSeen===true;}
 acknowledgeFlushIntro():void {this.value={...this.value,flushIntroSeen:true};this.save();}
 acknowledgeFlushSorted(journal:readonly Command[]):void {if(this.sorted(journal)){this.value={...this.value,flushSortedSeen:true};this.save();}}
 recordSort(command:Command):void {
  if(command.runId!==this.runId||command.action.type!=='ReorderHand')return;
  const hash=stableHash(command),same=this.value.sortId===command.commandId&&this.value.sortHash===hash;
  this.value={sortId:command.commandId,sortHash:hash,swept:same&&this.value.swept,flushIntroSeen:this.value.flushIntroSeen,flushSortedSeen:same&&this.value.flushSortedSeen};this.save();
 }
 recordSweep(update:HandSelectionUpdate,targetIds:readonly string[],initialIds:readonly string[]):boolean {
  const target=new Set(targetIds),selected=new Set(update.selectedIds),visited=new Set(update.visitedIds),initial=new Set(initialIds);
  if(!this.value.sortId||target.size<2||update.phase!=='committed'||update.mode!=='select'||update.limitReached||
    [...target].some(id=>!visited.has(id)||!selected.has(id))||[...target].filter(id=>!initial.has(id)&&selected.has(id)).length<2)return false;
  this.value={...this.value,swept:true};this.save();return true;
 }
}
