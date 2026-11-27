import type Phaser from 'phaser';
import type {Box} from './layout';

/**
 * Paper stock: fibres, one lamp and soft contact shadows are painted once into cached
 * canvases, then drawn like any other static picture. Presentation only: a fixed visual
 * seed (never the rules RNG), no per-frame work, and the same pixels on WebGL and Canvas.
 */
export const PAPER_FIBER_KEY='paper-fiber';
export const PAPER_DITHER_KEY='paper-dither';
export const PAPER_SHADOW_KEY='paper-card-shadow';
export const PAPER_FIBER_SIZE=256;
export const PAPER_BAKE_PIXELS=4_000_000;
/** Largest darkening at the far corners: the dark desk falls away, paper stays accurate. */
export const LAMP_LIMIT={desk:.12,paper:.03} as const;
export type LampKind=keyof typeof LAMP_LIMIT;
/** Fibre strength on a full page, a tray inside a page, and a small live sheet. */
export const PAGE_GRAIN=.62,TRAY_GRAIN=.7,SHEET_GRAIN=.6;
/** Warm umber, in the direction of the former hard offset shadows (down and slightly right). */
export const PAPER_SHADOW={color:[52,34,18] as const,dx:1,dy:3};

const FIBER_INK=[141,122,92] as const,FIBER_LIGHT=[255,253,246] as const;
const hex=(color:number)=>'#'+color.toString(16).padStart(6,'0');
const rgba=(c:readonly number[],a:number)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** mulberry32. A view-only stream; rules, saves and shop stock never read it. */
export function paperRandom(seed:number):()=>number {
  let a=seed>>>0;
  return ()=>{a=a+0x6d2b79f5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}

export interface PaperFibre {x:number;y:number;length:number;angle:number;bend:number;width:number;alpha:number;light:boolean}
export interface PaperFleck {x:number;y:number;radius:number;alpha:number;light:boolean}
export interface PaperFibrePlan {size:number;fibres:PaperFibre[];flecks:PaperFleck[];clouds:PaperFleck[]}

/** Pure description of one seamless tile; painting and tests share it. */
export function paperFibrePlan(size=PAPER_FIBER_SIZE,seed=0x5ea1):PaperFibrePlan {
  const random=paperRandom(seed),fibres:PaperFibre[]=[],flecks:PaperFleck[]=[],clouds:PaperFleck[]=[];
  for(let i=0;i<8;i++)clouds.push({x:random()*size,y:random()*size,radius:size*(.18+random()*.16),alpha:.006+random()*.006,light:i%2===0});
  // Mostly short tooth; a few longer strands. Quiet enough to vanish at arm's length.
  for(let i=0;i<220;i++){
    const long=random()<.09,light=i%3===2;
    fibres.push({x:random()*size,y:random()*size,length:long?16+random()*20:3+random()*9,angle:random()*Math.PI,bend:(random()-.5)*(long?.6:.4),
      width:long?.6+random()*.25:.5+random()*.4,alpha:light?.10+random()*.09:.05+random()*.05,light});
  }
  for(let i=0;i<70;i++)flecks.push({x:random()*size,y:random()*size,radius:.35+random()*.55,alpha:.05+random()*.07,light:i%4===3});
  return {size,fibres,flecks,clouds};
}

/** Expected mean change of one 0–255 channel when the tile lies on a flat tone. */
export function paperFibreMeanShift(plan:PaperFibrePlan,tone:number,channel:0|1|2):number {
  const area=plan.size*plan.size;let shift=0;
  const add=(coverage:number,alpha:number,light:boolean)=>{shift+=coverage/area*alpha*((light?FIBER_LIGHT:FIBER_INK)[channel]-tone);};
  for(const f of plan.fibres)add(f.length*f.width,f.alpha,f.light);
  for(const f of plan.flecks)add(Math.PI*f.radius*f.radius,f.alpha,f.light);
  // A radial fade to zero covers one third of its disc at full strength.
  for(const c of plan.clouds)add(Math.PI*c.radius*c.radius/3,c.alpha,c.light);
  return shift;
}

type Context=CanvasRenderingContext2D;
export interface PaperPage {width:number;height:number}
export interface PaperRegion {box:Box;radius?:number}
const wraps=(value:number,reach:number,size:number)=>[0,...(value-reach<0?[size]:[]),...(value+reach>size?[-size]:[])];

export function paintPaperFibre(c:Context,plan:PaperFibrePlan):void {
  const s=plan.size;c.clearRect(0,0,s,s);
  for(const cloud of plan.clouds)for(const ox of wraps(cloud.x,cloud.radius,s))for(const oy of wraps(cloud.y,cloud.radius,s)){
    const x=cloud.x+ox,y=cloud.y+oy,g=c.createRadialGradient(x,y,0,x,y,cloud.radius),tone=cloud.light?FIBER_LIGHT:FIBER_INK;
    g.addColorStop(0,rgba(tone,cloud.alpha));g.addColorStop(1,rgba(tone,0));c.fillStyle=g;c.fillRect(x-cloud.radius,y-cloud.radius,cloud.radius*2,cloud.radius*2);
  }
  c.lineCap='round';
  for(const f of plan.fibres){
    const dx=Math.cos(f.angle)*f.length,dy=Math.sin(f.angle)*f.length;
    for(const ox of wraps(f.x,f.length,s))for(const oy of wraps(f.y,f.length,s)){
      const x=f.x+ox,y=f.y+oy;
      c.strokeStyle=rgba(f.light?FIBER_LIGHT:FIBER_INK,f.alpha);c.lineWidth=f.width;
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+dx*.5-dy*f.bend,y+dy*.5+dx*f.bend,x+dx,y+dy);c.stroke();
    }
  }
  for(const f of plan.flecks){c.fillStyle=rgba(f.light?FIBER_LIGHT:FIBER_INK,f.alpha);c.beginPath();c.arc(f.x,f.y,f.radius,0,Math.PI*2);c.fill();}
}

