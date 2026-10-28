import {usesLaohuanFind} from '../domain/r2LaohuanFind';
import {r2HouseBase} from '../domain/r2GroupUpgrade';
import {erxiangHandoffLimit} from '../domain/r2ErxiangHandoff';
import {laohuanRefillRepeats} from '../domain/r2LaohuanRefill';
import {isR2HeroFrequency} from '../domain/r2GroupUpgrade';
import {xiemuTiersFor} from '../domain/r2XiemuBurn';
import {usesAmoExile} from '../domain/r2AmoExile';
import {AMO_EXILE_NAME,amoExileCopy} from './AmoExileCopy';
import {heroSkillName} from './HeroSkillPresentation';
import {usesErxiangHandoff,usesErxiangGroup} from '../domain/r2ErxiangHandoff';
import {usesTouyeWager,usesTouyeNewCore,usesTouyeScaling} from '../domain/r2TouyeWager';
import {usesLaohuanRefill} from '../domain/r2LaohuanRefill';
import {usesXiemuBurn} from '../domain/r2XiemuBurn';
import {isR2AzaoCharge} from '../domain/r2GroupUpgrade';
import {HERO_QUICK_COPY,heroDetailRules} from './HeroText';
import {newRunIdentity} from './RunLaunch';
import type {CharacterId} from '../domain/characters';
import {getCharacter} from './characters';
import type {R2RunState} from '../domain/r2Run';
import {R2_ASSIST_CONTRACT} from '../domain/r2Assist';
import {r2UsesAssist} from '../domain/r2Run';
import {R2_PUBLISHED_CONTENT} from '../domain/r2PublishedContent';
import {isR2XiemuBalance,R2_S04_FINISH_VERSION,R2_S04_FINISH_HASH} from '../domain/r2GroupUpgrade';

