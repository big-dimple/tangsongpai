import type {R2JokerDefinition,R2JokerInstance} from '../content/r2Schema';
import {R2_ROUTE_HAND_TYPES} from '../domain/r2RouteGrowth';
import {growthBounds} from './GrowthOpportunity';
import {fractionText} from './scoreText';
import {Rational} from '../domain/rational';

/** Four existing growth cards only. Every amount and cap comes from the active definition. */
export function jokerGrowthDecisionCopy(d:R2JokerDefinition,j:R2JokerInstance|undefined){
 if(!['b10','b03','c04','c06'].includes(d.id)||d.modifiers?.length)return;
 const family=d.id==='c04'?'S':d.id==='c06'?'F':'G';
 const writes=d.hooks.filter(h=>h.phase==='afterHand'&&h.condition.kind==='hand-type-in'&&h.condition.values.length===R2_ROUTE_HAND_TYPES[family].length&&R2_ROUTE_HAND_TYPES[family].every(t=>h.condition.kind==='hand-type-in'&&h.condition.values.includes(t)));
 if(writes.length!==1||writes[0].operations.length!==1)return;
 const grow=writes[0].operations[0];if(grow.kind!=='add-growth')return;
 const reads=d.hooks.filter(h=>h.phase==='jokerScore'&&h.condition.kind==='always'&&h.operations.length===1&&h.operations[0].kind==='read-growth'&&h.operations[0].key===grow.key);
 if(reads.length!==1)return;
 const read=reads[0].operations[0];if(read.kind!=='read-growth')return;
 const fixed=d.id==='c04'?d.hooks.find(h=>h.phase==='jokerScore'&&h.condition.kind==='hand-type-in'&&h.condition.values.length===R2_ROUTE_HAND_TYPES.S.length&&R2_ROUTE_HAND_TYPES.S.every(t=>h.condition.kind==='hand-type-in'&&h.condition.values.includes(t))):d.id==='b10'||d.id==='b03'?d.hooks.find(h=>h.phase==='jokerScore'&&h.condition.kind==='always'&&h.operations.length===1&&(h.operations[0].kind==='add-heat'||h.operations[0].kind==='add-multiplier')):undefined;
 if(d.hooks.length!==(d.id==='c04'||fixed?3:2)||d.id==='c04'&&(!fixed||fixed.operations.length!==1||fixed.operations[0].kind!=='add-heat'))return;
 const bounds=growthBounds(d,j,grow),unit=read.target==='heat'?'热度':'倍率',saved=fractionText(j?.growth[grow.key]??{n:'0',d:'1'}),cap=fractionText(bounds.cap);
 const trigger=family==='S'?'顺子或同花顺':family==='F'?'同花牌型':'对子等同点组合';
 const immediate=fixed?.operations[0];
 const fixedText=immediate?.kind==='add-heat'?(d.id==='b10'?`每次出牌热度+${fractionText(immediate.value)}`:`${trigger}热度+${fractionText(immediate.value)}`):immediate?.kind==='add-multiplier'?`每次出牌倍率+${fractionText(immediate.value)}`:'';
 const start=fixedText?(d.id==='c04'?`${fixedText}；出牌后`:`${fixedText}；打出${trigger}后，`):`打出${trigger}后，`;
 const effect=bounds.capped?(fixedText?`${fixedText}；已攒${unit}达上限，不再增加，已有成长仍可用。`:`已攒${unit}达上限，不再增加；每次出牌仍能加上。`):`${start}攒+${fractionText(bounds.delta)}${unit}，下次出牌起任意牌型都能用。`;
 const combined=immediate?.kind==='add-multiplier'?`固定加成与成长合计最多+${fractionText(Rational.fromJSON(immediate.value).add(Rational.fromJSON(bounds.cap)).toJSON())}倍率。`:'';
 const timing=(family==='F'?'同花顺、同花葫芦、同花五条也能攒；':'')+`最多攒+${cap}${unit}，跨场保留，出售后清空。`+combined;
 const tip=family==='S'?'搭配：让普通顺子只需4张的唐宋牌，或改点工具。':family==='F'?'搭配：染色工具，或让普通同花只需4张的唐宋牌。':'搭配：同样靠同点组合生效的唐宋牌，或改点工具。';
 const tile=(fixedText?fixedText+'\n':'')+(bounds.capped?`已攒+${cap}${unit}，不再增加\n每次出牌仍能用`:`${family==='S'?'顺子/同花顺':family==='F'?'同花':'成组'}后攒+${fractionText(bounds.delta)}${unit}\n下次起任意牌型都能用`);
 return {effect,timing,tip,status:j?`当前已攒${unit}：+${saved}。`:`新买入从+0${unit}开始攒。`,line:effect,tile};
}
