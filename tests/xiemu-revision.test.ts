import {describe,it,expect} from 'vitest';
import {r2WithHouseJoker,R2_XIEMU_FREQUENT_VERSION,R2_XIEMU_FREQUENT_HASH} from '../src/domain/r2GroupUpgrade';
import {withBossSuitRescueIdentity} from '../src/domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../src/domain/r2PokerEncounter';
import {newRunIdentity} from '../src/game/RunLaunch';
import {economyStart,economySend,economyHand} from './fixtures/hero-economy-budget';
import {applyCommand,type R2RunState} from '../src/domain/run';
import {r2ScoreContext,r2CreateJoker} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {previewR2Hand} from '../src/domain/scoreR2';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {xiemuChoice} from '../src/game/XiemuBurnCopy';
import {characterForRun} from '../src/game/CharacterRunCopy';
import {aiScoreContext} from '../src/game/AiHandCandidates';
import {SavedRun,type SaveStore,type SaveSlots} from '../src/application/SavedRun';
const identity=()=>newRunIdentity('xiemu','group');
const oldIdentity=()=>withPokerEncounterIdentity(withBossSuitRescueIdentity(r2WithHouseJoker({contentVersion:R2_XIEMU_FREQUENT_VERSION,contentHash:R2_XIEMU_FREQUENT_HASH})));
function ready(cash=12){const state=economySend(economySend(economyStart('xiemu',cash,identity()),{type:'LeaveShop'}),{type:'EnterStage'});return economyHand(state);}
function command(s:R2RunState,selectedIds:string[],cost:2|4|6|8){return {runId:s.runId,commandId:'revision/'+cost,expectedSeq:s.commandSeq,action:{type:'PlayHand' as const,selectedIds,xiemuBurn:cost}};}
describe('花蕊四档新身份',()=>{
 it.each([[2,1.5],[4,2],[6,3],[8,4]] as const)('支付%i金按×%s计分并可恢复',(cost,multiplier)=>{
  const {state:s,main}=ready(),before=structuredClone(s),hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);
  const context=r2ScoreContext({...s,gold:s.gold-cost},hand,main),preview=previewR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'preview',hand,selectedIds:main,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,...context,xiemuBurn:{cost,goldBefore:s.gold,beforeUsed:false}});
  expect(aiScoreContext({...context,handLevels:s.handLevels,previousHandType:null,wager:false}).xiemuRevised).toBe(true);const cmd=command(s,main,cost),result=applyCommand(s,cmd);expect(result.ok).toBe(true);if(!result.ok)return;
  const trace=result.state.lastTrace!;expect(trace.xiemuBurn).toMatchObject({cost,goldBefore:12,goldAfter:12-cost,multiplier,afterUsed:true});expect(trace.finalScore).toBe(preview.scoreRange.minimum);
  expect(trace.events.findIndex(e=>e.sourceDefinitionId==='xiemu'&&e.phase==='characterScore')).toBe(trace.events.findIndex(e=>e.phase==='finalScore')-1);
  expect(readCheckpoint(makeCheckpoint(result.state,[cmd])).ok).toBe(true);expect(applyCommand(result.state,cmd)).toMatchObject({ok:true,duplicate:true});expect(s).toEqual(before);
 });
 it('余额不足整档拒绝，新旧身份价格与展示各自保留',()=>{
  const {state:s,main}=ready(3),before=structuredClone(s);expect(applyCommand(s,command(s,main,4))).toMatchObject({ok:false,code:'insufficient-gold'});expect(s).toEqual(before);
  expect(xiemuChoice(s,'straight-flush').choices.map(c=>[c.cost,c.multiplier])).toEqual([[2,1.5],[4,2],[6,3],[8,4]]);expect(characterForRun(s).detailRules).toContain('×1.5／2／3／4');
  const old=economyHand(economySend(economySend(economyStart('xiemu',12,oldIdentity()),{type:'LeaveShop'}),{type:'EnterStage'})).state;
  expect(xiemuChoice(old,'straight-flush').choices.map(c=>c.cost)).toEqual([3,6,10]);expect(readCheckpoint(makeCheckpoint(old,[])).ok).toBe(true);
 });
 it('扣钱后持币门槛及关末利息读取实际余额',()=>{
  let {state:s,main}=ready(25);s.jokers=[r2CreateJoker('e03','e03',6,'none',s),r2CreateJoker('e08','e08',8,'none',s)];s.stage!.initialJokerIds=s.jokers.map(j=>j.instanceId);
  const r=applyCommand(s,command(s,main,8));expect(r.ok).toBe(true);if(!r.ok)return;const t=r.state.lastTrace!;
  expect(t.events.find(e=>e.sourceDefinitionId==='e03')!.value.n).toBe('34');expect(t.events.some(e=>e.sourceDefinitionId==='e08')).toBe(false);
  expect(t.combo?.goldBeforeRewards).toBe(17);expect(t.events.find(e=>e.sourceDefinitionId==='xiemu'&&e.phase==='onStageClear')?.value.n).toBe('2');expect(readCheckpoint(makeCheckpoint(r.state,[])).ok).toBe(true);
 });
 it('保存失败不扣钱或占次数，重试保存原结果',async()=>{
  const {state:s,main}=ready();let slots:SaveSlots={revision:1,current:makeCheckpoint(s,[]),previous:null},fail=true;
  const store:SaveStore={read:async()=>slots,commit:async(revision,cp,previous)=>{if(fail)throw Error('injected');slots={revision:revision+1,current:cp,previous};return slots.revision;}};
  const run=SavedRun.restore(store,slots),before=structuredClone(run.state);expect(await run.dispatch({type:'PlayHand',selectedIds:main,xiemuBurn:8})).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(before);
  fail=false;expect((await run.retry()).ok).toBe(true);expect(run.state.lastTrace?.xiemuBurn).toMatchObject({cost:8,goldAfter:4,multiplier:4});expect(SavedRun.restore(store,slots).state).toEqual(run.state);expect(await run.submit(run.journal.at(-1)!)).toMatchObject({ok:true,duplicate:true});
 });
});

