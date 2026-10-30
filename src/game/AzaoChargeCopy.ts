import {heroSkillName,heroSkillTitle} from './HeroSkillPresentation';
import {usesAzaoCharge} from '../domain/r2AzaoCharge';
import {AMO_ASSIST_TYPES} from '../domain/r2QualifiedHands';
import {r2RunModeConfig} from '../content/r2Modes';
import {HAND_LABELS} from '../content/handLabels';
import type {R2RunState} from '../domain/r2Run';
import type {R2HandType} from '../domain/evaluateR2';
export function azaoChoice(run:R2RunState,type?:R2HandType){
 const enabled=usesAzaoCharge(run)&&r2RunModeConfig(run).characterAbilityEnabled&&run.stage?.boss?.definitionId!=='B08',live=run.phase==='await-input',charge=run.stage?.azaoCharge?.charge??0,previous=run.stage?.azaoCharge?.previousQualifiedType,multiplier=['','1.5','2.5','4'][charge];
 const qualified=!!type&&AMO_ASSIST_TYPES.includes(type),available=enabled&&live&&charge>0&&qualified;
 const baseHold=!enabled?'本场停用，不蓄不放':!live?'当前不在出牌阶段；下场从0层重新蓄势':!type?previous?`上手${HAND_LABELS[previous]} · ${charge===3?'换型保层':'换型续蓄'} · 点英雄选释放`:'两对及以上蓄势 · 点英雄选释放':!qualified?'本手不合格，出牌清空蓄势':previous===type?'同牌型未释放则清空；合格时仍可释放':`不释放：结算后蓄 ${Math.min(3,charge+1)} 层`+(charge===3?'（已满层）':'');
 const hold=enabled&&live&&run.stage?.handsLeft===1?baseHold.replace('不释放：结算后蓄 ','不释放：合格异型可蓄至 ')+'；本场结束即清空':baseHold;
 return {enabled,charge,multiplier,available,hold,compact:heroSkillName('azao')+' · '+(!enabled?'已停用':!live?'本场已结束':`蓄${charge}层${charge?' · 可放×'+multiplier:''}`)};
}
export function savedAzaoCharge(run:R2RunState):string {
 const saved=run.lastTrace,trace=saved?.azaoCharge;if(!saved||!trace)return '';
 const {before,after}=trace,hand=HAND_LABELS[saved.handType];
 const result=trace.release?`已释放${before.charge}层，实际 ×${trace.multiplier}`:
  after.charge>before.charge?`本手${hand} · 蓄势 ${before.charge} → ${after.charge}层`:
  after.charge<before.charge?`本手${hand}${saved.handType===before.previousQualifiedType?'与上手同型':'未达两对'} · 蓄势 ${before.charge} → ${after.charge}层`:
  after.charge===3?`本手${hand} · 已满3层，维持蓄势`:`本手${hand} · 未蓄势`;
 return heroSkillTitle('azao')+' · '+result+(run.phase==='await-input'?`\n当前蓄势${run.stage?.azaoCharge?.charge??0}层；弃牌保留，场间清空。`:'\n本场已结束，蓄势已清；再次入场从0层开始。');
}