/** One-level noise over a dark gradient, so an 8-bit falloff never shows as bands. */
export function paintPaperDither(c:Context,size:number,seed=0xd17):void {
  const random=paperRandom(seed);c.clearRect(0,0,size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=random();if(v>.5)continue;
    c.fillStyle=v<.25?'rgba(0,0,0,.02)':'rgba(255,255,255,.008)';c.fillRect(x,y,1,1);
  }
}

const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const LAMP_CENTRE_Y=.44,LAMP_INNER=.42;
/** Darkening fraction at a normalised screen position. One lamp, slightly above centre. */
export function lampShade(kind:LampKind,u:number,v:number):number {
  const dx=(u-.5)/.5,dy=v<LAMP_CENTRE_Y?(v-LAMP_CENTRE_Y)/LAMP_CENTRE_Y:(v-LAMP_CENTRE_Y)/(1-LAMP_CENTRE_Y);
  return LAMP_LIMIT[kind]*smooth((Math.hypot(dx,dy)/Math.SQRT2-LAMP_INNER)/(1-LAMP_INNER));
}
/** The same falloff as lampShade, as four quadrant gradients on the canvas. */
function paintLamp(c:Context,page:PaperPage,kind:LampKind):void {
  const cx=page.width/2,cy=page.height*LAMP_CENTRE_Y,tone=kind==='desk'?[6,14,16]:[96,66,34];
  for(const [sx,sy,h] of [[-1,-1,cy],[1,-1,cy],[-1,1,page.height-cy],[1,1,page.height-cy]] as const){
    c.save();c.translate(cx,cy);c.scale(sx*cx,sy*h);
    const g=c.createRadialGradient(0,0,LAMP_INNER*Math.SQRT2,0,0,Math.SQRT2);
    for(let i=0;i<=6;i++)g.addColorStop(i/6,rgba(tone,LAMP_LIMIT[kind]*smooth(i/6)));
    c.fillStyle=g;c.fillRect(0,0,1,1);c.restore();
  }
}

