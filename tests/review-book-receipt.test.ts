import {describe,it,expect} from 'vitest';
import {applyCommand} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {reviewBookReady} from '../harness/fixtures/review-book';
import {energySend} from '../harness/fixtures/hero-climax';
import {reviewBookReceipt,ReviewBookCue} from '../src/game/ReviewBookReceipt';
import {settlementFacts} from '../src/game/SettlementPresentation';

const clear=()=>{const f=reviewBookReady();return energySend(f.state,f.action);};
const live=(run:ReturnType<typeof clear>)=>({cleared:true,stageIndex:run.stage!.index,rewardClearId:run.stage!.clearId!});
describe('review book committed clear receipt',()=>{
 it('displays the actual most-used discovered hand, rather than the winning hand',()=>{
  const run=clear(),before=JSON.stringify(run),receipt=reviewBookReceipt(run,true)!;
  expect(run.lastTrace!.handType).toBe('straight');
  expect(receipt).toMatchObject({handType:'two-pair',before:2,after:3,label:'复盘本：两对 Lv2→Lv3'});
  expect(run.lastTrace!.events.find(e=>e.eventId===receipt.eventId)).toMatchObject({sourceDefinitionId:'U09',phase:'onStageClear',operation:'upgrade-hand',targetHandType:'two-pair',resourceBefore:2,resourceAfter:3});
  expect(settlementFacts(run,true).reviewBook).toEqual(receipt);
  expect(JSON.stringify(run)).toBe(before);
 });
 it('preserves existing low-to-high table tie order, including cap skip without redraw',()=>{
  const f=reviewBookReady();f.state.handLevels.pair=5;f.state.chapterHandUsage={pair:2,'two-pair':2};
  const run=energySend(f.state,f.action);
  expect(reviewBookReceipt(run,true)?.label).toBe('复盘本：对子 Lv5→Lv6');
  expect(run.handLevels['two-pair']).toBe(2);
  f.state.handLevels.pair=30;
  const capped=energySend(f.state,f.action);
  expect(reviewBookReceipt(capped,true)).toBeUndefined();expect(capped.handLevels['two-pair']).toBe(2);
 });
 it.each([['ordinary',true],['boss-loss',true],['boss-win',false]] as const)('does not imply a benefit for %s / owned %s',(kind,owned)=>{
  const f=reviewBookReady(kind,owned),run=energySend(f.state,f.action);
  expect(run.phase).toBe(kind==='boss-loss'?'run-lost':'stage-cleared');
  expect(run.lastTrace!.events.some(e=>e.sourceDefinitionId==='U09')).toBe(false);
  expect(reviewBookReceipt(run,kind!=='boss-loss')).toBeUndefined();
 });
 it('requires a saved source event and the current successful result',()=>{
  const f=reviewBookReady();expect(reviewBookReceipt(f.state,true)).toBeUndefined();
  const run=clear();expect(reviewBookReceipt(run,false)).toBeUndefined();expect(reviewBookReceipt(run,true,true)).toBeUndefined();
  const noSource=structuredClone(run);noSource.lastTrace!.events=noSource.lastTrace!.events.filter(e=>e.sourceDefinitionId!=='U09');
  expect(reviewBookReceipt(noSource,true)).toBeUndefined();
  const noTrace=structuredClone(run);noTrace.lastTrace=null;expect(reviewBookReceipt(noTrace,true)).toBeUndefined();
  const next=energySend(energySend(energySend(run,{type:'OpenShop'}),{type:'LeaveShop'}),{type:'EnterStage'});
  expect(reviewBookReceipt(next,true)).toBeUndefined();
 });
 it('restores the receipt without reapplying the upgrade or replaying the live cue',()=>{
  const run=clear(),checkpoint=makeCheckpoint(run,[]),restored=readCheckpoint(checkpoint);
  expect(restored.ok).toBe(true);if(!restored.ok)throw Error(restored.code);
  const saved=restored.checkpoint.state as typeof run,before=JSON.stringify(saved),cue=new ReviewBookCue();
  expect(cue.claim(run,live(run))).toBe(true);
  for(let i=0;i<3;i++){
   expect(reviewBookReceipt(saved,true)).toEqual(reviewBookReceipt(run,true));
   expect(cue.claim(saved,live(saved))).toBe(false);
   expect(new ReviewBookCue().claim(saved,{cleared:true,stageIndex:saved.stage!.index})).toBe(false);
  }
  expect(JSON.stringify(saved)).toBe(before);expect(saved.handLevels['two-pair']).toBe(3);
 });
 it('a retried committed command cannot upgrade twice or produce another cue',()=>{
  const f=reviewBookReady(),command={runId:f.state.runId,commandId:'review-book-clear',expectedSeq:f.state.commandSeq,action:f.action};
  const first=applyCommand(f.state,command);expect(first.ok).toBe(true);if(!first.ok)throw Error(first.code);
  const cue=new ReviewBookCue();expect(cue.claim(first.state,live(first.state))).toBe(true);
  const retry=applyCommand(first.state,command);expect(retry.ok).toBe(true);if(!retry.ok)throw Error(retry.code);
  expect(retry.duplicate).toBe(true);expect(retry.state).toEqual(first.state);
  expect(retry.state.lastTrace!.events.filter(e=>e.sourceDefinitionId==='U09')).toHaveLength(1);
  expect(cue.claim(retry.state,live(retry.state))).toBe(false);
 });
});
