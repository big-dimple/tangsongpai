import {r2WithHouseJoker,R2_HERO_FREQUENCY_VERSION,R2_HERO_FREQUENCY_HASH} from '../src/domain/r2GroupUpgrade';
import {withBossSuitRescueIdentity} from '../src/domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../src/domain/r2PokerEncounter';
import {describe,it,expect} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {laohuanFindGroups,laohuanFindStep} from '../src/domain/r2LaohuanFind';
const cards:PlayingCard[]=[
 {id:'a',rank:9,suit:'hearts'},{id:'b',rank:9,suit:'clubs'},
 {id:'c',rank:8,suit:'hearts'},{id:'d',rank:8,suit:'clubs'},
 {id:'e',rank:9,suit:'spades'},
];
describe('寻得按本批有效实例分组',()=>{
 it('并列最大组可选，较小组不可选',()=>{
  expect(laohuanFindGroups(cards,['a','b','c','d'],['a','b','c','d','e'])).toEqual([{rank:9,ids:['a','b']},{rank:8,ids:['c','d']}]);
  expect(laohuanFindStep(cards,['a','b','c','d'],{batchIds:['a','b','c','d'],beforeUsed:false,rank:8},true).multiplier).toBe(2);
  expect(()=>laohuanFindStep(cards,['a','b','c','d','e'],{batchIds:['a','b','c','d','e'],beforeUsed:false,rank:8},true)).toThrow('laohuan-find-unavailable');
 });
 it('仅算本批和有效牌，不发动不消耗次数',()=>{
  const intent={batchIds:['a','b','c'],beforeUsed:false,rank:null};
  expect(laohuanFindStep(cards,['a','b','c'],intent,true)).toMatchObject({activeIds:[],multiplier:null,afterUsed:false});
  expect(()=>laohuanFindStep(cards,['a','c'],{...intent,rank:9},true)).toThrow('laohuan-find-unavailable');
  expect(()=>laohuanFindStep(cards,['a','b'],{...intent,rank:9},false)).toThrow('laohuan-find-unavailable');
 });
});

import {newRunIdentity} from '../src/game/RunLaunch';
const oldFindIdentity=()=>withPokerEncounterIdentity(withBossSuitRescueIdentity(r2WithHouseJoker({contentVersion:R2_HERO_FREQUENCY_VERSION,contentHash:R2_HERO_FREQUENCY_HASH})));
import {laohuanDiscardFixture,laohuanSend} from './fixtures/laohuan-discard-handoff';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
it('真实弃牌、候选留牌及恢复保留批次',()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});
 expect(s.stage!.laohuanFindBatch).toEqual([]);
 expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
 const selected=s.pendingRefill!.candidateIds.slice(0,s.pendingRefill!.required);
 s=laohuanSend(s,{type:'ChooseRefill',selectedIds:selected});
 expect(s.stage!.laohuanFindBatch).toEqual(selected);
 expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
 s=laohuanSend(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,1)});
 expect(s.stage!.laohuanFindBatch).toEqual([]);expect(s.stage!.laohuanFindUsed).toBe(false);
 expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});

import {applyCommand,createRun} from '../src/domain/run';
import {stableHash} from '../src/domain/hash';
it('真实并列组选择、预览与计分时点，及来源篡改拒绝',()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));
 s=structuredClone(s);
 const byRank=new Map<number,string[]>();for(const id of s.drawPile){const rank=s.deckInstances.find(c=>c.id===id)!.rank;byRank.set(rank,[...(byRank.get(rank)??[]),id]);}
 const pairs=[...byRank.values()].filter(a=>a.length>=2).slice(0,2);const targets=[...pairs[0].slice(0,2),...pairs[1].slice(0,2)];
 const filler=s.drawPile.filter(id=>!targets.includes(id)).slice(0,2);const candidate=[...targets,...filler];s.drawPile=[...s.drawPile.filter(id=>!candidate.includes(id)),...candidate.slice().reverse()];
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,4)});
 s=laohuanSend(s,{type:'ChooseRefill',selectedIds:targets});
 const snap=makeCheckpoint(s,[]),mutated=structuredClone(snap);mutated.state.stage!.laohuanFindProof!.drawBefore.reverse();const {checksum,...payload}=mutated;
 expect(readCheckpoint({...payload,checksum:stableHash(payload)}).ok).toBe(false);
 const rank=s.deckInstances.find(c=>c.id===targets[0])!.rank;
 const cmd={runId:s.runId,commandId:'find/score',expectedSeq:s.commandSeq,action:{type:'PlayHand' as const,selectedIds:targets,laohuanFindRank:rank}};
 const result=applyCommand(s,cmd);expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result.state.lastTrace?.laohuanFind).toMatchObject({rank,multiplier:2,afterUsed:true});
 expect(result.state.lastTrace!.events.findIndex(e=>e.reasonKey==='laohuan.find')).toBe(result.state.lastTrace!.events.findIndex(e=>e.phase==='finalScore')-1);
 expect(readCheckpoint(makeCheckpoint(result.state,[cmd])).ok).toBe(true);
 expect(applyCommand(result.state,cmd)).toMatchObject({ok:true,duplicate:true});
});

