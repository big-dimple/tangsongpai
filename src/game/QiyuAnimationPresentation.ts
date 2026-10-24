import {
  buildQiyuAnimationTimeline,
  qiyuHeroProfile,
  type QiyuAnimationOutcome,
  type QiyuCeremonyPhase,
} from '../domain/qiyuEvent';
import type {CharacterId} from '../domain/characters';
import {characterArt} from './CharacterArt';
import {rankLabel, SUIT_SYMBOL, type PlayingCard} from '../cards/types';
import {ENHANCEMENT_BRIEF} from './CardSpecialLabels';
import {handdrawnPath} from './HanddrawnArt';
import {assetUrl} from './theme';
import {iridescenceColor, iridescencePath} from './PolychromeCardIridescence';
import {inkBurstFrame} from './InkBurst';
import {AudioEngine} from '../audio/AudioEngine';
import {Haptics} from '../haptics/Haptics';
import type {PokerEncounterView} from './PokerEncounterView';

export type QiyuAnimationPresentationOptions = {
  root?: HTMLElement;
  heroName?: string;
  characterId?: CharacterId;
  resultLabel?: string;
  reducedMotion?: boolean;
};

const pause = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cardTitle(card: Readonly<PlayingCard>): string {
  return SUIT_SYMBOL[card.suit] + rankLabel(card.rank);
}

function isRedSuit(card: Readonly<PlayingCard>): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

