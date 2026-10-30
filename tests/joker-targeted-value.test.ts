import {describe,expect,it} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {CHARACTER_IDS} from '../src/domain/characters';
import {createRun,applyCommand,type R2RunState,type Action} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2PurchaseValueBase,isR2DynamicEndless,isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision,r2TargetedValueBase} from '../src/domain/r2GroupUpgrade';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {R2_TARGETED_VALUE_JOKERS,R2_VALUE_JOKERS} from '../src/content/r2RouteGrowthJokers';
import {validateR2Content} from '../src/content/r2Schema';
import {r2Price} from '../src/domain/r2Shop';
import {previewR2Hand,scoreR2Hand} from '../src/domain/scoreR2';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {SHOP_TARGETED_VALUE_RECOMMENDATION_SEMANTICS,shopRecommendation} from '../src/game/ShopRecommendation';
import {stableHash} from '../src/domain/hash';

function fresh(hero:typeof CHARACTER_IDS[number],old=false){const identity=r2PurchaseValueBase(newRunIdentity(hero,'group')) as {contentVersion:string;contentHash:string};return createRun({rulesVersion:'r2',runId:'heat/'+hero+(old?'/old':''),seed:'heat',characterId:hero,openingRoute:'group',r2Identity:old?r2TargetedValueBase(identity) as {contentVersion:string;contentHash:string}:identity});}
function send(s:R2RunState,action:Action){const r=applyCommand(s,{runId:s.runId,commandId:'heat/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;}
const hand:PlayingCard[]=[9,9,5,5,2,3,11,14].map((rank,i)=>({id:'c'+i,rank:rank as PlayingCard['rank'],suit:(['hearts','clubs','spades','diamonds'] as const)[i%4]}));
function input(s:R2RunState,ids:string[],selectedIds=hand.slice(0,4).map(c=>c.id),disabledIds:string[]=[],level=1){return {rulesVersion:'r2' as const,runId:s.runId,rootId:'heat/score',hand,selectedIds,disabledIds,jokers:ids.map(id=>r2CreateJoker(id,id,r2Price(id,'none',s),'none',s)),definitions:r2JokerDefinitionsFor(s),handLevels:{'two-pair':level},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,characterId:'neutral' as const,routeGrowth:{clears:0,G:0,S:0,F:0}};}

describe('targeted value identity',()=>{
 it('keeps every other definition, the old identities, prices and hero capabilities exact',()=>{
  expect(validateR2Content(R2_TARGETED_VALUE_JOKERS,'route-growth-v1')).toEqual([]);
  expect(stableHash(R2_TARGETED_VALUE_JOKERS)).toBe(SHOP_TARGETED_VALUE_RECOMMENDATION_SEMANTICS);
  expect(R2_TARGETED_VALUE_JOKERS.filter((d,i)=>d!==R2_VALUE_JOKERS[i]).map(d=>d.id).sort()).toEqual(['b03','b10','d10']);
  for(const hero of CHARACTER_IDS){const now=fresh(hero),old=fresh(hero,true);expect(r2JokerDefinitionsFor(now)).toBe(R2_TARGETED_VALUE_JOKERS);expect(r2JokerDefinitionsFor(old)).toBe(R2_VALUE_JOKERS);expect(isR2DynamicEndless(now)).toBe(true);expect(isR2DynamicEndless(old)).toBe(true);for(const p of [isR2ErxiangGroup,isR2LaohuanFind,isR2TouyeScaling,isR2XiemuRevision])expect(p(now)).toBe(p(old));
   for(const id of ['b03','b10','d10']){const a=R2_VALUE_JOKERS.find(d=>d.id===id)!,b=R2_TARGETED_VALUE_JOKERS.find(d=>d.id===id)!;expect(r2Price(id,'none',now)).toBe(r2Price(id,'none',old));expect(b.rarity).toBe(a.rarity);expect(b.hooks.slice(0,a.hooks.length)).toEqual(a.hooks);expect(b.hooks.at(-1)).toMatchObject({phase:'jokerScore',condition:{kind:'always'},operations:[{kind:id==='b03'?'add-multiplier':'add-heat'}]});}
   for(const s of [old,now]){expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);expect(launchIdentity(hero,{kind:'retry',run:s})).toEqual({contentVersion:s.contentVersion,contentHash:s.contentHash});}
  }
 });
 it.each([[1,186,279],[5,692,865],[15,3357,3730]])('adds b03 initial multiplier at level %i', (level,before,after)=>{
  const old=input(fresh('azao',true),['b03'],undefined,[],level),now=input(fresh('azao'),['b03'],undefined,[],level);expect(scoreR2Hand(old).finalScore).toBe(String(before));expect(scoreR2Hand(now).finalScore).toBe(String(after));expect(previewR2Hand(now).scoreRange.minimum).toBe(String(after));
  now.jokers[0].growth.multiplier={n:'3',d:'1'};const mature=scoreR2Hand(now);expect(mature.events.find(e=>e.operation==='add-multiplier'&&e.sourceDefinitionId==='b03')?.value).toEqual({n:'1',d:'1'});expect(mature.events.find(e=>e.operation==='add-growth'&&e.sourceDefinitionId==='b03')?.value).toEqual({n:'0',d:'1'});
 });
 it('applies the b03 base before its polychrome edition',()=>{
  const x=input(fresh('azao'),['b03']);x.jokers[0].edition='polychrome';const t=scoreR2Hand(x),base=t.events.findIndex(e=>e.reasonKey==='b03.add-multiplier'),edition=t.events.findIndex(e=>e.reasonKey==='edition.polychrome.multiply-multiplier');expect(base).toBeGreaterThanOrEqual(0);expect(edition).toBeGreaterThan(base);expect(t.finalScore).toBe('418');
 });
 it.each([[1,282,306,186,226],[5,884,932,692,772],[15,3789,3897,3357,3537]])('scores same hand at level %i and previews the same result', (level,oldD,newD,oldB,newB)=>{
  for(const [id,before,after] of [['d10',oldD,newD],['b10',oldB,newB]] as const){const old=input(fresh('azao',true),[id],undefined,[],level),now=input(fresh('azao'),[id],undefined,[],level);const a=scoreR2Hand(old),b=scoreR2Hand(now),p=previewR2Hand(now);expect(a.finalScore).toBe(String(before));expect(b.finalScore).toBe(String(after));expect(p.scoreRange.minimum).toBe(b.finalScore);expect(p.scoreRange.maximum).toBe(b.finalScore);expect(b.rng).toEqual(a.rng);}
 });
 it('preserves the four-empty-slot cap, full-slot base and growth semantics',()=>{
  for(const legacy of [true,false]){const s=fresh('azao',legacy);const x=input(s,['d10','e01','e02','e09','d05']);const full=scoreR2Hand(x);expect(full.finalScore).toBe(legacy?'186':'210');const grow=input(s,['b10']);grow.jokers[0].growth.heat={n:'100',d:'1'};const mature=scoreR2Hand(grow);expect(mature.finalScore).toBe(legacy?'386':'426');const gain=mature.events.find(e=>e.sourceDefinitionId==='b10'&&e.operation==='add-growth');expect(gain).toBeDefined();}
 });
 it('honors B06 slot suppression and scoring despite the additional hook',()=>{
  for(const legacy of [true,false])for(const id of ['b03','b10','d10']){const s=fresh('azao',legacy);const x=input(s,['e01',id]);const t=scoreR2Hand({...x,boss:{definitionId:'B06',disabledSuit:null}});expect(t.events.filter(e=>e.sourceDefinitionId===id&&e.phase==='jokerScore')).toHaveLength(0);}
 });
 it('purchases and persists the new definition; recommendations remain audited and read-only',()=>{
  let s=fresh('azao');for(const id of ['b03','b10','d10']){const offer={offerId:'heat/'+id,definitionId:id,price:r2Price(id,'none',s),edition:'none' as const,consumed:false};const before=JSON.stringify(s),old=fresh('azao',true),expected=id==='b03'?'每手倍率+1':id==='b10'?'每手热度+20':'每手热度+12';expect(shopRecommendation(s,offer,'group').condition).toContain(expected);expect(shopRecommendation(old,offer,'group').condition).not.toContain(expected);expect(shopRecommendation(s,offer,'group').stars).toBeGreaterThan(0);expect(JSON.stringify(s)).toBe(before);}
  s.shop!.offers[0]={offerId:'heat/offer',definitionId:'b10',price:r2Price('b10','none',s),edition:'none',consumed:false};s=send(s,{type:'BuyOffer',offerId:'heat/offer'});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
 });
 it('grows from a real purchased instance and restores its earned growth under both identities',()=>{
  for(const id of ['b03','b10'])for(const old of [true,false]){
   let s=fresh('azao',old);s.shop!.offers[0]={offerId:'heat/offer',definitionId:id,price:r2Price(id,'none',s),edition:'none',consumed:false};s=send(s,{type:'BuyOffer',offerId:'heat/offer'});s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});
   const cards=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);const pair=cards.find(c=>cards.filter(other=>other.rank===c.rank).length>=2);expect(pair).toBeDefined();const selected=cards.filter(c=>c.rank===pair!.rank).slice(0,2).map(c=>c.id);s=send(s,{type:'PlayHand',selectedIds:selected});
   expect(s.jokers[0].growth[id==='b03'?'multiplier':'heat']).toEqual(id==='b03'?{n:'1',d:'4'}:{n:'10',d:'1'});expect(s.lastTrace!.events.filter(e=>e.sourceDefinitionId===id&&e.operation===(id==='b03'?'add-multiplier':'add-heat')).map(e=>e.value)).toEqual(old?[]:[{n:id==='b03'?'1':'20',d:'1'}]);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
  }
 });
 it.each(['b03','b10','d10'])('rejects forged %s base events in a real checkpoint',id=>{
  let s=fresh('azao');s.shop!.offers[0]={offerId:'heat/offer',definitionId:id,price:r2Price(id,'none',s),edition:'none',consumed:false};s=send(s,{type:'BuyOffer',offerId:'heat/offer'});s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});s=send(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
  const alter=(fn:(events:NonNullable<R2RunState['lastTrace']>['events'],i:number)=>void)=>{const forged=structuredClone(s),events=forged.lastTrace!.events,i=events.findIndex(e=>e.sourceDefinitionId===id&&e.reasonKey===id+(id==='b03'?'.add-multiplier':'.add-heat'));expect(i).toBeGreaterThan(0);fn(events,i);expect(()=>makeCheckpoint(forged,[])).toThrow();};
  alter((events,i)=>{events[i].value={n:'999',d:'1'};});
  alter((events,i)=>{events[i].visibleCondition={kind:'resource',resource:'play-index',equals:2};});
  alter((events,i)=>{const duplicate=structuredClone(events[i]);duplicate.eventId+='-forged';duplicate.rootEventId=duplicate.eventId;events.splice(i+1,0,duplicate);});
  alter((events,i)=>{[events[i-1],events[i]]=[events[i],events[i-1]];});
  alter((events,i)=>{events[i].sourceInstanceId='forged-instance';});
  alter((events,i)=>{events.splice(i,1);});
  alter((events,i)=>{events[i].after.H={n:'999',d:'1'};});
 });
});
