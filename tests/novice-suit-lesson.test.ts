import {describe,expect,it} from 'vitest';
import type {PlayingCard,Rank,Suit} from '../src/cards/types';
import {noviceHandDefinition,noviceSameSuitFeedback} from '../src/game/NoviceSuitLesson';

const card=(suit:Suit,rank:Rank):PlayingCard=>({id:`${suit}-${rank}`,suit,rank});

describe('the tutorial describes the selected suit and real hand rules',()=>{
 it('explains why four hearts are not yet a normal flush',()=>{
  const hand=[card('hearts',11),card('hearts',10),card('hearts',6),card('hearts',3),card('diamonds',4)];
  expect(noviceSameSuitFeedback(hand,hand.slice(0,4).map(c=>c.id),{})).toBe('同花还差1张；高牌看最高点。');
  expect(noviceSameSuitFeedback(hand,[hand[0].id,hand[4].id],{})).toBeUndefined();
 });
 it('describes five same-suit cards and the actual higher hand when applicable',()=>{
  const flush=[11,10,7,6,3].map(rank=>card('hearts',rank as Rank));
  expect(noviceSameSuitFeedback(flush,flush.map(c=>c.id),{})).toBe('5张同花色，牌型是同花。');
  const straightFlush=[2,3,4,5,6].map(rank=>card('hearts',rank as Rank));
  expect(noviceSameSuitFeedback(straightFlush,straightFlush.map(c=>c.id),{})).toBe('5张同花色，牌型是同花顺。');
 });
 it('honours a real four-flush rule rather than teaching the normal threshold',()=>{
  const hand=[2,4,7,10].map(rank=>card('clubs',rank as Rank));
  expect(noviceSameSuitFeedback(hand,hand.map(c=>c.id),{fourFlush:true})).toBe('4张同花色，牌型是同花。');
  expect(noviceHandDefinition('flush',{fourFlush:true})).toContain('4张或5张');
 });
 it('uses suit rather than red or black colour in the chosen hand definition',()=>{
  expect(noviceHandDefinition('flush',{})).toBe('同花：5张花色相同。');
  expect(noviceHandDefinition('straight',{fourStraight:true})).toContain('4张或5张');
 });
});