import {xiemuBurnStep} from '../src/domain/r2XiemuBurn';
import {createRun} from '../src/domain/run';
import {aiHandScoreInput,type AiHandInput} from '../src/game/AiHandCandidates';
it('两对以下与静场拒绝，挑战关闭角色能力',()=>{
 const {state:s}=ready();expect(()=>xiemuBurnStep('pair',{cost:2,goldBefore:12,beforeUsed:false},true,true,true,true)).toThrow('xiemu-unqualified');
 expect(()=>xiemuBurnStep('two-pair',{cost:2,goldBefore:12,beforeUsed:false},false,true,true,true)).toThrow('xiemu-disabled');
 let q=createRun({seed:'challenge/q01/0',runId:'xiemu/q01',characterId:'xiemu',rulesVersion:'r2',r2Identity:identity(),openingRoute:'group',modeConfig:{mode:'challenge',difficulty:0,challengeId:'Q01',programsEnabled:false}});
 q=economySend(economySend(q,{type:'LeaveShop'}),{type:'EnterStage'});const h=economyHand(q);expect(applyCommand(h.state,command(h.state,h.main,2))).toMatchObject({ok:false,code:'xiemu-disabled'});
});
it.each([[4,2,2],[5,2,3],[8,6,2],[10,8,2]] as const)('跨利息门槛本金%i，支付%i后余额%i',(gold,cost,after)=>{
 const f=ready(gold),r=applyCommand(f.state,command(f.state,f.main,cost));expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.state.lastTrace!.combo!.goldBeforeRewards).toBe(after);const interest=r.state.lastTrace!.events.find(e=>e.sourceDefinitionId==='xiemu'&&e.phase==='onStageClear');expect(Number(interest?.value.n??0)).toBe(Math.min(2,Math.floor(after/5)));
});
it('AI 预览沿用所选档和扣后余额，重复查看不触碰真实状态',()=>{
 const {state:s,main}=ready(12),hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),context=r2ScoreContext(s,hand,main),stage=s.stage!;
 const input:AiHandInput={hand,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handRules:context.handRules,disabledIds:stage.disabledIds,ordinaryPointsSuppressedIds:[],boss:context.boss,stageIndex:stage.index,sealedJokerIds:context.sealedJokerIds,challengeDisabledJokerId:context.challengeDisabledJokerId,resources:{gold:s.gold,handsLeft:stage.handsLeft,playIndex:stage.playIndex,discardsUsed:stage.discardsUsed,stageHeat:stage.heat,target:stage.targetHeat},contentVersion:s.contentVersion,score:aiScoreContext({...context,handLevels:s.handLevels,previousHandType:stage.previousHandType,wager:stage.wagerSelected},{xiemuBurn:8})};
 const before=structuredClone(s),a=previewR2Hand(aiHandScoreInput(input,main)),b=previewR2Hand(aiHandScoreInput(input,main));expect(a).toEqual(b);const actual=applyCommand(s,command(s,main,8));expect(actual.ok).toBe(true);if(actual.ok)expect(actual.state.lastTrace!.finalScore).toBe(a.scoreRange.minimum);expect(s).toEqual(before);
});