import {SavedRun,type SaveStore,type SaveSlots} from '../src/application/SavedRun';
it('保存失败保留已发布旧状态，重试只保存原候选，重复提交不再扣弃牌',async()=>{
 const initial=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));
 let revision=0,failed=false,slots:SaveSlots={revision:0,current:null,previous:null};
 const store:SaveStore={read:async()=>slots,commit:async(expected,current,previous)=>{if(failed){failed=false;throw Error('injected');}expect(expected).toBe(revision);slots={revision:++revision,current,previous};return revision;}};
 const run=await SavedRun.start(store,initial,slots);const before=structuredClone(run.state);failed=true;
 const result=await run.dispatch({type:'DiscardHand',selectedIds:run.state.handOrder.slice(0,2)});
 expect(result).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(before);
 const retried=await run.retry();expect(retried.ok).toBe(true);if(!retried.ok)return;
 expect(run.state.phase).toBe('pending-refill');expect(run.state.stage!.discardsUsed).toBe(before.stage!.discardsUsed+1);
 const restored=SavedRun.restore(store,slots);expect(restored.state.pendingRefill).toEqual(run.state.pendingRefill);expect(restored.state.rng).toEqual(run.state.rng);
 expect(await restored.submit(run.journal.at(-1)!)).toMatchObject({ok:true,duplicate:true});
});

import {activeCards,activeScoreInput} from './fixtures/p1a-active-mult';
import {scoreR2Hand,previewR2Hand} from '../src/domain/scoreR2';
it('压零仍是有效计分，禁用牌排除；预览不改真实 RNG',()=>{
 const hand=activeCards([9,9,9,9,9]);const ids=hand.map(c=>c.id);
 const base=activeScoreInput(hand,[],{characterId:'laohuan',laohuanTrick:true,activeMultTiming:'after-route-growth',laohuanFind:{batchIds:ids,beforeUsed:false,rank:9},ordinaryPointsSuppressedIds:[ids[0]],disabledIds:[ids[4]]});
 const before=structuredClone(base);const a=previewR2Hand(base),b=previewR2Hand(base);expect(a).toEqual(b);expect(base).toEqual(before);
 const actual=scoreR2Hand(base);expect(actual.laohuanFind?.activeIds).toEqual(ids.slice(0,4));expect(actual.laohuanFind?.multiplier).toBe(4);
 expect(actual.events.findIndex(e=>e.reasonKey==='laohuan.find')).toBe(actual.events.findIndex(e=>e.phase==='finalScore')-1);
});
it.each([0,1,2])('候选短缺 %i 张时自动保留实际补入，不重抽',(n)=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));s=structuredClone(s);
 s.playedPile.push(...s.drawPile.splice(0,s.drawPile.length-n));const before=[...s.drawPile];
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});
 expect(s.pendingRefill).toBeNull();expect(s.stage!.laohuanFindBatch).toEqual(before.reverse());expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});
it('无效弃牌不会覆盖批次；成功再弃才覆盖，放弃待选可保存',()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});
 s=laohuanSend(s,{type:'ChooseRefill',selectedIds:s.pendingRefill!.candidateIds.slice(0,2)});
 const before=structuredClone(s),bad={type:'DiscardHand' as const,selectedIds:['missing']};
 expect(applyCommand(s,{runId:s.runId,commandId:'bad',expectedSeq:s.commandSeq,action:bad}).ok).toBe(false);expect(s).toEqual(before);
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,1)});
 expect(s.stage!.laohuanFindBatch).toEqual([]);expect(s.pendingRefill).not.toBeNull();
 s=laohuanSend(s,{type:'AbandonRun'});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});

