import {describe,expect,it} from 'vitest';
import {applyCommand,createRun,type Action,type Command,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {captureDynamicScore} from '../src/domain/r2DynamicEndlessCapture';
import {verifyDynamicHandEvidence,verifyDynamicClearChain} from '../src/domain/r2DynamicEndlessEvidence';

function send(state:R2RunState,action:Action){const command:Command={runId:state.runId,commandId:`capture/${state.commandSeq}`,expectedSeq:state.commandSeq,action};const result=applyCommand(state,command);if(!result.ok)throw Error(result.code);return {command,result};}
describe('dynamic score capture',()=>{
 it('captures real scored transactions and does not alter state or RNG',()=>{
  let state=createRun({rulesVersion:'r2',runId:'capture',seed:'warning',characterId:'azao',openingRoute:'group',r2Identity:newRunIdentity('azao','group')});
  state=send(state,{type:'LeaveShop'}).result.state;state=send(state,{type:'EnterStage'}).result.state;
  for(let i=0;i<2;i++){
   const before=state,{command,result}=send(before,{type:'PlayHand',selectedIds:[before.handOrder[0]]});state=result.state;
   const snapshot=structuredClone(state),capture=captureDynamicScore(before,state,command,result.events,result.receipt)!;
   expect(capture.hand.before).toBe(before.stage!.heat);expect(capture.hand.after).toBe(state.stage!.heat);
   expect(verifyDynamicHandEvidence(capture.hand,capture.receipt,state.runId)).toBe(true);
   expect(state).toEqual(snapshot);expect(capture.clear).toBeNull();
   expect(()=>captureDynamicScore(before,state,command,result.events,{...result.receipt,fingerprint:'wrong'})).toThrow('invalid-dynamic-score-transaction');
  }
 });
 it('captures an actual multi-hand clear and rejects a missing intermediate receipt',()=>{
  let state=createRun({rulesVersion:'r2',runId:'capture-clear',seed:'warning',characterId:'azao',openingRoute:'group',r2Identity:newRunIdentity('azao','group')});
  state=send(state,{type:'LeaveShop'}).result.state;state=send(state,{type:'EnterStage'}).result.state;
  const hands:ReturnType<typeof captureDynamicScore>[]=[];
  while(state.phase==='await-input'){
   const before=state,ids=before.handOrder,choices:string[][]=[];
   for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)choices.push([ids[a],ids[b]]);
   for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)for(let c=b+1;c<ids.length;c++)choices.push([ids[a],ids[b],ids[c]]);
   let best:ReturnType<typeof send>|undefined;
   for(const selectedIds of choices){const attempt=send(before,{type:'PlayHand',selectedIds});if(!best||BigInt(attempt.result.state.stage!.heat)>BigInt(best.result.state.stage!.heat))best=attempt;}
   if(!best)throw Error('no choices');state=best.result.state;hands.push(captureDynamicScore(before,state,best.command,best.result.events,best.result.receipt));
  }
  expect(state.phase).toBe('stage-cleared');expect(hands.length).toBeGreaterThan(1);
  const records=hands.map(h=>h!.hand),receipts=hands.map(h=>h!.receipt),clear=hands.at(-1)!.clear!;
  expect(verifyDynamicClearChain(clear,records,receipts,state.runId)).toBe(true);
  expect(verifyDynamicClearChain(clear,records,receipts.slice(1),state.runId)).toBe(false);
 });
});
