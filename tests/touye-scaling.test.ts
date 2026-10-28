import {describe,it,expect} from 'vitest';
import {r2WithHouseJoker,R2_S04_FINISH_VERSION,R2_S04_FINISH_HASH} from '../src/domain/r2GroupUpgrade';
import {withBossSuitRescueIdentity} from '../src/domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../src/domain/r2PokerEncounter';
import {newRunIdentity} from '../src/game/RunLaunch';
import {touyeFixture,touyeBet,touyeSend,touyeCommand} from './fixtures/touye-new-core';
import {touyeWagerStep} from '../src/domain/r2TouyeWager';
import {applyCommand,type R2RunState} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {previewR2Hand} from '../src/domain/scoreR2';
import {touyeChoice,savedTouyeWager} from '../src/game/TouyeWagerCopy';
import {savedBenefit} from '../src/game/JokerExperience';
import {SavedRun,type SaveStore,type SaveSlots} from '../src/application/SavedRun';
const id=()=>newRunIdentity('touye','group');
const oldIdentity=()=>withPokerEncounterIdentity(withBossSuitRescueIdentity(r2WithHouseJoker({contentVersion:R2_S04_FINISH_VERSION,contentHash:R2_S04_FINISH_HASH})));
function arranged(identity=id()){
 const {state:initial}=touyeFixture('mature-win',{identity});const s=structuredClone(initial);
 const hand=['hearts-3','hearts-5','hearts-7','hearts-9','spades-2','clubs-3','diamonds-4','spades-6'];
 const incoming=['hearts-2','hearts-4','hearts-6'];s.handOrder=hand;s.drawPile=[...s.deckInstances.map(c=>c.id).filter(card=>!hand.includes(card)&&!incoming.includes(card)),...incoming.slice().reverse()];
 return {state:s,incoming,discard:['spades-2','clubs-3','diamonds-4'],held:hand.slice(0,4)};
}
describe('秦琼多张新牌倍率',()=>{
 it.each([[1,'2'],[2,'3'],[3,'4']] as const)('%i 张实际新牌有效计分 → ×%s', (n,m)=>{
  const f=arranged(),s=touyeSend(f.state,touyeBet(f.state,f.discard,'flush'));
  const play=[...f.incoming.slice(0,n),...f.held.slice(0,5-n)],before=structuredClone(s),hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),context=r2ScoreContext(s,hand,play);
  const preview=previewR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'preview',hand,selectedIds:play,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,...context});
  expect(touyeChoice(s,play).status).toContain(`换来的${n}张牌计分 ×${m}`);
  const cmd=touyeCommand(s,{type:'PlayHand',selectedIds:play}),r=applyCommand(s,cmd);expect(r.ok).toBe(true);if(!r.ok)return;const t=r.state.lastTrace!;
  expect(t.touyeWager).toMatchObject({outcome:'won',multiplier:m,core:{activeNewIds:f.incoming.slice(0,n)}});expect(t.finalScore).toBe(preview.scoreRange.minimum);
  const event=t.events.find(e=>e.sourceDefinitionId==='touye')!;expect(event.value.n).toBe(m);expect(t.events.indexOf(event)).toBe(t.events.findIndex(e=>e.phase==='finalScore')-1);
  expect(savedTouyeWager(t,r.state)).toContain(`换来的${n}张牌计分 ×${m}`);expect(savedBenefit(r.state,t,event)?.effect).toContain(`换来的牌计分${n}张`);
  expect(readCheckpoint(makeCheckpoint(r.state,[cmd])).ok).toBe(true);expect(applyCommand(r.state,cmd)).toMatchObject({ok:true,duplicate:true});expect(s).toEqual(before);
 });
 it('未押保留原时点；目标错误或零新有效仍×0.85',()=>{
  const f=arranged(),plain=touyeSend(f.state,{type:'PlayHand',selectedIds:f.held.slice(0,2)});expect(plain.lastTrace!.touyeWager?.multiplier).toBe('1.15');
  const p=touyeSend(f.state,touyeBet(f.state,f.discard,'flush')),commit=p.stage!.touyeWager!.commit!;
  expect(touyeWagerStep('pair',commit,true,f.incoming,true,true)).toMatchObject({outcome:'lost',multiplier:'0.85',core:{lossReason:'target'}});
  expect(touyeWagerStep('flush',commit,true,[],true,true)).toMatchObject({outcome:'lost',multiplier:'0.85',core:{lossReason:'new-core'}});
  expect(touyeWagerStep('flush',commit,true,f.incoming,true,false).multiplier).toBe('2');
 });
 it('旧身份和新身份相同换牌不改变牌序或随机流',()=>{
  const old=arranged(oldIdentity()),fresh=arranged(),a=touyeSend(old.state,touyeBet(old.state,old.discard,'flush')),b=touyeSend(fresh.state,touyeBet(fresh.state,fresh.discard,'flush'));
  expect(b.handOrder).toEqual(a.handOrder);expect(b.drawPile).toEqual(a.drawPile);expect(b.rng).toEqual(a.rng);
  const ids=[...fresh.incoming,...fresh.held.slice(0,2)],x=touyeSend(a,{type:'PlayHand',selectedIds:ids}),y=touyeSend(b,{type:'PlayHand',selectedIds:ids});expect(x.lastTrace!.touyeWager!.multiplier).toBe('2');expect(y.lastTrace!.touyeWager!.multiplier).toBe('4');expect(readCheckpoint(makeCheckpoint(x,[])).ok).toBe(true);
 });
 it('保存失败不重复押注和出牌，重试保留同一补牌证明',async()=>{
  const f=arranged();let slots:SaveSlots={revision:1,current:makeCheckpoint(f.state,[]),previous:null},fail=true;
  const store:SaveStore={read:async()=>slots,commit:async(revision,cp,previous)=>{if(fail)throw Error('injected');slots={revision:revision+1,current:cp,previous};return slots.revision;}};
  const run=SavedRun.restore(store,slots),before=structuredClone(run.state);expect(await run.dispatch(touyeBet(run.state,f.discard,'flush'))).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(before);fail=false;expect((await run.retry()).ok).toBe(true);
  const committed=structuredClone(run.state),proof=structuredClone(committed.stage!.touyeWager!.commit);fail=true;expect(await run.dispatch({type:'PlayHand',selectedIds:[...f.incoming,...f.held.slice(0,2)]})).toMatchObject({ok:false,code:'save-failed'});expect(run.state).toEqual(committed);
  fail=false;const result=await run.retry();expect(result.ok).toBe(true);expect(run.state.stage!.touyeWager!.commit).toEqual(proof);expect(run.state.lastTrace?.touyeWager?.multiplier).toBe('4');expect(SavedRun.restore(store,slots).state).toEqual(run.state);expect(await run.submit(run.journal.at(-1)!)).toMatchObject({ok:true,duplicate:true});
 });
});