/** Saved-run copy is scoped to its identity; character selection uses the actual new-game identity. */
function characterDetailsForRun(run:Pick<R2RunState,'characterId'|'contentVersion'|'contentHash'>){
 const character=getCharacter(run.characterId);
 if(usesErxiangGroup(run))return {...character,openingPlay:'对子及以上选择一张核心，同点有效计分牌每次将普通点数转为倍率。',buildTip:'每场2次，选择核心的同点组逐张逐次转移；是否伤分取决于当前热度与倍率。',passiveDescription:'每场2次，选择一张普通点数非0的有效计分核心；本手所有同点有效计分牌每次计分时，把该次普通热度改加同值倍率，再结算增强和版次。重触发同样转移，不增加重触发次数；压成0的普通点数不转。高牌、静场和关闭角色能力的挑战不可使用。转移可能降低得分，取消不消耗。'};
 if(usesErxiangHandoff(run)&&erxiangHandoffLimit(run)===2)return {...character,openingPlay:'对子及以上，选一张计分牌的普通点数改加倍率；每场2次。',buildTip:'每场2次，选有效核心把首次普通点数从热度转为同值倍率；可留到后手。',passiveDescription:'每场2次，每手至多选一张有效计分牌：首次普通点数不计热度、改加同值倍率。增强、额外加成与后续重触保留；0点、失效牌或角色封禁时不能发动。'};
 if(usesErxiangHandoff(run))return {...character,openingPlay:'对子及以上，出牌前点击技能按钮选计分牌：一张核心普通点数改加倍率，本场一次。',buildTip:'对子及以上，选一张有效核心把首次普通点数改加倍率；每场一次，可留到后手。',passiveDescription:'每场一次，指定本手有效核心：首次普通点数不计热度、改加同值倍率。增强、版次与后续重触保持原规则；0点、失效牌或角色封禁不可发动。取消不消耗，出牌时才用掉次数。'};
 if(usesTouyeScaling(run))return {...character,openingPlay:'押型换牌，押中后1／2／3张以上新牌有效计分分别×2／3／4。',buildTip:'选1–5张弃牌并押下一手牌型。押中且新补牌有效计分按数量×2／3／4，否则×0.85。',passiveDescription:'每场一次，选1–5张弃牌并押下一手牌型。押中且本次补入的1／2／3张及以上牌有效计分，分别×2／×3／×4；押错或没有新牌有效计分为×0.85。有效计分排除被封牌和杂牌；不押×1.15，成功不叠加普通倍率。已成型也可押；照常花弃牌次数。押后锁定下一手；静场与关闭角色能力的挑战停用。'};
 if(usesTouyeNewCore(run))return {...character,openingPlay:'1选弃牌，2押牌型换牌，3用新摸牌成型。已成型也可押；成×2／不成×0.85。',buildTip:'1选1–5张弃牌；2押下一手牌型并换牌；3至少用一张刚摸回的牌凑成目标。成功×2，否则×0.85；每场一次。',passiveDescription:'1. 选1–5张要弃的牌。\n2. 押下一手牌型，再确认换牌；手里已成型也可押。\n3. 下一手至少用一张刚摸回的牌凑成所押牌型，倍率×2；否则×0.85。新牌只当配牌、没打出或被封住，都不算。\n每场一次，只赌下一手。押后不能再弃牌、用改牌工具或更换、调整唐宋牌。照常花弃牌次数；不押时×1.15。返回或继续存档仍保留押注；静场、禁用角色能力的挑战不能押。'};
 if(usesTouyeWager(run))return {...character,openingPlay:'弃牌前点英雄押未成目标，只赌下一手；成型×2，未成×0.85，本场一次。',buildTip:'每场一次，弃前押当前手牌尚凑不出的成组、顺子或同花；只赌下一手，不能再弃牌。成型×2，未成×0.85；普通不押×1.15。',passiveDescription:'每场一次，押目标与真实弃牌一起提交；目标当前手牌已能凑出就不能押。只赌下一次真实出牌，成型×2、未成×0.85替代普通×1.15，不另扣金币；普通弃牌成本照旧。押后不能再弃、改牌工具或调序唐宋牌，返回恢复保约。静场/无能力挑战停用，'};
 if(usesLaohuanFind(run))return {...character,openingPlay:'弃牌多看两张；下一手本批两张同点有效计分时可发动寻得。',buildTip:'每次正常弃牌多看最多两张；本批同点牌在下一手有效计分可选择寻得。',passiveDescription:'每次正常弃牌多看最多2张，亲自留下应补张数。下一手本批实际留牌有至少2张同点有效计分时，可选择最大同点组发动寻得：2／3／4张及以上分别×2／×3／×4，每场一次。最大组并列时自行选择，不能叠加。再次弃牌或下一手成功出牌后旧批资格失效。静场只能换牌；关闭角色能力的挑战两者停用。'};
 if(laohuanRefillRepeats(run))return {...character,openingPlay:'被动：每次正常弃牌后多看最多2张，自己留下应补张数。',buildTip:'照付正常弃牌成本，每次都多看最多2张；未留候选本场不再抽，没有额外技能次数限制。',passiveDescription:'每次正常弃牌都多看最多2张，亲自留下应补张数；正常弃牌额度与附加费用照付，未留候选本场不再抽。牌堆不足时少看或全部留下。固定候选选完前不能继续操作；静场可用，无能力挑战停用。'};
 if(usesLaohuanRefill(run))return {...character,openingPlay:'弃牌前点击技能按钮确认换牌，多看最多两张并自己留牌，本场一次。',buildTip:'每场一次额外择牌：真实弃牌后多看最多2张，自己留应补数；没留的本场不再抽。三条路线都可用。',passiveDescription:'每场一次，照付实际弃牌成本，确认换牌后多看最多2张，手选应补数；未留候选进已用区、不算再次弃牌。候选不足全留，收起或恢复仍是同批；完成前不能出/弃/用工具。静场可用，无能力挑战停用；'};
 if(isR2XiemuBalance(run)){const tiers=xiemuTiersFor(run),costs=tiers.map(t=>t.cost).join('／'),multipliers=tiers.map(t=>t.multiplier).join('／');return {...character,openingPlay:'两对及以上，出牌前可付'+costs+'金换倍率，也可留钱收息。',buildTip:'每场一次，两对及以上付'+costs+'金，本手倍率×'+multipliers+'；持币收益与关末息读余钱。',passiveDescription:'每场一次主动付'+costs+'金，本手倍率×'+multipliers+'，仅两对及以上主手。不足不降档。过关时奖励前金币每5金额外给1，最多2金；静场不付但保留关末息，无能力挑战全停。'};}
 if(usesXiemuBurn(run))return {...character,openingPlay:'两对及以上，出牌前可付10／20／30金换倍率，也可留钱收息。',buildTip:'每场一次，两对及以上可付10／20／30金，本手倍率×2／3／4；先扣真金，持币收益和关末息读余钱。留钱还有有限关末息。',passiveDescription:'每场一次主动付10／20／30金，本手倍率×2／3／4，仅两对及以上主手。不足不降档。成功额外关末息：奖励前金币每5金给1，最多2金；不算本次奖励再生息。静场不付、关末息保留；无能力挑战全停。'};
 if(run.characterId==='azao'&&isR2AzaoCharge(run))return {...character,openingPlay:'两对及以上先蓄势；有层时出牌前点英雄释放，换型可继续蓄。',buildTip:'两对及以上先蓄1层，下一手可主动释放。换牌型可继续蓄；重复牌型不释放会清空。弃牌保留，场间清空。',passiveDescription:'两对及以上：首手蓄1层，连续换牌型最多3层。主动释放当前1／2／3层，倍率×1.5／2.5／4；重复合格牌也可释放。释放手不再蓄。重复牌型不释放、对子或高牌出牌清空；弃牌保留，进场／结束清空。'};
 if(run.characterId!=='amo')return character;
 if(r2UsesAssist(run))return {...character,openingPlay:'两对及以上，出牌前可用剩余同点牌助攻；副组真消耗，本场一次。',buildTip:'先凑两对、三条、顺子、同花或更高主手，再决定是否用剩余同点对子／三条助攻。每场一次，可留到关键手；高牌和对子仅兜底，不能助攻。副组会真消耗，不算主手或留手。',passiveDescription:'每场'+R2_ASSIST_CONTRACT.usesPerStage+'次：两对及以上主手＋剩余对子×'+R2_ASSIST_CONTRACT.pair+'／三条×'+R2_ASSIST_CONTRACT.three+'。副组真消耗，不算主手或留手；高牌、对子不能助攻。'};
 if(run.contentHash===R2_PUBLISHED_CONTENT.v10.hash)return {...character,passiveDescription:'高牌 Lv3 开局；只打出1张时，倍率 ×3，在唐宋牌计分之前结算。'};
 return {...character,passiveDescription:'高牌 Lv3 开局；只打出1张时，唐宋牌计分之后，最终倍率 ×3。'};
}

