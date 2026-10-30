import {usesTouyeScaling} from '../domain/r2TouyeWager';
import type {R2RunState} from '../domain/r2Run';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {fractionText} from './scoreText';
/** Owned public source and successful-play counter only; never forecasts the draw or total score. */
export function touyeComboCue(run:R2RunState):string|undefined {
 const owned=run.jokers.find(j=>j.definitionId==='huimaqiang');if(!owned||!run.stage)return;
 const d=r2JokerDefinitionsFor(run).find(d=>d.id===owned.definitionId),h=d?.hooks.find(h=>h.phase==='jokerScore'&&h.condition.kind==='play-window'),op=h?.operations.find(o=>o.kind==='multiply-multiplier');
 if(!h||h.condition.kind!=='play-window'||op?.kind!=='multiply-multiplier')return;
 const next=run.stage.playIndex+1,{minimum,maximum}=h.condition;
 const head=next>=minimum&&next<=maximum?'回马枪：第'+next+'手，就是下一手倍率×'+fractionText(op.value)+'。'
  :next<minimum?'回马枪：第'+minimum+'手起倍率×'+fractionText(op.value)+'，还隔'+(minimum-next)+'手。'
  :'回马枪：本场第'+maximum+'手后不再触发，下场重新计数。';
 return head+'\n押中同花且两项实际生效，英雄'+(usesTouyeScaling(run)?'×2／3／4':'×2')+'与回马枪×'+fractionText(op.value)+'相乘；封禁时不生效。';
}
