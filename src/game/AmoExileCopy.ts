import {amoExileMultiplier,amoExileRequiresKing} from '../domain/r2AmoExile';
export const AMO_EXILE_NAME='贬谪';
export const AMO_EXILE_RULE='出牌时，弃掉手里剩下的牌，本次出牌最终得分 ×4，仅当次、本关一次。';
export const AMO_EXILE_DETAILS=AMO_EXILE_RULE+'至少要有1张余牌可弃；不要求同点，普通对子也能用。弃掉的牌不参与本手计分或留手效果；不算额外一次普通弃牌，不触发普通弃牌收益。之后正常补牌，不永久删牌、不占手位，不额外扣金币、弃牌次数或出牌次数。确认出牌后才用掉本场次数；取消不消耗。';
export function amoExileCopy(run:{contentVersion?:unknown;contentHash?:unknown}){
 const factor=amoExileMultiplier(run),requiresKing=amoExileRequiresKing(run),base=AMO_EXILE_RULE.replace('×4','×'+factor);
 const rule=requiresKing?base.replace('剩下的牌','剩下的牌（其中至少有1张K）'):base;
 const confirmation='弃掉剩余手牌'+(requiresKing?'（须含K）':'')+'，本次出牌最终得分 ×'+factor+'，仅当次、本关一次。';
 const details=rule+AMO_EXILE_DETAILS.slice(AMO_EXILE_RULE.length)+(requiresKing?'主手里的K不算。':'');
 return {factor,requiresKing,rule,confirmation,details};
}
export function savedAmoExileMultiplier(trace:ScoreTrace):string {const e=trace.events.find(e=>e.reasonKey==='amo.exile');return e?.value.n??'4';}
import type {ScoreTrace} from '../domain/scoreR2';
import {heatText} from './scoreText';

/** Saved integer score proves the result even when ordinary H×M had a fractional remainder. */
export function savedAmoExileFormula(trace:ScoreTrace):string|undefined {
 const x=trace.amoExile;
 return x?.use&&x.beforeScore!==null&&x.afterScore!==null?'贬谪：'+heatText(x.beforeScore)+' ×'+savedAmoExileMultiplier(trace)+' = '+heatText(x.afterScore):undefined;
}
