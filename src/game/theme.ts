/** D44 shared ink / paper language. New character artwork is supplied separately. */
export const PAPER_THEME = {
  paper: 0xf3eadb,
  paperLight: 0xfff9ee,
  paperEdge: 0xe2d2b8,
  ink: 0x26313a,
  mutedInk: 0x59646a,
  jade: 0x3f606b,
  jadeSoft: 0xe2e8e5,
  red: 0xb8473a,
  redSoft: 0xf0d3c7,
  brass: 0x7b7365,
  divider: 0xc7b89d,
  shadow: 0x26313a,
  disabled: 0xd8d1c3,
  disabledInk: 0x595b59,
  focus: 0x3f606b,
} as const;

export const PAPER_CSS = Object.fromEntries(
  Object.entries(PAPER_THEME).map(([name, value]) => [name, `#${value.toString(16).padStart(6, '0')}`]),
) as { readonly [K in keyof typeof PAPER_THEME]: string };

export const ATELIER_THEME = {
  void: 0x0a181c,
  lacquer: 0x11262c,
  panel: 0x163036,
  panelRaised: 0x1d3c42,
  panelInset: 0x0d2025,
  felt: 0x183d37,
  gold: 0xd8b46c,
  goldSoft: 0x8c764c,
  goldBright: 0xf5deb0,
  ivory: 0xf6efe0,
  ink: 0xf6efe0,
  mist: 0xb8cdc6,
  muted: 0x8ea6a0,
  celadon: 0x6bc2b4,
  cinnabar: 0xb84234,
  cinnabarHi: 0xd45847,
  cinnabarSoft: 0xf4a08e,
  cardIvory: 0xfcf6e8,
  disabledBg: 0x13262b,
  disabledInk: 0x6a807e,
} as const;

export const ATELIER_CSS = Object.fromEntries(
  Object.entries(ATELIER_THEME).map(([name, value]) => [name, `#${value.toString(16).padStart(6, '0')}`]),
) as { readonly [K in keyof typeof ATELIER_THEME]: string };

export const SCORE_FONT = '"Tangsongpai Score", "Tangsongpai Latin", "Arial Narrow", "Roboto Condensed", sans-serif';
export const DISPLAY_FONT = '"Tangsongpai XiaoWei", "Tangsongpai Latin", "PingFang SC", "Hiragino Sans GB", "HarmonyOS Sans SC", "MiSans", "Noto Sans SC", "Microsoft YaHei", sans-serif';
export const UI_FONT = '"PingFang SC", "Hiragino Sans GB", "HarmonyOS Sans SC", "MiSans", "Noto Sans SC", "Microsoft YaHei", sans-serif';

/** Small procedural borders, not generated character pictures; no gradients or baked text. */
const inkSvg=(body:string)=>'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336">${body}</svg>`);
const frameSvg=(color:string,extra='')=>inkSvg(`<rect x="3" y="3" width="234" height="330" rx="9" fill="none" stroke="${color}" stroke-width="1.5"/><path d="M9 29V10l19-1M212 327l19-1v-19" fill="none" stroke="${color}" stroke-width=".7" opacity=".45"/>${extra}`);
export const INK_FRAME_PATHS={
  common:frameSvg('#8ea6a0'),
  uncommon:frameSvg('#6bc2b4','<path d="m120 5 5 5-5 5-5-5Z" fill="#6bc2b4"/>'),
  rare:frameSvg('#d8b46c','<path d="m120 5 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#d8b46c"/>'),
  back:inkSvg('<rect x="3" y="3" width="234" height="330" rx="9" fill="#142f36" stroke="#d8b46c" stroke-width="1.5"/><path d="M12 24V12h20M208 324h20v-12M120 84l65 84-65 84-65-84Z" fill="none" stroke="#d8b46c" stroke-width="1.8" opacity=".8"/><path d="M87 178c4-45 23-66 33-69 10 3 29 24 33 69Z" fill="#b84234"/><path d="M79 187h82M103 202h34" fill="none" stroke="#f5deb0" stroke-width="2.5"/>'),
} as const;
export const P00_ASSETS = [
  { key: 'p00-paper', path: 'assets/p00/paper.svg', width: 640, height: 640 },
  { key: 'p00-card-back', path: INK_FRAME_PATHS.back, width: 240, height: 336 },
  { key: 'p00-frame-common', path: INK_FRAME_PATHS.common, width: 240, height: 336 },
  { key: 'p00-frame-uncommon', path: INK_FRAME_PATHS.uncommon, width: 240, height: 336 },
  { key: 'p00-frame-rare', path: INK_FRAME_PATHS.rare, width: 240, height: 336 },
  { key: 'p00-mark-joker', path: 'assets/p00/mark-joker.svg', width: 96, height: 96 },
  { key: 'p00-mark-plus', path: 'assets/p00/mark-plus.svg', width: 96, height: 96 },
  { key: 'p00-mark-times', path: 'assets/p00/mark-times.svg', width: 96, height: 96 },
] as const;

export function assetUrl(path: string): string {
  if(path.startsWith('data:'))return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
