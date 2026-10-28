import {usesLaohuanFind} from '../domain/r2LaohuanFind';
import {erxiangHandoffLimit} from '../domain/r2ErxiangHandoff';
import {laohuanRefillRepeats} from '../domain/r2LaohuanRefill';
import {characterForNewRun,characterForRun} from './CharacterRunCopy';
import {newRunIdentity} from './RunLaunch';
import {amoExileCopy} from './AmoExileCopy';
import {xiemuTiersFor} from '../domain/r2XiemuBurn';
import type {R2RunState} from '../domain/r2Run';
import type {CharacterId} from './characters';

/** Interaction copy complements the same authoritative effect used by the skill panel. */
export interface SelectionPresentation {tag:string;hook:string;entry:string;when:string;cost:string}
const operations:Record<CharacterId,Omit<SelectionPresentation,'tag'|'hook'>>={
 amo:{entry:'选出牌 → 选贬谪 → 确认出牌',when:'',cost:'出牌时弃掉全部余牌；每场一次。'},
 touye:{entry:'选弃牌 → 点击技能按钮押型并换牌',when:'选1–5张弃牌；已成型也能押。',cost:'成×2／否则×0.85；每场一次，押后不能再弃或改牌。'},
 laohuan:{entry:'选弃牌 → 点击技能按钮 → 确认换牌',when:'选1–5张弃牌，付得起弃牌成本。',cost:'没留的本场不再抽；每场一次。'},
 erxiang:{entry:'选主手 → 点击技能按钮 → 选一张计分牌',when:'对子及以上，选一张有效计分牌。',cost:'这张普通点数不加热度；每场一次。'},
 azao:{entry:'出牌蓄势 → 点击技能按钮 → 释放',when:'两对及以上蓄势；有层才能释放。',cost:'同牌型未释放则清空；合格时仍可释放。'},
 xiemu:{entry:'选主手 → 点击技能按钮 → 选择支付档',when:'',cost:''},
};
export function selectionPresentation(id:CharacterId,run?:Pick<R2RunState,'characterId'|'contentVersion'|'contentHash'>):SelectionPresentation {
 const identity=run??{characterId:id,...newRunIdentity(id)},hero=run?characterForRun(run):characterForNewRun(id),copy={...operations[id],tag:hero.passiveName,hook:hero.quickEffect};
 if(id==='erxiang')copy.cost='这张普通点数不加热度；每场'+erxiangHandoffLimit(identity)+'次。';
 if(id==='laohuan'&&laohuanRefillRepeats(identity)){copy.entry='正常弃牌 → 自动多看 → 自己留牌';copy.when='被动：正常弃牌后自动生效。';copy.cost='每次正常弃牌多看最多2张；照付弃牌成本。';}
 if(usesLaohuanFind(identity)){copy.entry='正常弃牌 → 留候选 → 下一手选择寻得';copy.when='本批至少2张同点参与有效计分。';copy.cost='寻得每场一次；下一手出牌或再次弃牌后旧批失效。';}
 if(id==='amo'){const exile=amoExileCopy(identity);copy.when='选好1–5张出牌，'+(exile.requiresKing?'余牌须含K；主手里的K不算。':'至少还剩1张可弃。');}
 if(id==='xiemu'){const tiers=xiemuTiersFor(identity);copy.when='两对及以上，至少留有'+tiers[0].cost+'金。';copy.cost='出牌扣'+tiers.map(t=>t.cost).join('／')+'金，倍率×'+tiers.map(t=>t.multiplier).join('／')+'；每场一次。';}
 return copy;
}
export const SELECTION_PRESENTATION:Record<CharacterId,SelectionPresentation>={
 amo:selectionPresentation('amo'),touye:selectionPresentation('touye'),laohuan:selectionPresentation('laohuan'),erxiang:selectionPresentation('erxiang'),azao:selectionPresentation('azao'),xiemu:selectionPresentation('xiemu'),
};
