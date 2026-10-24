import type {CharacterId} from './characters';

/**
 * Animation-only contract for the existing Qiyu event flow.
 *
 * Gameplay, save, and entry commands remain owned by the existing route/event
 * implementation (`r2PokerEncounter.ts`). This module only maps committed event
 * outcomes and public visual events to presentation cues and Tang-Song hero
 * cultural anchors without duplicating domain rules or touching RNG/checkpoints.
 */

export type QiyuAnimationCue =
  | 'qiyu-open'
  | 'choice-focus'
  | 'choice-confirm'
  | 'choice-cancel'
  | 'paid'
  | 'charge'
  | 'strike'
  | 'impact'
  | 'polychrome-bloom'
  | 'ledger-settle'
  | 'qiyu-close';

export type QiyuCeremonyPhase = 'charge' | 'strike' | 'impact' | 'settled';

export type QiyuAnimationOutcome = {
  eventId: string;
  choiceId: string;
  paidGold: number;
  resultKey: string;
  goldBefore?: number;
  goldAfter?: number;
  cardLabel?: string;
  enhancementLabel?: string;
  characterId?: CharacterId;
};

export type QiyuAnimationFrame = {
  cue: QiyuAnimationCue;
  phase: QiyuCeremonyPhase;
  durationMs: number;
  progressStart: number;
  progressEnd: number;
  caption: string;
  subcaption: string;
  audioCue: 'curtain' | 'spectral' | 'play' | 'multiply-reveal' | 'score-settle' | 'none';
  outcome?: QiyuAnimationOutcome;
};

export interface QiyuHeroProfile {
  readonly id: CharacterId;
  readonly name: string;
  readonly title: string;
  readonly sceneTitle: string;
  readonly allusion: string;
  readonly encounterLine: string;
  readonly confirmLine: string;
  readonly settledLine: string;
  readonly skippedLine: string;
  readonly sealText: string;
  readonly accentHex: string;
}

export const QIYU_HERO_PROFILES: Readonly<Record<CharacterId, QiyuHeroProfile>> = Object.freeze({
  amo: Object.freeze({
    id: 'amo',
    name: '苏轼',
    title: '风起赤壁',
    sceneTitle: '赤壁夜航 · 墨染流彩',
    allusion: '壬戌之秋，七月既望，苏子与客泛舟游于赤壁之下。',
    encounterLine: '江上清风，山间明月 · 取之成色，落纸流彩。',
    confirmLine: '清风入袖，墨锋已蓄 · 这一笔当化寻常为奇彩。',
    settledLine: '流彩入骨，声色俱定 · 待出牌入局，便见一纸峥嵘。',
    skippedLine: '扁舟任所如，机缘暂寄江月 · 留得行囊，再图后举。',
    sealText: '赤壁',
    accentHex: '#79c4b8',
  }),
  laohuan: Object.freeze({
    id: 'laohuan',
    name: '辛弃疾',
    title: '墨影醉里挑灯看剑',
    sceneTitle: '挑灯看剑 · 锋芒入纸',
    allusion: '醉里挑灯看剑，梦回吹角连营。',
    encounterLine: '灯火千寻，剑气如虹 · 择一张精锐，淬此一抹流彩。',
    confirmLine: '金戈蓄势，只待落印 · 此牌既定，锋芒毕露。',
    settledLine: '剑气凝彩，寒光照纸 · 他日出阵计分，自当倍增声威。',
    skippedLine: '收剑入鞘，暂按兵甲 · 留存军资，静候良机。',
    sealText: '看剑',
    accentHex: '#68b8d6',
  }),
  erxiang: Object.freeze({
    id: 'erxiang',
    name: '刘娥',
    title: '大宋之母',
    sceneTitle: '垂帘掌局 · 丹青定色',
    allusion: '垂帘听政，审时度势，一言而定庙堂章程。',
    encounterLine: '垂帘审势，落笔成章 · 择一张要牌，赐此一纸流彩。',
    confirmLine: '规制既明，朱印待落 · 一纸流彩，便作定局之重。',
    settledLine: '丹青已诏，朱印落定 · 嗣后出牌计分，皆依新章倍增。',
    skippedLine: '审时度势，暂缓用印 · 库银不损，留待下回筹谋。',
    sealText: '定章',
    accentHex: '#d98a7c',
  }),
  azao: Object.freeze({
    id: 'azao',
    name: '文成公主',
    title: '藏地迎宾',
    sceneTitle: '长路奉锦 · 山河添彩',
    allusion: '远涉千里山口，携锦帛典籍，结两地之好。',
    encounterLine: '长路奉锦，山河同色 · 拣一张良牌，留此一页辉光。',
    confirmLine: '锦帛铺展，霞色欲凝 · 此番织彩，可助前路长行。',
    settledLine: '山河映彩，锦纹已成 · 每逢出牌计分，便添一重华彩。',
    skippedLine: '行旅从容，不急一时 · 且存盘缠，前路自有奇遇。',
    sealText: '奉锦',
    accentHex: '#84c99b',
  }),
  xiemu: Object.freeze({
    id: 'xiemu',
    name: '花蕊夫人',
    title: '执剑凌风',
    sceneTitle: '执剑凌风 · 剑魄流彩',
    allusion: '更无一人能遣此，执剑凌风，独照高楼。',
    encounterLine: '宫词题罢，剑气凝霜 · 选一张锋刃，点染此番流彩。',
    confirmLine: '锋芒内敛，蓄力待发 · 一掷千金，只为剑出惊鸿。',
    settledLine: '流彩附刃，清辉如霜 · 登台计分之时，自见惊鸿一击。',
    skippedLine: '敛刃回鞘，不费分毫 · 留得锋芒，待压轴之时再展。',
    sealText: '凌风',
    accentHex: '#d87a74',
  }),
  touye: Object.freeze({
    id: 'touye',
    name: '秦琼',
    title: '踏破山河',
    sceneTitle: '跃马冲阵 · 金石淬彩',
    allusion: '跃马挺枪，万军之中取敌首级，金石为开。',
    encounterLine: '跃马横枪，金石为开 · 挑一张主力，淬此一张战牌。',
    confirmLine: '勒马蓄力，气吞山河 · 确认落印，便教此牌脱胎换骨。',
    settledLine: '金石淬彩，战意昂扬 · 日后披挂出阵，定教声势倍增。',
    skippedLine: '勒马驻足，暂养锐气 · 不费粮饷，且看下关风云。',
    sealText: '冲阵',
    accentHex: '#e2a85c',
  }),
});

