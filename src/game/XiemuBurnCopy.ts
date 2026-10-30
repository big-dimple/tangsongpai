import {isR2XiemuRevision} from '../domain/r2GroupUpgrade';
import {cardDefinitionName} from './tangsongCardNames';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {heroSkillName,heroSkillTitle} from './HeroSkillPresentation';
import {usesXiemuBurn,xiemuInterest,xiemuTiersFor,type XiemuBurnCost} from '../domain/r2XiemuBurn';
import {AMO_ASSIST_TYPES} from '../domain/r2QualifiedHands';
import {r2RunModeConfig} from '../content/r2Modes';
import {r2InterestCap,type R2RunState} from '../domain/r2Run';
import type {R2HandType} from '../domain/evaluateR2';
/** Existing held score hooks only: payment may cross a public gold gate before scoring. */
function changedCashGates(run:R2RunState,after:number):string[]{
 if(after<0)return [];const definitions=r2JokerDefinitionsFor(run);
 return [...new Set(run.jokers.flatMap(j=>{const d=definitions.find(d=>d.id===j.definitionId);return d?.hooks.flatMap(h=>{
  const c=h.condition;if(!['onCardScore','onHeldCard','jokerScore'].includes(h.phase)||!('resource'in c)||c.resource!=='gold')return [];
  if(c.kind!=='resource-minimum'&&c.kind!=='resource-maximum'&&c.kind!=='resource')return [];
  const matches=(gold:number)=>c.kind==='resource-minimum'?gold>=c.minimum:c.kind==='resource-maximum'?gold<=c.maximum:gold===c.equals;
  const beforeMatches=matches(run.gold),afterMatches=matches(after);if(beforeMatches===afterMatches)return [];
  const gate=c.kind==='resource-minimum'?'至少'+c.minimum:c.kind==='resource-maximum'?'不超过'+c.maximum:'恰好'+c.equals;
  return [cardDefinitionName(d)+'：花后'+after+'金，'+(afterMatches?'满足持有'+gate+'金条件；仍需看本手与停用状态':'需持有'+gate+'金')];
 })??[];}))];
}
export function xiemuChoice(run:R2RunState,type?:R2HandType,cost:XiemuBurnCost=0){
 const enabled=usesXiemuBurn(run)&&r2RunModeConfig(run).characterAbilityEnabled&&run.stage?.boss?.definitionId!=='B08',live=run.phase==='await-input',used=run.stage?.xiemuBurnUsed??false,qualified=!!type&&AMO_ASSIST_TYPES.includes(type);
 const tiers=xiemuTiersFor(run),choices=tiers.map(({cost:amount,multiplier})=>{const after=run.gold-amount,interest=(g:number)=>Math.min(r2InterestCap(run),Math.floor(g/5)),loss=after>=0?interest(run.gold)-interest(after):0,extraLoss=after>=0&&r2RunModeConfig(run).characterAbilityEnabled?xiemuInterest(run.gold)-xiemuInterest(after):0,reason=!enabled?'本场不能付':!live?'当前不在出牌阶段':used?'本场已用':!qualified?'先选两对及以上':after<0?'金币不足，不降档':'';return {cost:amount,multiplier,after,available:!reason,reason,label:(isR2XiemuRevision(run)&&amount===8?'大赏 · ':'')+'付'+amount+'金 ×'+multiplier,details:after<0?'不足'+(amount-run.gold)+'金，整档拒绝':`花后${after}金；按现在的余额估算，普通利息少${loss}金，额外利息少${extraLoss}金`+changedCashGates(run,after).map(message=>'；'+message).join('')};});
 return {enabled,used,qualified,choices,compact:heroSkillName('xiemu')+' · '+(used?'已用':!enabled?'已停用':!live?'本场已结束':cost?'已选付'+cost+'金':'付'+tiers.map(t=>t.cost).join('／')+'金'),mobile:heroSkillName('xiemu'),details:`当前${run.gold}金；${used?'本场'+heroSkillName('xiemu')+'已用，入场才重置':'每场一次，默认不付；选档不扣，出牌才扣'}。\n`+choices.map(c=>c.label+'：'+c.details+(c.reason?'；'+c.reason:'')).join('\n')+(!r2RunModeConfig(run).characterAbilityEnabled?'\n角色能力停用，不产生额外关末息。':'')+'\n利息变化只按现在的余额估算；过关时按实际扣钱后、奖励前的余额计算。其他持币效果也读剩余金币。'};
}
export function savedXiemuBurn(run:R2RunState):string {const saved=run.lastTrace,t=saved?.xiemuBurn;if(!saved||!t)return '';const interest=saved.events.find(e=>e.sourceType==='character'&&e.sourceDefinitionId==='xiemu'&&e.phase==='onStageClear'),principal=saved.combo?.goldBeforeRewards,zeroInterest=!interest&&principal!=null&&principal<5&&usesXiemuBurn(run)&&r2RunModeConfig(run).characterAbilityEnabled;return heroSkillTitle('xiemu')+' · '+(t.cost?`上手已付${t.cost}金，${t.goldBefore}→${t.goldAfter}；角色时点实际×${t.multiplier}`:'上手未付，保留金币')+(interest?'\n额外关末息+'+interest.value.n+'金；奖励前本金'+interest.goldBeforeRewards+'，不含本次奖励':zeroInterest?'\n额外关末息+0金；奖励前本金'+principal+'金，不足5金':'');}
