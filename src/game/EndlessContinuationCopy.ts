import {r2TargetPolicyFor} from '../domain/r2TargetPolicy';
import {fractionText} from './scoreText';
import {isR2DynamicEndless} from '../domain/r2GroupUpgrade';

/** Read the same identity and target contracts as getR2Stage; presentation only. */
export function endlessContinuationCopy(identity:{contentVersion?:unknown;contentHash?:unknown}):string {
  if(isR2DynamicEndless(identity))return '八章通关已保存。\n\n继续无尽会保留当前牌组、唐宋牌、成长、道具与金币，从第九章商店接续。\n\n目标结合真实通关得分逐场调整；普通场连续高分会更快抬高目标，Boss 会考虑公开限制。下一场目标在进场前锁定，后续目标暂时待定。首场参考上一次真实通关，单次爆发也可能使首场目标偏高。\n\n是否继续由你决定；取消可留在胜利页。';
  const contract=r2TargetPolicyFor(identity);
  return '八章通关已保存。\n\n继续无尽会保留当前牌组、唐宋牌、成长、道具与金币，从第九章商店接续。\n\n'+
    `后续每章同场次目标按 ${fractionText(contract.multiplier)} 倍递增，最终向上取整；新的压轴规则仍会公开。\n\n`+
    '是否继续由你决定；取消可留在胜利页。';
}
