import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createShadowCanvasHost,
  mountHeroEntranceBurst,
  mountTangSongEnsembleBurst,
  resetHeroEntranceForNewRun,
  resetTitleEnsembleForTests,
} from '../src/game/TangSongEntranceBurst';

interface MockNode {
  className: string;
  tagName: string;
  children: MockNode[];
  style: Record<string, string>;
  attributes: Record<string, string>;
  shadowRoot: MockNode | null;
  isConnected: boolean;
  parentNode: MockNode | null;
  append(...nodes: MockNode[]): void;
  remove(): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  attachShadow(init: {mode: string}): MockNode;
  querySelector(selector: string): MockNode | null;
  querySelectorAll(selector: string): MockNode[];
  getBoundingClientRect(): {width: number; height: number; left: number; top: number};
  getContext?(kind: string): unknown;
}

function createMockElement(tagName: string): MockNode {
  const children: MockNode[] = [];
  const attributes: Record<string, string> = {};
  const style: Record<string, string> = {};
  let shadowRoot: MockNode | null = null;
  let isConnected = false;
  let parentNode: MockNode | null = null;

  const node: MockNode = {
    tagName: tagName.toUpperCase(),
    className: '',
    children,
    style,
    attributes,
    get isConnected() {
      return isConnected || (parentNode ? parentNode.isConnected : false);
    },
    set isConnected(v: boolean) {
      isConnected = v;
    },
    get parentNode() {
      return parentNode;
    },
    set parentNode(p: MockNode | null) {
      parentNode = p;
    },
    get shadowRoot() {
      return shadowRoot;
    },
    set shadowRoot(s: MockNode | null) {
      shadowRoot = s;
    },
    append(...newNodes: MockNode[]) {
      for (const n of newNodes) {
        n.parentNode = node;
        children.push(n);
      }
    },
    remove() {
      if (parentNode) {
        const idx = parentNode.children.indexOf(node);
        if (idx >= 0) parentNode.children.splice(idx, 1);
        parentNode = null;
      }
    },
    setAttribute(k: string, v: string) {
      attributes[k] = v;
      if (k === 'class') node.className = v;
    },
    getAttribute(k: string) {
      return attributes[k] ?? null;
    },
    attachShadow(_init: {mode: string}) {
      const shadow = createMockElement('shadow-root');
      shadow.parentNode = node;
      shadowRoot = shadow;
      return shadow;
    },
    querySelector(selector: string): MockNode | null {
      return node.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector: string): MockNode[] {
      const matches: MockNode[] = [];
      const check = (candidate: MockNode) => {
        // Light DOM traversal: only visit children, never pierce shadowRoot
        for (const child of candidate.children) {
          if (selector === 'canvas' && child.tagName === 'CANVAS') {
            matches.push(child);
          } else if (selector.startsWith('.') && child.className.split(/\s+/).includes(selector.slice(1))) {
            matches.push(child);
          }
          check(child);
        }
      };
      check(node);
      return matches;
    },
    getBoundingClientRect() {
      return {width: 960, height: 540, left: 0, top: 0};
    },
  };

  if (tagName.toLowerCase() === 'canvas') {
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: () => ({addColorStop: vi.fn()}),
      createLinearGradient: () => ({addColorStop: vi.fn()}),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      measureText: (txt: string) => ({width: txt.length * 12}),
      fillText: vi.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
    };
    node.getContext = () => ctx;
  }

  return node;
}

