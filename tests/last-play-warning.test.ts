import {describe,expect,it} from 'vitest';
import {createRun,applyCommand,type Action,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {lastPlayWarning,reducedPlayEntry,LastPlayWarningTracker,lastPlayCuePlacement,bossRuleCuePlacement} from '../src/game/LastPlayWarning';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
function send(s:R2RunState,action:Action){const result=applyCommand(s,{runId:s.runId,commandId:'warning/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!result.ok)throw Error(result.code);return result.state;}
function entered(){let s=createRun({rulesVersion:'r2',runId:'warning',seed:'warning',characterId:'azao',r2Identity:newRunIdentity('azao','group'),openingRoute:'group'});return send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});}
describe('last play committed state',()=>{
 it('appears only with one remaining active play, including after checkpoint restore',()=>{
  let s=entered();expect(lastPlayWarning(s,false)).toBeUndefined();for(let i=0;i<3;i++){s=send(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});expect(s.phase).toBe('await-input');}
  expect(lastPlayWarning(s,false)).toEqual({key:'warning/0',message:'仅剩最后1次出牌'});expect(lastPlayWarning(s,true)).toBeUndefined();const cp=readCheckpoint(makeCheckpoint(s,[]));expect(cp.ok).toBe(true);if(cp.ok)expect(lastPlayWarning(cp.checkpoint.state,false)).toEqual(lastPlayWarning(s,false));
  expect(lastPlayWarning({...s,phase:'pending-refill'},false)).toEqual(lastPlayWarning(s,false));
  for(const phase of ['stage-cleared','run-lost','run-won','shop'] as const)expect(lastPlayWarning({...s,phase},false)).toBeUndefined();expect(lastPlayWarning({...s,stage:{...s.stage!,handsLeft:2}},false)).toBeUndefined();expect(lastPlayWarning({...s,stage:{...s.stage!,handsLeft:0}},false)).toBeUndefined();
 });
 it('uses the actual entered Boss and initial play budget',()=>{
  const s=entered();expect(reducedPlayEntry(s)).toBeUndefined();const boss={...s,stage:{...s.stage!,boss:{definitionId:'B09' as const,disabledSuit:null},initialHands:3}};expect(reducedPlayEntry(boss)).toBe('快板 · 本场3次出牌（−1）');expect(reducedPlayEntry({...boss,stage:{...boss.stage,playIndex:1}})).toBeUndefined();expect(reducedPlayEntry({...boss,stage:{...boss.stage,boss:{definitionId:'B10',disabledSuit:null}}})).toBeUndefined();
 });
 it('highlights only an observed drop to one, rearms after an increase, and does not replay on restore',()=>{
  const s=entered(),tracker=new LastPlayWarningTracker(),count=(n:number)=>({...s,stage:{...s.stage!,handsLeft:n}});
  tracker.seed(count(2));expect(tracker.observe(count(1),false).highlight).toBe(true);expect(tracker.observe(count(1),false).highlight).toBe(false);
  expect(tracker.observe(count(2),false).highlight).toBe(false);expect(tracker.observe(count(1),false).highlight).toBe(true);
  tracker.seed(count(1));expect(tracker.observe(count(1),false).highlight).toBe(false);expect(tracker.observe({...count(1),phase:'stage-cleared'},false).warning).toBeUndefined();
  tracker.seed(count(1));expect(tracker.observe({...count(1),phase:'pending-refill'},false)).toEqual({warning:lastPlayWarning(count(1),false),highlight:false});expect(tracker.observe(count(1),false).highlight).toBe(false);
 });
 it('places a transient cue only in a free rectangle and otherwise falls back to static',()=>{
  const score={x:296,y:280,width:360,height:110},played={x:680,y:244,width:650,height:180},hand={x:300,y:458,width:1030,height:180};
  expect(lastPlayCuePlacement(1366,768,score,played,[score,played,hand],false)).toEqual({x:296,y:392,width:360,height:44});
  expect(lastPlayCuePlacement(320,568,{x:12,y:160,width:296,height:108},{x:12,y:280,width:296,height:108},[{x:0,y:0,width:320,height:568}],true)).toBeUndefined();
 });
 it('places the full Boss notice only in a clear bounded area',()=>{
  const score={x:296,y:280,width:360,height:110},played={x:680,y:244,width:650,height:180},hand={x:300,y:458,width:1030,height:180};
  expect(bossRuleCuePlacement(1366,768,score,played,[score,hand],false,96)).toEqual({x:825,y:252,width:360,height:96});
  expect(bossRuleCuePlacement(320,568,score,played,[{x:0,y:0,width:320,height:568}],true,96)).toBeUndefined();
 });
});
