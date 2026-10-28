import {usesLaohuanFind} from '../domain/r2LaohuanFind';
import {erxiangHandoffLimit,usesErxiangGroup} from '../domain/r2ErxiangHandoff';
import {laohuanRefillRepeats} from '../domain/r2LaohuanRefill';
import {amoExileMultiplier,amoExileRequiresKing} from '../domain/r2AmoExile';
import {xiemuTiersFor} from '../domain/r2XiemuBurn';
import {heroSkillName} from './HeroSkillPresentation';
import type {R2RunState} from '../domain/r2Run';
import {getR2Stage,r2UsesAssist} from '../domain/r2Run';
import {r2RunModeConfig} from '../content/r2Modes';
import {usesAzaoCharge} from '../domain/r2AzaoCharge';
import {usesXiemuBurn,xiemuInterest} from '../domain/r2XiemuBurn';
import {usesErxiangHandoff} from '../domain/r2ErxiangHandoff';
import {usesTouyeWager,usesTouyeNewCore,usesTouyeScaling} from '../domain/r2TouyeWager';
import {usesLaohuanRefill} from '../domain/r2LaohuanRefill';
import {usesAmoExile} from '../domain/r2AmoExile';
import {savedHeroResult} from './HeroAbilityCue';
import {savedXiemuBurn} from './XiemuBurnCopy';

export interface HeroStageContinuity {last?:string;next:string;decision:string}
/** A completed stage may remain attached in the shop. It is history, never next-stage availability. */
export function heroStageContinuity(run:R2RunState):HeroStageContinuity|undefined {
 if(!['stage-cleared','shop','stage-ready'].includes(run.phase)||!getR2Stage(run.stageIndex,run.tourMode,run.difficulty,run))return;
 const azao=usesAzaoCharge(run),xiemu=usesXiemuBurn(run),erxiang=usesErxiangHandoff(run),touye=usesTouyeWager(run),laohuan=usesLaohuanRefill(run),exile=usesAmoExile(run),amo=r2UsesAssist(run)||exile;
 if(!azao&&!xiemu&&!erxiang&&!touye&&!laohuan&&!amo)return;
 const old=run.stage&&run.stage.index<run.stageIndex?run.stage:undefined;
 let last:string|undefined;
 if(old?.skipResult)last='上一场已跳过，没有出牌或角色发动结果。';
 else if(old){
  const result=run.lastTrace?savedHeroResult(run):'';
  if(azao){const t=run.lastTrace?.azaoCharge;last=t?result+'；本场结束已清层。':'上一场蓄势已清；没有可读取的上手蓄势记录。';}
  else if(xiemu)last=run.lastTrace?.xiemuBurn?savedXiemuBurn(run):'上一场没有可读取的支付金币结算记录。';
  else if(usesLaohuanFind(run))last=old.laohuanFindUsed?'上一场寻得已使用。':'上一场寻得未使用。';
  else if(laohuan)last=old.laohuanTrickUsed?'上一场'+heroSkillName('laohuan')+'已用；留牌已经保存，下一场不重抽旧候选。':'上一场未用'+heroSkillName('laohuan')+'。';
  else last=result||((erxiang?(old.erxiangHandoffUses??(old.erxiangHandoffUsed?1:0))>0:touye?!!old.touyeWager?.commit:exile?old.amoExileUsed:old.assistUsed)?'上一场能力已用；最后一手没有对应角色收益记录。':'上一场未用主动能力。');
 }
 const enabled=r2RunModeConfig(run).characterAbilityEnabled;
 const sealed=run.stageIndex%3===2&&run.boss.definitionId==='B08'&&!laohuan;
 if(!enabled)return {last,next:'本模式角色能力停用',decision:'下一场仍可正常选牌出弃；不要为停用能力预留专用代价。'};
 if(sealed)return {last,next:'下一场静场：角色计分能力停用',decision:xiemu?'下一场不能支付金币；额外关末息仍按真实本金结算。':'下一场仍可正常出弃；本场已用与否不改变静场限制。'};
 if(azao)return {last,next:'下场从0层重新蓄势',decision:'两对及以上先蓄，换牌型可续蓄；有层后自己决定释放。弃牌保层，过场不保层。'};
 if(xiemu)return {last,next:'下场'+heroSkillName('xiemu')+'次数恢复为1次',decision:`当前${run.gold}金；`+(run.gold<xiemuTiersFor(run)[0].cost?`距最低${xiemuTiersFor(run)[0].cost}金支付档还差${xiemuTiersFor(run)[0].cost-run.gold}金。`:'可自行留钱，或入场选两对及以上再选支付档。')+`按当前本金，角色关末息最多${xiemuInterest(run.gold)}金；购买/支付金币后要按余钱重算，未到账。`};
 if(erxiang)return {last,next:'下场'+heroSkillName('erxiang')+'次数恢复为'+erxiangHandoffLimit(run)+'次',decision:usesErxiangGroup(run)?'先凑对子及以上，选一张普通点数非0的有效计分核心；同点牌每次普通点数转倍率，重触也转，可能伤分。':'先凑对子及以上，再选一张会计分的牌，把一次普通点数改加倍率；可以留到后手，改牌工具与增强仍由你选择。'};
 if(touye)return {last,next:'下场'+heroSkillName('touye')+'次数恢复为1次',decision:usesTouyeScaling(run)?'押中后按1／2／3张以上新牌有效计分分别×2／3／4；否则×0.85。':usesTouyeNewCore(run)?'已成型也可押；先选要弃的牌和目标，下一手至少用一张刚摸的牌凑成目标才×2，否则×0.85。新牌只当配牌或被封住不算，可不押。':'先看当前手牌还凑不出哪些目标，再选弃牌与目标；只赌下一手，成型×2、未成×0.85，可不押。'};
 if(usesLaohuanFind(run))return {last,next:'下场寻得恢复1次；正常弃牌仍可多看两张',decision:'留牌后下一手可选择最大同点有效计分组发动寻得；静场只能换牌。'};
 if(laohuan)return {last,next:laohuanRefillRepeats(run)?'下场每次正常弃牌仍可多看最多2张':'下场'+heroSkillName('laohuan')+'次数恢复为1次',decision:'先决定保留哪些牌，再自行确认换牌并从真实补牌候选留牌；照付弃牌成本，不能预知补牌。'};
 if(exile)return {last,next:'下场贬谪次数恢复为1次',decision:'选好这手要打的牌，再决定是否弃掉全部余牌，让本手得分变为'+amoExileMultiplier(run)+'倍；至少要有1张余牌，可留到关键手。'+(amoExileRequiresKing(run)?'弃掉的余牌中须有K，主手里的K不算。':'')};
 return {last,next:'下场'+heroSkillName('amo')+'次数恢复为1次',decision:'两对及以上主手之外留同点对子或三条，可自己选择助攻；副组真消耗，不算留牌，可留到关键手。'};
}
