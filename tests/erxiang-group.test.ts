import {describe,it,expect} from 'vitest';
import {activeCards,activeScoreInput,activeJoker} from './fixtures/p1a-active-mult';
import {scoreR2Hand,previewR2Hand} from '../src/domain/scoreR2';

describe('刘娥同点组逐次转换',()=>{
 it('五条 A 每轮转55点，重触发逐卡逐次执行',()=>{
  const hand=activeCards([14,14,14,14,14]);for(const c of hand)c.enhancement='encore-paper';const targetId=hand[0].id;
  const input=activeScoreInput(hand,[],{characterId:'erxiang',erxiangGroup:true,erxiangHandoff:{targetId,beforeUsed:false}}),t=scoreR2Hand(input);
  const events=t.events.filter(e=>e.reasonKey==='erxiang.handoff');expect(events).toHaveLength(10);
  for(const depth of [0,1])expect(events.filter(e=>e.retriggerDepth===depth).reduce((sum,e)=>sum+Number(e.value.n),0)).toBe(55);
  for(const e of events){const i=t.events.indexOf(e),prev=t.events[i-1];expect(prev.targetCardId).toBe(e.targetCardId);expect(prev.retriggerDepth).toBe(e.retriggerDepth);expect(prev.rootEventId).toBe(e.rootEventId);expect(prev.value.n).toBe('0');}
  expect(t.events.filter(e=>e.operation==='retrigger-card')).toHaveLength(5);
  const old=scoreR2Hand({...input,erxiangGroup:undefined});expect(old.events.filter(e=>e.reasonKey==='erxiang.handoff')).toHaveLength(1);expect(old.events.filter(e=>e.sourceType==='card'&&e.sourceDefinitionId==='rank-14'&&e.retriggerDepth===1).every(e=>e.value.n==='11')).toBe(true);
 });
 it('葫芦选择三条或对子，压零牌不转但其他同点牌仍转',()=>{
  const hand=activeCards([9,9,9,4,4]);hand[0].enhancement='encore-paper';
  const base=activeScoreInput(hand,[],{characterId:'erxiang',erxiangGroup:true,erxiangHandoff:{targetId:hand[1].id,beforeUsed:false},ordinaryPointsSuppressedIds:[hand[2].id]});
  const tri=scoreR2Hand(base),pair=scoreR2Hand({...base,erxiangHandoff:{targetId:hand[3].id,beforeUsed:false}});
  expect(tri.events.filter(e=>e.reasonKey==='erxiang.handoff').map(e=>e.targetCardId)).toEqual([hand[0].id,hand[0].id,hand[1].id]);
  expect(pair.events.filter(e=>e.reasonKey==='erxiang.handoff').map(e=>e.targetCardId)).toEqual([hand[3].id,hand[4].id]);
  expect(()=>scoreR2Hand({...base,erxiangHandoff:{targetId:hand[2].id,beforeUsed:false}})).toThrow('erxiang-zero-points');
 });
 it('预览按真实顺序计算，转换不保证增分且不消耗 RNG',()=>{
  const hand=activeCards([2,2]);const input=activeScoreInput(hand,[],{characterId:'erxiang',erxiangGroup:true,handLevels:{pair:30},erxiangHandoff:{targetId:hand[0].id,beforeUsed:false}});
  const before=structuredClone(input),p=previewR2Hand(input),t=scoreR2Hand(input);expect(p.scoreRange.minimum).toBe(t.finalScore);expect(input).toEqual(before);
  const weak=activeCards([2,2,5],2);weak[0].edition='holographic';weak[1].edition='holographic';weak[2].enhancement='voice-paper';const jokers=Array.from({length:5},(_,i)=>({...activeJoker('f04',{},'holographic'),instanceId:'rich-mult/'+i}));
  const costly=activeScoreInput(weak,jokers,{characterId:'erxiang',selectedIds:weak.slice(0,2).map(c=>c.id),erxiangGroup:true,erxiangHandoff:{targetId:weak[0].id,beforeUsed:false}}),on=scoreR2Hand(costly),off=scoreR2Hand({...costly,erxiangHandoff:{targetId:null,beforeUsed:false}});expect(BigInt(on.finalScore)).toBeLessThan(BigInt(off.finalScore));expect(previewR2Hand(costly).scoreRange.minimum).toBe(on.finalScore);
 });
});

