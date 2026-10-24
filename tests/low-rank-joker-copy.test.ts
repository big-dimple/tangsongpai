import {expect,it} from 'vitest';
import type {PlayingCard,Rank,Suit} from '../src/cards/types';
import {R2_JOKERS} from '../src/content/r2Schema';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {r2CreateJoker} from '../src/domain/r2Run';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {jokerMemoryAbility,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {cardDefinitionName} from '../src/game/tangsongCardNames';
import {R2_PUBLISHED_CONTENT} from '../src/domain/r2PublishedContent';

const identity=newRunIdentity('erxiang','straight'),definitions=r2JokerDefinitionsFor(identity);
const context=publicJokerMemoryContext({phase:'shop',gold:6,stage:null,lastTrace:null,shop:null},{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:0});
const definition=(id:string)=>definitions.find(d=>d.id===id)!;
const copy=(id:string)=>jokerMemoryAbility(definition(id),undefined,context);
const card=(id:string,rank:Rank,suit:Suit='spades'):PlayingCard=>({id,rank,suit});
const score=(hand:PlayingCard[],ids:string[],jokers:string[],disabledIds:string[]=[])=>scoreR2Hand({rulesVersion:'r2',runId:'low-rank-copy',rootId:'low-rank-copy/hand',characterId:'neutral',hand,selectedIds:ids,disabledIds,definitions,jokers:jokers.map(id=>r2CreateJoker(id,'owned/'+id,4,undefined,identity)),handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,routeGrowth:{clears:0,G:0,S:0,F:0},rng:{algorithm:'fnv1a-mulberry32-v1',state:41}});

it('keeps the formal card names and states rank choices, source area, per-card gain and held cap in actual visible copy',()=>{
 expect(cardDefinitionName(definition('d02'))).toBe('奇兵突起');expect(cardDefinitionName(definition('a08'))).toBe('野火春风');
 const a=copy('a08'),d=copy('d02');
 expect(a.plain?.line).toBe(a.condition);expect(a.condition).toContain('每张打出的计分牌');expect(a.condition).toContain('点数是 2、3、4、5 中任一种');expect(a.condition).toContain('20 热度');expect(a.value).toContain('没参与计分');
 expect(d.plain?.line).toBe(d.condition);expect(d.condition).toContain('每次出牌，手里没打出的牌中');expect(d.condition).toContain('点数是 2、3、4、5 中任一种');expect(d.condition).toContain('每张加 6 热度，最多 4 张');expect(d.rules).toContain('同点牌也分别算');expect(d.rules).not.toContain('留在手里的扑克不触发额外加成');expect(d.rules).toContain('不加这些留手牌的普通点数');
});
it('the two hooks agree across current new-run identities and the published version without modifying definitions',()=>{
 const characters=['amo','erxiang','laohuan','azao','touye','xiemu'] as const;
 const identities=[...characters.map(id=>newRunIdentity(id,'straight')),{contentVersion:R2_PUBLISHED_CONTENT.v11.version,contentHash:R2_PUBLISHED_CONTENT.v11.hash}];
 for(const version of identities)for(const id of ['a08','d02']){
  const d=r2JokerDefinitionsFor(version).find(row=>row.id===id)!,before=JSON.stringify(d);expect(d.hooks).toEqual(R2_JOKERS.find(row=>row.id===id)!.hooks);
  const c=jokerMemoryAbility(d,undefined,context);expect(c.plain?.line).toContain('点数');expect(JSON.stringify(d)).toBe(before);
 }
});
it('wildfire accepts two cards of the same low rank but excludes a low kicker, held card and disabled scoring card',()=>{
 const hand=[card('2a',2),card('2b',2,'hearts'),card('kicker4',4),card('held3',3)];
 const both=score(hand,['2a','2b','kicker4'],['a08']),limited=score(hand,['2a','2b','kicker4'],['a08'],['2b']);
 const hits=(trace:ReturnType<typeof score>)=>trace.events.filter(e=>e.sourceDefinitionId==='a08'&&e.operation==='add-heat');
 expect(hits(both).map(e=>e.targetCardId)).toEqual(['2a','2b']);expect(hits(both).every(e=>e.value.n==='20'&&e.phase==='onCardScore')).toBe(true);expect(hits(limited).map(e=>e.targetCardId)).toEqual(['2a']);
});
it('wildfire repeats its gain on a genuine card retrigger rather than implying a once-per-hand cap',()=>{
 const trace=score([{...card('two',2),enhancement:'encore-paper'}],['two'],['a08']),hits=trace.events.filter(e=>e.sourceDefinitionId==='a08'&&e.operation==='add-heat');expect(hits.map(e=>e.retriggerDepth)).toEqual([0,1]);expect(hits.every(e=>e.value.n==='20')).toBe(true);expect(copy('a08').rules).toContain('再次计分');
});
it('surprise troops takes the first four qualifying held cards, skips disabled cards and grants no held ordinary points',()=>{
 const hand=[card('played',13),card('skip9',9),card('2a',2),card('2b',2,'hearts'),card('three',3),card('four',4),card('extra5',5),card('ace',14)],hits=(trace:ReturnType<typeof score>)=>trace.events.filter(e=>e.sourceDefinitionId==='d02'&&e.operation==='add-heat');
 const first=score(hand,['played'],['d02']),afterSkip=score(hand,['played'],['d02'],['2a']);
 expect(hits(first).map(e=>e.targetCardId)).toEqual(['2a','2b','three','four']);expect(hits(afterSkip).map(e=>e.targetCardId)).toEqual(['2b','three','four','extra5']);expect(hits(first).every(e=>e.value.n==='6'&&e.phase==='onHeldCard')).toBe(true);
 expect(first.events.filter(e=>e.sourceType==='card'&&e.operation==='add-heat').map(e=>e.targetCardId)).toEqual(['played']);expect(hits(score(hand,['played'],['d02']))).toHaveLength(4);expect(first.jokers[0].growth).toEqual({});
});
it('the visible amount, ranks and held limit remain bound to authoritative definitions',()=>{
 const d=structuredClone(definition('d02')),a=structuredClone(definition('a08'));
 const h=d.hooks[0];if(h.condition.kind!=='held-rank-first'||h.operations[0].kind!=='add-heat')throw Error('wrong d02 contract');h.condition.limit=2;h.operations[0].value={n:'7',d:'2'};
 const dc=jokerMemoryAbility(d,undefined,context);expect(dc.plain?.line).toContain('3.5 热度，最多 2 张');expect(dc.plain?.tile).toContain('最多2张');
 const ah=a.hooks[0];if(ah.condition.kind!=='rank-in'||ah.operations[0].kind!=='add-heat')throw Error('wrong a08 contract');ah.condition.values=[14];ah.operations[0].value={n:'9',d:'2'};
 const ac=jokerMemoryAbility(a,undefined,context);expect(ac.plain?.line).toContain('点数是 A 中任一种');expect(ac.plain?.tile).toContain('每张+4.5热');
});
