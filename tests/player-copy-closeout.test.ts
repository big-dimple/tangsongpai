import {it,expect} from 'vitest';
import {R2_TOOLS} from '../src/content/r2Tools';
import {createRun} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2JokerDefinitionFor} from '../src/domain/r2ContentProfiles';
import {newRunIdentity} from '../src/game/RunLaunch';
import {jokerAbilityCopyForRun,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {r2JokerStateText} from '../src/game/r2Help';
import {shopRouteRelation} from '../src/game/ShopRouteRelations';
import {toolUseCost} from '../src/game/r2ToolInfo';
import {findShopSynergy} from '../src/game/ShopSynergy';
import {jokerMemory,jokerMemoryAbility} from '../src/game/JokerMemory';
import {R2_ASSIST_JOKERS} from '../src/content/r2AssistJokers';
import {r2TargetedValueBase} from '../src/domain/r2GroupUpgrade';
import {playerJokerDescription} from '../src/game/JokerDescription';
import {R2_COMBO_GROWTH_JOKERS} from '../src/content/r2ComboGrowthJokers';

const setup=(characterId:'erxiang'|'touye'='erxiang')=>createRun({rulesVersion:'r2',seed:'player-copy-closeout',runId:'player-copy-closeout',characterId,r2Identity:newRunIdentity(characterId,'flush'),openingRoute:'flush'});
it('c06 separates one effect, growth timing and the actual zero or carried multiplier',()=>{
 const s=setup(),d=r2JokerDefinitionFor(s,'c06'),j=r2CreateJoker('c06','held',6,'none',s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:1});
 for(const stored of ['0','2']){
  j.growth.multiplier={n:stored,d:'1'};const before=structuredClone({s,j}),p=jokerAbilityCopyForRun(s,'c06',j,ctx).plain!;
  expect(p.effectLine).toContain('同花牌型后，攒+0.5倍率');expect(p.effectLine).toContain('下次出牌起任意牌型都能用');
  expect(r2JokerStateText(j,d)).toContain('倍率成长 '+stored);expect(p.timingLine).toContain('同花葫芦');expect(p.timingLine).toContain('同花五条');expect(p.essential).toMatch(/^搭配：/);expect(p.details).toContain('同花葫芦、同花五条也增加成长');expect(p.details).toContain('出售后丢失');expect({s,j}).toEqual(before);
 }
 const relation=shopRouteRelation(s,j,'flush');expect(relation.body.split(d.description)).toHaveLength(2);expect(relation.body).not.toMatch(/保存事件|用途不表示|对应动作|实例/);
 j.growth={};expect(r2JokerStateText(j,d)).toContain('倍率成长 0');
});
it('legacy c06 exclusions remain visible instead of being mistaken for duplicate inclusions',()=>{
 const s=createRun({rulesVersion:'r2',r2Profile:'group-upgrade-v1',seed:'legacy-c06-exclusions',runId:'legacy-c06-exclusions',characterId:'erxiang'}),j=r2CreateJoker('c06','held',6,'none',s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:1});
 const p=jokerAbilityCopyForRun(s,'c06',j,ctx).plain!;expect(p.essential).toContain('同花葫芦、同花五条不增加成长');expect(p.timingLine).not.toContain('同花葫芦');
});
it('a scoring ban stays explicit while growth timing remains visible',()=>{
 const s=setup(),j=r2CreateJoker('c06','held',6,'none',s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:true,deckSize:52,jokerSlots:5,jokerCount:1}),p=jokerAbilityCopyForRun(s,'c06',j,ctx).plain!;
 expect(p.status).toContain('当前计分暂停');expect(p.effectLine).toContain('下次出牌起任意牌型都能用');
});
it('owned tools show the use cost separately and retain permanent sacrifice and penalty facts',()=>{
 const use=(id:string)=>toolUseCost(R2_TOOLS.find(t=>t.id===id)!);
 expect(use('S02')).toContain('5金');expect(use('S02')).not.toContain('售价');expect(use('S03')).toContain('永久出牌次数');expect(use('S04')).toContain('永久手牌上限');expect(use('S07')).toContain('永久牺牲');expect(use('S03')).toContain('成功后消耗1件工具');
});
it('first scoring copy reads the actual definition even if it is copied',()=>{
 const s=setup(),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:0});
 const definition=structuredClone(R2_ASSIST_JOKERS.find(d=>d.id==='a03')!);
 const copy=jokerMemoryAbility(definition,undefined,ctx);
 expect(copy.condition).toContain('15');expect(copy.condition).toContain('首张有效计分牌');
 expect(jokerMemory(definition,undefined,ctx).short).toContain('+15');
});
it('new and saved growth and empty-slot cards show their own fixed heat and limits',()=>{
 const s=setup(),old=r2TargetedValueBase(s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:0});
 const b10=jokerAbilityCopyForRun(s,'b10',undefined,ctx),oldB10=jokerAbilityCopyForRun(old,'b10',undefined,ctx);
 expect(b10.condition).toContain('每次出牌热度+20');expect(b10.plain!.line).toContain('每次出牌热度+20');expect(b10.plain!.line).toContain('下次出牌');
 expect(oldB10.condition).not.toContain('每次出牌热度+20');expect(oldB10.plain!.line).not.toContain('每次出牌热度+20');
 const b03=jokerAbilityCopyForRun(s,'b03',undefined,ctx),oldB03=jokerAbilityCopyForRun(old,'b03',undefined,ctx);
 expect(b03.condition).toContain('每次出牌倍率+1');expect(b03.condition).toContain('合计最多+4倍率');expect(b03.plain!.line).toContain('每次出牌倍率+1');expect(b03.plain!.line).toContain('下次出牌');expect(b03.plain!.timingLine).toContain('跨场保留');expect(b03.plain!.timingLine).toContain('合计最多+4倍率');
 expect(oldB03.condition).not.toContain('每次出牌倍率+1');expect(oldB03.plain!.line).not.toContain('每次出牌倍率+1');
 const d10=jokerAbilityCopyForRun(s,'d10',undefined,ctx),oldD10=jokerAbilityCopyForRun(old,'d10',undefined,ctx);
 expect(d10.condition).toContain('每次出牌热度+12');expect(d10.condition).toContain('最多+60热度');expect(d10.condition).toContain('最多加 48');
 expect(oldD10.condition).not.toContain('每次出牌热度+12');expect(oldD10.condition).not.toContain('最多+60热度');
});
it('explains the opening-discard multiplier separately for current and older identities',()=>{
 const current=playerJokerDescription(r2JokerDefinitionFor(setup(),'f10'));
 expect(current).toContain('首次出牌前第一次成功弃牌');expect(current).toContain('下一次出牌');expect(current).toContain('倍率×3');expect(current).toContain('不必用完弃牌次数');expect(current).not.toContain('救火');
 const legacy=playerJokerDescription(R2_COMBO_GROWTH_JOKERS.find(d=>d.id==='f10')!);
 expect(legacy).toContain('弃牌前手牌凑不出两对及以上');expect(legacy).not.toContain('救火');
});
it('the Qin Qiong no-discard tradeoff survives player-copy shortening without a gold synergy',()=>{
 const s=setup('touye');s.gold=28;s.jokers=[r2CreateJoker('b10','held',4,'none',s)];s.shop!.offers=[{offerId:'f09',definitionId:'f09',price:6,edition:'none',consumed:false}];
 expect(findShopSynergy(s,'f09')).toMatchObject({hasSynergy:false,heroSynergy:false,tradeoff:'走不弃牌打法可用；发动秦琼弃牌技能会停用本场加成。'});
});