import {newRunIdentity} from '../src/game/RunLaunch';
import {createRun,applyCommand,type R2RunState,type Action} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {stableHash} from '../src/domain/hash';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
const identity=()=>newRunIdentity('erxiang','group');
const send=(s:R2RunState,action:Action)=>{const r=applyCommand(s,{runId:s.runId,commandId:'erxiang/group/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;};
function setup(){
 let s=createRun({rulesVersion:'r2',characterId:'erxiang',runId:'erxiang/group',seed:'group-natural-17',openingRoute:'group',r2Identity:identity(),modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});s=structuredClone(s);
 const ids=['spades-14','hearts-14','clubs-14','diamonds-14','copy-a'];s.deckInstances.push({...s.deckInstances.find(c=>c.id==='spades-14')!,id:'copy-a'});s.deckInstances.find(c=>c.id===ids[0])!.enhancement='encore-paper';
 s.handOrder=[...ids,'clubs-2','diamonds-4','spades-6'];s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!s.handOrder.includes(id));return {state:s,ids};
}
it('真实五条重触发、结果与检查点一致；篡改事件拒绝',()=>{
 const {state:s,ids}=setup(),cmd={runId:s.runId,commandId:'group-score',expectedSeq:s.commandSeq,action:{type:'PlayHand' as const,selectedIds:ids,erxiangTargetId:ids[0]}};
 const r=applyCommand(s,cmd);expect(r.ok).toBe(true);if(!r.ok)return;const t=r.state.lastTrace!;expect(t.erxiangGroup).toBe(true);expect(t.events.filter(e=>e.reasonKey==='erxiang.handoff')).toHaveLength(6);expect(readCheckpoint(makeCheckpoint(r.state,[cmd])).ok).toBe(true);expect(applyCommand(r.state,cmd)).toMatchObject({ok:true,duplicate:true});
 const bad=structuredClone(makeCheckpoint(r.state,[]));bad.state.lastTrace!.events.find(e=>e.reasonKey==='erxiang.handoff'&&e.retriggerDepth===1)!.value.n='12';const {checksum,...payload}=bad;expect(readCheckpoint({...payload,checksum:stableHash(payload)}).ok).toBe(false);
});
it('保存失败不消费次数，重试按同一次计分保存并可恢复',async()=>{
 const {state:s,ids}=setup();let slots:SaveSlots={revision:1,current:makeCheckpoint(s,[]),previous:null},fail=true;const store:SaveStore={read:async()=>slots,commit:async(revision,cp,previous)=>{if(fail)throw Error('injected');slots={revision:revision+1,current:cp,previous};return slots.revision;}};
 const run=SavedRun.restore(store,slots),before=structuredClone(run.state);expect(await run.dispatch({type:'PlayHand',selectedIds:ids,erxiangTargetId:ids[0]})).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(before);
 fail=false;expect((await run.retry()).ok).toBe(true);expect(run.state.stage!.erxiangHandoffUses).toBe(1);expect(SavedRun.restore(store,slots).state).toEqual(run.state);expect(await run.submit(run.journal.at(-1)!)).toMatchObject({ok:true,duplicate:true});
});

import {lockR2ChapterTargets} from '../src/domain/r2Chapter';
import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {erxiangChoice,savedErxiangHandoff} from '../src/game/ErxiangHandoffCopy';
import {reviewOperationText} from '../src/game/ScoreReview';
import {heroScoreAction} from '../src/game/HeroScoreAction';
import {aiScoreContext,aiHandScoreInput,rankAiHandCandidates,type AiHandInput} from '../src/game/AiHandCandidates';
it('新身份两次独立消费，非法核心不消耗',()=>{
 let {state:s}=setup();s=structuredClone(s);const ids=['spades-2','hearts-2','clubs-3','diamonds-3','spades-4','hearts-6','clubs-8','diamonds-9'];s.handOrder=ids;s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id));
 const invalid=applyCommand(s,{runId:s.runId,commandId:'bad',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds:[ids[0]],erxiangTargetId:ids[0]}});expect(invalid).toMatchObject({ok:false,code:'score-diagnostic'});expect(s.stage!.erxiangHandoffUses).toBe(0);
 s=send(s,{type:'PlayHand',selectedIds:ids.slice(0,2),erxiangTargetId:ids[0]});expect(s.stage!.erxiangHandoffUses).toBe(1);expect(s.phase).toBe('await-input');s=send(s,{type:'PlayHand',selectedIds:ids.slice(2,4),erxiangTargetId:ids[2]});expect(s.stage!.erxiangHandoffUses).toBe(2);expect(s.stage!.erxiangHandoffUsed).toBe(true);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});
