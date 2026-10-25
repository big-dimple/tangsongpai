import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {createRun} from '../src/domain/run';
import {R2_RULESETS,r2CreateJoker} from '../src/domain/r2Run';
import {R2_ROUTE_GROWTH_IDS} from '../src/content/r2RouteGrowthJokers';
import {isR2RouteGrowth,isR2RouteStarter,R2_ROUTE_GROWTH_VERSION,R2_ROUTE_GROWTH_HASH} from '../src/domain/r2GroupUpgrade';
import {r2JokerDefinitionFor} from '../src/domain/r2ContentProfiles';
import {jokerAbilityCopyForRun,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {shopOfferGuidance} from '../src/game/ShopOfferGuidance';
import {r2Price} from '../src/domain/r2Shop';
import legacyHashes from '../docs/production/evidence/c2-description-consistency-2026-10-11/legacy-copy-hashes-before.json';
import approvedPresentation from '../docs/production/evidence/ci-contract-sync-2026-10-18/approved-presentation-contracts.json';
const identity={contentVersion:R2_ROUTE_GROWTH_VERSION,contentHash:R2_ROUTE_GROWTH_HASH};
function start(p=identity){return createRun({rulesVersion:'r2',characterId:'amo',runId:'c2-copy',seed:'c2-copy',r2Identity:p,...(isR2RouteStarter(p)?{openingRoute:'group' as const}:{})});}
function context(s:ReturnType<typeof start>){return publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:s.deckInstances.length,jokerSlots:5,jokerCount:0});}
const fields=(c:ReturnType<typeof jokerAbilityCopyForRun>)=>[c.condition,c.value,c.rules,c.summary,c.plain!.line,c.plain!.tile,c.plain!.essential,c.plain!.details,JSON.stringify(c.plain!.steps)].join('\n');
it.each(R2_ROUTE_GROWTH_IDS)('C2 %s renders owned/unowned shop and stage summaries/details without stale bindings',id=>{
 const s=start();for(const inStage of [false,true])for(const owned of [false,true]){
  const ctx={...context(s),inStage},j=owned?r2CreateJoker(id,id,8,undefined,identity):undefined,before=JSON.stringify({s,ctx,j});
  const c=jokerAbilityCopyForRun(s,id,j,ctx),text=fields(c);
  expect(text).not.toMatch(/见完整规则|\{\w+\}|五条、同花葫芦、同花五条不算|同花葫芦、同花五条不增加|同花葫芦、同花五条不算|倍数立即回到|累计热度还不到/);
  expect(JSON.stringify({s,ctx,j})).toBe(before);expect(c.plain!.line.length).toBeGreaterThan(5);
  const d=r2JokerDefinitionFor(s,id);for(const h of d.hooks)if(h.condition.kind==='hand-type-in')for(const type of h.condition.values){
   const labels:Record<string,string>={'pair':'对子','two-pair':'两对','three-kind':'三条','straight':'顺子','flush':'同花','full-house':'葫芦','four-kind':'四条','straight-flush':'同花顺','five-kind':'五条','flush-house':'同花葫芦','flush-five':'同花五条'};
   expect(text).toContain(labels[type]);
  }
 }
});
it('C2 fixed score, later growth, sale retention and opening rescue match their public definitions',()=>{
 const s=start(),copy=(id:string)=>jokerAbilityCopyForRun(s,id,undefined,context(s));
 expect(fields(copy('mantangcai'))).toContain('热度+90');expect(copy('mantangcai').plain!.essential).toContain('五条、同花葫芦、同花五条也生效');
 const straight=copy('c04');expect(straight.plain!.line).toContain('热度+50；出牌后攒+10热度');expect(straight.plain!.tile).toContain('任意牌型都能用');expect(straight.plain!.timingLine).toContain('最多攒+100热度');
 expect(fields(copy('c06'))).toContain('0.5');for(const hand of ['同花','同花顺','同花葫芦','同花五条'])expect(copy('c06').plain!.timingLine).toContain(hand);
 expect(copy('jiedongfeng').plain!.essential).toContain('每次出牌只加一次');expect(copy('jiedongfeng').plain!.line).toContain('倍率+1.5');
 expect(copy('e11').plain!.essential).toContain('出售其他唐宋牌保留已有倍数，但本场不增长');expect(copy('e11').plain!.essential).toContain('出售本牌后重买从 ×1');
 expect(copy('f10').plain!.line).toContain('首次成功弃牌');expect(copy('f10').plain!.line).toContain('×3');expect(copy('f10').plain!.essential).toContain('不要求弃牌前缺少成型牌');
 const j=r2CreateJoker('c04','mature',8,undefined,s);j.growth.heat={n:'100',d:'1'};const capped=jokerAbilityCopyForRun(s,'c04',j,context(s));expect(capped.plain!.timingLine).toContain('最多攒+100热度');expect(capped.plain!.tile).toContain('不再增加');
 const rescue=r2CreateJoker('f10','rescue',8,undefined,s);rescue.counters!.rescueArmed=true;expect(jokerAbilityCopyForRun(s,'f10',rescue,{...context(s),inStage:true}).state).toContain('救火待出牌');
});
it('C2 summary, expanded rules and existing shop recommendation share the upgraded family',()=>{
 const s=start(),offer={offerId:'copy-offer',definitionId:'mantangcai',price:r2Price('mantangcai',undefined,s),consumed:false};
 s.shop!.offers[0]=offer;const before=structuredClone(s),c=jokerAbilityCopyForRun(s,'mantangcai',undefined,context(s)),advice=shopOfferGuidance(s,offer);
 expect(JSON.stringify(advice)).toMatch(/五条|同花升级/);expect(c.plain!.essential).toContain('五条、同花葫芦、同花五条也生效');expect(c.plain!.details).toContain('同花五条');expect(s).toEqual(before);
});
it.each(R2_RULESETS.filter(p=>!isR2RouteGrowth(p)))('legacy $contentVersion keeps frozen card definitions',p=>{
 const profile={contentVersion:p.contentVersion,contentHash:p.contentHash};
 const baseline=legacyHashes[p.contentVersion as keyof typeof legacyHashes],approved=approvedPresentation.profiles[p.contentVersion as keyof typeof approvedPresentation.profiles];
 expect(profile.contentHash).toBe(baseline.contentHash);
 const definitions=R2_ROUTE_GROWTH_IDS.map(id=>r2JokerDefinitionFor(profile,id));
 expect(createHash('sha256').update(JSON.stringify(definitions)).digest('hex')).toBe(approved.definitionsSha256);
});
