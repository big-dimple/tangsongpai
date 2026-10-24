import {expect,it} from 'vitest';
import {createDeck} from '../src/cards/deck';
import {SUITS,type PlayingCard,type Rank} from '../src/cards/types';
import {getR2Tool} from '../src/content/r2Tools';
import {toolCardChange} from '../src/game/ToolChangePreview';
import {evaluateR2Hand} from '../src/domain/evaluateR2';
import {straightWorkshopAdvice,type StraightAdviceInput,type StraightAdviceQuote} from '../src/game/StraightWorkshopAdvice';

const quote=(definitionId='T08',extra:Partial<StraightAdviceQuote>={}):StraightAdviceQuote=>({quoteId:'diy/'+definitionId,definitionId,paidPrice:2,available:true,quotaCost:1,...extra});
const cards=(counts:Record<number,number>):PlayingCard[]=>Object.entries(counts).flatMap(([rank,count])=>Array.from({length:count},(_,i)=>({id:`${rank}/${i}`,rank:Number(rank) as Rank,suit:SUITS[i%4]})));
const input=(deck:PlayingCard[],extra:Partial<StraightAdviceInput>={}):StraightAdviceInput=>({deck,destroyedIds:[],fourStraight:false,quotes:[quote()],gold:4,diyUsesLeft:1,...extra});
const segment:Rank[]=[6,7,8,9,10];
it('does not force advice on a balanced52 deck, including when the four-card rule is owned',()=>{
 for(const fourStraight of [false,true])expect(straightWorkshopAdvice(input(createDeck(),{fourStraight}))).toMatchObject({kind:'none',reason:'no-gap'});
});
it('fills a missing or sole8 from surplus7, returns real alternatives and costs, and leaves input untouched',()=>{
 for(const eights of [0,1]){
  const value=input(cards({6:6,7:6,8:eights,9:6,10:6}),{segment}),before=structuredClone(value),result=straightWorkshopAdvice(value);
  expect(result.kind).toBe('gap');if(result.kind!=='gap')continue;
  const goal=result.goals[0],two=goal.options.find(o=>o.changes[0].count===2)!;
  expect(goal.deficientRanks).toEqual([8]);expect(two).toMatchObject({paidPrice:2,quotaCost:1,changes:[{fromRank:7,toRank:8,count:2,sourceBefore:6,sourceAfter:4}]});
  expect(two.changes[0].eligibleCardIds).toHaveLength(6);expect(two.countsAfter.find(c=>c.rank===8)?.count).toBe(eights+2);expect(value).toEqual(before);
  expect('targetIds' in two).toBe(false);expect('probability' in goal).toBe(false);
 }
});
it('never moves the only connecting neighbour or merely exchanges the location of the same bottleneck',()=>{
 for(const counts of [{6:1,7:1,8:0,9:1,10:1},{6:3,7:2,8:1,9:2,10:3}])expect(straightWorkshopAdvice(input(cards(counts),{segment}))).toMatchObject({kind:'none',reason:'no-safe-transfer'});
});
it('supports two different gaps in one actual same-direction two-card tool and the evaluator confirms the resulting straight',()=>{
 const deck=cards({5:2,7:2,9:1}),result=straightWorkshopAdvice(input(deck,{segment:[5,6,7,8,9]}));expect(result.kind).toBe('gap');if(result.kind!=='gap')return;
 const option=result.goals[0].options.find(o=>o.changes.length===2)!;expect(option.changes.map(c=>[c.fromRank,c.toRank,c.count])).toEqual([[5,6,1],[7,8,1]]);
 const chosen=new Set(option.changes.map(c=>c.eligibleCardIds[0]));const after=deck.map(c=>chosen.has(c.id)?toolCardChange(getR2Tool(option.definitionId),c)!.after!:c);
 expect(evaluateR2Hand(after,{}).type).toBe('straight');
});
it('uses actual Ace boundaries and four-card ownership instead of wrapping ranks or inventing short straights',()=>{
 const deck=cards({10:3,11:3,12:3,13:3});const result=straightWorkshopAdvice(input(deck,{segment:[10,11,12,13,14]}));expect(result.kind).toBe('gap');if(result.kind==='gap')expect(result.goals[0].options[0].changes[0]).toMatchObject({fromRank:13,toRank:14});
 expect(straightWorkshopAdvice(input(cards({14:6,2:1,3:1,4:1}),{fourStraight:true,segment:[14,2,3,4],quotes:[quote('T08')]}))).toMatchObject({kind:'none'});
 expect(straightWorkshopAdvice(input(cards({2:6,3:6,4:6}),{fourStraight:true,segment:[14,2,3,4],quotes:[quote('T09')]}))).toMatchObject({kind:'none'});
 const short=input(cards({14:3,2:3,3:3,4:0,5:3}),{segment:[14,2,3,4],quotes:[quote('T09')]});
 expect(straightWorkshopAdvice(short)).toMatchObject({kind:'none',reason:'unsupported-segment'});
 const four=straightWorkshopAdvice({...short,fourStraight:true});expect(four.kind).toBe('gap');if(four.kind==='gap'){expect(four.goals[0].label).toBe('A–2–3–4');expect(four.goals[0].options[0].changes[0]).toMatchObject({fromRank:5,toRank:4});expect(four.goals[0].options[0].countsAfter.map(c=>c.rank)).toEqual(four.goals[0].countsBefore.map(c=>c.rank));}
 expect(straightWorkshopAdvice({...short,fourStraight:true,segment:[12,13,14,2]})).toMatchObject({kind:'none',reason:'unsupported-segment'});
});
it('honours supplied paid prices, availability, funds and shared quota while preserving genuine stock offers',()=>{
 const value=input(cards({6:4,7:4,9:4,10:4}),{segment});
 for(const extra of [{gold:1},{diyUsesLeft:0},{quotes:[quote('T08',{available:false})]},{quotes:[quote('T08',{paidPrice:7})]}])expect(straightWorkshopAdvice({...value,...extra})).toMatchObject({kind:'none',reason:'no-available-tool'});
 const stock=straightWorkshopAdvice({...value,diyUsesLeft:0,gold:7,quotes:[quote('T08',{quoteId:'stock/real',paidPrice:7,quotaCost:0})]});expect(stock.kind).toBe('gap');if(stock.kind==='gap')expect(stock.goals[0].options[0]).toMatchObject({quoteId:'stock/real',paidPrice:7,quotaCost:0});
 for(const definitionId of ['T03','T07'])expect(straightWorkshopAdvice({...value,quotes:[quote(definitionId,{paidPrice:1,quotaCost:0})]})).toMatchObject({kind:'none',reason:'no-available-tool'});
});
it('excludes destroyed donors, preserves special-card data and does not claim future whole-deck benefit',()=>{
 const deck=cards({6:4,7:3,9:4,10:4});deck.find(c=>c.rank===7)!.edition='polychrome';const value=input(deck,{segment,destroyedIds:['7/1','7/2']}),before=structuredClone(value);
 expect(straightWorkshopAdvice(value)).toMatchObject({kind:'none',reason:'no-safe-transfer'});expect(value).toEqual(before);
 const live=straightWorkshopAdvice({...value,destroyedIds:[]});expect(live.kind).toBe('gap');if(live.kind==='gap'){expect(live.goals[0].caveat).toContain('其它连续段');expect(live.goals[0].countsBefore.find(c=>c.rank===7)?.count).toBe(3);}
});
it('does not recommend paying the one shared opportunity for a window still missing more than one tool can fill',()=>{
 expect(straightWorkshopAdvice(input(cards({5:5,9:5}),{segment:[5,6,7,8,9]}))).toMatchObject({kind:'none',reason:'no-safe-transfer'});
});