import {aiScoreContext,aiHandScoreInput,rankAiHandCandidates,type AiHandInput} from '../src/game/AiHandCandidates';
it('AI 与公开预览使用相同新牌事实，多次查看不推进随机流',()=>{
 const f=arranged(),s=touyeSend(f.state,touyeBet(f.state,f.discard,'flush')),play=[...f.incoming,...f.held.slice(0,2)],hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),stage=s.stage!,context=r2ScoreContext(s,hand,play);
 const input:AiHandInput={hand,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handRules:context.handRules,disabledIds:stage.disabledIds,ordinaryPointsSuppressedIds:[],boss:context.boss,stageIndex:stage.index,sealedJokerIds:context.sealedJokerIds,challengeDisabledJokerId:context.challengeDisabledJokerId,resources:{gold:s.gold,handsLeft:stage.handsLeft,playIndex:stage.playIndex,discardsUsed:stage.discardsUsed,stageHeat:stage.heat,target:stage.targetHeat},contentVersion:s.contentVersion,score:aiScoreContext({...context,handLevels:s.handLevels,previousHandType:stage.previousHandType,wager:stage.wagerSelected})};
 const before=structuredClone(s),a=previewR2Hand(aiHandScoreInput(input,play)),b=previewR2Hand(aiHandScoreInput(input,play));expect(a).toEqual(b);expect(rankAiHandCandidates(input).status).toBe('ready');const r=applyCommand(s,touyeCommand(s,{type:'PlayHand',selectedIds:play}));expect(r.ok).toBe(true);if(r.ok)expect(r.state.lastTrace!.finalScore).toBe(a.scoreRange.minimum);expect(s).toEqual(before);
});
it.each([['B02-zero','won'],['disabled-core','lost'],['mature-accompanying','lost'],['target-miss','lost']] as const)('%s 保持压零、禁用、杂牌与错目标语义',(kind,outcome)=>{
 const f=touyeFixture(kind,{identity:id()}),s=touyeSend(f.state,touyeBet(f.state,f.discard,f.target)),r=touyeSend(s,{type:'PlayHand',selectedIds:f.play});expect(r.lastTrace!.touyeWager!.outcome).toBe(outcome);
 if(kind==='B02-zero')expect(r.lastTrace!.events.some(e=>e.operation==='ordinary-points-suppressed'&&e.targetCardId===f.incoming[0])).toBe(true);
 expect(readCheckpoint(makeCheckpoint(r,[])).ok).toBe(true);
});
it('新规则身份只能用于其对应英雄',()=>{
 for(const [characterId,identity] of [['laohuan',id()],['touye',newRunIdentity('laohuan','group')]] as const){
  expect(applyCommand(null,{runId:'wrong/'+characterId,commandId:'start',expectedSeq:0,action:{type:'StartRun',rulesVersion:'r2',seed:'hero-scope',characterId,openingRoute:'group',r2Identity:identity}})).toMatchObject({ok:false,code:'invalid-r2-profile'});
 }
});
it('静场与禁用能力挑战不能押注，次数不变',()=>{
 for(const options of [{boss:{definitionId:'B08' as const,disabledSuit:null}},{challenge:true}]){
  const f=touyeFixture('mature-win',{...options,identity:id()}),before=structuredClone(f.state),r=applyCommand(f.state,touyeCommand(f.state,touyeBet(f.state,f.discard,f.target)));
  expect(r).toMatchObject({ok:false,code:'touye-disabled'});expect(f.state).toEqual(before);
 }
});