import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {aiHandKey,aiScoreContext,aiHandScoreInput,rankAiHandCandidates,type AiHandInput} from '../src/game/AiHandCandidates';
it('AI 使用公开批次和显式组意图，重复预览不改 RNG 或牌序',()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));s=structuredClone(s);
 const rank=9,candidates=s.drawPile.filter(id=>s.deckInstances.find(c=>c.id===id)?.rank===rank).slice(0,2);expect(candidates).toHaveLength(2);
 const fillers=s.drawPile.filter(id=>!candidates.includes(id)).slice(0,2);const top=[...candidates,...fillers];s.drawPile=[...s.drawPile.filter(id=>!top.includes(id)),...top.slice().reverse()];
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});s=laohuanSend(s,{type:'ChooseRefill',selectedIds:candidates});
 const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),context=r2ScoreContext(s,hand,candidates),stage=s.stage!;
 const build=(chosen:number|null):AiHandInput=>({hand,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handRules:context.handRules,disabledIds:stage.disabledIds,ordinaryPointsSuppressedIds:[],boss:context.boss,stageIndex:stage.index,sealedJokerIds:context.sealedJokerIds,challengeDisabledJokerId:context.challengeDisabledJokerId,resources:{gold:s.gold,handsLeft:stage.handsLeft,playIndex:stage.playIndex,discardsUsed:stage.discardsUsed,stageHeat:stage.heat,target:stage.targetHeat},contentVersion:s.contentVersion,score:aiScoreContext({...context,handLevels:s.handLevels,previousHandType:stage.previousHandType,wager:stage.wagerSelected},{laohuanFindRank:chosen})});
 const before=structuredClone(s),chosen=build(rank),plain=build(null);expect(aiHandKey(chosen)).not.toBe(aiHandKey(plain));
 expect(previewR2Hand(aiHandScoreInput(chosen,candidates)).scoreRange.minimum).toBe(String(BigInt(previewR2Hand(aiHandScoreInput(plain,candidates)).scoreRange.minimum)*2n));
 expect(rankAiHandCandidates(chosen).status).toBe('ready');expect(s).toEqual(before);
});
it('发动寻得保存失败不消耗次数，重试仅提交原出牌',async()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));s=structuredClone(s);
 const pair=s.drawPile.filter(id=>s.deckInstances.find(c=>c.id===id)?.rank===9).slice(0,2),extra=s.drawPile.filter(id=>!pair.includes(id)).slice(0,2),top=[...pair,...extra];
 s.drawPile=[...s.drawPile.filter(id=>!top.includes(id)),...top.slice().reverse()];
 let revision=0,fail=false,slots:SaveSlots={revision:0,current:null,previous:null};const store:SaveStore={read:async()=>slots,commit:async(expected,current,previous)=>{if(fail){fail=false;throw Error('injected');}expect(expected).toBe(revision);slots={revision:++revision,current,previous};return revision;}};
 const run=await SavedRun.start(store,s,slots);expect((await run.dispatch({type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)})).ok).toBe(true);expect((await run.dispatch({type:'ChooseRefill',selectedIds:pair})).ok).toBe(true);
 const before=structuredClone(run.state);fail=true;expect(await run.dispatch({type:'PlayHand',selectedIds:pair,laohuanFindRank:9})).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(before);
 const result=await run.retry();expect(result.ok).toBe(true);if(!result.ok)return;
 expect(run.state.stage!.laohuanFindUsed).toBe(true);expect(run.state.lastTrace!.laohuanFind?.multiplier).toBe(2);expect(run.state.stage!.laohuanFindBatch).toEqual([]);
 expect(await run.submit(run.journal.at(-1)!)).toMatchObject({ok:true,duplicate:true});expect(SavedRun.restore(store,slots).state).toEqual(run.state);
});
it.each([2,3,4,5])('本批 %i 张同点有效牌使用正确档位',count=>{
 const hand=activeCards(Array(count).fill(9));const ids=hand.map(c=>c.id);
 const input=activeScoreInput(hand,[],{characterId:'laohuan',laohuanTrick:true,activeMultTiming:'after-route-growth',laohuanFind:{batchIds:ids,beforeUsed:false,rank:9}});
 const on=scoreR2Hand(input),off=scoreR2Hand({...input,laohuanFind:{...input.laohuanFind!,rank:null}});const factor=Math.min(count,4);
 expect(on.laohuanFind?.multiplier).toBe(factor);expect(BigInt(on.finalScore)).toBe(BigInt(off.finalScore)*BigInt(factor));expect(on.rng).toEqual(off.rng);
 expect(()=>scoreR2Hand({...input,laohuanFind:{...input.laohuanFind!,beforeUsed:true}})).toThrow('laohuan-find-unavailable');
 expect(()=>scoreR2Hand({...input,boss:{definitionId:'B08',disabledSuit:null}})).toThrow('laohuan-find-unavailable');
});