function roundedPath(c:Context,b:Box,radius:number):void {
  const r=Math.max(0,Math.min(radius,b.width/2,b.height/2));
  c.moveTo(b.x+r,b.y);c.lineTo(b.x+b.width-r,b.y);c.quadraticCurveTo(b.x+b.width,b.y,b.x+b.width,b.y+r);c.lineTo(b.x+b.width,b.y+b.height-r);
  c.quadraticCurveTo(b.x+b.width,b.y+b.height,b.x+b.width-r,b.y+b.height);c.lineTo(b.x+r,b.y+b.height);c.quadraticCurveTo(b.x,b.y+b.height,b.x,b.y+b.height-r);
  c.lineTo(b.x,b.y+r);c.quadraticCurveTo(b.x,b.y,b.x+r,b.y);c.closePath();
}
/** Clip to an area (default: the page) with holes cut out. Holes must not overlap each other. */
function clipRegion(c:Context,page:PaperPage,area:PaperRegion|undefined,holes:readonly PaperRegion[]):void {
  if(area){c.beginPath();roundedPath(c,area.box,area.radius??0);c.clip();}
  if(holes.length){c.beginPath();c.rect(0,0,page.width,page.height);for(const hole of holes)roundedPath(c,hole.box,hole.radius??0);c.clip('evenodd');}
}

/** A soft shadow that only lands outside its own sheet; the sheet's paper is never tinted. */
export function castPaperShadow(c:Context,page:PaperPage,sheet:PaperRegion,strength=1,spread=1,within?:PaperRegion):void {
  c.save();clipRegion(c,page,within,[sheet]);
  c.shadowColor=rgba(PAPER_SHADOW.color,.3*strength);c.shadowBlur=11*spread;c.shadowOffsetX=PAPER_SHADOW.dx*spread;c.shadowOffsetY=PAPER_SHADOW.dy*spread;
  c.fillStyle='#000';c.beginPath();roundedPath(c,sheet.box,sheet.radius??0);c.fill();c.restore();
}

interface TextureHost {textures:{createCanvas(key:string,width:number,height:number):unknown}}
const canPaint=(scene:Phaser.Scene):boolean=>typeof (scene as unknown as Partial<TextureHost>).textures?.createCanvas==='function';
/** Whether static sheets can be painted here (false in headless unit fixtures). */
export const paperStockAvailable=canPaint;

function ensureTile(scene:Phaser.Scene,key:string,size:number,paint:(c:Context)=>void):HTMLCanvasElement|undefined {
  if(!canPaint(scene))return;
  if(!scene.textures.exists(key)){
    const texture=scene.textures.createCanvas(key,size,size);if(!texture)return;
    paint(texture.getContext());texture.refresh();
  }
  const source=scene.textures.get(key).getSourceImage();
  return typeof (source as HTMLCanvasElement).getContext==='function'?source as HTMLCanvasElement:undefined;
}
/** The shared fibre tile. Created at most once per game, outside any score presentation. */
export function ensurePaperFibre(scene:Phaser.Scene):HTMLCanvasElement|undefined {
  return ensureTile(scene,PAPER_FIBER_KEY,PAPER_FIBER_SIZE,c=>paintPaperFibre(c,paperFibrePlan()));
}
const ensurePaperDither=(scene:Phaser.Scene)=>ensureTile(scene,PAPER_DITHER_KEY,64,c=>paintPaperDither(c,64));

/** Native dialogs, the cover entry and the phone shelf reuse the very same tile. */
export function publishPaperGrain(scene:Phaser.Scene):void {
  if(typeof document==='undefined')return;
  const tile=ensurePaperFibre(scene);if(!tile||typeof tile.toDataURL!=='function')return;
  try{document.documentElement.style.setProperty('--paper-grain',`url(${tile.toDataURL('image/png')})`);}catch{/* Flat paper remains complete. */}
}

/** One tile texel is one CSS pixel on ordinary screens and half a CSS pixel on dense ones. */
export const paperGrainScale=(density:number):number=>density>=2?.5:1;
/**
 * Lay fibres over what is already painted. The context is in CSS pixels (scaled by the
 * bake density); only already-opaque pixels inside the area and outside the holes change.
 */
export function paintPaperGrain(scene:Phaser.Scene,c:Context,page:PaperPage,density:number,strength:number,area?:PaperRegion,holes:readonly PaperRegion[]=[]):void {
  const tile=strength>0?ensurePaperFibre(scene):undefined;if(!tile)return;
  const pattern=c.createPattern(tile,'repeat');if(!pattern)return;
  if(typeof pattern.setTransform==='function'&&typeof DOMMatrix!=='undefined')pattern.setTransform(new DOMMatrix().scale(paperGrainScale(density)));
  c.save();clipRegion(c,page,area,holes);
  c.globalCompositeOperation='source-atop';c.globalAlpha=Math.min(1,strength);c.fillStyle=pattern;c.fillRect(0,0,page.width,page.height);c.restore();
}
/** The lamp over a region: strong on the dark desk, barely there on paper. */
export function paintPaperLamp(scene:Phaser.Scene,c:Context,page:PaperPage,kind:LampKind,area?:PaperRegion,holes:readonly PaperRegion[]=[]):void {
  c.save();clipRegion(c,page,area,holes);
  c.globalCompositeOperation='source-atop';paintLamp(c,page,kind);
  const dither=kind==='desk'?ensurePaperDither(scene):undefined,pattern=dither?c.createPattern(dither,'repeat'):null;
  if(pattern){c.fillStyle=pattern;c.fillRect(0,0,page.width,page.height);}
  c.restore();
}

