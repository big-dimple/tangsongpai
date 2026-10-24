import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  createShadowCanvasHost,
  mountHeroEntranceBurst,
  mountTangSongEnsembleBurst,
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

function setupDomDouble() {
  const body = createMockElement('body');
  body.isConnected = true;

  const mockDoc = {
    body,
    createElement: (tag: string) => createMockElement(tag),
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const mockWin = {
    innerWidth: 960,
    innerHeight: 540,
    devicePixelRatio: 2,
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
    dom = setupDomDouble();
  });

  afterEach(() => {
    resetTitleEnsembleForTests();
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
    const stop = mountHeroEntranceBurst(dom.body as unknown as HTMLElement, 'amo', {
      context: 'qiyu',
      reducedMotion: true,
      playAudio: false,
    });
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

  it('mountTangSongEnsembleBurst mode:title plays only once per session and allows test reset', () => {
    const stop1 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      mode: 'title',
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).not.toBeNull();
    stop1();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();

    // Second call without resetTitleEnsembleForTests must be a no-op
    const stop2 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      mode: 'title',
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
    stop2();

    // After reset, title mode plays again
    resetTitleEnsembleForTests();
    const stop3 = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      mode: 'title',
      reducedMotion: false,
      playAudio: false,
    });
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).not.toBeNull();
    stop3();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
  });

  it('mountTangSongEnsembleBurst mode:character-select mounts and disposes cleanly', () => {
    const stop = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      mode: 'character-select',
      reducedMotion: false,
      playAudio: false,
    });

    const host = dom.body.querySelector('.qiyu-ensemble-burst-canvas');
    expect(host).not.toBeNull();
    expect(dom.doc.querySelectorAll('canvas').length).toBe(0);

    stop();
    expect(dom.body.querySelector('.qiyu-ensemble-burst-canvas')).toBeNull();
  });

  it('mountTangSongEnsembleBurst respects reducedMotion and does not mount', () => {
    const stop = mountTangSongEnsembleBurst(dom.body as unknown as HTMLElement, {
      mode: 'character-select',
      reducedMotion: true,
      playAudio: false,
    });
    expect(dom.body.children.length).toBe(0);
    stop();
  });
});