import {heroAbilityCue} from '../src/game/HeroAbilityCue';
import {heroSkillGuide} from '../src/game/HeroSkillGuide';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {characterForRun} from '../src/game/CharacterRunCopy';
it('新身份显示寻得与实际可选最大组，旧身份继续显示被动',()=>{
 const old=laohuanDiscardFixture(0,oldFindIdentity());
 expect(heroAbilityCue(old)?.state).toBe('passive');
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));s=structuredClone(s);
 const pair=s.drawPile.filter(id=>s.deckInstances.find(c=>c.id===id)?.rank===9).slice(0,2),extra=s.drawPile.filter(id=>!pair.includes(id)).slice(0,2),top=[...pair,...extra];s.drawPile=[...s.drawPile.filter(id=>!top.includes(id)),...top.reverse()];
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});s=laohuanSend(s,{type:'ChooseRefill',selectedIds:pair});
 const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),facts=r2SelectionFacts({hand,selectedIds:pair,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s)});
 expect(heroAbilityCue(s,facts,pair,false,{laohuanFindRank:9})).toMatchObject({available:true,state:'selected',label:'寻得'});
 expect(heroSkillGuide(s,facts,pair).effect).toContain('×2');expect(characterForRun(s).detailRules).toContain('并列');
});
it('关闭角色能力的挑战不提供候选或寻得',()=>{
 const identity=newRunIdentity('laohuan','group');
 let s=createRun({seed:'challenge/q01/0',runId:'find/q01',characterId:'laohuan',rulesVersion:'r2',r2Identity:identity,openingRoute:'group',modeConfig:{mode:'challenge',difficulty:0,challengeId:'Q01',programsEnabled:false}});
 s=laohuanSend(laohuanSend(s,{type:'LeaveShop'}),{type:'EnterStage'});s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});
 expect(s.pendingRefill).toBeNull();expect(s.stage!.laohuanFindBatch).toEqual([]);expect(s.stage!.laohuanFindUsed).toBe(false);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});

import {formatScoreReview} from '../src/game/ScoreReview';
import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';
import {heroScoreAction} from '../src/game/HeroScoreAction';
import {savedBenefit} from '../src/game/JokerExperience';
it('回放与效果说明读取已提交的点数、数量和倍率',()=>{
 let s=laohuanDiscardFixture(0,newRunIdentity('laohuan','group'));s=structuredClone(s);
 const pair=s.drawPile.filter(id=>s.deckInstances.find(c=>c.id===id)?.rank===9).slice(0,2),extra=s.drawPile.filter(id=>!pair.includes(id)).slice(0,2),top=[...pair,...extra];s.drawPile=[...s.drawPile.filter(id=>!top.includes(id)),...top.reverse()];
 s=laohuanSend(s,{type:'DiscardHand',selectedIds:s.handOrder.slice(0,2)});s=laohuanSend(s,{type:'ChooseRefill',selectedIds:pair});s=laohuanSend(s,{type:'PlayHand',selectedIds:pair,laohuanFindRank:9});
 const trace=s.lastTrace!,event=trace.events.find(e=>e.reasonKey==='laohuan.find')!;
 expect(savedHeroAttachment(trace,'laohuan')?.targetIds).toEqual(pair);expect(heroScoreAction(trace,event)?.targetIds).toEqual(pair);
 expect(savedBenefit(s,trace,event)?.effect).toContain('2张刚换的同点牌计分 · ×2');expect(JSON.stringify(formatScoreReview(s,trace))).toContain('寻得 · 9 2张');
});
it('旧身份与新身份相同种子及弃牌序列保持补牌和随机流',()=>{
 const old=laohuanDiscardFixture(0,oldFindIdentity());
 const fresh=laohuanDiscardFixture(0,newRunIdentity('laohuan','group')),ids=old.handOrder.slice(0,3);
 const a=laohuanSend(old,{type:'DiscardHand',selectedIds:ids}),b=laohuanSend(fresh,{type:'DiscardHand',selectedIds:ids});
 expect(b.pendingRefill).toEqual(a.pendingRefill);expect(b.drawPile).toEqual(a.drawPile);expect(b.rng).toEqual(a.rng);
 const keep=a.pendingRefill!.candidateIds.slice(0,a.pendingRefill!.required),c=laohuanSend(a,{type:'ChooseRefill',selectedIds:keep}),d=laohuanSend(b,{type:'ChooseRefill',selectedIds:keep});
 expect(d.handOrder).toEqual(c.handOrder);expect(d.drawPile).toEqual(c.drawPile);expect(d.rng).toEqual(c.rng);
});
