import type {Command,DomainEvent,Receipt} from './run';
import type {R2RunState} from './r2Run';
import {stableHash} from './hash';
import {dynamicClearHash,dynamicHandHash,dynamicReceiptOutcome,makeDynamicClearEvidence,makeDynamicHandEvidence,type DynamicClearEvidence,type DynamicHandEvidence,type DynamicEvidenceReceipt} from './r2DynamicEndlessEvidence';

/** Capture only facts emitted by the same successful command transaction.
 * The caller must persist the returned record and stamped receipt atomically. */
export function captureDynamicScore(before:R2RunState,after:R2RunState,command:Command,events:readonly DomainEvent[],receipt:Receipt):{hand:DynamicHandEvidence;clear:DynamicClearEvidence|null;receipt:DynamicEvidenceReceipt}|undefined {
 if(command.action.type!=='PlayHand'&&command.action.type!=='PlayAssistedHand')return;
 const old=before.stage,stage=after.stage,scored=events.filter(e=>e.type==='hand-scored-r2');
 if(!old||!stage||before.phase!=='await-input'||old.clearId!==null||old.skipResult!==null||old.index!==stage.index||stage.playIndex!==old.playIndex+1||before.runId!==after.runId||before.runId!==command.runId||command.expectedSeq!==before.commandSeq||after.commandSeq!==before.commandSeq+1||receipt.commandId!==command.commandId||receipt.seq!==after.commandSeq||receipt.fingerprint!==stableHash(command)||scored.length!==1)throw Error('invalid-dynamic-score-transaction');
 const trace=scored[0].score;
 if(trace.rootId!==after.lastTrace?.rootId||trace.finalScore!==after.lastTrace.finalScore)throw Error('invalid-dynamic-score-trace');
 const hand=makeDynamicHandEvidence(stage.index,old.heat,stage.heat,trace,command);
 const ended=events.filter((e):e is Extract<DomainEvent,{type:'stage-ended'}>=>e.type==='stage-ended'&&e.cleared);
 if(ended.length>1||!!stage.clearId!==!!ended.length||ended.length&&stableHash(ended[0].stage)!==stableHash(stage))throw Error('invalid-dynamic-clear-transaction');
 const clear=ended.length?makeDynamicClearEvidence(stage,trace,command):null;
 return {hand,clear,receipt:{...receipt,endlessOutcome:dynamicReceiptOutcome(dynamicHandHash(hand),clear?dynamicClearHash(clear):'')}};
}
