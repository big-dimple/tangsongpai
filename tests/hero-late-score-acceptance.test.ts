import {describe,expect,it} from 'vitest';
import {activeCards,activeJoker,activeScoreInput} from './fixtures/p1a-active-mult';
import {scoreR2Hand,previewR2Hand,type ScoreInput} from '../src/domain/scoreR2';
import {touyeSnapshotToken,type TouyeCommit} from '../src/domain/r2TouyeWager';
import type {PlayingCard} from '../src/cards/types';

/** Controlled bounded input, not proof of natural acquisition or a balance result. */
function fixedLateHand(){
 const hand=activeCards([14,14,14,14,14],0,true),editions=['polychrome','holographic','polychrome','polychrome','polychrome'] as const;
 hand.forEach((c,i)=>{c.enhancement=i===0?'glass-paper':'heat-paper';c.edition=editions[i];});
 const jokers=['c06','b09','huimaqiang','f06','c04'].map((id,i)=>({...activeJoker(id,id==='c04'?{heat:{n:'90',d:'1'}}:id==='c06'?{multiplier:{n:'0',d:'1'}}:{},id==='c04'?'holographic':undefined),instanceId:'late/'+id+'/'+i}));
 const base=activeScoreInput(hand,jokers,{handLevels:{'flush-five':18},boundedClear:true,routeGrowth:{clears:23,G:23,S:0,F:23},gold:20,playIndex:3,activeMultTiming:'after-route-growth'});
 return {hand,base};
}
function qinIntent(hand:PlayingCard[]):NonNullable<ScoreInput['touyeWager']>{
 const old=activeCards([2,3,4]),handBefore=[...hand.slice(3),...old],selectedIds=old.map(c=>c.id),rules={fourStraight:false,fourFlush:false};
 const commit:TouyeCommit={target:'flush',stageIndex:18,duePlayIndex:3,discardCommandId:'late/discard',expectedSeq:7,handBefore,rules,selectedIds,snapshotToken:touyeSnapshotToken(handBefore,rules,18,3,7),refill:{handLimit:5,handAfter:[...hand.slice(3),...hand.slice(0,3)].map(c=>c.id),refilledIds:hand.slice(0,3).map(c=>c.id)}};
 return {commit,newCore:true,scaled:true};
}
describe('固定后期手的主动倍率结算顺序',()=>{
 it('同一手先得 2500 万，辛／秦／花在全部效果后各自 ×4 至 1 亿',()=>{
  const {hand,base}=fixedLateHand(),plain=scoreR2Hand(base);expect(plain.finalScore).toBe('25000000');
  const inputs:ScoreInput[]=[
   {...base,characterId:'laohuan',laohuanTrick:true,laohuanFind:{rank:14,batchIds:hand.slice(0,4).map(c=>c.id),beforeUsed:false}},
   {...base,characterId:'touye',touyeWager:qinIntent(hand)},
   {...base,characterId:'xiemu',heroBalance:true,xiemuFrequent:true,xiemuRevised:true,xiemuBurn:{cost:8,goldBefore:28,beforeUsed:false}},
  ];
  for(const input of inputs){const before=structuredClone(input),preview=previewR2Hand(input),trace=scoreR2Hand(input),role=trace.events.findIndex(e=>e.sourceType==='character'&&e.operation==='multiply-multiplier');
   expect(trace.finalScore).toBe('100000000');expect(preview.scoreRange).toEqual({minimum:'100000000',maximum:'100000000'});expect(input).toEqual(before);expect(trace.rng).toEqual(plain.rng);expect(trace.events[role].value).toEqual({n:'4',d:'1'});
   for(const predicate of [(e:typeof trace.events[number])=>e.reasonKey==='enhancement.glass-paper.multiply-multiplier',(e:typeof trace.events[number])=>e.reasonKey.startsWith('edition.polychrome'),(e:typeof trace.events[number])=>e.phase==='jokerScore',(e:typeof trace.events[number])=>e.phase==='routeGrowth']){const indexes=trace.events.map((e,i)=>predicate(e)?i:-1).filter(i=>i>=0);expect(indexes.length).toBeGreaterThan(0);expect(Math.max(...indexes)).toBeLessThan(role);}
   expect(trace.events.findIndex(e=>e.operation==='final-score')).toBeGreaterThan(role);
  }
 });
});
