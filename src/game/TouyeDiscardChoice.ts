import type {R2RunState} from '../domain/r2Run';
import {r2DiscardCost} from '../domain/r2Run';
import {touyeConfirmationCopy} from './TouyeWagerCopy';
import type {DetailDialog} from './DetailDialog';
import {mountHeroDecisionEyes} from './HeroDecisionEyes';
import {showHeroDiscardChoice} from './HeroDiscardChoice';
/** A fresh UI-only discard draft. The table's proposed play is never reused or changed. */
export function showTouyeDiscardChoice(dialog:DetailDialog,run:R2RunState,valid:()=>boolean,next:(ids:string[])=>void):void {
 const copy=touyeConfirmationCopy(run,[]),modal=showHeroDiscardChoice(dialog,run,valid,next,{title:'秦琼 · 另选弃牌',body:copy.qualification+'；'+copy.success+'，不押仍按原规则。',summaryBody:'另选1–5张要弃的牌，原出牌选择保留。',effectBody:'确认换牌花'+r2DiscardCost(run)+'次弃牌'+(run.stage?.boss?.definitionId==='B07'?'＋1金币':'')+'，不能重抽。'+copy.risk+'。',nextLabel:'下一步 · 选押注牌型'});
 mountHeroDecisionEyes(modal,'discard-choice');modal.classList.add('touye-discard-choice');
}
