import {describe,expect,it} from 'vitest';
import {CHARACTER_IDS} from '../src/domain/characters';
import {createRun,applyCommand,type R2RunState,type Action} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2Price} from '../src/domain/r2Shop';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {r2PurchaseValueBase,isR2DynamicEndless,isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision} from '../src/domain/r2GroupUpgrade';
import {R2_PURCHASE_VALUE_JOKERS,R2_TARGETED_VALUE_JOKERS} from '../src/content/r2RouteGrowthJokers';
import {validateR2Content} from '../src/content/r2Schema';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {shopRecommendation} from '../src/game/ShopRecommendation';
import {scoreR2Hand} from '../src/domain/scoreR2';
import type {PlayingCard} from '../src/cards/types';
const ids=['b03','b10','d10'] as const;
function fresh(hero:typeof CHARACTER_IDS[number],old=false){const identity=newRunIdentity(hero,'group');return createRun({rulesVersion:'r2',runId:'purchase/'+hero+(old?'/old':''),seed:'purchase',characterId:hero,openingRoute:'group',r2Identity:(old?r2PurchaseValueBase(identity):identity) as {contentVersion:string;contentHash:string}});}
function send(s:R2RunState,action:Action){const r=applyCommand(s,{runId:s.runId,commandId:'purchase/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;}
const hand:PlayingCard[]=[9,9,5,5,2].map((rank,i)=>({id:'c'+i,rank:rank as PlayingCard['rank'],suit:(['hearts','clubs','spades','diamonds'] as const)[i%4]}));
function score(s:R2RunState,ids:string[],edition:'none'|'polychrome'='none') {return scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'purchase/score',hand,selectedIds:hand.slice(0,4).map(c=>c.id),disabledIds:[],jokers:ids.map((id,i)=>r2CreateJoker(id,'j'+i,r2Price(id,i===0?edition:'none',s),i===0?edition:'none',s)),definitions:r2JokerDefinitionsFor(s),handLevels:{'two-pair':5},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,characterId:'neutral',routeGrowth:{clears:0,G:0,S:0,F:0}});}
describe('purchase value identity',()=>{
 it('recognizes the six pre-change new-run identity hashes',()=>{
  // Captured from the committed baseline before purchase-value-v1.
  const hashes={amo:'json-fnv-v1:0e7d27b5eb8fef39',touye:'json-fnv-v1:e27a04507ae56f2c',laohuan:'json-fnv-v1:e960d5a985c1416d',erxiang:'json-fnv-v1:8b75115fdc71b183',azao:'json-fnv-v1:6f78f4c76ad24d13',xiemu:'json-fnv-v1:14ecc153c26c35e7'};
  for(const hero of CHARACTER_IDS){const old=r2PurchaseValueBase(newRunIdentity(hero,'group'));expect(old.contentHash).toBe(hashes[hero]);expect(fresh(hero,true).contentHash).toBe(hashes[hero]);}
 });
 it('preserves all former definitions, prices and hero capabilities',()=>{
  expect(validateR2Content(R2_PURCHASE_VALUE_JOKERS,'route-growth-v1')).toEqual([]);
  expect(R2_PURCHASE_VALUE_JOKERS.filter((d,i)=>d!==R2_TARGETED_VALUE_JOKERS[i]).map(d=>d.id).sort()).toEqual([...ids].sort());
  for(const hero of CHARACTER_IDS){const now=fresh(hero),old=fresh(hero,true);expect(r2JokerDefinitionsFor(now)).toBe(R2_PURCHASE_VALUE_JOKERS);expect(r2JokerDefinitionsFor(old)).toBe(R2_TARGETED_VALUE_JOKERS);for(const p of [isR2DynamicEndless,isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision])expect(p(now)).toBe(p(old));for(const id of ids)expect(r2Price(id,'none',now)).toBe(r2Price(id,'none',old));for(const run of [now,old]){expect(readCheckpoint(makeCheckpoint(run,[])).ok).toBe(true);expect(launchIdentity(hero,{kind:'retry',run})).toEqual({contentVersion:run.contentVersion,contentHash:run.contentHash});}}
 });
 it('counts zero and four empty slots and applies the base before polychrome',()=>{
  const now=fresh('azao'),old=fresh('azao',true);
  const four=score(now,['d10']);expect(four.finalScore).toBe('980');expect(score(old,['d10']).finalScore).toBe('932');
  expect(score(now,['d10','e01','e02','e09','d05']).finalScore).toBe('788');expect(score(old,['d10','e01','e02','e09','d05']).finalScore).toBe('740');
  const poly=score(now,['d10'],'polychrome'),base=poly.events.findIndex(e=>e.reasonKey==='d10.add-heat'),edition=poly.events.findIndex(e=>e.reasonKey==='edition.polychrome.multiply-multiplier');expect(edition).toBeGreaterThan(base);expect(poly.finalScore).toBe('1470');
 });
 it.each(ids)('purchases, scores and restores %s under new and prior identities',id=>{
  for(const old of [false,true]){let s=fresh('azao',old);const offer={offerId:'purchase/offer',definitionId:id,price:r2Price(id,'none',s),edition:'none' as const,consumed:false};expect(shopRecommendation(s,offer,'group').stars).toBeGreaterThan(0);s.shop!.offers[0]=offer;s=send(s,{type:'BuyOffer',offerId:offer.offerId});s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});s=send(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});const e=s.lastTrace!.events.find(e=>e.reasonKey===id+(id==='b03'?'.add-multiplier':'.add-heat'));expect(e?.value).toEqual(id==='b03'?old?{n:'1',d:'1'}:{n:'3',d:'2'}:{n:id==='b10'?(old?'20':'40'):(old?'12':'24'),d:'1'});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);const forged=structuredClone(s);forged.lastTrace!.events.find(e=>e.eventId===e!.eventId)!.value={n:'999',d:'1'};expect(()=>makeCheckpoint(forged,[])).toThrow();}
 });
});