export function paperBakeDensity(width:number,height:number,zoom:number):number {
  return Math.max(.25,Math.min(2,1/zoom,4096/width,4096/height,Math.sqrt(PAPER_BAKE_PIXELS/(width*height))));
}

interface Bake {signature:string;key:string}
const bakes=new WeakMap<Phaser.Scene,Map<string,Bake>>();
let serial=0;
function bakeSlots(scene:Phaser.Scene):Map<string,Bake> {
  let slots=bakes.get(scene);
  if(!slots){
    const created=slots=new Map<string,Bake>();bakes.set(scene,created);
    // Scenes are reused; their pictures are not kept across a shutdown.
    scene.events?.once?.('shutdown',()=>{for(const bake of created.values())if(scene.textures.exists(bake.key))scene.textures.remove(bake.key);bakes.delete(scene);});
  }
  return slots;
}
/** Identical layouts reuse one texture per slot; a changed layout replaces it. */
function bakeLookup(scene:Phaser.Scene,slot:string,signature:string):string|undefined {
  const known=bakes.get(scene)?.get(slot);return known&&known.signature===signature&&scene.textures.exists(known.key)?known.key:undefined;
}
function bakeAdopt(scene:Phaser.Scene,slot:string,signature:string,key:string):void {
  const slots=bakeSlots(scene),known=slots.get(slot);
  if(known&&known.key!==key&&scene.textures.exists(known.key))scene.textures.remove(known.key);
  slots.set(slot,{signature,key});
}

/**
 * A static sheet is neither card art nor print. Naming its type keeps the ink, particle
 * and atmosphere guards (which protect Image/Text) treating it like the flat fill it replaces.
 */
export function asPaperSheet<T extends Phaser.GameObjects.Image>(image:T):T {image.type='PaperSheet';return image;}

export interface PaperPageSpec {slot:string;width:number;height:number;base:number;lamp:LampKind|'none';grain:number}
/** A whole plain page: base tone, fibres and the lamp, as one opaque picture. */
export function bakedPaper(scene:Phaser.Scene,spec:PaperPageSpec):Phaser.GameObjects.Image|undefined {
  if(!canPaint(scene)||typeof scene.add?.image!=='function'||!(spec.width>0)||!(spec.height>0))return;
  const density=paperBakeDensity(spec.width,spec.height,scene.scale?.zoom??1),signature=JSON.stringify([spec,density]);
  let key=bakeLookup(scene,spec.slot,signature);
  if(!key){
    const texture=scene.textures.createCanvas('paper-bake/'+spec.slot+'/'+(++serial),Math.ceil(spec.width*density),Math.ceil(spec.height*density));if(!texture)return;
    const c=texture.getContext(),page={width:spec.width,height:spec.height};
    c.save();c.scale(density,density);c.fillStyle=hex(spec.base);c.fillRect(0,0,page.width,page.height);
    paintPaperGrain(scene,c,page,density,spec.grain);
    if(spec.lamp!=='none')paintPaperLamp(scene,c,page,spec.lamp);
    c.restore();texture.refresh();key=texture.key;bakeAdopt(scene,spec.slot,signature,key);
  }
  return asPaperSheet(scene.add.image(0,0,key).setOrigin(0).setScale(1/density).setName('paper/'+spec.slot));
}

export interface PaperRaster {slot:string;width:number;height:number;signature:unknown;
  /** Runs once per new layout, in CSS pixels, over the freshly rasterized page. */
  finish?:(c:Context,page:PaperPage,density:number)=>void;
  /** The Graphics it replaces was invisible to the art/print guards; keep it so. */
  sheet?:boolean}
