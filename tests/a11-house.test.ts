import {expect,it} from 'vitest';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {CHARACTER_IDS} from '../src/domain/characters';
import {createRun,applyCommand,type R2RunState} from '../src/domain/run';
import {r2CreateJoker,assertR2Invariants} from '../src/domain/r2Run';
import {r2HouseBase,r2HouseProfile,r2JokerValueBase} from '../src/domain/r2GroupUpgrade';
import {r2JokerDefinitionsFor,r2JokerDefinitionFor} from '../src/domain/r2ContentProfiles';
import {R2_ROUTE_GROWTH_JOKERS,R2_HOUSE_JOKERS,R2_VALUE_JOKERS,hasR2RouteGrowthDefinitions} from '../src/content/r2RouteGrowthJokers';
import {r2Price,R2_ECONOMY,r2PurchasePrice,r2Pool} from '../src/domain/r2Shop';
import {R2_EDITIONS} from '../src/content/r2Tools';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {r2RouteSnapshot} from '../src/domain/r2RouteGrowth';
import {Rational} from '../src/domain/rational';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {jokerAbilityCopyForRun,jokerMemory,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {catalogFacts} from '../src/game/Catalog';
import {shopRecommendation} from '../src/game/ShopRecommendation';
import type {PlayingCard} from '../src/cards/types';
const copy='葫芦 ×2\n同花葫芦 ×3';
function run(hero:typeof CHARACTER_IDS[number]='amo',legacy=false){const identity=newRunIdentity(hero,'group');return createRun({rulesVersion:'r2',characterId:hero,seed:'a11',runId:'a11/'+hero,r2Identity:(legacy?r2HouseBase(identity):identity) as {contentVersion:string;contentHash:string},openingRoute:'group'});}
function send(s:R2RunState,action:Parameters<typeof applyCommand>[1]['action']){const r=applyCommand(s,{runId:s.runId,commandId:'c/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);assertR2Invariants(r.state);return r.state as R2RunState;}
function cards(ranks:number[],flush=false):PlayingCard[]{return ranks.map((rank,i)=>({id:'c/'+i,rank:rank as PlayingCard['rank'],suit:flush?'hearts':i%2?'clubs':'spades'}));}
it('all six new games bind only the revised a11 while exact old checkpoints and retry remain valid',()=>{
 for(const hero of CHARACTER_IDS){const s=run(hero),old=run(hero,true);expect(r2HouseProfile(s)).toBeDefined();expect(r2JokerDefinitionsFor(s)).toBe(R2_VALUE_JOKERS);expect(r2JokerDefinitionsFor(r2JokerValueBase(s))).toBe(R2_HOUSE_JOKERS);expect(r2JokerDefinitionsFor(old)).toBe(R2_ROUTE_GROWTH_JOKERS);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);expect(readCheckpoint(makeCheckpoint(old,[])).ok).toBe(true);expect(launchIdentity(hero,{kind:'retry',run:old})).toEqual(r2HouseBase(s));}
 expect(R2_HOUSE_JOKERS.filter((d,i)=>d!==R2_ROUTE_GROWTH_JOKERS[i]).map(d=>d.id)).toEqual(['a11']);expect(hasR2RouteGrowthDefinitions(R2_HOUSE_JOKERS)).toBe(true);
});
it.each([[false,'full-house','2'],[true,'flush-house','3']] as const)('actual %s house applies one multiplier and no retrigger', (flush,type,factor)=>{
 const s=send(send(run(),{type:'LeaveShop'}),{type:'EnterStage'}),hand=cards([9,9,9,13,13],flush);
 const base={rulesVersion:'r2' as const,runId:s.runId,rootId:'a11-score',previousHandType:null,hand,selectedIds:hand.map(c=>c.id),disabledIds:[],handLevels:{},playIndex:1,handsBeforePlay:4,wager:false,rng:s.rng.rule,characterId:'neutral' as const,definitions:r2JokerDefinitionsFor(s),routeGrowth:r2RouteSnapshot(s.routeGrowth)};
 const without=scoreR2Hand({...base,jokers:[]}),withCard=scoreR2Hand({...base,jokers:[r2CreateJoker('a11','messi',9,undefined,s)]});
 expect(withCard.handType).toBe(type);const events=withCard.events.filter(e=>e.sourceDefinitionId==='a11');expect(events).toHaveLength(1);expect(events[0]).toMatchObject({phase:'jokerScore',operation:'multiply-multiplier',value:{n:factor,d:'1'}});
 expect(Rational.fromJSON(events[0].after.M).compare(Rational.fromJSON(events[0].before.M).multiply(new Rational(BigInt(factor))))).toBe(0);
 expect(withCard.events.some(e=>e.operation==='retrigger-card')).toBe(false);expect(withCard.accumulator.M).toEqual(Rational.fromJSON(without.accumulator.M).multiply(new Rational(BigInt(factor))).toJSON());
});
it.each([[9],[9,9],[9,9,9],[9,9,9,9,13],[2,4,7,9,13],[9,9,9,9,9]].map(ranks=>({ranks})))('unrelated ranks $ranks do not multiply',({ranks})=>{
 const s=run(),hand=cards(ranks,true);
 const t=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'negative',previousHandType:null,characterId:'neutral',routeGrowth:r2RouteSnapshot(s.routeGrowth),hand,selectedIds:hand.map(c=>c.id),disabledIds:[],handLevels:{},jokers:[r2CreateJoker('a11','messi',9,undefined,s)],definitions:r2JokerDefinitionsFor(s),playIndex:1,handsBeforePlay:4,wager:false,rng:s.rng.rule});expect(t.events.filter(e=>e.sourceDefinitionId==='a11'&&e.operation==='multiply-multiplier')).toEqual([]);
});
it.each([false,true])('real PlayHand persists one house multiplier, flush=%s; B15 seals it',flush=>{
 let s=run();s.jokers=[r2CreateJoker('a11','messi',9,undefined,s)];s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});
 const ids=['spades-9','hearts-9','clubs-9','spades-13','hearts-13'];if(flush)for(const c of s.deckInstances)if(ids.includes(c.id))c.suit='hearts';
 s.handOrder=[...ids,...s.deckInstances.filter(c=>!ids.includes(c.id)).slice(0,s.stage!.handLimit-ids.length).map(c=>c.id)];s.drawPile=s.deckInstances.filter(c=>!s.handOrder.includes(c.id)).map(c=>c.id);assertR2Invariants(s);
 const after=send(s,{type:'PlayHand',selectedIds:ids}),events=after.lastTrace!.events.filter(e=>e.sourceDefinitionId==='a11');expect(events).toHaveLength(1);expect(events[0]).toMatchObject({operation:'multiply-multiplier',value:{n:flush?'3':'2',d:'1'}});expect(readCheckpoint(makeCheckpoint(after,[])).ok).toBe(true);
 const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);
 const sealed=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'sealed',previousHandType:null,characterId:'neutral',routeGrowth:r2RouteSnapshot(s.routeGrowth),hand,selectedIds:ids,disabledIds:[],handLevels:{},jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),boss:{definitionId:'B15',disabledSuit:null},sealedJokerIds:['messi'],playIndex:1,handsBeforePlay:4,wager:false,rng:s.rng.rule});expect(sealed.events.filter(e=>e.sourceDefinitionId==='a11'&&e.operation==='multiply-multiplier')).toEqual([]);
});
it('raises only a11 from 8 to 9 with the same rarity, pool, weights, edition deltas and discounts; actual purchase saves 9',()=>{
 let s=run();const old=run('amo',true);expect(r2JokerDefinitionFor(s,'a11').rarity).toBe('rare');expect(R2_ECONOMY.weights).toEqual({common:5,uncommon:3,rare:2});expect(r2Pool([],[],s).map(d=>d.id)).toEqual(r2Pool([],[],old).map(d=>d.id));
 for(const d of R2_HOUSE_JOKERS)for(const e of R2_EDITIONS)expect(r2Price(d.id,e.id,s)-r2Price(d.id,e.id,old)).toBe(d.id==='a11'?1:0);
 expect(r2Price('a11','none',old)).toBe(8);expect(r2Price('a11','none',s)).toBe(9);
 s.gold=12;const offer=s.shop!.offers[0];Object.assign(offer,{definitionId:'a11',edition:'none',price:9});assertR2Invariants(s);expect(r2PurchasePrice({...s,purchaseCoupons:1},offer)).toBe(7);
 s=send(s,{type:'BuyOffer',offerId:offer.offerId});expect(s.gold).toBe(3);expect(s.jokers.at(-1)).toMatchObject({definitionId:'a11',paidPrice:9});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
});
it('shop, owned and catalog use exactly two lines; no old retrigger advice leaks into recommendations',()=>{
 const s=run(),j=r2CreateJoker('a11','messi',9,undefined,s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:1});
 for(const own of [undefined,j]){const c=jokerAbilityCopyForRun(s,'a11',own,ctx);expect(c.condition).toBe(copy);expect(c.plain?.line).toBe(copy);expect([c.value,c.state,c.rules,c.flavor,c.plain?.essential,c.plain?.details].join('')).toBe('');expect(c.minimal).toBe(true);}
 expect(jokerMemory(r2JokerDefinitionFor(s,'a11'),j,ctx).labelCandidates).toEqual(['查看效果']);
 expect(catalogFacts(s).entries.find(e=>e.id==='a11'&&e.kind==='joker')?.summary).toBe(copy);
 const offer={offerId:'a11-offer',definitionId:'a11',price:9,edition:'none' as const,consumed:false};expect(shopRecommendation(s,offer).reason).toBe('葫芦 ×2');s.jokers=[j];expect(shopRecommendation(s,{...offer,definitionId:'d09',price:r2Price('d09','none',s)}).facts.retriggerSource).toBe(false);
});
