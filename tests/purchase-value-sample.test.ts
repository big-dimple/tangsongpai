import {describe,it,expect} from 'vitest';
import {newRunIdentity} from '../src/game/RunLaunch';
import {createRun} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2Price} from '../src/domain/r2Shop';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {stableHash} from '../src/domain/hash';
import type {PlayingCard} from '../src/cards/types';
const s=createRun({rulesVersion:'r2',runId:'sample',seed:'sample',characterId:'azao',openingRoute:'group',r2Identity:newRunIdentity('azao','group')});
const hand:PlayingCard[]=[9,9,5,5,2,3,11,14].map((rank,i)=>({id:'c'+i,rank:rank as PlayingCard['rank'],suit:(['hearts','clubs','spades','diamonds'] as const)[i%4]}));
describe('purchase value comparisons',()=>{
it('compares the same hand and slots at ordinary and polychrome prices',()=>{
 const output:unknown[]=[];
 expect(stableHash(r2JokerDefinitionsFor(s))).toBe('json-fnv-v1:695909c67b30e242');
 for(const id of ['d07','b03','b07','b10','d10','b06']){
 const ids=id==='d07'||id==='b03'?['mantangcai','b07','e01','e02',id]:['mantangcai','d07','e01','e02',id];
 for(const level of [1,5,15])for(const edition of ['none','polychrome'] as const){const jokers=ids.map((v,i)=>r2CreateJoker(v,'j'+i,r2Price(v,i===4?edition:'none',s),i===4?edition:'none',s));const t=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'score',hand,selectedIds:hand.slice(0,4).map(c=>c.id),disabledIds:[],jokers,definitions:r2JokerDefinitionsFor(s),handLevels:{'two-pair':level},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,characterId:'neutral',routeGrowth:{clears:0,G:0,S:0,F:0}});output.push([id,level,edition,r2Price(id,edition,s),t.finalScore]);}
 }
 expect(output).toEqual([
 ['d07',1,'none',4,'815'],['d07',1,'polychrome',9,'1223'],['d07',5,'none',4,'1721'],['d07',5,'polychrome',9,'2582'],['d07',15,'none',4,'5386'],['d07',15,'polychrome',9,'8079'],
 ['b03',1,'none',6,'815'],['b03',1,'polychrome',11,'1223'],['b03',5,'none',6,'1721'],['b03',5,'polychrome',11,'2582'],['b03',15,'none',6,'5386'],['b03',15,'polychrome',11,'8079'],
 ['b07',1,'none',4,'815'],['b07',1,'polychrome',9,'1223'],['b07',5,'none',4,'1721'],['b07',5,'polychrome',9,'2582'],['b07',15,'none',4,'5386'],['b07',15,'polychrome',9,'8079'],
 ['b10',1,'none',4,'780'],['b10',1,'polychrome',9,'1170'],['b10',5,'none',4,'1666'],['b10',5,'polychrome',9,'2499'],['b10',15,'none',4,'5281'],['b10',15,'polychrome',9,'7922'],
 ['d10',1,'none',4,'724'],['d10',1,'polychrome',9,'1086'],['d10',5,'none',4,'1578'],['d10',5,'polychrome',9,'2367'],['d10',15,'none',4,'5113'],['d10',15,'polychrome',9,'7670'],
 ['b06',1,'none',8,'703'],['b06',1,'polychrome',13,'1055'],['b06',5,'none',8,'1545'],['b06',5,'polychrome',13,'2318'],['b06',15,'none',8,'5050'],['b06',15,'polychrome',13,'7575'],
 ]);
});
});
