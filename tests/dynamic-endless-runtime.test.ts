import {describe,expect,it} from 'vitest';
import {applyCommand,createRun,type Action,type Command,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {drawR2Boss,lockR2ChapterTargets} from '../src/domain/r2Chapter';
import {SeededRng} from '../src/core/SeededRng';
import {getR2Stage} from '../src/domain/r2Run';
import {dynamicEndlessAdvanceAnchor,dynamicEndlessStageTarget} from '../src/domain/r2DynamicEndless';
import {r2DynamicEndlessBase} from '../src/domain/r2GroupUpgrade';
import {stableHash} from '../src/domain/hash';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';

function send(s:R2RunState,action:Action){const c:Command={runId:s.runId,commandId:`runtime/${s.commandSeq}`,expectedSeq:s.commandSeq,action};const r=applyCommand(s,c);if(!r.ok)throw Error(r.code);return {state:r.state,command:c};}
const round=(s:R2RunState)=>{const parsed=readCheckpoint(makeCheckpoint(s,[]));expect(parsed.ok,parsed.ok?'':parsed.code).toBe(true);};
function nearWin(legacy=false){
 let s:R2RunState|undefined;
 for(let i=0;i<20;i++){const newest=newRunIdentity('azao','group'),identity=legacy?r2DynamicEndlessBase(newest) as {contentVersion:string;contentHash:string}:newest;const x=createRun({rulesVersion:'r2',runId:'dynamic-runtime',seed:'dynamic-runtime-'+i,characterId:'azao',openingRoute:'group',r2Identity:identity,modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});if(x.pokerEncounter!.nextAt>7){s=x;break;}}
 if(!s)throw Error('seed');s=send(s,{type:'LeaveShop'}).state;
 s.chapter=8;s.stageIndex=23;s.totalHeat='1000';s.boss={definitionId:'B12',disabledSuit:null};s.seenBossIds=['B01','B02','B05','B06','B07','B08','B13','B12'];s.chapterTargetPlan=lockR2ChapterTargets(8,'normal',0,s.boss);
 s.routeGrowth={clears:7,G:0,S:0,F:0,settlements:[2,5,8,11,14,17,20].map(stageIndex=>({stageIndex,families:[]}))};
 s.deckInstances=Array.from({length:20},(_,i)=>({id:`dynamic/card/${i}`,rank:14 as const,suit:'hearts' as const,enhancement:'encore-paper' as const,edition:'polychrome' as const}));s.drawPile=s.deckInstances.map(c=>c.id);s.handLevels={'flush-five':30};return send(s,{type:'EnterStage'}).state;
}
describe('dynamic endless runtime',()=>{
 it('uses a real final-stage sample, freezes each target before entry and restores it',()=>{
  let s=nearWin();s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('run-won');const score=s.stage!.heat;round(s);
  s=send(s,{type:'ContinueEndless'}).state;expect(s.dynamicEndless?.status).toBe('active');expect(s.dynamicEndless?.bootstrap?.clear.score).toBe(score);const target=s.dynamicEndless!.records[0].target;expect(getR2Stage(24,'endless',0,s)?.targetHeat).toBe(target);expect(getR2Stage(25,'endless',0,s)).toBeUndefined();round(s);
  s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;expect(s.stage!.initialTargetHeat).toBe(target);s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');round(s);
  const anchor=s.dynamicEndless!.anchor!;s=send(s,{type:'OpenShop'}).state;expect(s.dynamicEndless!.records[1].target).toBe(dynamicEndlessStageTarget(25,0,anchor,s.boss));round(s);
 });
 it('explicitly upgrades an existing endless run at the next chapter without altering its content identity or current public plan',async()=>{
  let s=nearWin(true);s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;s=send(s,{type:'ContinueEndless'}).state;
  expect(s.dynamicEndless).toBeUndefined();const identity=[s.contentVersion,s.contentHash],plan=structuredClone(s.chapterTargetPlan),rng=structuredClone(s.rng),choice=send(s,{type:'ActivateDynamicEndless',stageIndex:s.stageIndex});s=choice.state;
  expect(s.dynamicEndless?.status).toBe('pending');expect(s.dynamicEndless?.fromStage).toBe(27);expect([s.contentVersion,s.contentHash]).toEqual(identity);expect(s.chapterTargetPlan).toEqual(plan);expect(s.rng).toEqual(rng);round(s);
  for(let i=0;i<2;i++){s=send(s,{type:'SkipStage'}).state;s=send(s,{type:'OpenShop'}).state;}
  expect(s.stageIndex).toBe(26);expect(s.dynamicEndless?.status).toBe('pending');
  s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');const oldPolicy=structuredClone(s);delete oldPolicy.dynamicEndless;const comparison=send(oldPolicy,{type:'OpenShop'}).state;s=send(s,{type:'OpenShop'}).state;expect(s.rng).toEqual(comparison.rng);expect(s.boss).toEqual(comparison.boss);
  expect(s.dynamicEndless?.status).toBe('active');expect(s.dynamicEndless?.bootstrap).toBeNull();expect(s.dynamicEndless?.anchor).toBe('37316');expect(s.stageIndex).toBe(27);expect([s.contentVersion,s.contentHash]).toEqual(identity);round(s);
  const duplicate=applyCommand(s,choice.command);expect(duplicate.ok&&duplicate.duplicate).toBe(true);
  const anchor0=s.dynamicEndless!.anchor!;
  s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;const first=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)});s=first.state;expect(s.phase).toBe('stage-cleared');const firstScore=s.stage!.heat,anchor1=s.dynamicEndless!.anchor!;
  expect(anchor1).toBe(dynamicEndlessAdvanceAnchor(anchor0,'37316',firstScore));round(s);s=send(s,{type:'OpenShop'}).state;s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;
  s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');expect(s.dynamicEndless!.anchor).toBe(dynamicEndlessAdvanceAnchor(anchor1,'55974',s.stage!.heat,firstScore));round(s);
  const retry=applyCommand(s,first.command);expect(retry.ok&&retry.duplicate).toBe(true);expect(retry.state).toBe(s);
  const original=makeCheckpoint(s,[]);for(const change of [
   (x:R2RunState)=>{x.dynamicEndless!.records[0].target='1';},
   (x:R2RunState)=>{x.dynamicEndless!.records[0].sample!.clear.score='1';},
   (x:R2RunState)=>{x.dynamicEndless!.records[0].sample!.hands=[];},
   (x:R2RunState)=>{x.dynamicEndless!.anchor='1';},
   (x:R2RunState)=>{x.dynamicEndless!.records[0].boss.definitionId='B16';},
   (x:R2RunState)=>{x.dynamicEndless!.records[0].deck.live++;},
   (x:R2RunState)=>{const id=x.dynamicEndless!.records[0].lock.commandId;delete (x.receipts.find(r=>r.commandId===id)! as unknown as {endlessOutcome?:string}).endlessOutcome;},
  ]){const cp=structuredClone(original);change(cp.state);const {checksum:_,...payload}=cp;expect(readCheckpoint({...payload,checksum:stableHash(payload)}).ok).toBe(false);}
  let slots:SaveSlots={revision:1,current:original,previous:null},fail=true;const attempts:string[]=[];
  const store:SaveStore={read:async()=>slots,commit:async(revision,current,backup)=>{attempts.push(JSON.stringify(current));if(fail)throw Error('quota-exceeded');slots={revision:revision+1,current,previous:backup};return slots.revision;}};
  const saved=SavedRun.restore(store,slots),before=saved.state;const failed=await saved.dispatch({type:'OpenShop'});expect(failed.ok).toBe(false);expect(saved.state).toEqual(before);fail=false;expect((await saved.retry()).ok).toBe(true);expect(attempts[0]).toBe(attempts[1]);expect(saved.state.dynamicEndless!.records.at(-1)?.index).toBe(29);round(saved.state);
  s=saved.state;s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');s=send(s,{type:'OpenShop'}).state;
  for(let i=0;i<2;i++){s=send(s,{type:'SkipStage'}).state;s=send(s,{type:'OpenShop'}).state;round(s);}
  expect(s.dynamicEndless!.frontier?.index).toBe(28);expect(s.dynamicEndless!.records.map(r=>r.index)).toEqual([29,30,31,32]);expect(s.dynamicEndless!.anchor).toBe(saved.state.dynamicEndless!.anchor);
  const compact=makeCheckpoint(s,[]);for(const change of [
   (x:R2RunState)=>{x.dynamicEndless!.frontier!.anchorAfter='1';},
   (x:R2RunState)=>{x.dynamicEndless!.frontier!.sample!.clear.score='1';},
   (x:R2RunState)=>{x.dynamicEndless!.frontier!.index=27;},
   (x:R2RunState)=>{const id=x.dynamicEndless!.frontier!.sample!.clear.command.commandId;delete (x.receipts.find(r=>r.commandId===id)! as unknown as {endlessOutcome?:string}).endlessOutcome;},
  ]){const cp=structuredClone(compact);change(cp.state);const {checksum:_,...payload}=cp;expect(readCheckpoint({...payload,checksum:stableHash(payload)}).ok).toBe(false);}
 });
 it('freezes B03 with a real all-disabled deck snapshot and preserves it after restoration',()=>{
  let s=nearWin(true);s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;s=send(s,{type:'ContinueEndless'}).state;
  s=send(s,{type:'ActivateDynamicEndless',stageIndex:s.stageIndex}).state;
  for(let i=0;i<2;i++){s=send(s,{type:'SkipStage'}).state;s=send(s,{type:'OpenShop'}).state;}
  s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');
  expect(s.seenBossIds).not.toContain('B03');let selected:ReturnType<SeededRng['snapshot']>|undefined;
  for(let i=0;i<200;i++){const snapshot=new SeededRng(`forced-b03/${i}`).snapshot(),boss=drawR2Boss(SeededRng.restore(snapshot),s.seenBossIds,10,'endless');if(boss.definitionId==='B03'&&boss.disabledSuit==='hearts'){selected=snapshot;break;}}
  if(!selected)throw Error('missing B03 seed');s.rng.rule=selected;s=send(s,{type:'OpenShop'}).state;expect(s.boss).toEqual({definitionId:'B03',disabledSuit:'hearts'});
  for(let i=0;i<2;i++){s=send(s,{type:'SkipStage'}).state;s=send(s,{type:'OpenShop'}).state;}
  const locked=s.dynamicEndless!.records.at(-1)!;expect(locked.index).toBe(29);expect(locked.deck).toEqual({live:20,disabled:20});expect(locked.target).toBe(dynamicEndlessStageTarget(29,0,locked.anchorBefore,locked.boss,true));round(s);
 });
 it('keeps the original 2.4× static floor when an older v11 run opts in',()=>{
  let s=createRun({seed:'v11-dynamic',runId:'v11-dynamic',characterId:'erxiang',rulesVersion:'r2',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});s=send(s,{type:'LeaveShop'}).state;
  Object.assign(s,{chapter:8,stageIndex:23,shop:null,totalHeat:'1000',boss:{definitionId:'B12',disabledSuit:null},seenBossIds:['B01','B02','B05','B06','B07','B08','B13','B12'],handLevels:{'flush-five':30}});
  s.deckInstances=Array.from({length:20},(_,i)=>({id:`v11/card/${i}`,rank:14 as const,suit:'hearts' as const,enhancement:'encore-paper' as const,edition:'polychrome' as const}));s.drawPile=s.deckInstances.map(c=>c.id);
  s=send(s,{type:'EnterStage'}).state;s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;
  let cursor:ReturnType<SeededRng['snapshot']>|undefined;for(let i=0;i<100;i++){const candidate=new SeededRng(`v11-boss/${i}`).snapshot();if(drawR2Boss(SeededRng.restore(candidate),s.seenBossIds,9,'endless').definitionId==='B09'){cursor=candidate;break;}}if(!cursor)throw Error('missing seed');s.rng.rule=cursor;
  s=send(s,{type:'ContinueEndless'}).state;const identity=[s.contentVersion,s.contentHash];s=send(s,{type:'ActivateDynamicEndless',stageIndex:s.stageIndex}).state;
  for(let i=0;i<2;i++){s=send(s,{type:'SkipStage'}).state;s=send(s,{type:'OpenShop'}).state;}s=send(send(s,{type:'LeaveShop'}).state,{type:'EnterStage'}).state;s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)}).state;expect(s.phase).toBe('stage-cleared');s=send(s,{type:'OpenShop'}).state;
  expect([s.contentVersion,s.contentHash]).toEqual(identity);expect(s.dynamicEndless!.anchor).toBe('921600');expect(getR2Stage(27,'endless',0,s)?.targetHeat).toBe('921600');round(s);
 });
});
