import {describe,expect,it} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {SeededRng} from '../src/core/SeededRng';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {r2JokerValueBase} from '../src/domain/r2GroupUpgrade';
import {r2CreateJoker} from '../src/domain/r2Run';
import {applyCommand,createRun} from '../src/domain/run';
import {scoreR2Hand,type ScoreInput} from '../src/domain/scoreR2';
import {noviceContributionPrefix,novicePurchaseAdvice,novicePurchasedContribution,novicePurchaseTarget,type NovicePurchase} from '../src/game/NovicePurchaseGuide';
import {newRunIdentity} from '../src/game/RunLaunch';

const state=(old=false)=>createRun({seed:'novice-purchase-facts',runId:'novice-purchase-facts',characterId:'erxiang',rulesVersion:'r2',
 r2Identity:(old?r2JokerValueBase(newRunIdentity('erxiang')):newRunIdentity('erxiang')) as {contentVersion:string;contentHash:string},
 openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
const purchase:NovicePurchase={instanceId:'bought/black',definitionId:'c03',stageIndex:1};
function score(blackScores:boolean,foil:boolean,old=false){
 const s=state(old);
 const hand:PlayingCard[]=[{id:'five-hearts',rank:5,suit:'hearts'},
  {id:'five-other',rank:5,suit:blackScores?'clubs':'diamonds'},{id:'black-king',rank:13,suit:'clubs'}];
 const joker=r2CreateJoker('c03',purchase.instanceId,4,foil?'foil':undefined,s);
 const input:ScoreInput={rulesVersion:'r2',runId:s.runId,rootId:'saved-hand',characterId:'neutral',hand,selectedIds:hand.map(c=>c.id),disabledIds:[],
  jokers:[joker],definitions:r2JokerDefinitionsFor(s),handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,
  rng:new SeededRng('novice-purchase-facts').snapshot(),amoScoreTiming:'assist-v1',routeGrowth:{clears:0,G:0,S:0,F:0}};
 return {s,input,trace:scoreR2Hand(input)};
}

describe('purchased-card lesson uses saved scoring instances and phases',()=>{
 it('describes only the fixed effect from this saved content identity',()=>{
  for(const [old,amount] of [[false,'12'],[true,'8']] as const){
   const {s,trace}=score(true,false,old),joker=trace.sourceJokers[0];s.jokers=[joker];
   const advice=novicePurchaseAdvice(s,{purchase,status:'ready'});
   expect(advice.action).toBe(`出♠或♣，有效计分各+${amount}筹码`);
   expect(trace.events.find(e=>e.sourceInstanceId===purchase.instanceId&&e.phase==='onCardScore')?.value).toEqual({n:amount,d:'1'});
  }
  const s=state(),pairPurchase:NovicePurchase={instanceId:'bought/pair',definitionId:'b02',stageIndex:1};
  s.jokers=[r2CreateJoker('b02',pairPurchase.instanceId,4,undefined,s)];
  expect(novicePurchaseAdvice(s,{purchase:pairPurchase,status:'ready'}).action).toBe('出≥2张同点牌，有效计分各+0.25倍率');
 });
 it('does not present one number as the complete effect for growth, multiple operations, chance or an edition',()=>{
  const s=state();
  for(const id of ['b10','d10','f08']){
   const candidate:NovicePurchase={instanceId:`bought/${id}`,definitionId:id,stageIndex:1};
   s.jokers=[r2CreateJoker(id,candidate.instanceId,4,undefined,s)];
   const action=novicePurchaseAdvice(s,{purchase:candidate,status:'ready'}).action;
   expect(action).toContain('查看');expect(action).not.toMatch(/\+\d/);
  }
  const pairPurchase:NovicePurchase={instanceId:'bought/pair',definitionId:'b02',stageIndex:1};
  s.jokers=[r2CreateJoker('b02',pairPurchase.instanceId,4,'foil',s)];
  expect(novicePurchaseAdvice(s,{purchase:pairPurchase,status:'ready'}).action).not.toContain('+0.25');
 });
 it('explains that a black played side card did not count as an effective scoring card',()=>{
  const {s,trace}=score(false,false),before=structuredClone(trace);
  expect(trace.sets.playedIds).toContain('black-king');expect(trace.sets.activeScoringIds).not.toContain('black-king');
  expect(novicePurchasedContribution(trace,[purchase])).toBeUndefined();
  const advice=novicePurchaseAdvice(s,{purchase,status:'ready'},{trace,playIndex:1});
  expect(advice.cause).toContain('无♠、♣计分');
  expect(advice.action).toContain('有效计分');expect(trace).toEqual(before);
 });
 it('distinguishes no played pair from a played pair with no effective scoring card',()=>{
  const {s,input}=score(false,false),pairPurchase:NovicePurchase={instanceId:'bought/pair',definitionId:'b02',stageIndex:1};
  const joker=r2CreateJoker('b02',pairPurchase.instanceId,4,undefined,s);s.jokers=[joker];
  const target={purchase:pairPurchase,status:'ready' as const};
  const single=scoreR2Hand({...input,jokers:[joker],selectedIds:['black-king']});
  expect(novicePurchaseAdvice(s,target,{trace:single,playIndex:1}).cause).toBe('上手无同点；');
  const disabled=scoreR2Hand({...input,jokers:[joker],disabledIds:['five-hearts','five-other']});
  expect(disabled.sets.playedIds).toEqual(expect.arrayContaining(['five-hearts','five-other']));
  expect(disabled.sets.activeScoringIds).not.toContain('five-hearts');expect(disabled.sets.activeScoringIds).not.toContain('five-other');
  expect(novicePurchaseAdvice(s,target,{trace:disabled,playIndex:1}).cause).toBe('同点未计分；');
 });
 it('uses the real scoring event and distinguishes an edition from the card effect',()=>{
  const foil=score(false,true),edition=novicePurchasedContribution(foil.trace,[purchase])!;
  expect(edition.event.reasonKey).toBe('edition.foil.add-heat');
  expect(noviceContributionPrefix(edition.event)).toContain('闪箔版次');
  const active=score(true,false),effect=novicePurchasedContribution(active.trace,[purchase])!;
  expect(effect.event).toMatchObject({phase:'onCardScore',sourceInstanceId:purchase.instanceId,targetCardId:'five-other'});
  expect(noviceContributionPrefix(effect.event)).toBe('');
  expect(novicePurchasedContribution(active.trace,[{...purchase,instanceId:'another-instance'}])).toBeUndefined();
 });
 it('falls back when a real boss rule disables the first purchased instance',()=>{
  let s=state();
  for(const type of ['LeaveShop','EnterStage'] as const){
   const result=applyCommand(s,{runId:s.runId,commandId:`fixture/${type}`,expectedSeq:s.commandSeq,action:{type}});
   expect(result.ok).toBe(true);if(!result.ok)throw Error(result.code);s=result.state;
  }
  const first:NovicePurchase={instanceId:'bought/first',definitionId:'b02',stageIndex:0};
  s.jokers=[r2CreateJoker('c03',purchase.instanceId,4,undefined,s),r2CreateJoker('b02',first.instanceId,4,undefined,s)];
  s.stage!.boss={definitionId:'B06',disabledSuit:null};
  expect(novicePurchaseTarget(s,[first,purchase])).toMatchObject({purchase,status:'ready'});
  expect(novicePurchaseTarget(s,[first])).toMatchObject({purchase:first,status:'disabled'});
  s.jokers.reverse();expect(novicePurchaseTarget(s,[first,purchase])).toMatchObject({purchase:first,status:'ready'});

  const fixture=score(true,false),black=fixture.input.jokers[0];
  const trace=scoreR2Hand({...fixture.input,jokers:[r2CreateJoker('b02','other',4,undefined,fixture.s),black],boss:{definitionId:'B06',disabledSuit:null}});
  expect(novicePurchasedContribution(trace,[purchase])).toBeUndefined();
  expect(novicePurchaseAdvice(fixture.s,{purchase,status:'ready'},{trace,playIndex:1}).cause).toContain('计分效果受限制');
 });
});
