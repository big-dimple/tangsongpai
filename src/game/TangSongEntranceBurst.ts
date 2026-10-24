import {qiyuHeroProfile, type QiyuHeroProfile} from '../domain/qiyuEvent';
import type {CharacterId} from '../domain/characters';
import {characterArt} from './CharacterArt';
import {iridescenceColor} from './PolychromeCardIridescence';
import {inkBurstFrame} from './InkBurst';
import {AudioEngine} from '../audio/AudioEngine';
import {Haptics} from '../haptics/Haptics';

/**
 * Tang-Song entrance spectacles shared by the home page, hero selection and every
 * hero entry point (shop / stage / boss / Qiyu).
 *
 * Presentation-only: every overlay is `pointer-events: none`, `aria-hidden`, lives in a
 * closed Shadow Root (so DOM/canvas queries only see Phaser's canvas), never touches
 * run state, and is skipped entirely under reduced motion.
 *
 * Rendering uses a responsive, devicePixelRatio-aware stage: a 960×540 design space in
 * landscape (handscroll 手卷) or 540×960 in portrait (hanging scroll 立轴), uniformly
 * fitted and centered, so text stays crisp and circles never stretch on phones.
 */

const SERIF = '"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong",SimSun,Georgia,serif';
const SANS = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

const INK = '#26313a';
const VERMILION = '#b8473a';
const GOLD = '#e6c168';
const GOLD_DEEP = '#b99a61';
const PAPER = '#fbf4e6';
const TEAL = '#3f606b';

export function createShadowCanvasHost(
  className: string,
  width: number,
  height: number,
  fixedFullScreen: boolean,
): {hostNode: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D} | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (typeof canvas.getContext !== 'function') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {pointerEvents: 'none', width: '100%', height: '100%', display: 'block'});

  const hostNode = document.createElement('div');
  hostNode.className = className;
  hostNode.setAttribute('aria-hidden', 'true');
  Object.assign(hostNode.style, {
    pointerEvents: 'none',
    position: fixedFullScreen ? 'fixed' : 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  });
  if (fixedFullScreen) hostNode.style.zIndex = '2147483646';

  if (typeof hostNode.attachShadow === 'function') {
    const shadow = hostNode.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent =
      ':host{pointer-events:none!important}canvas{width:100%;height:100%;display:block;pointer-events:none!important}';
    shadow.append(style, canvas);
  } else {
    hostNode.append(canvas);
  }
  return {hostNode, canvas, ctx};
}

// ---------------------------------------------------------------------------
// Shared drawing helpers
// ---------------------------------------------------------------------------

interface Stage {
  /** Design-space size (960×540 landscape or 540×960 portrait). */
  w: number;
  h: number;
  portrait: boolean;
  /** Viewport (CSS px) size of the overlay. */
  vw: number;
  vh: number;
  scale: number;
  ox: number;
  oy: number;
  dpr: number;
}

function prepareStage(hostNode: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Stage {
  const rect = hostNode.getBoundingClientRect();
  const vw = Math.max(1, rect.width || window.innerWidth || 960);
  const vh = Math.max(1, rect.height || window.innerHeight || 540);
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const pw = Math.round(vw * dpr);
  const ph = Math.round(vh * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const portrait = vh > vw * 1.05;
  const w = portrait ? 540 : 960;
  const h = portrait ? 960 : 540;
  const scale = Math.min(vw / w, vh / h);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  return {w, h, portrait, vw, vh, scale, ox: (vw - w * scale) / 2, oy: (vh - h * scale) / 2, dpr};
}

function enterDesignSpace(ctx: CanvasRenderingContext2D, s: Stage, shakeX = 0, shakeY = 0): void {
  const k = s.dpr * s.scale;
  ctx.setTransform(k, 0, 0, k, s.dpr * s.ox + shakeX * k, s.dpr * s.oy + shakeY * k);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const hexColor = (color: number) => '#' + color.toString(16).padStart(6, '0');

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Shrinks the font until `text` fits `maxWidth`; returns the applied size. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  size: number,
  family: string,
  maxWidth: number,
  minSize = 10,
): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > minSize && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Draws CJK text with manual letter spacing, centered on `cx`. */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = Array.from(text);
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = align;
}

const imageCache = new Map<string, HTMLImageElement>();
function cachedImage(url: string | undefined): HTMLImageElement | undefined {
  if (!url || typeof Image === 'undefined') return undefined;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    imageCache.set(url, img);
  }
  return img;
}
const ready = (img: HTMLImageElement | undefined): img is HTMLImageElement =>
  !!img && img.complete && img.naturalWidth > 0;

