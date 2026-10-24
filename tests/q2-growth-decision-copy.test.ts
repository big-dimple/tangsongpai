import {describe,expect,it} from 'vitest';
import {createRun} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2JokerDefinitionsFor,r2JokerDefinitionFor} from '../src/domain/r2ContentProfiles';
import {r2CreateJoker} from '../src/domain/r2Run';
import {jokerGrowthDecisionCopy} from '../src/game/JokerGrowthDecisionCopy';
import {jokerAbilityCopyForRun,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {shopDecisionCopy} from '../src/game/ShopDecisionCopy';
import {R2_TOOLS} from '../src/content/r2Tools';
const state=()=>createRun({seed:'policy-valid-groups',runId:'growth-copy',characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang','straight'),openingRoute:'straight'});
describe('Q2 first-layer growth purchase decision, only four supported cards',()=>{
 it.each([['c04','顺子或同花顺热度+50','攒+10热度'],['c06','同花牌型','攒+0.5倍率'],['b10','对子等同点组合','攒+10热度'],['b03','对子等同点组合','攒+0.25倍率']])('%s names the real trigger, amount and delayed benefit before purchase',(id,trigger,gain)=>{
  const s=state(),d=r2JokerDefinitionFor(s,id),before=JSON.stringify(s),copy=jokerGrowthDecisionCopy(d,undefined)!;
  expect(copy.effect).toContain(trigger);expect(copy.effect).toContain(gain);expect(copy.effect).toContain('下次出牌起任意牌型都能用');expect(copy.tip).toMatch(/^搭配：/);expect(copy.status).toContain('+0');expect(copy.effect.length).toBeLessThan(60);expect(copy.tip.length).toBeLessThan(35);expect(JSON.stringify(s)).toBe(before);
 });
 it('front-layer offer copy keeps the c04 immediate conditional +50 and the same Tips instead of rewriting it to growth jargon',()=>{
  const s=state(),o=s.shop!.offers.find(o=>o.definitionId==='c04')!,d=r2JokerDefinitionFor(s,'c04'),expected=jokerGrowthDecisionCopy(d,undefined)!,before=JSON.stringify(s),copy=shopDecisionCopy(s,o);
  expect(copy.now).toBe(expected.effect);expect(copy.purchaseAbility?.plain?.effectLine).toBe(expected.effect);expect(copy.purchaseAbility?.plain?.essential).toBe(expected.tip);expect(copy.purchaseAbility?.plain?.status).toContain('从+0');expect(copy.now).not.toContain('成长+10顶100');expect(JSON.stringify(s)).toBe(before);
 });
 it('headroom, current saved value and cap stay real; the default layer has no fabricated past read',()=>{
  const s=state(),d=r2JokerDefinitionFor(s,'c04'),j=r2CreateJoker('c04','held',4,undefined,s),ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:1});
  j.growth.heat={n:'95',d:'1'};const before=JSON.stringify(j),p=jokerAbilityCopyForRun(s,'c04',j,ctx).plain!;expect(p.effectLine).toContain('攒+5热度');expect(p.status).toBe('当前已攒热度：+95。');expect(p.timingLine).toContain('最多攒+100热度');expect(p.status).not.toMatch(/实际读取|上次出牌|已触发/);expect(JSON.stringify(j)).toBe(before);
  j.growth.heat={n:'100',d:'1'};expect(jokerGrowthDecisionCopy(d,j)!.effect).toContain('不再增加');expect(jokerGrowthDecisionCopy(d,j)!.effect).not.toContain('攒+10');
 });
 it('values bind to the definition, not the card id or a frozen amount',()=>{
  const s=state(),d=structuredClone(r2JokerDefinitionFor(s,'c04'));const base=d.hooks[0].operations[0],gain=d.hooks[2].operations[0];if(base.kind!=='add-heat'||gain.kind!=='add-growth')throw Error('fixture');base.value={n:'63',d:'1'};gain.value={n:'7',d:'1'};gain.cap={n:'77',d:'1'};const c=jokerGrowthDecisionCopy(d,undefined)!;expect(c.effect).toContain('热度+63');expect(c.effect).toContain('攒+7热度');expect(c.timing).toContain('最多攒+77热度');
 });
 it('Tips describe real compatible modifier and tool categories without inventing named partners',()=>{
  const s=state(),defs=r2JokerDefinitionsFor(s);expect(defs.some(d=>d.modifiers?.some(m=>m.kind==='four-straight'))).toBe(true);expect(defs.some(d=>d.modifiers?.some(m=>m.kind==='four-flush'))).toBe(true);expect(R2_TOOLS.some(t=>t.operation.kind==='shift-rank')).toBe(true);expect(R2_TOOLS.some(t=>t.operation.kind==='set-suit')).toBe(true);
  expect(jokerGrowthDecisionCopy(r2JokerDefinitionFor(s,'c04'),undefined)!.tip).toContain('改点工具');expect(jokerGrowthDecisionCopy(r2JokerDefinitionFor(s,'c06'),undefined)!.tip).toContain('染色工具');
 });
 it('old different conditions and the two-line a11 card are not rewritten',()=>{
  const s=state(),d=structuredClone(r2JokerDefinitionFor(s,'c06'));d.hooks[1].condition={kind:'hand-type-in',values:['flush','straight-flush']};expect(jokerGrowthDecisionCopy(d,undefined)).toBeUndefined();expect(jokerGrowthDecisionCopy(r2JokerDefinitionFor(s,'a11'),undefined)).toBeUndefined();const ctx=publicJokerMemoryContext(s,{hand:[],scoringLimited:false,deckSize:52,jokerSlots:5,jokerCount:0});expect(jokerAbilityCopyForRun(s,'a11',undefined,ctx)).toMatchObject({minimal:true,condition:'葫芦 ×2\n同花葫芦 ×3'});
 });
});