/**
 * Rasterize a finished page Graphics once and reuse it while the layout is unchanged.
 * Returns undefined (and leaves the Graphics untouched) where canvases are unavailable.
 */
export function rasterizePaper(scene:Phaser.Scene,graphics:Phaser.GameObjects.Graphics,raster:PaperRaster):Phaser.GameObjects.Image|undefined {
  if(!canPaint(scene)||typeof graphics.generateTexture!=='function'||typeof scene.add?.image!=='function'||!(raster.width>0)||!(raster.height>0))return;
  const density=paperBakeDensity(raster.width,raster.height,scene.scale?.zoom??1),signature=JSON.stringify([raster.signature,raster.width,raster.height,density]);
  let key=bakeLookup(scene,raster.slot,signature);
  if(!key){
    key='paper-bake/'+raster.slot+'/'+(++serial);
    // Canvas keeps the rounded edges antialiased, including WebGL1 devices.
    graphics.setScale(density).generateTexture(key,Math.ceil(raster.width*density),Math.ceil(raster.height*density));
    const texture=scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    if(raster.finish&&typeof texture.getContext==='function'){
      const c=texture.getContext();c.save();c.scale(density,density);raster.finish(c,{width:raster.width,height:raster.height},density);c.restore();texture.refresh();
    }
    bakeAdopt(scene,raster.slot,signature,key);
  }
  const image=scene.add.image(0,0,key).setOrigin(0).setScale(1/density).setName(graphics.name).setData('bounds',graphics.getData('bounds'));
  graphics.destroy();return raster.sheet?asPaperSheet(image):image;
}

/** Fibres on a small live sheet (phone trays, shop tiles, receipts): one textured quad. */
export function paperGrainSprite(scene:Phaser.Scene,b:Box,alpha:number):Phaser.GameObjects.TileSprite|undefined {
  if(b.width<=0||b.height<=0||typeof scene.add?.tileSprite!=='function'||!ensurePaperFibre(scene))return;
  const scale=paperGrainScale(Math.max(1,1/(scene.scale?.zoom??1)));
  const sprite=scene.add.tileSprite(b.x,b.y,b.width,b.height,PAPER_FIBER_KEY).setOrigin(0).setAlpha(alpha);
  sprite.setTileScale?.(scale,scale);return sprite;
}

/** Proportions of the shared card shadow: a 96×134 card inside a 128×176 picture. */
export const CARD_SHADOW={width:128,height:176,cardWidth:96,cardHeight:134} as const;
export function ensureCardShadow(scene:Phaser.Scene):boolean {
  if(!canPaint(scene))return false;
  if(scene.textures.exists(PAPER_SHADOW_KEY))return true;
  const texture=scene.textures.createCanvas(PAPER_SHADOW_KEY,CARD_SHADOW.width,CARD_SHADOW.height);if(!texture)return false;
  const c=texture.getContext(),x=(CARD_SHADOW.width-CARD_SHADOW.cardWidth)/2,y=(CARD_SHADOW.height-CARD_SHADOW.cardHeight)/2,far=4096;
  // Paint the card far outside the picture; only its offset shadow lands inside.
  c.shadowColor=rgba(PAPER_SHADOW.color,.24);c.shadowBlur=8;c.shadowOffsetX=far+PAPER_SHADOW.dx*1.5;c.shadowOffsetY=PAPER_SHADOW.dy*1.5;
  c.fillStyle='#000';c.beginPath();roundedPath(c,{x:x-far,y,width:CARD_SHADOW.cardWidth,height:CARD_SHADOW.cardHeight},7);c.fill();
  texture.refresh();return true;
}
/** One soft picture under a card of any size. Like the fill it replaces it has no measured bounds. */
export function cardShadow(scene:Phaser.Scene,width:number,height:number):Phaser.GameObjects.Image|undefined {
  if(typeof scene.add?.image!=='function'||!ensureCardShadow(scene))return;
  const image=asPaperSheet(scene.add.image(0,0,PAPER_SHADOW_KEY).setName('card/shadow'));
  image.setDisplaySize(width*CARD_SHADOW.width/CARD_SHADOW.cardWidth,height*CARD_SHADOW.height/CARD_SHADOW.cardHeight);
  // Containers measure children through getBounds; the former Graphics shadow had none.
  Object.defineProperty(image,'getBounds',{value:undefined,configurable:true});
  return image;
}
