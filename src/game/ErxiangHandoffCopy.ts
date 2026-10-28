import {heroSkillName,heroSkillTitle} from './HeroSkillPresentation';
import {usesErxiangHandoff,usesErxiangGroup,erxiangHandoffLimit,ordinaryCardPoints} from '../domain/r2ErxiangHandoff';
import type {R2RunState} from '../domain/r2Run';
import type {R2SelectionFacts} from '../domain/r2SelectionFacts';
import {r2RunModeConfig} from '../content/r2Modes';
import {rankLabel,SUIT_SYMBOL} from '../cards/types';
import {enhancementText} from './CardSpecialLabels';
import {editionLabel} from './r2ToolInfo';
export function erxiangChoice(run:R2RunState,facts?:R2SelectionFacts,targetId:string|null=null){
 const grouped=usesErxiangGroup(run),enabled=usesErxiangHandoff(run)&&r2RunModeConfig(run).characterAbilityEnabled&&run.stage?.boss?.definitionId!=='B08',live=run.phase==='await-input',used=!!run.stage?.erxiangHandoffUsed;
 const candidates=enabled&&live&&!used&&facts&&facts.type!=='high-card'?run.deckInstances.filter(c=>facts.activeScoringIds.includes(c.id)&&!facts.ordinaryPointsSuppressedIds.includes(c.id)).map(card=>{
  const points=ordinaryCardPoints(card),group=facts.activeScoringIds.map(id=>run.deckInstances.find(c=>c.id===id)!).filter(c=>c.rank===card.rank&&!facts.ordinaryPointsSuppressedIds.includes(c.id)),groupIds=group.map(c=>c.id),initialPoints=group.reduce((sum,c)=>sum+ordinaryCardPoints(c),0);
  return {card,points,groupIds,initialPoints,label:'第'+(run.handOrder.indexOf(card.id)+1)+'张 · '+rankLabel(card.rank)+SUIT_SYMBOL[card.suit],detail:'增强：'+enhancementText(card)+'；额外加成：'+editionLabel(card.edition)+'。'+heroSkillName('erxiang')+'：'+(grouped?'同点计分牌'+groupIds.length+'张首次共'+initialPoints+'点热度改加倍率；再次计分也转。':'首次普通'+points+'点热度 → 倍率。')};
 }):[];
 const limit=erxiangHandoffLimit(run),remaining=Math.max(0,limit-(limit===2?run.stage?.erxiangHandoffUses??0:used?1:0));
 const selected=candidates.find(c=>c.card.id===targetId);
 return {grouped,enabled,used,remaining,candidates,selected,compact:heroSkillName('erxiang')+' · '+(used?'已用':!enabled?'已停用':!live?'本场已结束':selected?(grouped?'已选'+selected.groupIds.length+'张 · 首轮'+selected.initialPoints+'点':'已选'+selected.points+'点'):'选牌'),sentence:selected?(grouped?'同点计分牌'+selected.groupIds.length+'张，首轮共'+selected.initialPoints+'点热度改加倍率；再次计分也转，可能降低得分。本场剩'+remaining+'次':'这张的'+selected.points+'点改加倍率，本场剩'+remaining+'次'):used?'本场'+heroSkillName('erxiang')+'已用':!enabled?'本场角色停用，仍可正常出牌':!live?'当前不在出牌阶段':candidates.length?(grouped?'选一张计分牌，同点牌的普通热度改加倍率；可能降低得分，本场剩'+remaining+'次':'选一张计分牌，把首次普通热度改加倍率；本场剩'+remaining+'次'):'先选对子及以上，且至少有一张计分牌的普通点数不为0'};
}
export function savedErxiangHandoff(run:R2RunState):string {
 const t=run.lastTrace?.erxiangHandoff;if(!t?.targetId)return '';
 if(run.lastTrace!.erxiangGroup){const events=run.lastTrace!.events.filter(e=>e.reasonKey==='erxiang.handoff');return '上手'+heroSkillTitle('erxiang')+' · '+new Set(events.map(e=>e.targetCardId)).size+'张同点 · 共'+events.reduce((sum,e)=>sum+Number(e.value.n),0)+'点热度 → 倍率（包括再次计分）';}
 const e=run.lastTrace!.events.find(e=>e.sourceType==='character'&&e.reasonKey==='erxiang.handoff'&&e.targetCardId===t.targetId);
 return e?'上手'+heroSkillTitle('erxiang')+' · '+e.value.n+'点热度 → 倍率（首次普通计分）':'';
}
