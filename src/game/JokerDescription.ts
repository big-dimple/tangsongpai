import type {R2JokerDefinition} from '../content/r2Schema';
import {fractionText} from './scoreText';

/** Preserve frozen definitions while presenting the actual identity-specific rule plainly. */
export function playerJokerDescription(definition:R2JokerDefinition):string {
 if(definition.id==='f10'){
  const opening=definition.hooks.find(h=>h.phase==='onDiscard'&&(h.condition.kind==='opening-discard'||h.condition.kind==='cold-opening-discard'));
  const multiplier=definition.hooks.flatMap(h=>h.operations).find(o=>o.kind==='rescue-multiplier');
  if(opening&&multiplier?.kind==='rescue-multiplier'){
   const condition=opening.condition.kind==='cold-opening-discard'?'第一次成功弃牌前手牌凑不出两对及以上时':'第一次成功弃牌时';
   return `本场首次出牌前${condition}，自动准备倍率；下一次出牌为两对及以上时倍率×${fractionText(multiplier.value)}。不必用完弃牌次数；下一次出牌后消耗，场末清空，每场最多一次。`;
  }
 }
 return definition.description;
}