export function qiyuHeroProfile(characterId?: CharacterId): QiyuHeroProfile {
  return QIYU_HERO_PROFILES[characterId ?? 'amo'] ?? QIYU_HERO_PROFILES.amo;
}

/**
 * Hearthstone-paced 4-stage cadence:
 * 蓄势 (charge) -> 加速冲击 (strike) -> 命中顿挫与爆发 (impact) -> 账单落定 (settled).
 */
export function buildQiyuAnimationTimeline(
  outcome: QiyuAnimationOutcome,
): readonly QiyuAnimationFrame[] {
  const card = outcome.cardLabel ?? outcome.choiceId;
  return [
    {
      cue: 'qiyu-open',
      phase: 'charge',
      durationMs: 220,
      progressStart: 0,
      progressEnd: 0.24,
      caption: '墨幕聚势 · 金毫引彩',
      subcaption: `实付 ${outcome.paidGold} 金已落账 · 墨气向 ${card} 聚拢蓄力`,
      audioCue: 'spectral',
      outcome,
    },
    {
      cue: 'choice-confirm',
      phase: 'strike',
      durationMs: 180,
      progressStart: 0.24,
      progressEnd: 0.48,
      caption: '破墨疾驰 · 挥毫点染',
      subcaption: `${card} 腾起迎印 · 丹青笔锋加速直落牌心`,
      audioCue: 'play',
      outcome,
    },
    {
      cue: 'paid',
      phase: 'impact',
      durationMs: 140,
      progressStart: 0.48,
      progressEnd: 0.64,
      caption: '朱印顿挫 · 纸上生辉',
      subcaption: `朱砂印落定 · 墨滴金屑迸散，流彩沿牌缘贯通`,
      audioCue: 'multiply-reveal',
      outcome,
    },
    {
      cue: 'impact',
      phase: 'impact',
      durationMs: 260,
      progressStart: 0.64,
      progressEnd: 0.86,
      caption: '流彩附着 · 倍率 ×1.5 爆发',
      subcaption: `${card} 晋升【多彩】· 打出且参与计分时每次读取 ×1.5`,
      audioCue: 'none',
      outcome,
    },
    {
      cue: 'ledger-settle',
      phase: 'settled',
      durationMs: 240,
      progressStart: 0.86,
      progressEnd: 1,
      caption: '成长账单落定 · 已入牌组',
      subcaption: `${outcome.resultKey} · 结果已保存，不占道具格`,
      audioCue: 'score-settle',
      outcome,
    },
    {
      cue: 'qiyu-close',
      phase: 'settled',
      durationMs: 120,
      progressStart: 1,
      progressEnd: 1,
      caption: '奇遇礼成 · 可返筹备',
      subcaption: '所有变更已写入本局账单，可继续商店筹备',
      audioCue: 'none',
      outcome,
    },
  ];
}