function hexColor(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

function createVisualCardElement(
  card: Readonly<PlayingCard>,
  variant: 'ordinary' | 'polychrome',
  reducedMotion: boolean,
  cleanups: (() => void)[],
): HTMLElement {
  const wrap = el('div', `qiyu-visual-card is-${variant}`);
  wrap.dataset.suit = card.suit;
  wrap.dataset.rank = String(card.rank);
  wrap.dataset.red = String(isRedSuit(card));
  wrap.dataset.edition = variant === 'polychrome' ? 'polychrome' : card.edition ?? 'none';
  wrap.setAttribute('aria-hidden', 'true');

  if (variant === 'polychrome') {
    const borderCanvas = el('canvas', 'qiyu-polychrome-edge-canvas');
    borderCanvas.width = 160;
    borderCanvas.height = 224;
    wrap.append(borderCanvas);
    cleanups.push(startPolychromeEdgeLoop(borderCanvas, reducedMotion));
  }

  const cornerTop = el('div', 'qiyu-card-corner');
  const rankNode = el('strong', 'qiyu-card-rank', rankLabel(card.rank));
  const suitNode = el('span', 'qiyu-card-suit', SUIT_SYMBOL[card.suit]);
  cornerTop.append(rankNode, suitNode);
  wrap.append(cornerTop);

  const center = el('div', 'qiyu-card-center');
  const courtKey = card.rank === 11 ? 'j' : card.rank === 12 ? 'q' : card.rank === 13 ? 'k' : '';
  const courtPath = courtKey ? handdrawnPath(courtKey, 'court') : undefined;
  if (courtPath) {
    const img = el('img', 'qiyu-card-court-art');
    img.src = assetUrl(courtPath);
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => {
      img.replaceWith(el('span', 'qiyu-card-big-pip', SUIT_SYMBOL[card.suit]));
    };
    center.append(img);
  } else {
    center.append(el('span', 'qiyu-card-big-pip', SUIT_SYMBOL[card.suit]));
  }
  wrap.append(center);

  const footer = el('div', 'qiyu-card-footer');
  if (card.enhancement) {
    const enh = el('span', 'qiyu-card-badge is-enhancement', ENHANCEMENT_BRIEF[card.enhancement]);
    footer.append(enh);
  }
  if (variant === 'polychrome') {
    const seal = el('span', 'qiyu-card-seal', '彩');
    const mult = el('span', 'qiyu-card-badge is-polychrome', '多彩 ×1.5');
    wrap.append(seal);
    footer.append(mult);
  } else {
    footer.append(el('span', 'qiyu-card-badge is-ordinary', '普通版'));
  }
  wrap.append(footer);
  return wrap;
}

function startPolychromeEdgeLoop(canvas: HTMLCanvasElement, reducedMotion: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const path = iridescencePath({x: 4, y: 4, width: canvas.width - 8, height: canvas.height - 8}, 64);
  let disposed = false;
  let rafId = 0;
  let lastPaint = 0;
  const start = performance.now();

  const render = (phase: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const count = path.length - 1;
    for (let i = 0; i < count; i++) {
      const a = path[i];
      const b = path[i + 1];
      const position = i / count;
      const color = hexColor(iridescenceColor(position - phase));
      const glint = Math.pow((1 + Math.cos((position - phase) * Math.PI * 4)) / 2, 10);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.22 + 0.18 * glint;
      ctx.lineWidth = 5.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.globalAlpha = 0.84 + 0.16 * glint;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  render(0);
  if (reducedMotion) return () => {};

  const tick = (now: number) => {
    if (disposed) return;
    if (now - lastPaint >= 66) {
      lastPaint = now;
      render(((now - start) / 4800) % 1);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * Mounts the Tang-Song Hero Banner & 3-Column Contract Strip at the top of the Qiyu dialog.
 */
export function mountQiyuHeroBanner(
  dialog: HTMLDialogElement,
  characterId: CharacterId,
  mode: 'selection' | 'confirm' | 'purchased' | 'skipped',
  options: {
    freshEntry?: boolean;
    reducedMotion?: boolean;
    gold: number;
    price: number;
    unavailable?: string;
    cardName?: string;
    goldBefore?: number;
    goldAfter?: number;
  },
): () => void {
  const profile = qiyuHeroProfile(characterId);
  const eyesAsset = characterArt(characterId, 'eyes');
  const avatarAsset = characterArt(characterId, 'avatar');
  const reduced = !!options.reducedMotion;

  const banner = el('section', `qiyu-stage-banner is-${mode}`);
  banner.dataset.hero = characterId;
  banner.dataset.motion = reduced ? 'static' : 'animated';
  banner.setAttribute('aria-label', `${profile.name}奇遇分镜`);

  const topRow = el('div', 'qiyu-hero-row');
  const identityBox = el('div', 'qiyu-hero-identity');
  if (avatarAsset) {
    const avatar = el('img', 'qiyu-hero-avatar');
    avatar.src = avatarAsset.url;
    avatar.alt = '';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.decoding = 'async';
    avatar.onerror = () => {
      avatar.hidden = true;
    };
    identityBox.append(avatar);
  }
  const titleStack = el('div', 'qiyu-hero-titles');
  const sealRow = el('div', 'qiyu-hero-seal-row');
  const seal = el('span', 'qiyu-hero-seal', profile.sealText);
  seal.setAttribute('aria-hidden', 'true');
  const sceneName = el('span', 'qiyu-scene-title', profile.sceneTitle);
  sealRow.append(seal, sceneName);
  const heroHeading = el('strong', 'qiyu-hero-name', `${profile.name} · ${profile.title}`);
  const line =
    mode === 'selection'
      ? profile.encounterLine
      : mode === 'confirm'
        ? profile.confirmLine
        : mode === 'purchased'
          ? profile.settledLine
          : profile.skippedLine;
  const quote = el('p', 'qiyu-hero-quote', line);
  const allusion = el('small', 'qiyu-hero-allusion', profile.allusion);
  titleStack.append(sealRow, heroHeading, quote, allusion);
  identityBox.append(titleStack);
  topRow.append(identityBox);

  if (eyesAsset) {
    const eyesFrame = el('div', 'qiyu-hero-eyes-frame');
    eyesFrame.setAttribute('aria-hidden', 'true');
    const eyesImg = el('img', 'qiyu-hero-eyes-img');
    eyesImg.src = eyesAsset.url;
    eyesImg.alt = '';
    eyesImg.decoding = 'async';
    eyesImg.onerror = () => {
      eyesFrame.hidden = true;
    };
    eyesFrame.append(eyesImg);
    topRow.append(eyesFrame);
  }
  banner.append(topRow);

  // Three-column contract strip: 失去 / 获得 / 保留
  const contractGrid = el('div', 'qiyu-contract-strip');
  contractGrid.setAttribute('aria-label', '奇遇代价与收益摘要');
  const items =
    mode === 'purchased'
      ? [
          {
            tag: '已付代价',
            value: `实付 ${options.price} 金（${options.goldBefore ?? options.gold} → ${options.goldAfter ?? options.gold} 金）`,
            note: '本店培养／基础改牌共享额度已用',
          },
          {
            tag: '本次获得',
            value: `${options.cardName ?? '所选扑克'} 晋升【多彩】`,
            note: '打出且参与计分时，每次读取倍率 ×1.5',
          },
          {
            tag: '保留与后续',
            value: '原有增强与牌组结构完整保留',
            note: '结果已原子保存，冷恢复不重复扣款或补发',
          },
        ]
      : mode === 'skipped'
        ? [
            {
              tag: '本次代价',
              value: '0 金 · 未扣款、未消耗培养额度',
              note: '本店奇遇机会已结束',
            },
            {
              tag: '本次结果',
              value: '未赋予多彩版次',
              note: '牌组与金币保持原状',
            },
            {
              tag: '后续规则',
              value: '按后续真实通关 7–9 关正常推进',
              note: '本店刷新或重进不会补发第二次',
            },
          ]
        : [
            {
              tag: '付出代价',
              value: `固定 ${options.price} 金（当前 ${options.gold} 金）`,
              note: '与本店培养／基础改牌共用 1 次额度，不耗优惠券',
            },
            {
              tag: '即时获得',
              value: '1 张存活普通扑克赋予【多彩 ×1.5】',
              note: '打出且参与计分时逐遍读取，留手不生效',
            },
            {
              tag: '保持不变',
              value: '原增强保留 · 不占道具格',
              note: options.unavailable
                ? `当前限制：${options.unavailable}`
                : '取消确认不扣钱；可先返回商店卖牌筹钱',
            },
          ];

  for (const item of items) {
    const cell = el('div', 'qiyu-contract-cell');
    cell.append(
      el('span', 'qiyu-contract-tag', item.tag),
      el('strong', 'qiyu-contract-val', item.value),
      el('small', 'qiyu-contract-note', item.note),
    );
    contractGrid.append(cell);
  }
  banner.append(contractGrid);

  const intro = dialog.querySelector('.dialog-intro') ?? dialog.querySelector('.dialog-scroll');
  intro?.prepend(banner);

  if (mode === 'selection' && options.freshEntry) {
    try {
      AudioEngine.shared.rareReveal();
    } catch {
      /* Optional audio */
    }
  }

  return () => {
    banner.remove();
  };
}

/**
 * Enhances the card choice buttons in `.poker-encounter .dialog-choice-actions`
 * without altering any button's accessible name (`SUIT_SYMBOL + rankLabel`).
 */
export function enhanceQiyuCardGrid(
  dialog: HTMLDialogElement,
  targets: readonly Readonly<PlayingCard>[],
  reducedMotion: boolean,
): () => void {
  const container = dialog.querySelector<HTMLElement>('.dialog-choice-actions');
  if (!container) return () => {};
  container.dataset.motion = reducedMotion ? 'static' : 'animated';

  const cleanups: (() => void)[] = [];
  const cells = [...container.children] as HTMLElement[];
  cells.forEach((cell, idx) => {
    const card = targets[idx];
    const button = cell.querySelector<HTMLButtonElement>('button');
    if (!card || !button) return;

    cell.classList.add('qiyu-card-choice-cell');
    cell.dataset.suit = card.suit;
    cell.dataset.rank = String(card.rank);
    cell.dataset.red = String(isRedSuit(card));
    cell.dataset.edition = card.edition ?? 'none';
    if (card.enhancement) cell.dataset.enhancement = card.enhancement;

    button.classList.add('qiyu-card-choice-btn');
    button.dataset.red = String(isRedSuit(card));

    // Add decorative aria-hidden badge bar outside the button so button's exact name stays untouched
    const metaRow = el('div', 'qiyu-card-choice-meta');
    metaRow.setAttribute('aria-hidden', 'true');
    const courtKey = card.rank === 11 ? 'j' : card.rank === 12 ? 'q' : card.rank === 13 ? 'k' : '';
    const courtPath = courtKey ? handdrawnPath(courtKey, 'court') : undefined;
    if (courtPath) {
      const thumb = el('img', 'qiyu-card-choice-court');
      thumb.src = assetUrl(courtPath);
      thumb.alt = '';
      thumb.decoding = 'async';
      thumb.onerror = () => {
        thumb.hidden = true;
      };
      metaRow.append(thumb);
    }
    if (card.enhancement) {
      metaRow.append(el('span', 'qiyu-choice-tag is-enh', ENHANCEMENT_BRIEF[card.enhancement]));
    }
    if ((card.edition ?? 'none') !== 'none') {
      const edText = card.edition === 'foil' ? '闪箔' : card.edition === 'holographic' ? '全息' : '多彩';
      metaRow.append(el('span', 'qiyu-choice-tag is-edition', edText));
    } else {
      metaRow.append(el('span', 'qiyu-choice-tag is-ready', '可赋彩'));
    }
    cell.prepend(metaRow);

    const onEnter = () => {
      if (!button.disabled) {
        try {
          AudioEngine.shared.hoverTick();
        } catch {
          /* Optional audio */
        }
      }
    };
    button.addEventListener('pointerenter', onEnter);
    cleanups.push(() => button.removeEventListener('pointerenter', onEnter));
  });

  return () => {
    for (const fn of cleanups) fn();
  };
}

/**
 * Mounts the Before -> After Polychrome Altar inside the confirmation dialog (`SelectionChanged`).
 */
export function mountQiyuConfirmAltar(
  dialog: HTMLDialogElement,
  target: Readonly<PlayingCard>,
  characterId: CharacterId,
  gold: number,
  unavailable: string | undefined,
  reducedMotion: boolean,
): () => void {
  const cleanups: (() => void)[] = [];
  const hapticScope = Haptics.shared.createScope();
  cleanups.push(() => hapticScope.cancel());

  try {
    AudioEngine.shared.cardLand();
    hapticScope.selectionChanged(true);
  } catch {
    /* Optional feedback */
  }

  cleanups.push(
    mountQiyuHeroBanner(dialog, characterId, 'confirm', {
      reducedMotion,
      gold,
      price: 18,
      unavailable,
      cardName: cardTitle(target),
    }),
  );

  const altar = el('section', 'qiyu-confirm-altar');
  altar.dataset.motion = reducedMotion ? 'static' : 'animated';
  altar.setAttribute('aria-label', `${cardTitle(target)}赋予多彩预览`);

  const stage = el('div', 'qiyu-altar-cards');
  const beforeCol = el('div', 'qiyu-altar-col');
  beforeCol.append(
    el('span', 'qiyu-altar-col-label', '当前牌面 · 普通版'),
    createVisualCardElement(target, 'ordinary', reducedMotion, cleanups),
  );

  const conduit = el('div', 'qiyu-altar-conduit');
  conduit.setAttribute('aria-hidden', 'true');
  const seal = el('div', 'qiyu-altar-seal', '壹拾捌金');
  const arrow = el('div', 'qiyu-altar-arrow', '墨韵点染 ➔');
  const effectNote = el('div', 'qiyu-altar-formula', '计分每次 ×1.5');
  conduit.append(seal, arrow, effectNote);

  const afterCol = el('div', 'qiyu-altar-col is-after');
  afterCol.append(
    el('span', 'qiyu-altar-col-label is-highlight', '确认后 · 纸上流彩'),
    createVisualCardElement(target, 'polychrome', reducedMotion, cleanups),
  );

  stage.append(beforeCol, conduit, afterCol);
  altar.append(stage);

  const intro = dialog.querySelector('.dialog-intro') ?? dialog.querySelector('.dialog-scroll');
  intro?.append(altar);

  return () => {
    for (const fn of cleanups) fn();
    altar.remove();
  };
}

/**
 * Mounts the 4-stage Polychrome Transformation Ceremony (`蓄势 -> 冲击 -> 顿挫 -> 数字爆发与账单落定`)
 * inside the `纸上流彩 · 已赋予` dialog.
 *
 * Never blocks the dialog's `返回商店` button; supports `跳过镜头` and reducedMotion/Restored.
 */
export function mountQiyuCeremonyStage(
  dialog: HTMLDialogElement,
  view: PokerEncounterView,
  characterId: CharacterId,
  options: {committed: boolean; reducedMotion: boolean},
): () => void {
  const cleanups: (() => void)[] = [];
  const abort = new AbortController();
  const hapticScope = Haptics.shared.createScope(abort.signal);
  cleanups.push(() => {
    abort.abort();
    hapticScope.cancel();
  });

  const receipt = view.receipt;
  const card =
    (receipt ? view.targets.find(c => c.id === receipt.targetId) : undefined) ?? view.targets[0];
  const cardName = card ? cardTitle(card) : '所选扑克';
  const goldBefore = receipt?.goldBefore ?? view.gold + 18;
  const goldAfter = receipt?.goldAfter ?? view.gold;
  const reduced = options.reducedMotion;
  const animateCeremony = options.committed && !reduced;

  cleanups.push(
    mountQiyuHeroBanner(dialog, characterId, 'purchased', {
      reducedMotion: reduced,
      gold: view.gold,
      price: 18,
      cardName,
      goldBefore,
      goldAfter,
    }),
  );

  const outcome: QiyuAnimationOutcome = {
    eventId: receipt?.id ?? view.id,
    choiceId: card?.id ?? 'poker-polychrome',
    paidGold: 18,
    resultKey: `${cardName} 晋升多彩 ×1.5`,
    goldBefore,
    goldAfter,
    cardLabel: cardName,
    enhancementLabel: card?.enhancement ? ENHANCEMENT_BRIEF[card.enhancement] : undefined,
    characterId,
  };
  const timeline = buildQiyuAnimationTimeline(outcome);

  const stage = el('section', 'qiyu-ceremony-stage');
  stage.dataset.qiyuPresentation = 'true';
  stage.dataset.motion = animateCeremony ? 'animated' : 'static';
  stage.dataset.ceremonyPhase = animateCeremony ? 'charge' : 'settled';
  stage.setAttribute('aria-label', '纸上流彩赋予演出与成长账单');

  const statusBar = el('div', 'qiyu-ceremony-bar');
  const statusTextWrap = el('div', 'qiyu-ceremony-status-text');
  const phaseBadge = el('span', 'qiyu-ceremony-phase-badge', animateCeremony ? '蓄势' : '落定');
  const caption = el(
    'strong',
    'qiyu-ceremony-caption',
    animateCeremony ? timeline[0].caption : '流彩已定 · 账单已存',
  );
  const subcaption = el(
    'p',
    'qiyu-ceremony-subcaption',
    animateCeremony
      ? timeline[0].subcaption
      : `${cardName} 已赋予【多彩】版次 · 打出且参与计分时每次读取 ×1.5`,
  );
  statusTextWrap.append(phaseBadge, caption, subcaption);
  statusBar.append(statusTextWrap);

  const skipBtn = el('button', 'qiyu-ceremony-skip', '跳过镜头');
  skipBtn.type = 'button';
  if (!animateCeremony) skipBtn.hidden = true;
  statusBar.append(skipBtn);
  stage.append(statusBar);

  // Centerpiece: 2D Canvas for ink/gold ribbons + burst + card pedestal + multiplier crest
  const centerStage = el('div', 'qiyu-ceremony-center');
  const fxCanvas = el('canvas', 'qiyu-ceremony-canvas');
  fxCanvas.width = 520;
  fxCanvas.height = 240;
  fxCanvas.setAttribute('aria-hidden', 'true');
  centerStage.append(fxCanvas);

  const cardSeat = el('div', 'qiyu-ceremony-card-seat');
  if (card) {
    cardSeat.append(createVisualCardElement(card, 'polychrome', reduced, cleanups));
  }
  const crest = el('div', 'qiyu-multiplier-crest');
  crest.innerHTML = '<span>计分倍率</span><strong>×1.5</strong><small>打出计分每次读取</small>';
  cardSeat.append(crest);
  centerStage.append(cardSeat);
  stage.append(centerStage);

  // Growth Ledger (获得 / 失去 / 保留)
  const ledger = el('div', 'qiyu-growth-ledger');
  ledger.setAttribute('aria-label', '本次奇遇成长账单');
  const ledgerRows = [
    {
      label: '失去（已扣款）',
      main: `18 金（${goldBefore} → ${goldAfter} 金）`,
      sub: '共用本店培养／改牌额度 1 次，无隐藏费用',
    },
    {
      label: '获得（已入牌组）',
      main: `${cardName} · 多彩版次（×1.5）`,
      sub: '打出且参与有效计分时逐遍读取；留手不触发',
    },
    {
      label: '保留与联动',
      main: card?.enhancement
        ? `原【${ENHANCEMENT_BRIEF[card.enhancement]}】增强完整保留`
        : '原牌点花色与牌组顺序完整保留',
      sub: '支持既有复制与重触发；已写入存档账单',
    },
  ];
  for (const row of ledgerRows) {
    const col = el('div', 'qiyu-ledger-col');
    col.append(el('span', '', row.label), el('strong', '', row.main), el('small', '', row.sub));
    ledger.append(col);
  }
  stage.append(ledger);

  const intro = dialog.querySelector('.dialog-intro') ?? dialog.querySelector('.dialog-scroll');
  intro?.append(stage);

  const paintCanvasFrame = (progress: number, phase: QiyuCeremonyPhase) => {
    const ctx = fxCanvas.getContext('2d');
    if (!ctx) return;
    const w = fxCanvas.width;
    const h = fxCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    // Subtle paper & celadon ink aura behind the card
    const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 195);
    grad.addColorStop(0, phase === 'impact' ? 'rgba(184, 71, 58, 0.28)' : 'rgba(216, 179, 106, 0.20)');
    grad.addColorStop(0.55, 'rgba(29, 61, 57, 0.16)');
    grad.addColorStop(1, 'rgba(29, 61, 57, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Phase 1: Charge (0 - 0.24) -> inward gathering ink & gold brush strokes
    if (progress < 0.45) {
      const u = Math.min(1, progress / 0.36);
      for (let i = 0; i < 10; i++) {
        const angle = 0.28 + (i * Math.PI) / 5;
        const dist = 165 * Math.pow(1 - u, 1.65) + 32;
        const len = 24 + (i % 3) * 8;
        const x1 = cx + Math.cos(angle) * (dist + len);
        const y1 = cy + Math.sin(angle) * (dist + len) * 0.68;
        const x2 = cx + Math.cos(angle) * dist;
        const y2 = cy + Math.sin(angle) * dist * 0.68;
        ctx.strokeStyle = i % 2 === 0 ? '#183b36' : '#d59a4b';
        ctx.globalAlpha = Math.sin(u * Math.PI) * 0.85;
        ctx.lineWidth = i % 2 === 0 ? 4.2 : 2.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Phase 2: Strike (0.24 - 0.52) -> wet brush diagonal calligraphy ribbon
    if (progress >= 0.2 && progress <= 0.65) {
      const s = Math.max(0, Math.min(1, (progress - 0.2) / 0.35));
      const fade = progress > 0.48 ? Math.max(0, 1 - (progress - 0.48) / 0.18) : 1;
      ctx.save();
      ctx.globalAlpha = 0.82 * fade;
      ctx.strokeStyle = '#183b36';
      ctx.lineWidth = 14 * (1 - s * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 170, cy + 54);
      ctx.quadraticCurveTo(cx - 20, cy - 18, cx - 170 + 340 * s, cy + 54 - 108 * s);
      ctx.stroke();

      ctx.strokeStyle = '#c94a38';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 160, cy + 46);
      ctx.quadraticCurveTo(cx - 10, cy - 12, cx - 160 + 320 * s, cy + 46 - 92 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Phase 3: Impact & Polychrome Bloom (0.45 - 1.0) -> InkBurst droplets & concentric calligraphy rings
    if (progress >= 0.45) {
      const b = Math.min(1, (progress - 0.45) / 0.48);
      for (const [idx, delay] of [0, 0.16].entries()) {
        if (b >= delay) {
          const rp = Math.min(1, (b - delay) / (1 - delay));
          const radius = 38 + 135 * (1 - Math.pow(1 - rp, 3));
          ctx.strokeStyle = idx === 0 ? '#b8473a' : '#2d5a54';
          ctx.globalAlpha = (1 - rp) * 0.68;
          ctx.lineWidth = Math.max(1.2, 4.5 * (1 - rp));
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const droplets = inkBurstFrame(b, 150, 18);
      for (const [i, d] of droplets.entries()) {
        if (d.alpha <= 0.01) continue;
        const color = i % 3 === 0 ? '#b8473a' : i % 3 === 1 ? '#d4a24e' : '#1d3d39';
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = d.alpha;
        ctx.lineWidth = Math.max(1, d.r * 0.65);
        ctx.beginPath();
        ctx.moveTo(d.x + cx - Math.cos(d.angle) * d.r * 3, d.y + cy - Math.sin(d.angle) * d.r * 3);
        ctx.lineTo(d.x + cx, d.y + cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(d.x + cx, d.y + cy, d.r * 2.1, d.r * 1.35, d.angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Settled seal ring impression
    if (phase === 'settled') {
      ctx.globalAlpha = 0.36;
      ctx.strokeStyle = '#c89e56';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 196, 18, 392, h - 36);
    }
    ctx.globalAlpha = 1;
  };

  if (!animateCeremony) {
    paintCanvasFrame(1, 'settled');
    return () => {
      for (const fn of cleanups) fn();
      stage.remove();
    };
  }

  // Trigger initial committed audio + haptics once on fresh commit
  try {
    hapticScope.saved('purchase', outcome.eventId);
    AudioEngine.shared.toolUse('spectral');
  } catch {
    /* Optional feedback */
  }

  let finished = false;
  const settleImmediately = (fromSkip: boolean) => {
    if (finished) return;
    finished = true;
    abort.abort();
    stage.dataset.ceremonyPhase = 'settled';
    phaseBadge.textContent = '落定';
    caption.textContent = fromSkip ? '镜头已跳过 · 结果与账单已保留' : '奇遇礼成 · 流彩已入牌组';
    subcaption.textContent = `${cardName} 晋升【多彩】· 实付 18 金（${goldBefore} → ${goldAfter} 金）`;
    skipBtn.hidden = true;
    paintCanvasFrame(1, 'settled');
    if (fromSkip) {
      try {
        AudioEngine.shared.select();
      } catch {
        /* Optional audio */
      }
    }
  };

  const onSkip = () => settleImmediately(true);
  skipBtn.addEventListener('click', onSkip, {once: true});
  cleanups.push(() => skipBtn.removeEventListener('click', onSkip));

  // Run the choreographed timeline asynchronously without blocking the dialog
  void (async () => {
    for (const frame of timeline) {
      if (finished || abort.signal.aborted) return;
      stage.dataset.ceremonyPhase = frame.phase;
      phaseBadge.textContent =
        frame.phase === 'charge'
          ? '蓄势'
          : frame.phase === 'strike'
            ? '冲击'
            : frame.phase === 'impact'
              ? '顿挫爆发'
              : '账单落定';
      caption.textContent = frame.caption;
      subcaption.textContent = frame.subcaption;

      try {
        if (frame.audioCue === 'play') {
          AudioEngine.shared.playHand();
        } else if (frame.audioCue === 'multiply-reveal') {
          AudioEngine.shared.multiplier('multiply', 1);
          AudioEngine.shared.rareReveal();
          hapticScope.multiplierArrived(outcome.eventId);
        } else if (frame.audioCue === 'score-settle') {
          AudioEngine.shared.score(1);
          hapticScope.settlementArrived(outcome.eventId);
        }
      } catch {
        /* Optional audio/haptics */
      }

      const steps = 4;
      const stepMs = Math.max(16, Math.floor(frame.durationMs / steps));
      for (let s = 1; s <= steps; s++) {
        if (finished || abort.signal.aborted) return;
        const p = frame.progressStart + ((frame.progressEnd - frame.progressStart) * s) / steps;
        paintCanvasFrame(p, frame.phase);
        await pause(stepMs);
      }
    }
    if (!finished && !abort.signal.aborted) {
      settleImmediately(false);
    }
  })();

  return () => {
    for (const fn of cleanups) fn();
    stage.remove();
  };
}

/**
 * Standalone runnable presentation for `QiyuAnimationOutcome` (kept compatible with direct callers/tests).
 */
export async function playQiyuAnimation(
  outcome: QiyuAnimationOutcome,
  options: QiyuAnimationPresentationOptions = {},
): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const reduced =
    options.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const profile = qiyuHeroProfile(options.characterId ?? outcome.characterId);
  const host = el('section', 'qiyu-standalone-overlay');
  host.dataset.qiyuPresentation = 'true';
  host.dataset.ceremonyPhase = reduced ? 'settled' : 'charge';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-label', '奇遇结果');
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '10000',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    color: '#f8e8c8',
    background: 'radial-gradient(circle at 50% 38%,#6f4036 0%,#182f2c 72%)',
    fontFamily: 'Georgia,"Noto Serif SC",serif',
    opacity: '0',
    transition: reduced ? 'none' : 'opacity 220ms ease',
  });

  const panel = el('div', 'qiyu-standalone-panel');
  Object.assign(panel.style, {
    width: 'min(760px,100%)',
    minHeight: 'min(360px,80vh)',
    padding: '28px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: '16px',
    alignContent: 'center',
    border: '1px solid rgba(248,232,200,.55)',
    borderRadius: '14px',
    background: 'linear-gradient(145deg,rgba(20,45,43,.96),rgba(91,47,47,.92))',
    boxShadow: '0 18px 80px rgba(0,0,0,.35)',
    textAlign: 'center',
  });

  const title = el('h2', '', profile.sceneTitle);
  Object.assign(title.style, {margin: '0', fontSize: 'clamp(26px,4.5vw,48px)', letterSpacing: '.16em'});
  const hero = el('div', '', options.heroName ?? `${profile.name} · ${profile.title}`);
  Object.assign(hero.style, {fontSize: 'clamp(16px,2vw,22px)', color: '#f0c77a'});
  const caption = el('p', '', '准备回应…');
  Object.assign(caption.style, {
    margin: '0',
    minHeight: '2.6em',
    fontSize: 'clamp(18px,2.4vw,28px)',
    lineHeight: '1.45',
  });
  const ledger = el('div', '', '账单将在结果落定后显示');
  Object.assign(ledger.style, {
    margin: '0 auto',
    maxWidth: '36em',
    padding: '12px 16px',
    borderTop: '1px solid rgba(248,232,200,.35)',
    fontSize: '15px',
    lineHeight: '1.55',
    whiteSpace: 'pre-line',
  });
  const skip = el('button', '', '跳过镜头');
  skip.type = 'button';
  Object.assign(skip.style, {
    justifySelf: 'center',
    minWidth: '144px',
    minHeight: '44px',
    border: '1px solid #f0c77a',
    borderRadius: '999px',
    color: '#182f2c',
    background: '#f0c77a',
    font: 'inherit',
    cursor: 'pointer',
  });

  panel.append(title, hero, caption, ledger, skip);
  host.append(panel);
  (options.root ?? document.body).append(host);
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => {
      host.style.opacity = '1';
      resolve();
    }),
  );

  let skipped = false;
  const skipNow = () => {
    skipped = true;
  };
  skip.addEventListener('click', skipNow, {once: true});
  try {
    for (const frame of buildQiyuAnimationTimeline(outcome)) {
      if (skipped) break;
      host.dataset.ceremonyPhase = frame.phase;
      caption.textContent = `${frame.caption}\n${frame.subcaption}`;
      if (frame.cue === 'impact' && typeof panel.animate === 'function') {
        panel.animate(
          [
            {transform: 'translateY(0) scale(1)'},
            {transform: 'translateY(-4px) scale(1.015)'},
            {transform: 'translateY(0) scale(1)'},
          ],
          {duration: reduced ? 1 : frame.durationMs, easing: 'cubic-bezier(.2,.8,.2,1)'},
        );
      }
      if (frame.cue === 'ledger-settle') {
        ledger.textContent = `本次奇遇成长账单\n失去：${outcome.paidGold} 金\n获得：${options.resultLabel ?? outcome.resultKey}\n保留：原增强与牌组其余资源不变`;
      }
      await pause(reduced ? 1 : frame.durationMs);
    }
    if (skipped) {
      host.dataset.ceremonyPhase = 'settled';
      caption.textContent = '镜头已跳过，结果与账单已保留';
      ledger.textContent = `失去：${outcome.paidGold} 金\n获得：${options.resultLabel ?? outcome.resultKey}\n保留：原增强与牌组其余资源不变`;
      await pause(reduced ? 1 : 400);
    }
  } finally {
    skip.removeEventListener('click', skipNow);
    host.style.opacity = '0';
    await pause(reduced ? 1 : 220);
    host.remove();
  }
}
