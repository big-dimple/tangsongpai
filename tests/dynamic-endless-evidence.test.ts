import {describe,expect,it} from 'vitest';
import {dynamicClearHash,dynamicHandHash,makeDynamicClearEvidence,makeDynamicHandEvidence,verifyDynamicClearEvidence,verifyDynamicClearChain} from '../src/domain/r2DynamicEndlessEvidence';
import {stableHash} from '../src/domain/hash';
import type {Command} from '../src/domain/run';
const command:Command={runId:'run',commandId:'hand/one',expectedSeq:9,action:{type:'PlayHand',selectedIds:['hearts-2']}};
const stage={index:24,clearId:'run/clear/24',heat:'5000000',targetHeat:'2000000',skipResult:null};
const trace={rootId:'run/hand/hand/one',finalScore:'4000000'};
describe('clear evidence draft',()=>{
 it('ties the recorded score to a clear outcome and the actual command receipt',()=>{
  const e=makeDynamicClearEvidence(stage,trace,command),r={commandId:command.commandId,seq:10,fingerprint:stableHash(command),endlessClearHash:dynamicClearHash(e)};
  expect(verifyDynamicClearEvidence(e,r,'run')).toBe(true);
  expect(verifyDynamicClearEvidence({...e,score:'5000001'},r,'run')).toBe(false);
  expect(verifyDynamicClearEvidence(e,{...r,endlessClearHash:undefined},'run')).toBe(false);
  expect(verifyDynamicClearEvidence(e,{...r,seq:11},'run')).toBe(false);
  expect(verifyDynamicClearEvidence(e,{...r,fingerprint:'different'},'run')).toBe(false);
 });
 it('rejects skipped, failed, wrong-command and wrong-run records',()=>{
  expect(()=>makeDynamicClearEvidence({...stage,skipResult:{kind:'gold',amount:1}},trace,command)).toThrow();
  expect(()=>makeDynamicClearEvidence({...stage,heat:'100'},trace,command)).toThrow();
  expect(()=>makeDynamicClearEvidence(stage,trace,{...command,action:{type:'SkipStage'}})).toThrow();
  expect(()=>makeDynamicClearEvidence(stage,trace,{...command,runId:'other'})).toThrow();
 });
 it('checks each committed hand and the complete stage sum, not only the final hand',()=>{
  const earlier:Command={runId:'run',commandId:'hand/zero',expectedSeq:6,action:{type:'PlayHand',selectedIds:['spades-2']}};
  const first=makeDynamicHandEvidence(24,'0','1000000',{rootId:'run/hand/hand/zero',finalScore:'1000000'},earlier);
  const last=makeDynamicHandEvidence(24,'1000000','5000000',trace,command),clear=makeDynamicClearEvidence(stage,trace,command);
  const receipts=[{commandId:earlier.commandId,seq:7,fingerprint:stableHash(earlier),endlessHandHash:dynamicHandHash(first)},{commandId:command.commandId,seq:10,fingerprint:stableHash(command),endlessHandHash:dynamicHandHash(last),endlessClearHash:dynamicClearHash(clear)}];
  expect(verifyDynamicClearChain(clear,[first,last],receipts,'run')).toBe(true);
  expect(verifyDynamicClearChain(clear,[last],receipts,'run')).toBe(false);
  expect(verifyDynamicClearChain(clear,[{...first,score:'2'},last],receipts,'run')).toBe(false);
  expect(verifyDynamicClearChain(clear,[first,last],[receipts[0],{...receipts[1],endlessHandHash:undefined}],'run')).toBe(false);
 });
});