it('B02 后两张普通点数压零不转，前三张仍逐次转移',()=>{
 let s=createRun({rulesVersion:'r2',characterId:'erxiang',runId:'erxiang/b02',seed:'group-natural-17',openingRoute:'group',r2Identity:identity(),modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 s=send(s,{type:'LeaveShop'});s=structuredClone(s);s.stageIndex=2;s.seenBossIds=['B02'];s.boss={definitionId:'B02',disabledSuit:null};s.chapterTargetPlan=lockR2ChapterTargets(s.chapter,s.tourMode,s.difficulty,s.boss);s.shop!.visitIndex=2;s=send(s,{type:'EnterStage'});
 s=structuredClone(s);const ids=['spades-14','hearts-14','clubs-14','diamonds-14','copy-a'];s.deckInstances.push({...s.deckInstances.find(c=>c.id===ids[0])!,id:ids[4]});s.handOrder=ids;s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id));
 const bad=applyCommand(s,{runId:s.runId,commandId:'zero',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds:ids,erxiangTargetId:ids[3]}});expect(bad).toMatchObject({ok:false,code:'score-diagnostic',diagnostic:{code:'erxiang-zero-points'}});
 s=send(s,{type:'PlayHand',selectedIds:ids,erxiangTargetId:ids[0]});const t=s.lastTrace!;expect(t.events.filter(e=>e.reasonKey==='erxiang.handoff').map(e=>e.targetCardId)).toEqual(ids.slice(0,3));expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});
it('选择提示、AI、回放和结果读取同一同点组及逐次事件',()=>{
 const {state:s,ids}=setup(),hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),context=r2ScoreContext(s,hand,ids),facts=r2SelectionFacts({hand,selectedIds:ids,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s)}),choice=erxiangChoice(s,facts,ids[0]);
 expect(choice.selected?.groupIds).toEqual(ids);expect(choice.selected?.initialPoints).toBe(55);expect(choice.sentence).toContain('首轮共55点');
 const stage=s.stage!,input:AiHandInput={hand,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handRules:context.handRules,disabledIds:stage.disabledIds,ordinaryPointsSuppressedIds:[],boss:context.boss,stageIndex:stage.index,sealedJokerIds:context.sealedJokerIds,challengeDisabledJokerId:context.challengeDisabledJokerId,resources:{gold:s.gold,handsLeft:stage.handsLeft,playIndex:stage.playIndex,discardsUsed:stage.discardsUsed,stageHeat:stage.heat,target:stage.targetHeat},contentVersion:s.contentVersion,score:aiScoreContext({...context,handLevels:s.handLevels,previousHandType:stage.previousHandType,wager:stage.wagerSelected},{erxiangTargetId:ids[0]})};
 const before=structuredClone(s),p=previewR2Hand(aiHandScoreInput(input,ids));expect(rankAiHandCandidates(input).status).toBe('ready');const a=send(s,{type:'PlayHand',selectedIds:ids,erxiangTargetId:ids[0]}),event=a.lastTrace!.events.find(e=>e.reasonKey==='erxiang.handoff'&&e.retriggerDepth===1)!;
 expect(a.lastTrace!.finalScore).toBe(p.scoreRange.minimum);expect(savedErxiangHandoff(a)).toContain('5张同点 · 共66点');expect(reviewOperationText(a,event)).toContain('本次计分');expect(heroScoreAction(a.lastTrace!,event)?.targetIds).toEqual([event.targetCardId]);expect(s).toEqual(before);
});