/** Draws `img` covering the destination box without distortion (center crop). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (ir > br) {
    sw = sh * br;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / br;
    sy = (img.naturalHeight - sh) * focusY;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  progress: number,
  rotation = 0.07,
): void {
  if (progress <= 0) return;
  // Slam: drop in from 2.6× with a slight overshoot, then settle.
  const p = clamp01(progress);
  const scale = p < 0.62 ? 2.6 - (p / 0.62) * 1.72 : 0.88 + easeOutCubic((p - 0.62) / 0.38) * 0.12;
  const alpha = Math.min(1, p * 3);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(rotation);
  ctx.globalAlpha *= alpha;
  const half = size / 2;
  ctx.shadowColor = 'rgba(120, 30, 20, 0.35)';
  ctx.shadowBlur = 6;
  roundRectPath(ctx, -half, -half, size, size, size * 0.12);
  ctx.fillStyle = VERMILION;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 244, 224, 0.82)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  roundRectPath(ctx, -half + size * 0.09, -half + size * 0.09, size * 0.82, size * 0.82, size * 0.06);
  ctx.stroke();
  ctx.fillStyle = '#fff7e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = Array.from(text);
  if (chars.length === 2) {
    // Traditional seal layout: two characters stacked vertically.
    ctx.font = `bold ${size * 0.34}px ${SERIF}`;
    ctx.fillText(chars[0], 0, -size * 0.18);
    ctx.fillText(chars[1], 0, size * 0.2);
  } else {
    fitFont(ctx, text, 'bold', size * 0.4, SERIF, size * 0.74, 8);
    ctx.fillText(text, 0, size * 0.02);
  }
  ctx.restore();
}

interface Particle {
  angle: number;
  speed: number;
  size: number;
  stretch: number;
  color: (p: number) => string;
  spin: number;
}

function buildParticles(count: number, palette: ((p: number, seed: number) => string)[]): Particle[] {
  return Array.from({length: count}, (_, i) => {
    const seed = ((i * 97) % count) / count;
    const pick = palette[i % palette.length];
    return {
      angle: (Math.PI * 2 * i) / count + ((i * 37) % 11) * 0.03,
      speed: 120 + ((i * 53) % 13) * 32,
      size: 2.2 + ((i * 29) % 7) * 1.1,
      stretch: 1.3 + ((i * 17) % 5) * 0.55,
      color: (p: number) => pick(p, seed),
      spin: (((i * 13) % 7) - 3) * 0.6,
    };
  });
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[], cx: number, cy: number, t: number, alpha: number): void {
  if (t <= 0 || alpha <= 0) return;
  const travel = easeOutCubic(t);
  for (const pt of list) {
    const dist = 20 + pt.speed * travel;
    const px = cx + Math.cos(pt.angle) * dist;
    const py = cy + Math.sin(pt.angle) * dist * 0.78 + t * t * 34;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pt.angle + t * pt.spin);
    ctx.globalAlpha = alpha * (1 - t * 0.85);
    ctx.fillStyle = pt.color(t);
    ctx.beginPath();
    ctx.ellipse(0, 0, pt.size * pt.stretch * (1 - t * 0.4), pt.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, alpha: number, maxR: number, colors: string[]): void {
  colors.forEach((color, i) => {
    const delay = i * 0.09;
    const rp = clamp01((t - delay) / (1 - delay));
    if (rp <= 0 || rp >= 1) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * (1 - rp) * 0.8;
    ctx.lineWidth = (4.2 - i * 0.9) * (1 - rp * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + easeOutCubic(rp) * maxR * (1 - i * 0.1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  p: number,
  impactT: number,
  alpha: number,
  count: number,
  colors: string[],
  reach: number,
): void {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + ((i * 7) % 5) * 0.02;
    const converge = p < 0.16 ? 1 - easeOutCubic(p / 0.16) : 0;
    const innerR = 60 + converge * reach * 0.5 + impactT * reach * 0.55;
    const outerR = innerR + reach * (0.28 + ((i * 11) % 5) * 0.07);
    ctx.save();
    ctx.strokeStyle = colors[i % colors.length];
    ctx.globalAlpha = alpha * (p < 0.16 ? 0.5 : (1 - impactT) * 0.55);
    ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
    ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
    ctx.stroke();
    ctx.restore();
  }
}

function prefersReducedMotion(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// Hero cut-in (`mountHeroEntranceBurst`)
// ---------------------------------------------------------------------------

export type HeroEntranceContext = 'qiyu' | 'stage' | 'boss' | 'shop' | 'select';

let entranceSerial = 0;

/**
 * Shared 6-hero explosive entrance cut-in: ink/gold speed lines, an angled lacquer
 * cut-in band with the hero medallion, eye-strip and allusion, a vermilion seal slam
 * with camera shake, shockwave rings and radial gold-leaf / cinnabar particles.
 *
 * The `select` context is a lighter, faster variant for browsing heroes: it keeps the
 * selection screen readable (lighter veil, smaller shake) and plays a single cue.
 */
