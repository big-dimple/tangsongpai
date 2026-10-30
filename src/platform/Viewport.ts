import type Phaser from 'phaser';
export const FRAMEBUFFER_PIXELS=9_000_000;
const logicalSizes=new WeakMap<Phaser.Game,{width:number;height:number}>();
const sizeKey='tangsongpai-canvas-size-v1';
const sizeEvent='tangsongpai-canvas-size-change';
export type CanvasSize='auto'|'standard'|'large';
export function canvasSize():CanvasSize {try{const stored=localStorage.getItem(sizeKey);return stored==='large'||stored==='standard'?stored:'auto';}catch{return 'auto';}}
export function setCanvasSize(size:CanvasSize):void {try{localStorage.setItem(sizeKey,size);}catch{/* The setting still applies for this page. */} currentSize=size;window.dispatchEvent(new Event(sizeEvent));}
let currentSize:CanvasSize|undefined;
export function selectedCanvasSize():CanvasSize {return currentSize??canvasSize();}
/** CSS medium reflects the browser's default font size even when the page sets a root size. */
export function browserRequestsLargeText():boolean {
  if(typeof document==='undefined'||!document.body||typeof getComputedStyle==='undefined')return false;
  const probe=document.createElement('span');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;font-size:medium';document.body.append(probe);
  try{return parseFloat(getComputedStyle(probe).fontSize)>=20;}finally{probe.remove();}
}
/** The native DOM follows the user's request even where the canvas is constrained. */
export function requestsLargeText(size:CanvasSize):boolean {
  return size==='large'||size==='auto'&&browserRequestsLargeText();
}
/** Keep the reflow viewport within the smallest supported portrait layout. */
export function canvasSizeFactor(width:number,height:number,size:CanvasSize):number {
  return requestsLargeText(size)?Math.max(1,Math.min(1.2,width/320,height/568)):1;
}

/** Keep layout / input in CSS pixels while the framebuffer uses device pixels. */
export function viewportMetrics() {
  const bounds=document.getElementById('app')!.getBoundingClientRect();
  const width=Math.max(1,Math.round(bounds.width)),height=Math.max(1,Math.round(bounds.height));
  // Preserve fractional browser zoom and native 3x phone pixels, within a bounded 9 MP framebuffer (including 1080p at DPR2).
  let density=Math.min(3,window.devicePixelRatio||1,Math.sqrt(FRAMEBUFFER_PIXELS/(width*height)));
  const fits=(d:number)=>Math.max(1,Math.ceil(width*d))*Math.max(1,Math.ceil(height*d))<=FRAMEBUFFER_PIXELS;
  // Ceil is part of the real allocation. Account for its extra row/column as well.
  if(!fits(density)){let low=0,high=density;for(let i=0;i<48;i++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}density=low;}
  return {width,height,density};
}

export function installViewport(game:Phaser.Game):void {
  const host=document.getElementById('app')!;
  const syncInputBounds=()=>{
    game.scale.updateBounds();
    // updateBounds alone leaves Phaser's pointer conversion at the previous CSS size.
    const {baseSize,canvasBounds,displayScale}=game.scale;
    displayScale.set(baseSize.width/canvasBounds.width,baseSize.height/canvasBounds.height);
  };
  const resize=()=>{
    const {width,height,density}=viewportMetrics();
    const size=selectedCanvasSize();
    if(document.documentElement)document.documentElement.dataset.textSize=requestsLargeText(size)?'large':'normal';
    const backingWidth=Math.ceil(width*density),backingHeight=Math.ceil(height*density);
    const zoom=1/(density*canvasSizeFactor(width,height,size));
    logicalSizes.set(game,{width:backingWidth*zoom,height:backingHeight*zoom});
    if(game.scale.width===backingWidth&&game.scale.height===backingHeight&&game.scale.zoom===zoom){game.canvas.style.width=width+'px';game.canvas.style.height=height+'px';syncInputBounds();return;}
    game.scale.zoom=zoom;
    game.scale.resize(backingWidth,backingHeight);
    // Phaser autoRound floors backing/zoom CSS dimensions at fractional DPR.
    game.canvas.style.width=width+'px';game.canvas.style.height=height+'px';syncInputBounds();
    // Phaser emits resize before its CSS size is restored; native overlays need final bounds.
    game.scale.emit?.('resize',game.scale.gameSize,game.scale.baseSize,game.scale.displaySize);
  };
  const observer=new ResizeObserver(resize);observer.observe(host);
  window.visualViewport?.addEventListener('resize',resize);
  window.addEventListener('resize',resize);
  window.addEventListener('focus',resize);
  window.addEventListener(sizeEvent,resize);
  let media:MediaQueryList;const watchDensity=()=>{media?.removeEventListener('change',changed);media=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);media.addEventListener('change',changed);};
  const changed=()=>{resize();watchDensity();};watchDensity();
  game.events.once('destroy',()=>{observer.disconnect();window.visualViewport?.removeEventListener('resize',resize);window.removeEventListener('resize',resize);window.removeEventListener('focus',resize);window.removeEventListener(sizeEvent,resize);media.removeEventListener('change',changed);logicalSizes.delete(game);});
  resize();
}

export function cssViewport(scene:Phaser.Scene) {
  const logical=logicalSizes.get(scene.game);if(logical)return logical;
  return {width:Math.round(scene.scale.width*scene.scale.zoom),height:Math.round(scene.scale.height*scene.scale.zoom)};
}

export function alignViewportCamera(scene:Phaser.Scene):void {
  scene.cameras.main.setOrigin(0,0).setZoom(1/scene.scale.zoom).setScroll(0,0);
  // A bounded framebuffer can be smaller than CSS space; rounding must not change layout/input.
  const logical=logicalSizes.get(scene.game);if(logical&&scene.scale.zoom>1){scene.cameras.main.zoomX=scene.scale.width/logical.width;scene.cameras.main.zoomY=scene.scale.height/logical.height;}
  scene.cameras.main.roundPixels=true;
}
