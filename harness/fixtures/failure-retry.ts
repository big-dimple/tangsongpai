import {createRun,assertRunInvariants,type R2RunState} from '../../src/domain/run';
import {lockR2ChapterTargets} from '../../src/domain/r2Chapter';
import {newRunIdentity} from '../../src/game/RunLaunch';
import {energySend} from './hero-climax';
import {settlementReady} from './settlement';
import {makeCheckpoint,MAX_JOURNAL,type Checkpoint} from '../../src/application/checkpoint';
import type {Action,Command} from '../../src/domain/run';

/** Controlled terminal fixtures, scored/ended by original domain commands. Not natural runs. */
export function failureRetryFixture(kind:'hands'|'cards'|'abandoned'|'boss'|'post-skip'):{before:R2RunState;after:R2RunState;checkpoint?:Checkpoint}{
 const journal:Command[]=[];
 const send=(s:R2RunState,action:Action)=>{journal.push({runId:s.runId,commandId:s.runId+'/command/'+(s.commandSeq+1),expectedSeq:s.commandSeq,action});return energySend(s,action);};
 if(kind==='boss'){
  const f=settlementReady('boss-loss','current');
  f.state.boss={definitionId:'B02',disabledSuit:null};f.state.stage!.boss=structuredClone(f.state.boss);f.state.stage!.disabledIds=[];f.state.seenBossIds=['B02'];
  f.state.jokers=[];f.action.selectedIds=f.state.handOrder.slice(0,5);
  f.action.selectedIds.forEach((id,index)=>{f.state.deckInstances.find(c=>c.id===id)!.suit=(['spades','hearts','clubs','diamonds','hearts'] as const)[index];});
  f.state.chapterTargetPlan=lockR2ChapterTargets(f.state.chapter,f.state.tourMode,f.state.difficulty,f.state.boss);
  assertRunInvariants(f.state);
  return {before:f.state,after:energySend(f.state,f.action)};
 }
 let s=createRun({seed:'controlled/failure-retry/'+kind,runId:'controlled/failure-retry/'+kind,characterId:'laohuan',rulesVersion:'r2',r2Identity:newRunIdentity('laohuan','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 s=send(s,{type:'LeaveShop'});
 if(kind==='post-skip'){s=energySend(s,{type:'SkipStage'});return {before:s,after:energySend(s,{type:'AbandonRun'})};}
 s=send(s,{type:'EnterStage'});
 const entry=makeCheckpoint(s,journal);
 if(kind==='cards'){
  // Exhausted stage zones retain the complete deck; the final real Play ends it with unused hands.
  const id=s.handOrder[0];s.handOrder=[id];s.drawPile=[];s.discardPile=s.deckInstances.map(c=>c.id).filter(c=>c!==id);assertRunInvariants(s);
  return {before:s,after:energySend(s,{type:'PlayHand',selectedIds:[id]})};
 }
 if(kind==='abandoned')return {before:s,after:energySend(s,{type:'AbandonRun'})};
 // A real stage can be retried even after ordinary sorting has bounded away its journal.
 for(let i=0;i<=MAX_JOURNAL;i++)s=send(s,{type:'ReorderHand',ids:[...s.handOrder].reverse()});
 while(s.stage!.handsLeft>1){
  const id=[...s.handOrder].sort((a,b)=>s.deckInstances.find(c=>c.id===a)!.rank-s.deckInstances.find(c=>c.id===b)!.rank)[0];
  s=send(s,{type:'PlayHand',selectedIds:[id]});
 }
 const after=send(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});
 return {before:s,after,checkpoint:makeCheckpoint(after,journal,entry)};
}