export function characterForNewRun(characterId:CharacterId){return characterForRun({characterId,...newRunIdentity(characterId,characterId==='erxiang'||characterId==='azao'||characterId==='xiemu'||characterId==='laohuan'||characterId==='touye'?'group':undefined)});}

export function usesCurrentHeroText(run:Pick<R2RunState,'characterId'|'contentVersion'|'contentHash'>):boolean {
 const base=r2HouseBase(run);
 return isR2HeroFrequency(run)||usesAmoExile(run)||isR2XiemuBalance(run)||(base.contentVersion===R2_S04_FINISH_VERSION&&base.contentHash===R2_S04_FINISH_HASH);
}
export function characterForRun(run:Pick<R2RunState,'characterId'|'contentVersion'|'contentHash'>){
 if(usesErxiangGroup(run)){const c=characterDetailsForRun(run);return {...c,openingPlay:'openingPlay' in c?c.openingPlay:c.buildTip,passiveName:heroSkillName('erxiang'),quickEffect:'选核心，同点有效牌每次普通点数转倍率。',skillTags:['对子及以上','每场2次','重触也转'],detailRules:c.passiveDescription};}
 if(usesTouyeScaling(run)){const c=characterDetailsForRun(run);return {...c,openingPlay:'openingPlay' in c?c.openingPlay:c.buildTip,passiveName:heroSkillName('touye'),quickEffect:'押中按新牌有效计分数×2／3／4；否则×0.85。',skillTags:['弃1–5张','每场1次','已成型也可押'],detailRules:c.passiveDescription};}
 if(usesLaohuanFind(run)){const c=characterDetailsForRun(run);return {...c,openingPlay:'openingPlay' in c?c.openingPlay:c.buildTip,passiveName:heroSkillName('laohuan'),quickEffect:'弃牌多看两张；本批同点有效计分可选寻得×2／3／4。',skillTags:['每次弃牌择牌','寻得每场1次','下一手有效'],detailRules:c.passiveDescription};}
 if(usesAmoExile(run)){const copy=amoExileCopy(run);return {...getCharacter('amo'),passiveName:AMO_EXILE_NAME,passiveDescription:copy.details,openingPlay:copy.rule,quickEffect:(copy.requiresKing?'余牌含K时，':'')+'弃掉余牌，本次得分×'+copy.factor+'。',skillTags:['每场1次',copy.requiresKing?'余牌含K':'至少弃1张'],detailRules:copy.details,buildTip:'选好这手要打的牌，'+(copy.requiresKing?'余牌含K时可':'再决定是否')+'弃掉余牌，把这一手得分变为'+copy.factor+'倍。'};}
 const c=characterDetailsForRun(run),current=usesCurrentHeroText(run),quick=HERO_QUICK_COPY[run.characterId];
 return {...c,openingPlay:'openingPlay' in c?c.openingPlay:c.buildTip,
  passiveName:heroSkillName(run.characterId),
  quickEffect:laohuanRefillRepeats(run)?'弃牌后多看两张，自行留下应补张数。':isR2XiemuBalance(run)?'付'+xiemuTiersFor(run).map(t=>t.cost).join('／')+'金换×'+xiemuTiersFor(run).map(t=>t.multiplier).join('／')+'，也可留钱收息。':current?quick.effect:('openingPlay' in c?c.openingPlay:c.buildTip),
  skillTags:isR2HeroFrequency(run)?run.characterId==='erxiang'?['对子及以上','每场2次']:['被动','每次正常弃牌','照付弃牌成本']:current?quick.tags:[] as readonly string[],
  detailRules:isR2HeroFrequency(run)||isR2XiemuBalance(run)?c.passiveDescription:current?heroDetailRules(run.characterId):c.passiveDescription};
}

/** All saved-result displays use the run's ability identity rather than an id-only default. */
export function heroSkillTitleForRun(run:Pick<R2RunState,'characterId'|'contentVersion'|'contentHash'>):string {
 const c=characterForRun(run);return c.name+' · '+c.passiveName;
}
