import {stableHash} from './hash';
import {MAX_INTEGER_DIGITS} from './rational';
import type {Command,Receipt} from './run';
import type {R2StageState} from './r2Run';
import type {ScoreTrace} from './scoreR2';

/** A bounded source record captured in the same successful clear transaction. */
export interface DynamicClearEvidence {
 stageIndex:number;clearId:string;score:string;target:string;finalHandScore:string;rootId:string;command:Command;
}
export interface DynamicHandEvidence {stageIndex:number;before:string;after:string;score:string;rootId:string;command:Command}
export type DynamicEvidenceReceipt=Receipt&{endlessClearHash?:string;endlessHandHash?:string};
const validScore=(s:unknown):s is string=>typeof s==='string'&&s.length<=MAX_INTEGER_DIGITS&&/^(0|[1-9]\d*)$/.test(s);
const outcome=(e:DynamicClearEvidence)=>({stageIndex:e.stageIndex,clearId:e.clearId,score:e.score,target:e.target,finalHandScore:e.finalHandScore,rootId:e.rootId});
export const dynamicClearHash=(e:DynamicClearEvidence)=>stableHash(outcome(e));
const handOutcome=(e:DynamicHandEvidence)=>({stageIndex:e.stageIndex,before:e.before,after:e.after,score:e.score,rootId:e.rootId});
export const dynamicHandHash=(e:DynamicHandEvidence)=>stableHash(handOutcome(e));
export function makeDynamicHandEvidence(stageIndex:number,before:string,after:string,trace:Pick<ScoreTrace,'rootId'|'finalScore'>,command:Command):DynamicHandEvidence {
 const e={stageIndex,before,after,score:trace.finalScore,rootId:trace.rootId,command:structuredClone(command)};
 if(!dynamicHandEvidenceShape(e,command.runId))throw Error('invalid-dynamic-hand-evidence');
 return e;
}
export function dynamicHandEvidenceShape(e:DynamicHandEvidence,runId:string):boolean {
 return !!e&&Number.isSafeInteger(e.stageIndex)&&e.stageIndex>=0&&validScore(e.before)&&validScore(e.after)&&validScore(e.score)&&BigInt(e.before)+BigInt(e.score)===BigInt(e.after)&&!!e.command&&e.command.runId===runId&&typeof e.command.commandId==='string'&&!!e.command.commandId&&Number.isSafeInteger(e.command.expectedSeq)&&e.command.expectedSeq>=0&&['PlayHand','PlayAssistedHand'].includes(e.command.action?.type)&&e.rootId===`${runId}/hand/${e.command.commandId}`;
}
export function verifyDynamicHandEvidence(e:DynamicHandEvidence,receipt:DynamicEvidenceReceipt|undefined,runId:string):boolean {
 return dynamicHandEvidenceShape(e,runId)&&!!receipt&&receipt.commandId===e.command.commandId&&receipt.seq===e.command.expectedSeq+1&&receipt.fingerprint===stableHash(e.command)&&receipt.endlessHandHash===dynamicHandHash(e);
}
/** Does not reconstruct earlier hands; the caller captures the actual committed stage, never a claimed score. */
export function makeDynamicClearEvidence(stage:Pick<R2StageState,'index'|'clearId'|'heat'|'targetHeat'|'skipResult'>,trace:Pick<ScoreTrace,'rootId'|'finalScore'>,command:Command):DynamicClearEvidence {
 const e={stageIndex:stage.index,clearId:stage.clearId??'',score:stage.heat,target:stage.targetHeat,finalHandScore:trace.finalScore,rootId:trace.rootId,command:structuredClone(command)};
 if(stage.skipResult!==null||!dynamicClearEvidenceShape(e,command.runId))throw Error('invalid-dynamic-clear-evidence');
 return e;
}
export function dynamicClearEvidenceShape(e:DynamicClearEvidence,runId:string):boolean {
 return !!e&&Number.isSafeInteger(e.stageIndex)&&e.stageIndex>=0&&e.clearId===`${runId}/clear/${e.stageIndex}`&&validScore(e.score)&&validScore(e.target)&&validScore(e.finalHandScore)&&BigInt(e.target)>0n&&BigInt(e.score)>=BigInt(e.target)&&BigInt(e.score)>=BigInt(e.finalHandScore)&&BigInt(e.score)-BigInt(e.finalHandScore)<BigInt(e.target)&&!!e.command&&e.command.runId===runId&&typeof e.command.commandId==='string'&&!!e.command.commandId&&Number.isSafeInteger(e.command.expectedSeq)&&e.command.expectedSeq>=0&&['PlayHand','PlayAssistedHand'].includes(e.command.action?.type)&&e.rootId===`${runId}/hand/${e.command.commandId}`;
}
/** Existing command receipts alone cannot establish score; require the clear outcome stamp. */
export function verifyDynamicClearEvidence(e:DynamicClearEvidence,receipt:DynamicEvidenceReceipt|undefined,runId:string):boolean {
 return dynamicClearEvidenceShape(e,runId)&&!!receipt&&receipt.commandId===e.command.commandId&&receipt.seq===e.command.expectedSeq+1&&receipt.fingerprint===stableHash(e.command)&&receipt.endlessClearHash===dynamicClearHash(e);
}
/** Replay-free consistency of a complete bounded stage, tied to committed outcome receipts. */
export function verifyDynamicClearChain(clear:DynamicClearEvidence,hands:readonly DynamicHandEvidence[],receipts:readonly DynamicEvidenceReceipt[],runId:string):boolean {
 if(!hands.length||hands.length>7||!verifyDynamicClearEvidence(clear,receipts.find(r=>r.commandId===clear.command.commandId),runId))return false;
 let previous='0',previousSeq=-1;
 for(const hand of hands){
  const receipt=receipts.find(r=>r.commandId===hand.command.commandId);
  if(hand.stageIndex!==clear.stageIndex||hand.before!==previous||hand.command.expectedSeq<=previousSeq||!verifyDynamicHandEvidence(hand,receipt,runId))return false;
  previous=hand.after;previousSeq=hand.command.expectedSeq;
 }
 const last=hands[hands.length-1];
 return previous===clear.score&&last.score===clear.finalHandScore&&last.rootId===clear.rootId&&stableHash(last.command)===stableHash(clear.command);
}
