import type {R2RunState} from '../domain/r2Run';
import {HAND_LABELS} from '../content/handLabels';
import {stageOutcome} from './stageOutcome';

/** A receipt of the committed U09 event, never a prediction from chapter usage. */
export function reviewBookReceipt(run:R2RunState,cleared:boolean,skipped=false){
 const stage=run.stage;
 if(!cleared||skipped||!stage?.clearId||stage.skipResult||stage.index%3!==2||
   !['stage-cleared','run-won'].includes(run.phase)||!run.longTermItems.includes('U09'))return;
 const trace=stageOutcome(stage,run.lastTrace).last;
 const event=trace?.events.find(e=>e.rootId===trace.rootId&&e.phase==='onStageClear'&&
   e.sourceType==='rule'&&e.sourceDefinitionId==='U09'&&e.sourceInstanceId===run.runId&&
   e.operation==='upgrade-hand'&&e.targetHandType&&Object.hasOwn(HAND_LABELS,e.targetHandType)&&
   Number.isSafeInteger(e.resourceBefore)&&e.resourceBefore!>=1&&Number.isSafeInteger(e.resourceAfter)&&
   e.resourceAfter===e.resourceBefore!+1&&e.value.n==='1'&&e.value.d==='1');
 if(!event)return;
 return {clearId:stage.clearId,eventId:event.eventId,handType:event.targetHandType!,before:event.resourceBefore!,after:event.resourceAfter!,
   label:`复盘本：${HAND_LABELS[event.targetHandType!]} Lv${event.resourceBefore}→Lv${event.resourceAfter}`};
}

/** Like the reward coin, only a live clear token may play a one-shot accent.
 * Restores retain the static receipt; resize/art arrival never replays it. */
export class ReviewBookCue {
 private consumed?:string;
 claim(run:R2RunState,result:{cleared:boolean;stageIndex:number;rewardClearId?:string}):boolean {
  const receipt=reviewBookReceipt(run,result.cleared);
  if(!receipt||run.stage!.index!==result.stageIndex||result.rewardClearId!==receipt.clearId||this.consumed===receipt.eventId)return false;
  this.consumed=receipt.eventId;return true;
 }
}