function setupDomDouble(width=960,height=540,dpr=2) {
  const body = createMockElement('body');
  body.isConnected = true;

  const mockDoc = {
    body,
    createElement: (tag: string) => {const node=createMockElement(tag);node.getBoundingClientRect=()=>({width,height,left:0,top:0});return node;},
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const mockWin = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
    matchMedia: () => ({matches: false}),
    requestAnimationFrame: vi.fn((_cb: FrameRequestCallback) => 1),
    cancelAnimationFrame: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('document', mockDoc);
  vi.stubGlobal('window', mockWin);
  vi.stubGlobal('requestAnimationFrame', mockWin.requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', mockWin.cancelAnimationFrame);
  return {body, doc: mockDoc, win: mockWin};
}

describe('TangSongEntranceBurst presentation and shadow isolation', () => {
  let dom: ReturnType<typeof setupDomDouble>;

  beforeEach(() => {
    resetTitleEnsembleForTests();
    resetHeroEntranceForNewRun();
    dom = setupDomDouble();
  });

  afterEach(() => {
    resetTitleEnsembleForTests();
    resetHeroEntranceForNewRun();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('createShadowCanvasHost encapsulates decorative canvas inside a closed shadow root', () => {
    const shadowHost = createShadowCanvasHost('test-shadow-host', 960, 540, true);
    expect(shadowHost).not.toBeNull();
    if (!shadowHost) return;

    const {hostNode, canvas, ctx} = shadowHost;
    expect(hostNode.className).toBe('test-shadow-host');
    expect(hostNode.getAttribute('aria-hidden')).toBe('true');
    expect(hostNode.style.pointerEvents).toBe('none');
    expect(canvas.width).toBe(960);
    expect(canvas.height).toBe(540);
    expect(ctx).toBeDefined();

    dom.body.append(hostNode as unknown as MockNode);

    // Light DOM queries (and Playwright page.locator('canvas')) must NOT see this decorative canvas
    expect(dom.doc.querySelectorAll('canvas').length).toBe(0);
    expect(dom.doc.querySelector('canvas')).toBeNull();

    // The host node itself is found in light DOM
    expect(dom.doc.querySelector('.test-shadow-host')).toBe(hostNode);

    hostNode.remove();
    expect(dom.doc.querySelector('.test-shadow-host')).toBeNull();
  });

  it('mountHeroEntranceBurst respects reducedMotion and does not mount', () => {
    const onShown=vi.fn();
    const stop = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'amo', {
      context: 'qiyu',
      reducedMotion: true,
      playAudio: false,
      onShown,
    });
    expect(onShown).not.toHaveBeenCalled();
    expect(dom.body.children.length).toBe(0);
    stop();
    expect(dom.body.children.length).toBe(0);
  });

  it('mountHeroEntranceBurst mounts decorative host and disposes cleanly', () => {
    const stop = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'laohuan', {
      context: 'select',
      reducedMotion: false,
      playAudio: false,
    });

    const host = dom.body.querySelector('.qiyu-entrance-burst-canvas');
    expect(host).not.toBeNull();
    // Canvas is isolated inside shadow root
    expect(dom.doc.querySelectorAll('canvas').length).toBe(0);

    stop();
    expect(dom.body.querySelector('.qiyu-entrance-burst-canvas')).toBeNull();
  });

  it.each([1,2,3])('renders the phone entrance at physical pixel density %i without an input surface', dpr => {
    dom=setupDomDouble(390,844,dpr);
    const stop=mountHeroEntranceBurst(dom.body as unknown as HTMLElement,'amo',{context:'stage',playAudio:false});
    const host=dom.body.querySelector('.qiyu-entrance-burst-canvas')!;
    const canvas=host.shadowRoot!.children.find(node=>node.tagName==='CANVAS') as MockNode & {width:number;height:number};
    expect(canvas.width).toBe(390*dpr);expect(canvas.height).toBe(844*dpr);expect(host.style.pointerEvents).toBe('none');
    stop();expect(dom.body.querySelector('.qiyu-entrance-burst-canvas')).toBeNull();
  });

  it('mountHeroEntranceBurst rearms for a new run without replaying the ensemble', () => {
    const onShown=vi.fn();
    const first = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'amo', {
      context: 'stage',
      reducedMotion: false,
      playAudio: false,
      onShown,
    });
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(dom.body.querySelector('.qiyu-entrance-burst-canvas')).not.toBeNull();
    first();

    for (const context of ['shop', 'boss', 'qiyu'] as const) {
      const skip = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'amo', {
        context,
        reducedMotion: false,
        playAudio: false,
        onShown,
      });
      expect(dom.body.querySelector('.qiyu-entrance-burst-canvas')).toBeNull();
      skip();
    }
    expect(onShown).toHaveBeenCalledTimes(1);

    resetHeroEntranceForNewRun();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();

    const nextRun = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'laohuan', {
      context: 'stage',
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-entrance-burst-canvas')).not.toBeNull();
    nextRun();
  });

  it('mountTangSongEnsembleBurst plays only once per page load and allows test reset', () => {
    const stop1 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).not.toBeNull();
    stop1();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();

    // Second call without resetTitleEnsembleForTests must be a no-op
    const stop2 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
    stop2();

    // After reset, a fresh page load can play the opening again.
    resetTitleEnsembleForTests();
    const stop3 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).not.toBeNull();
    stop3();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
  });

  it('holds the complete cast for an extra second and removes the opening at 2600ms', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const stop = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      reducedMotion: false,
      playAudio: false,
    });

    const host = dom.body.querySelector('.qiyu-ensemble-burst-canvas');
    expect(host).not.toBeNull();
    expect(dom.doc.querySelectorAll('canvas').length).toBe(0);

    const ctx = host!.shadowRoot!.querySelector('canvas')!.getContext!('2d') as {
      fillText: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };
    const frame = (now: number) => dom.win.requestAnimationFrame.mock.calls.at(-1)![0](now);
    ctx.fillText.mockClear();
    ctx.translate.mockClear();
    frame(1300);
    const heldText = ctx.fillText.mock.calls.slice();
    const heldPositions = ctx.translate.mock.calls.slice();
    expect(heldText.map(call => call[0])).toEqual(expect.arrayContaining(['苏轼', '辛弃疾', '刘娥', '文成公主', '花蕊夫人', '秦琼']));
    ctx.fillText.mockClear();
    ctx.translate.mockClear();
    frame(2200);
    expect(ctx.fillText.mock.calls).toEqual(heldText);
    expect(ctx.translate.mock.calls).toEqual(heldPositions);
    ctx.translate.mockClear();
    frame(2400);
    expect(ctx.translate.mock.calls).not.toEqual(heldPositions);
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBe(host);
    frame(2600);
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
    stop();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
  });

  it('mountTangSongEnsembleBurst respects reducedMotion and does not mount', () => {
    const stop = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      reducedMotion: true,
      playAudio: false,
    });
    expect(dom.body.children.length).toBe(0);
    stop();
  });
});
