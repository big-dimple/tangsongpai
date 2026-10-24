import {Rational} from '../domain/rational';
import {r2GrowthCaps,r2GrowthMinimums,type R2JokerDefinition,type R2JokerInstance} from '../content/r2Schema';
import {fractionText} from './scoreText';

export interface JokerSavedGrowthCopy {status:string[];notes:string[]}

/** Read-only saved-growth presentation. Never evaluates conditions, scores or random actions. */
export function jokerSavedGrowthCopy(definition:R2JokerDefinition,instance:R2JokerInstance|undefined):JokerSavedGrowthCopy|undefined {
 if(!instance)return;
 const caps=r2GrowthCaps(definition),keys=Object.keys(caps);if(!keys.length)return;
 const operations=definition.hooks.flatMap(h=>h.operations),growth={...r2GrowthMinimums(definition),...instance.growth};
 const status:string[]=[],notes:string[]=[];
 for(const key of keys){
  const value=growth[key]??{n:'0',d:'1'},cap=caps[key],coefficient=key==='coefficient',pending=key==='pendingHeat';
  const label=coefficient?'倍率系数':pending?'待用热度':key==='multiplier'?'倍率':'热度',prefix=coefficient?'×':'+';
  const capped=Rational.fromJSON(value).compare(Rational.fromJSON(cap))>=0;
  const current=coefficient?'当前倍率系数':pending?'当前待用热度':'当前已攒'+label;
  status.push(current+'：'+prefix+fractionText(value)+'；上限'+prefix+fractionText(cap)+(capped?'（已到上限）':''));
  const consumed=operations.some(o=>o.kind==='consume-growth'&&o.key===key);
  if(pending||consumed)notes.push(label+'在实际读取后消耗'+(pending?'，场末清空':'')+'；新增从后续出牌生效。');
  else notes.push((coefficient?'倍率系数':'已攒'+label)+'跨手、跨场保留；新增从后续出牌生效，不补算刚结束的一手。');
 }
 if(operations.some(o=>o.kind==='update-score-growth'))notes.push('比分成长只在本手实际比分超过上手时增加；未超过会归零，到上限也可能归零。');
 if(operations.some(o=>o.kind==='multiply-coefficient-once'))notes.push('倍率系数每场最多成长一次。');
 const reset=operations.find(o=>o.kind==='reset-coefficient');
 if(reset?.kind==='reset-coefficient')notes.push('牌面所述出售事件会把倍率系数重置为×'+fractionText(reset.initial)+'。');
 notes.push('出售这张牌后，随牌保存的成长一并丢失。');
 return {status,notes:[...new Set(notes)]};
}