export function mountHeroEntranceBurst(
  host: HTMLElement | null | undefined,
  characterId: CharacterId,
  options: {
    context?: HeroEntranceContext;
    stageIndex?: number;
    reducedMotion?: boolean;
    playAudio?: boolean;
  } = {},
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !host) return () => {};
  if (prefersReducedMotion(options.reducedMotion)) return () => {};

  const context = options.context ?? 'qiyu';
  const light = context === 'select';
  host.querySelectorAll('.qiyu-entrance-burst-canvas').forEach(node => node.remove());

  const shadow = createShadowCanvasHost(`qiyu-entrance-burst-canvas is-${context}`, 960, 540, host === document.body);
  if (!shadow) return () => {};
  const {hostNode, canvas, ctx} = shadow;
  host.append(hostNode);

  const profile = qiyuHeroProfile(characterId);
  const stageNum = (options.stageIndex ?? 0) + 1;
  const eyesImg = cachedImage(characterArt(characterId, 'eyes')?.url);
  const avatarImg = cachedImage(characterArt(characterId, 'avatar')?.url);

  const badge =
    context === 'qiyu'
      ? '奇遇降临 · 纸上流彩'
      : context === 'boss'
        ? `压轴迎战 · 第 ${stageNum} 关`
        : context === 'stage'
          ? `破阵入局 · 第 ${stageNum} 关`
          : context === 'select'
            ? '名士登坛 · 唐宋风流'
            : '群英入席 · 纸上山河';
  const subtitle = context === 'qiyu' ? profile.encounterLine : context === 'boss' ? profile.confirmLine : profile.allusion;

  const particles = buildParticles(light ? 40 : 72, [
    () => '#e04834',
    () => '#f5d782',
    (p, seed) => hexColor(iridescenceColor((seed + p * 1.6) % 1)),
    () => profile.accentHex,
  ]);

  const playAudio = options.playAudio ?? true;
  const abort = new AbortController();
  const haptics = Haptics.shared.createScope(abort.signal);
  const serial = ++entranceSerial;
  let sealCueFired = !playAudio;
  let settleCueFired = !playAudio || light;
  if (playAudio && !light) {
    try {
      AudioEngine.shared.curtainOpen();
      AudioEngine.shared.sourceCue(context === 'boss' ? 'boss' : 'character');
    } catch {
      /* Optional audio. */
    }
  }

  const totalMs = light ? 900 : 1250;
  const sealAt = light ? 0.14 : 0.17;
  const start = performance.now();
  let disposed = false;
  let rafId = 0;

  const render = (elapsed: number) => {
    const p = clamp01(elapsed / totalMs);
    const s = prepareStage(hostNode, canvas, ctx);
    const {w, h, portrait} = s;

    if (!sealCueFired && p >= sealAt) {
      sealCueFired = true;
      try {
        if (light) {
          AudioEngine.shared.sourceCue('character');
          haptics.selectionChanged(true);
        } else {
          AudioEngine.shared.rareReveal();
          haptics.multiplierArrived(`entrance-${serial}`);
        }
      } catch {
        /* Optional audio/haptics. */
      }
    }
    if (!settleCueFired && elapsed >= 560) {
      settleCueFired = true;
      try {
        AudioEngine.shared.score(1);
        haptics.settlementArrived(`entrance-${serial}`);
      } catch {
        /* Optional audio/haptics. */
      }
    }

    const fadeIn = clamp01(p / 0.12);
    const fadeOut = p > 0.76 ? clamp01(1 - (p - 0.76) / 0.24) : 1;
    const alpha = fadeIn * fadeOut;
    const impactT = p >= sealAt ? clamp01((p - sealAt) / 0.62) : 0;
    const shakeT = p >= sealAt ? clamp01((p - sealAt) / 0.2) : 1;
    const shakeAmp = shakeT < 1 ? (1 - shakeT) * (light ? 4 : 10) : 0;
    const shakeX = shakeAmp ? Math.sin(elapsed * 0.09) * shakeAmp : 0;
    const shakeY = shakeAmp ? Math.cos(elapsed * 0.11) * shakeAmp * 0.6 : 0;

    // 1. Viewport veil (full bleed, outside design space).
    const veil = ctx.createRadialGradient(s.vw / 2, s.vh * 0.46, 0, s.vw / 2, s.vh * 0.46, Math.max(s.vw, s.vh) * 0.72);
    veil.addColorStop(0, `rgba(14, 24, 29, ${light ? 0.34 : 0.7})`);
    veil.addColorStop(0.6, `rgba(22, 17, 19, ${light ? 0.18 : 0.46})`);
    veil.addColorStop(1, 'rgba(10, 16, 20, 0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, s.vw, s.vh);
    ctx.globalAlpha = 1;

    enterDesignSpace(ctx, s, shakeX, shakeY);
    const cx = w / 2;
    const cy = h * (portrait ? 0.45 : 0.47);

    // 2. Speed lines, rings, ink droplets, particles.
    drawSpeedLines(ctx, cx, cy, p, impactT, fadeOut, light ? 20 : 30, [GOLD, profile.accentHex, '#d84b37'], portrait ? 420 : 380);
    if (impactT > 0) {
      drawRings(ctx, cx, cy, impactT, fadeOut, Math.max(w, h) * 0.5, ['#d84b37', GOLD, hexColor(iridescenceColor((p * 2.2) % 1))]);
      for (const d of inkBurstFrame(Math.min(1, impactT * 1.3), portrait ? 200 : 190, light ? 12 : 18)) {
        ctx.globalAlpha = d.alpha * fadeOut * 0.8;
        ctx.fillStyle = '#f0cf7b';
        ctx.beginPath();
        ctx.arc(cx + d.x * 1.5, cy + d.y * 1.2, d.r * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawParticles(ctx, particles, cx, cy, impactT, fadeOut * 0.95);
    }

    // 3. Angled lacquer cut-in band.
    const slide = easeOutCubic(p / 0.16);
    const collapse = p > 0.82 ? clamp01(1 - (p - 0.82) / 0.18) : 1;
    const barW = w * (portrait ? 0.94 : 0.9);
    const fullHalfH = portrait ? 132 : light ? 58 : 66;
    const barHalfH = fullHalfH * collapse;
    if (barHalfH < 2) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    ctx.save();
    ctx.translate(cx + (1 - slide) * -w * 0.6, cy);
    ctx.rotate(portrait ? -0.035 : -0.05);
    ctx.globalAlpha = alpha;

    const barGrad = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    barGrad.addColorStop(0, 'rgba(16, 25, 30, 0.0)');
    barGrad.addColorStop(0.08, 'rgba(16, 25, 30, 0.95)');
    barGrad.addColorStop(0.5, 'rgba(28, 41, 47, 0.97)');
    barGrad.addColorStop(0.92, 'rgba(16, 25, 30, 0.95)');
    barGrad.addColorStop(1, 'rgba(16, 25, 30, 0.0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(-barW / 2, -barHalfH, barW, barHalfH * 2);

    // Eye-strip, cover-cropped and blended into the band.
    if (ready(eyesImg)) {
      const ex = portrait ? -barW / 2 + 20 : -barW * 0.02;
      const ew = portrait ? barW - 40 : barW * 0.46;
      const eh = portrait ? barHalfH * 0.62 : barHalfH * 2 - 8;
      const ey = portrait ? -barHalfH + 6 : -barHalfH + 4;
      ctx.save();
      ctx.globalAlpha = alpha * (portrait ? 0.3 : 0.38);
      drawCover(ctx, eyesImg, ex, ey, ew, eh);
      ctx.restore();
      // Soft fade on the inner edge so the strip melts into lacquer.
      const fade = portrait
        ? ctx.createLinearGradient(0, ey, 0, ey + eh)
        : ctx.createLinearGradient(ex, 0, ex + ew * 0.35, 0);
      fade.addColorStop(0, portrait ? 'rgba(24, 36, 42, 0)' : 'rgba(24, 36, 42, 1)');
      fade.addColorStop(1, portrait ? 'rgba(24, 36, 42, 0.9)' : 'rgba(24, 36, 42, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(ex, ey, ew, eh);
    }

    // Gold-leaf + polychrome hairline borders.
    const border = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    border.addColorStop(0, 'rgba(230, 193, 104, 0)');
    border.addColorStop(0.2, GOLD);
    border.addColorStop(0.5, hexColor(iridescenceColor((p * 2) % 1)));
    border.addColorStop(0.8, profile.accentHex);
    border.addColorStop(1, 'rgba(230, 193, 104, 0)');
    ctx.fillStyle = border;
    ctx.fillRect(-barW / 2, -barHalfH, barW, 3);
    ctx.fillRect(-barW / 2, barHalfH - 3, barW, 3);

    // Medallion, text and seal (layout differs per orientation).
    const contentAlpha = clamp01((p - 0.06) / 0.12) * fadeOut;
    ctx.globalAlpha = contentAlpha;
    const medalR = portrait ? 40 : Math.min(44, barHalfH * 0.7);
    const medalX = portrait ? 0 : -barW * 0.36;
    const medalY = portrait ? -barHalfH * 0.42 : 0;
    drawMedallion(ctx, avatarImg, profile, medalX, medalY, medalR);

    ctx.textBaseline = 'middle';
    if (portrait) {
      ctx.textAlign = 'center';
      const maxW = barW - 60;
      ctx.fillStyle = GOLD;
      fitFont(ctx, `◆ ${badge}`, 'bold', 14, SERIF, maxW, 10);
      ctx.fillText(`◆ ${badge}`, 0, medalY + medalR + 20);
      ctx.fillStyle = '#fff8ea';
      ctx.shadowColor = 'rgba(196, 63, 46, 0.65)';
      ctx.shadowBlur = 10;
      fitFont(ctx, `${profile.name} · ${profile.title}`, 'bold', 28, SERIF, maxW, 16);
      ctx.fillText(`${profile.name} · ${profile.title}`, 0, medalY + medalR + 50);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#bfe3dc';
      fitFont(ctx, subtitle, 'normal', 14, SANS, maxW, 10);
      ctx.fillText(subtitle, 0, medalY + medalR + 80);
    } else {
      ctx.textAlign = 'left';
      const textLeft = medalX + medalR + 22;
      const sealX = barW * 0.36;
      const maxW = sealX - 48 - textLeft;
      ctx.fillStyle = GOLD;
      fitFont(ctx, `◆ ${badge} · ${profile.sceneTitle}`, 'bold', 14, SERIF, maxW, 10);
      ctx.fillText(`◆ ${badge} · ${profile.sceneTitle}`, textLeft, -barHalfH * 0.5);
      ctx.fillStyle = '#fff8ea';
      ctx.shadowColor = 'rgba(196, 63, 46, 0.65)';
      ctx.shadowBlur = 12;
      fitFont(ctx, `${profile.name} · ${profile.title}`, 'bold', 30, SERIF, maxW, 16);
      ctx.fillText(`${profile.name} · ${profile.title}`, textLeft, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#bfe3dc';
      fitFont(ctx, subtitle, 'normal', 15, SANS, maxW, 10);
      ctx.fillText(subtitle, textLeft, barHalfH * 0.52);
    }

    // Travelling light sweep.
    ctx.globalAlpha = fadeOut;
    const sweepX = -barW * 0.6 + p * barW * 1.5;
    const sweep = ctx.createLinearGradient(sweepX - 90, 0, sweepX + 90, 0);
    sweep.addColorStop(0, 'rgba(255, 248, 220, 0)');
    sweep.addColorStop(0.5, 'rgba(255, 240, 185, 0.26)');
    sweep.addColorStop(1, 'rgba(255, 248, 220, 0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(-barW / 2, -barHalfH, barW, barHalfH * 2);

    // Vermilion seal slam.
    ctx.globalAlpha = fadeOut;
    const sealSize = portrait ? 64 : light ? 64 : 74;
    const sealX = portrait ? barW / 2 - 52 : barW * 0.36;
    const sealY = portrait ? -barHalfH + 46 : 0;
    drawSeal(ctx, profile.sealText, sealX, sealY, sealSize, (p - (sealAt - 0.02)) / 0.16);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const tick = (now: number) => {
    if (disposed || !hostNode.isConnected) return;
    const elapsed = now - start;
    if (elapsed >= totalMs) {
      hostNode.remove();
      return;
    }
    render(elapsed);
    rafId = requestAnimationFrame(tick);
  };
  render(16);
  rafId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    abort.abort();
    haptics.cancel();
    cancelAnimationFrame(rafId);
    hostNode.remove();
  };
}

function drawMedallion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  profile: QiyuHeroProfile,
  x: number,
  y: number,
  r: number,
  ring = GOLD,
  fallbackFill = '#24383f',
  fallbackInk = '#fff8ea',
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r + 1.2, 0, Math.PI * 2);
  ctx.strokeStyle = profile.accentHex;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (ready(img)) {
    ctx.save();
    ctx.clip();
    drawCover(ctx, img, x - r, y - r, r * 2, r * 2, 0.3);
    ctx.restore();
  } else {
    ctx.fillStyle = fallbackFill;
    ctx.fill();
    ctx.fillStyle = fallbackInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${r * 0.9}px ${SERIF}`;
    ctx.fillText(Array.from(profile.name)[0] ?? '', x, y + r * 0.04);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Six-hero ensemble scroll (`mountTangSongEnsembleBurst`)
// ---------------------------------------------------------------------------

const ENSEMBLE_IDS: readonly CharacterId[] = ['amo', 'laohuan', 'erxiang', 'azao', 'xiemu', 'touye'];

let titleEnsemblePlayed = false;

/**
 * Grand six-hero Tang-Song scroll entrance.
 *
 * - `title`: plays once per page load right after the first load finishes. Uses the
 *   home page's own Xuan-paper palette (cream paper, ink, vermilion, antique gold) so
 *   the spectacle hands off seamlessly into the light paper home instead of flashing a
 *   dark screen over it.
 * - `character-select`: dark lacquer & gold palette matching the hero-selection stage.
 *
 * Landscape unrolls a horizontal handscroll (手卷) with the six heroes in one row;
 * portrait unrolls a hanging scroll (立轴) with a 3×2 grid.
 */
export function mountTangSongEnsembleBurst(
  host: HTMLElement | null | undefined,
  options: {mode?: 'title' | 'character-select'; reducedMotion?: boolean; playAudio?: boolean} = {},
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !host) return () => {};
  const mode = options.mode ?? 'character-select';
  if (mode === 'title') {
    if (titleEnsemblePlayed) return () => {};
    titleEnsemblePlayed = true;
  }
  if (prefersReducedMotion(options.reducedMotion)) return () => {};

  host.querySelectorAll('.qiyu-ensemble-burst-canvas').forEach(node => node.remove());
  const shadow = createShadowCanvasHost(`qiyu-ensemble-burst-canvas is-${mode}`, 960, 540, host === document.body);
  if (!shadow) return () => {};
  const {hostNode, canvas, ctx} = shadow;
  host.append(hostNode);

  const paper = mode === 'title';
  const theme = paper
    ? {
        veilCenter: 'rgba(243, 234, 219, 0.96)',
        veilEdge: 'rgba(243, 234, 219, 0.82)',
        scrollTop: '#fdf8ee',
        scrollBottom: '#f4ead6',
        mount: TEAL,
        text: INK,
        heading: INK,
        muted: '#5d6b6e',
        sub: TEAL,
        lines: [INK, VERMILION, GOLD_DEEP],
        rings: [VERMILION, GOLD_DEEP, TEAL],
        droplet: 'rgba(38, 49, 58, 1)',
        plaque: 'rgba(255, 251, 242, 0.96)',
        plaqueLine: 'rgba(155, 139, 113, 0.65)',
        medalRing: GOLD_DEEP,
        medalFallback: '#e9dfcb',
        medalInk: INK,
        mountain: ['rgba(63, 96, 107, 0.16)', 'rgba(63, 96, 107, 0.05)'],
        glow: 'rgba(184, 71, 58, 0.22)',
      }
    : {
        veilCenter: 'rgba(12, 24, 28, 0.86)',
        veilEdge: 'rgba(10, 18, 22, 0.55)',
        scrollTop: 'rgba(26, 40, 46, 0.97)',
        scrollBottom: 'rgba(15, 25, 30, 0.97)',
        mount: GOLD_DEEP,
        text: '#fff8ea',
        heading: '#fff8ea',
        muted: '#9ecbc3',
        sub: '#bfe3dc',
        lines: [GOLD, '#3ba896', '#d84b37'],
        rings: ['#d84b37', GOLD, '#4ec7b2'],
        droplet: 'rgba(245, 215, 130, 1)',
        plaque: 'rgba(14, 23, 28, 0.92)',
        plaqueLine: 'rgba(230, 193, 104, 0.4)',
        medalRing: GOLD,
        medalFallback: '#24383f',
        medalInk: '#fff8ea',
        mountain: ['rgba(62, 168, 148, 0.22)', 'rgba(16, 28, 33, 0.04)'],
        glow: 'rgba(230, 193, 104, 0.22)',
      };

  const heroes = ENSEMBLE_IDS.map(id => ({
    id,
    profile: qiyuHeroProfile(id),
    avatar: cachedImage(characterArt(id, 'avatar')?.url),
  }));

  const particles = buildParticles(paper ? 64 : 84, paper
    ? [() => INK, () => VERMILION, () => GOLD_DEEP, () => TEAL]
    : [() => '#e04834', () => '#f5d782', (p, seed) => hexColor(iridescenceColor((seed + p * 1.7) % 1)), () => '#4ec7b2']);

  const eyebrow = paper ? '一纸纳山河 · 落子会群英' : '◆ 点将登坛 ◆';
  const heading = paper ? '唐宋牌' : '六位群英 · 候君点将';
  const sub = paper ? '唐宋群英 · 牌局争锋' : heroes.map(hero => hero.profile.sealText).join(' · ');
  const centralSeal = paper ? '唐宋' : '点将';

  const playAudio = options.playAudio ?? true;
  const abort = new AbortController();
  const haptics = Haptics.shared.createScope(abort.signal);
  const serial = ++entranceSerial;
  let sealCueFired = !playAudio;
  let settleCueFired = !playAudio;
  if (playAudio) {
    try {
      AudioEngine.shared.curtainOpen();
    } catch {
      /* Optional audio. */
    }
  }

  const totalMs = paper ? 1600 : 1400;
  const sealAt = 0.2;
  const start = performance.now();
  let disposed = false;
  let rafId = 0;

  const render = (elapsed: number) => {
    const p = clamp01(elapsed / totalMs);
    const s = prepareStage(hostNode, canvas, ctx);
    const {w, h, portrait} = s;

    if (!sealCueFired && p >= sealAt) {
      sealCueFired = true;
      try {
        AudioEngine.shared.rareReveal();
        haptics.multiplierArrived(`ensemble-${serial}`);
      } catch {
        /* Optional audio/haptics. */
      }
    }
    if (!settleCueFired && p >= 0.46) {
      settleCueFired = true;
      try {
        AudioEngine.shared.score(1);
        haptics.settlementArrived(`ensemble-${serial}`);
      } catch {
        /* Optional audio/haptics. */
      }
    }

    const fadeIn = clamp01(p / 0.1);
    const fadeOut = p > 0.78 ? clamp01(1 - (p - 0.78) / 0.22) : 1;
    const alpha = fadeIn * fadeOut;
    const impactT = p >= sealAt ? clamp01((p - sealAt) / 0.6) : 0;
    const shakeT = p >= sealAt ? clamp01((p - sealAt) / 0.16) : 1;
    const shakeAmp = shakeT < 1 ? (1 - shakeT) * (paper ? 7 : 11) : 0;
    const shakeX = shakeAmp ? Math.sin(elapsed * 0.095) * shakeAmp : 0;
    const shakeY = shakeAmp ? Math.cos(elapsed * 0.115) * shakeAmp * 0.6 : 0;

    // 1. Full-bleed veil (paper wash or lacquer night).
    const veil = ctx.createRadialGradient(s.vw / 2, s.vh / 2, 0, s.vw / 2, s.vh / 2, Math.max(s.vw, s.vh) * 0.75);
    veil.addColorStop(0, theme.veilCenter);
    veil.addColorStop(1, theme.veilEdge);
    ctx.globalAlpha = alpha * (paper ? 0.78 : 1);
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, s.vw, s.vh);
    ctx.globalAlpha = 1;

    enterDesignSpace(ctx, s, shakeX, shakeY);
    const cx = w / 2;
    const cy = h / 2;

    // 2. Speed lines + impact layer behind the scroll.
    drawSpeedLines(ctx, cx, cy, p, impactT, fadeOut * (paper ? 0.55 : 1), 32, theme.lines, portrait ? 480 : 440);
    if (impactT > 0) {
      drawRings(ctx, cx, cy, impactT, fadeOut * (paper ? 0.7 : 1), Math.max(w, h) * 0.52, theme.rings);
      for (const d of inkBurstFrame(Math.min(1, impactT * 1.25), portrait ? 230 : 220, 22)) {
        ctx.globalAlpha = d.alpha * fadeOut * (paper ? 0.5 : 0.85);
        ctx.fillStyle = theme.droplet;
        ctx.beginPath();
        ctx.arc(cx + d.x * 1.7, cy + d.y * 1.3, d.r * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawParticles(ctx, particles, cx, cy, impactT, fadeOut * (paper ? 0.75 : 0.95));
    }

    // 3. Unrolling scroll: horizontal handscroll (landscape) / hanging scroll (portrait).
    const unroll = easeOutCubic(p / 0.2);
    const exit = p > 0.8 ? clamp01((p - 0.8) / 0.2) : 0;
    const fullW = portrait ? w * 0.92 : w * 0.92;
    const fullH = portrait ? Math.min(h * 0.64, 608) : 312;
    const scrollW = portrait ? fullW : Math.max(16, fullW * unroll);
    const scrollH = portrait ? Math.max(16, fullH * unroll) : fullH;
    const lift = exit * -18;
    const scrollScale = 1 + exit * 0.04;
    ctx.save();
    ctx.translate(cx, cy + lift);
    ctx.scale(scrollScale, scrollScale);
    ctx.globalAlpha = alpha;
    const left = -scrollW / 2;
    const top = portrait ? -fullH / 2 : -scrollH / 2;

    // Paper / lacquer body with a soft drop shadow.
    ctx.save();
    ctx.shadowColor = paper ? 'rgba(38, 49, 58, 0.22)' : 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    const body = ctx.createLinearGradient(0, top, 0, top + scrollH);
    body.addColorStop(0, theme.scrollTop);
    body.addColorStop(1, theme.scrollBottom);
    ctx.fillStyle = body;
    ctx.fillRect(left, top, scrollW, scrollH);
    ctx.restore();

    // Clip the contents to the unrolled area.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, scrollW, scrollH);
    ctx.clip();

    // Mounting borders (装裱): outer band + inner hairline.
    ctx.strokeStyle = theme.mount;
    ctx.lineWidth = 6;
    ctx.globalAlpha = alpha * (paper ? 0.85 : 0.9);
    ctx.strokeRect(-fullW / 2 + 3, top + 3, fullW - 6, fullH - 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = paper ? GOLD_DEEP : 'rgba(230, 193, 104, 0.6)';
    ctx.strokeRect(-fullW / 2 + 12, top + 12, fullW - 24, fullH - 24);
    ctx.globalAlpha = alpha;

    // Distant blue-green mountains (青绿山水) along the lower edge.
    const ridgeBase = top + fullH - 18;
    ctx.beginPath();
    ctx.moveTo(-fullW / 2, ridgeBase);
    for (let x = -fullW / 2; x <= fullW / 2; x += 18) {
      const u = (x + fullW / 2) / fullW;
      const y = ridgeBase - 34 - Math.sin(u * Math.PI * 3.6 + 0.6) * 22 - Math.cos(u * Math.PI * 8.2) * 9 - Math.sin(u * Math.PI * 1.3) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(fullW / 2, ridgeBase);
    ctx.closePath();
    const ridge = ctx.createLinearGradient(0, ridgeBase - 80, 0, ridgeBase);
    ridge.addColorStop(0, theme.mountain[0]);
    ridge.addColorStop(1, theme.mountain[1]);
    ctx.fillStyle = ridge;
    ctx.fill();

    // Header calligraphy.
    const headerY = top + (portrait ? 54 : 40);
    const contentIn = clamp01((p - 0.08) / 0.14);
    ctx.globalAlpha = alpha * contentIn;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = paper ? '#7b7365' : GOLD;
    fitFont(ctx, eyebrow, 'normal', 13, SERIF, fullW - 120, 10);
    drawSpaced(ctx, eyebrow, 0, headerY, paper ? 4 : 2);
    ctx.fillStyle = theme.heading;
    if (paper) {
      ctx.font = `bold ${portrait ? 54 : 46}px ${SERIF}`;
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 14;
      drawSpaced(ctx, heading, 0, headerY + (portrait ? 50 : 40), portrait ? 18 : 22);
    } else {
      fitFont(ctx, heading, 'bold', portrait ? 30 : 28, SERIF, fullW - 150, 18);
      ctx.shadowColor = 'rgba(204, 66, 48, 0.7)';
      ctx.shadowBlur = 12;
      ctx.fillText(heading, 0, headerY + (portrait ? 40 : 32));
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.sub;
    fitFont(ctx, sub, 'normal', 13, SANS, fullW - 140, 10);
    drawSpaced(ctx, sub, 0, headerY + (portrait ? (paper ? 92 : 76) : paper ? 76 : 62), paper ? 3 : 1);

    // 4. Six hero plaques.
    const cols = portrait ? 3 : 6;
    const gap = portrait ? 14 : 12;
    const gridW = Math.min(fullW - (portrait ? 40 : 60), portrait ? 460 : 830);
    const cardW = (gridW - gap * (cols - 1)) / cols;
    const cardH = portrait ? 190 : 158;
    const gridTop = top + (portrait ? (paper ? 148 : 134) : paper ? 134 : 118);
    heroes.forEach((hero, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const appear = clamp01((p - (0.1 + idx * 0.04)) / 0.16);
      if (appear <= 0) return;
      const e = easeOutBack(appear);
      const x = -gridW / 2 + col * (cardW + gap);
      const y = gridTop + row * (cardH + gap) + (1 - e) * 26;
      ctx.save();
      ctx.globalAlpha = alpha * clamp01(appear * 1.6);

      roundRectPath(ctx, x, y, cardW, cardH, 6);
      ctx.fillStyle = theme.plaque;
      ctx.fill();
      ctx.strokeStyle = theme.plaqueLine;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Hero accent ribbon on top edge.
      ctx.fillStyle = hero.profile.accentHex;
      ctx.fillRect(x + 10, y, cardW - 20, 2.5);

      const mx = x + cardW / 2;
      const my = y + (portrait ? 56 : 50);
      const mr = portrait ? 33 : 29;
      drawMedallion(ctx, hero.avatar, hero.profile, mx, my, mr, theme.medalRing, theme.medalFallback, theme.medalInk);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = theme.text;
      fitFont(ctx, hero.profile.name, 'bold', 16, SERIF, cardW - 12, 11);
      ctx.fillText(hero.profile.name, mx, my + mr + 22);
      ctx.fillStyle = paper ? VERMILION : GOLD;
      fitFont(ctx, hero.profile.title, 'normal', 12, SANS, cardW - 12, 9);
      ctx.fillText(hero.profile.title, mx, my + mr + 43);
      ctx.fillStyle = theme.muted;
      fitFont(ctx, hero.profile.sceneTitle, 'normal', 10.5, SANS, cardW - 12, 8);
      ctx.fillText(hero.profile.sceneTitle, mx, my + mr + 63);

      // Staggered mini seal stamp.
      drawSeal(ctx, hero.profile.sealText, x + cardW - 20, y + 22, 30, (p - (sealAt + 0.03 + idx * 0.035)) / 0.12, 0.1);
      ctx.restore();
    });

    // Travelling gold-light sweep across the scroll.
    ctx.globalAlpha = fadeOut;
    const sweepPos = -fullW * 0.65 + clamp01((p - 0.18) / 0.6) * fullW * 1.3;
    const sweep = ctx.createLinearGradient(sweepPos - 120, 0, sweepPos + 120, 0);
    sweep.addColorStop(0, 'rgba(255, 248, 220, 0)');
    sweep.addColorStop(0.5, paper ? 'rgba(230, 193, 104, 0.18)' : 'rgba(255, 240, 185, 0.22)');
    sweep.addColorStop(1, 'rgba(255, 248, 220, 0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(left, top, scrollW, scrollH);
    ctx.restore(); // clip

    // Rollers (轴头) on the unrolling edges.
    ctx.globalAlpha = alpha;
    const rollerColor = paper ? '#6b4a2e' : '#d9b45b';
    const capColor = paper ? GOLD_DEEP : '#f5d782';
    if (portrait) {
      for (const ry of [top - 7, top + scrollH - 7]) {
        ctx.fillStyle = rollerColor;
        roundRectPath(ctx, -fullW / 2 - 12, ry, fullW + 24, 14, 7);
        ctx.fill();
        ctx.fillStyle = capColor;
        ctx.fillRect(-fullW / 2 - 18, ry + 1, 8, 12);
        ctx.fillRect(fullW / 2 + 10, ry + 1, 8, 12);
      }
    } else {
      for (const rx of [left - 7, left + scrollW - 7]) {
        ctx.fillStyle = rollerColor;
        roundRectPath(ctx, rx, top - 12, 14, scrollH + 24, 7);
        ctx.fill();
        ctx.fillStyle = capColor;
        ctx.fillRect(rx + 1, top - 18, 12, 8);
        ctx.fillRect(rx + 1, top + scrollH + 10, 12, 8);
      }
    }

    // 5. Central seal slam.
    const sealX = portrait ? fullW / 2 - 50 : fullW / 2 - 64;
    const sealY = top + (portrait ? 58 : 52);
    drawSeal(ctx, centralSeal, sealX, sealY, portrait ? 62 : 66, (p - (sealAt - 0.03)) / 0.15);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const tick = (now: number) => {
    if (disposed || !hostNode.isConnected) return;
    const elapsed = now - start;
    if (elapsed >= totalMs) {
      hostNode.remove();
      return;
    }
    render(elapsed);
    rafId = requestAnimationFrame(tick);
  };
  render(16);
  rafId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    abort.abort();
    haptics.cancel();
    cancelAnimationFrame(rafId);
    hostNode.remove();
  };
}

/** Test hook: lets unit tests replay the once-per-load title entrance. */
export function resetTitleEnsembleForTests(): void {
  titleEnsemblePlayed = false;
}
