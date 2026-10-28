import {describe,expect,it} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {CHARACTER_IDS} from '../src/domain/characters';
import {createRun,applyCommand,type R2RunState,type Action} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2JokerValueBase,isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision} from '../src/domain/r2GroupUpgrade';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {R2_HOUSE_JOKERS,R2_VALUE_JOKERS} from '../src/content/r2RouteGrowthJokers';
import {validateR2Content} from '../src/content/r2Schema';
import {r2Price} from '../src/domain/r2Shop';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {jokerAbilityCopyForRun,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {SHOP_VALUE_RECOMMENDATION_SEMANTICS} from '../src/game/ShopRecommendation';
import {stableHash} from '../src/domain/hash';

const ids=['d07','jiedongfeng','b07','c02','c03'];
function fresh(hero:typeof CHARACTER_IDS[number],legacy=false){const identity=newRunIdentity(hero,'group');return createRun({rulesVersion:'r2',runId:'value/'+hero+(legacy?'/old':''),seed:'value-balance',characterId:hero,openingRoute:'group',r2Identity:legacy?r2JokerValueBase(identity) as {contentVersion:string;contentHash:string}:identity});}
function send(s:R2RunState,action:Action){const r=applyCommand(s,{runId:s.runId,commandId:'value/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;}
function cards(ranks:number[],suits:PlayingCard['suit'][]):PlayingCard[]{return ranks.map((rank,i)=>({id:'card/'+i,rank:rank as PlayingCard['rank'],suit:suits[i]}));}
function scoring(s:R2RunState,id:string,hand:PlayingCard[],clears:number,disabledIds:string[]=[]){return scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'value/score',hand,selectedIds:hand.map(c=>c.id),disabledIds,jokers:[r2CreateJoker(id,id,r2Price(id,'none',s),'none',s)],definitions:r2JokerDefinitionsFor(s),handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,characterId:'neutral',routeGrowth:{clears,G:clears,S:clears,F:clears}});}

describe('five card value identity',()=>{
 it('preserves all other definitions, prices, conditions, effects, and all six hero capability identities',()=>{
  expect(validateR2Content(R2_VALUE_JOKERS,'route-growth-v1')).toEqual([]);
  expect(stableHash(R2_VALUE_JOKERS)).toBe(SHOP_VALUE_RECOMMENDATION_SEMANTICS);
  expect(R2_VALUE_JOKERS.filter((d,i)=>d!==R2_HOUSE_JOKERS[i]).map(d=>d.id).sort()).toEqual([...ids].sort());
  for(const hero of CHARACTER_IDS){const s=fresh(hero),old=fresh(hero,true);expect(r2JokerDefinitionsFor(s)).toBe(R2_VALUE_JOKERS);expect(r2JokerDefinitionsFor(old)).toBe(R2_HOUSE_JOKERS);expect(launchIdentity(hero,{kind:'retry',run:old})).toEqual({contentVersion:old.contentVersion,contentHash:old.contentHash});expect(readCheckpoint(makeCheckpoint(old,[])).ok).toBe(true);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
   for(const predicate of [isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision])expect(predicate(s)).toBe(predicate(old));
   for(const id of ids){const a=R2_HOUSE_JOKERS.find(d=>d.id===id)!,b=R2_VALUE_JOKERS.find(d=>d.id===id)!;expect(r2Price(id,'none',s)).toBe(r2Price(id,'none',old));expect(b.rarity).toBe(a.rarity);expect(b.hooks.map(h=>[h.phase,h.condition])).toEqual(a.hooks.map(h=>[h.phase,h.condition]));}
  }
 });
 it.each([0,5,15])('scores actual same hands at early/mid/late route growth %i',clears=>{
  const old=fresh('azao',true),now=fresh('azao');
  const samples:[string,PlayingCard[],string,string,number][]=[
   ['d07',cards([9,9],['hearts','clubs']),'1','3',1],
   ['jiedongfeng',cards([2,3,4,5,6],['hearts','clubs','hearts','clubs','spades']),'3','3',1],
   ['b07',cards([9,9],['hearts','clubs']),'30','50',1],
   ['c02',cards([9,9],['hearts','clubs']),'8','12',1],
   ['c03',cards([9,9],['hearts','clubs']),'8','12',1],
  ];
  for(const [id,hand,before,after,count] of samples){const a=scoring(old,id,hand,clears),b=scoring(now,id,hand,clears);const ae=a.events.filter(e=>e.sourceDefinitionId===id),be=b.events.filter(e=>e.sourceDefinitionId===id);expect(ae).toHaveLength(count);expect(be).toHaveLength(count);expect(ae[0].value).toEqual({n:before,d:id==='d07'||id==='jiedongfeng'?'2':'1'});expect(be[0].value).toEqual({n:after,d:id==='d07'?'2':'1'});expect(BigInt(b.finalScore)).toBeGreaterThan(BigInt(a.finalScore));expect(b.rng).toEqual(a.rng);}
 });
 it('retains all-active and suit restrictions, including disabled cards',()=>{
  const s=fresh('azao'),hand=cards([9,9,4],['hearts','clubs','spades']);
  for(const id of ['d07','b07'])expect(scoring(s,id,hand,0).events.filter(e=>e.sourceDefinitionId===id)).toHaveLength(0);
  const pair=hand.slice(0,2);expect(scoring(s,'b07',pair,0,['card/0']).events.filter(e=>e.sourceDefinitionId==='b07')).toHaveLength(0);
  expect(scoring(s,'c02',pair,0,['card/0']).events.filter(e=>e.sourceDefinitionId==='c02')).toHaveLength(0);
  expect(scoring(s,'c03',pair,0,['card/0']).events.filter(e=>e.sourceDefinitionId==='c03')).toHaveLength(1);
  expect(scoring(s,'jiedongfeng',pair,0).events.filter(e=>e.sourceDefinitionId==='jiedongfeng')).toHaveLength(0);
 });
 it('actual purchase, play and checkpoint keep the new value; player copy reports each identity',()=>{
  let s=fresh('azao');s.shop!.offers[0]={offerId:'value/offer',definitionId:'d07',price:r2Price('d07','none',s),edition:'none',consumed:false};s=send(s,{type:'BuyOffer',offerId:'value/offer'});s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});s=send(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});expect(s.lastTrace!.events.find(e=>e.sourceDefinitionId==='d07')?.value).toEqual({n:'3',d:'2'});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
  for(const legacy of [true,false]){const r=fresh('azao',legacy),ctx=publicJokerMemoryContext(r,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:0});expect(jokerAbilityCopyForRun(r,'d07',undefined,ctx).condition).toContain(legacy?'0.5':'1.5');expect(jokerAbilityCopyForRun(r,'jiedongfeng',undefined,ctx).condition).toContain(legacy?'1.5':'3');}
 });
});
