import {describe,expect,it} from 'vitest';
import {characterForNewRun,characterForRun} from '../src/game/CharacterRunCopy';
import {selectionPresentation} from '../src/game/SelectionPresentation';
import {heroSignature} from '../src/game/HeroSignature';
import {heroPlaySample} from '../src/game/OpeningPlaySample';
import {r2WithHouseJoker,R2_HERO_FREQUENCY_VERSION,R2_HERO_FREQUENCY_HASH} from '../src/domain/r2GroupUpgrade';
import {withBossSuitRescueIdentity} from '../src/domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../src/domain/r2PokerEncounter';

const legacy=withPokerEncounterIdentity(withBossSuitRescueIdentity(r2WithHouseJoker({contentVersion:R2_HERO_FREQUENCY_VERSION,contentHash:R2_HERO_FREQUENCY_HASH})));
describe('玩家能看懂当前英雄的规则与代价',()=>{
 it('秦琼说明计入哪些新牌，以及押错或没有新牌计分的结果',()=>{
  const c=characterForNewRun('touye');expect(c.detailRules).toContain('刚换来的牌有1／2／3张及以上参与计分，分别×2／×3／×4');expect(c.detailRules).toContain('押错或没有换来的牌计分，则×0.85');expect(c.detailRules).toContain('两张刚换来的8组成对子');expect(c.detailRules).toContain('不计分、或被封住的牌不算');expect(selectionPresentation('touye').cost).toContain('每场一次');
 });
 it('辛弃疾的留牌例子和倍率与下一手的限制一致',()=>{
  const c=characterForNewRun('laohuan');expect(c.detailRules).toContain('至少2张刚换来的同点牌参与计分');expect(c.detailRules).toContain('2／3／4张及以上分别×2／×3／×4，每场一次');expect(c.detailRules).toContain('下一次成功出牌后，之前换来的牌不再符合条件');expect(heroSignature('laohuan').beats[2].result).toContain('两张都计分，可选×2');expect(heroPlaySample('laohuan').result).toContain('×2');
 });
 it('花蕊说明每档金额、次数、资格和扣钱后的余额',()=>{
  const c=characterForNewRun('xiemu');for(const part of ['每场一次','两对及以上','2／4／6／8金','×1.5／2／3／4','先扣钱','扣钱后的余额'])expect(c.detailRules).toContain(part);
 });
 it('刘娥说明同点牌逐次转换、可能减分及每场次数',()=>{
  const c=characterForNewRun('erxiang');for(const part of ['每场2次','两张8首次计分时','各把8点热度改加8倍率','牌再次计分时也会转移','可能降低得分'])expect(c.detailRules).toContain(part);expect(heroPlaySample('erxiang').after.label).toContain('两张8都计分');
 });
 it('当前选角摘要不用内部身份或未解释的技术术语；旧刘娥只转首次',()=>{
  for(const id of ['laohuan','touye','xiemu','erxiang'] as const){const c=characterForNewRun(id),p=selectionPresentation(id);expect([c.quickEffect,p.when,p.cost].join(' ')).not.toMatch(/有效计分|本批|核心|contentHash|实例ID/);}
  const old=characterForRun({characterId:'erxiang',...legacy});expect(old.detailRules).toContain('首次普通点数');expect(old.detailRules).toContain('再次计分时，普通点数仍按原规则加热度');
 });
});
