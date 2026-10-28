import type {PlayingCard} from '../cards/types';
import {isR2LaohuanFind} from './r2GroupUpgrade';

export const usesLaohuanFind=(s:{characterId?:unknown;contentVersion?:unknown;contentHash?:unknown})=>s.characterId==='laohuan'&&isR2LaohuanFind(s);
export interface LaohuanFindIntent {batchIds:readonly string[];beforeUsed:boolean;rank:number|null}
export interface LaohuanFindTrace {batchIds:string[];beforeUsed:boolean;rank:number|null;activeIds:string[];multiplier:2|3|4|null;afterUsed:boolean}
/** Only actual retained instances and currently active scoring cards count. */
export function laohuanFindGroups(cards:readonly PlayingCard[],activeIds:readonly string[],batchIds:readonly string[]) {
 const groups=new Map<PlayingCard['rank'],string[]>();
 for(const card of cards)if(activeIds.includes(card.id)&&batchIds.includes(card.id))groups.set(card.rank,[...(groups.get(card.rank)??[]),card.id]);
 const maximum=Math.max(0,...[...groups.values()].map(ids=>ids.length));
 return maximum<2?[]:[...groups].filter(([,ids])=>ids.length===maximum).map(([rank,ids])=>({rank,ids}));
}
export function laohuanFindStep(cards:readonly PlayingCard[],activeIds:readonly string[],intent:LaohuanFindIntent,enabled:boolean):LaohuanFindTrace {
 if(!intent||!Array.isArray(intent.batchIds)||new Set(intent.batchIds).size!==intent.batchIds.length||intent.batchIds.some(id=>typeof id!=='string'||!id)||typeof intent.beforeUsed!=='boolean'||intent.rank!==null&&(!Number.isInteger(intent.rank)||intent.rank<2||intent.rank>14))throw Error('invalid-laohuan-find');
 const group=intent.rank===null?undefined:laohuanFindGroups(cards,activeIds,intent.batchIds).find(g=>g.rank===intent.rank);
 if(intent.rank!==null&&(!enabled||intent.beforeUsed||!group))throw Error('laohuan-find-unavailable');
 return {batchIds:[...intent.batchIds],beforeUsed:intent.beforeUsed,rank:intent.rank,activeIds:group?.ids??[],multiplier:group?(Math.min(4,group.ids.length) as 2|3|4):null,afterUsed:intent.beforeUsed||!!group};
}

import {stableHash} from './hash';
import type {Command} from './run';
import type {R2RunState} from './r2Run';
export interface LaohuanFindProof {source:Command;handBefore:string[];drawBefore:string[];handLimit:number;stageIndex:number;playIndex:number;candidateIds:string[];choice:Command|null;pending:boolean}
export function laohuanFindToken(s:Pick<R2RunState,'handOrder'|'drawPile'|'stageIndex'|'stage'>):string {
 return stableHash({hand:s.handOrder,draw:s.drawPile,handLimit:s.stage!.handLimit,stageIndex:s.stageIndex,playIndex:s.stage!.playIndex});
}
export function findProofRetained(p:LaohuanFindProof):string[] {
 return p.pending?[]:p.choice&&p.choice.action.type==='ChooseRefill'?p.candidateIds.filter(id=>p.choice!.action.type==='ChooseRefill'&&p.choice!.action.selectedIds.includes(id)):[...p.candidateIds];
}
export function validLaohuanFindProof(p:LaohuanFindProof,state:R2RunState):boolean {
 try{
  const a=p.source.action;if(a.type!=='DiscardHand'||!Array.isArray(p.handBefore)||!Array.isArray(p.drawBefore)||!Array.isArray(p.candidateIds)||!Array.isArray(a.selectedIds)||!p.source.commandId||p.source.runId!==state.runId||!Number.isSafeInteger(p.source.expectedSeq)||!Number.isSafeInteger(p.stageIndex)||!Number.isSafeInteger(p.playIndex)||!Number.isSafeInteger(p.handLimit)||p.handLimit<1||p.handLimit>14||p.handBefore.length>14||p.stageIndex!==state.stage!.index||p.playIndex<0||p.playIndex>state.stage!.playIndex)return false;
  const all=[...p.handBefore,...p.drawBefore];if(all.some(id=>typeof id!=='string'||!state.deckInstances.some(c=>c.id===id))||new Set(all).size!==all.length||!a.selectedIds.length||a.selectedIds.length>5||new Set(a.selectedIds).size!==a.selectedIds.length||a.selectedIds.some(id=>!p.handBefore.includes(id)))return false;
  const token=stableHash({hand:p.handBefore,draw:p.drawBefore,handLimit:p.handLimit,stageIndex:p.stageIndex,playIndex:p.playIndex});if(!state.receipts.some(r=>r.commandId===p.source.commandId&&r.seq===p.source.expectedSeq+1&&r.fingerprint===stableHash(p.source)&&r.laohuanFindSnapshot===token))return false;
  const gap=p.handLimit-(p.handBefore.length-a.selectedIds.length);if(gap<1)return false;
  const candidates=p.drawBefore.slice(-Math.min(gap+2,p.drawBefore.length)).reverse();if(stableHash(candidates)!==stableHash(p.candidateIds))return false;
  if(typeof p.pending!=='boolean')return false;
  if(p.pending)return p.choice===null&&p.candidateIds.length>gap&&state.phase==='pending-refill'&&state.pendingRefill?.discardCommandId===p.source.commandId&&stableHash(state.pendingRefill.candidateIds)===stableHash(p.candidateIds);
  if(p.candidateIds.length<=gap)return p.choice===null;
  const c=p.choice;if(!c||c.action.type!=='ChooseRefill'||c.runId!==state.runId||c.expectedSeq!==p.source.expectedSeq+1||!Array.isArray(c.action.selectedIds)||c.action.selectedIds.length!==gap||new Set(c.action.selectedIds).size!==gap||c.action.selectedIds.some(id=>!p.candidateIds.includes(id)))return false;
  return state.receipts.some(r=>r.commandId===c.commandId&&r.seq===c.expectedSeq+1&&r.fingerprint===stableHash(c));
 }catch{return false;}
}
