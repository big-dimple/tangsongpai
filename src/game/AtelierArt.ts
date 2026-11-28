import type Phaser from 'phaser';
import type {Box} from './layout';
import {asPaperSheet,paperBakeDensity,paintInkSeep,paperStockAvailable,paperRandom} from './PaperStock';

/**
 * Shared dark celadon-lacquer & warm-lantern painter.
 * Pure presentation layer: deterministic visual seed, baked once per layout/scene and freed
 * on shutdown, identical pixels across WebGL and Canvas 2D, and zero per-frame work.
 */
type Context=CanvasRenderingContext2D;

const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const rgba=(c:readonly [number,number,number],a:number)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

function roundedPath(c:Context,b:Box,radius:number):void {
  const r=Math.max(0,Math.min(radius,b.width/2,b.height/2));
  c.beginPath();
  c.moveTo(b.x+r,b.y);c.lineTo(b.x+b.width-r,b.y);
  c.quadraticCurveTo(b.x+b.width,b.y,b.x+b.width,b.y+r);
  c.lineTo(b.x+b.width,b.y+b.height-r);
  c.quadraticCurveTo(b.x+b.width,b.y+b.height,b.x+b.width-r,b.y+b.height);
  c.lineTo(b.x+r,b.y+b.height);
  c.quadraticCurveTo(b.x,b.y+b.height,b.x,b.y+b.height-r);
  c.lineTo(b.x,b.y+r);
  c.quadraticCurveTo(b.x,b.y,b.x+r,b.y);
  c.closePath();
}

export type LacquerVariant='panel'|'raised'|'inset'|'score';

/** Paint a deep celadon-lacquer surface with top silk sheen, antique-gold border and optional corner inlay. */
export function paintLacquerPanel(
  c:Context,
  box:Box,
  radius=5,
  variant:LacquerVariant='panel',
  options?:{corners?:boolean;shadow?:boolean;accentBar?:'gold'|'cinnabar'},
):void {
  if(box.width<=0||box.height<=0)return;
  c.save();
  if(options?.shadow!==false&&variant!=='inset'){
    c.save();
    c.shadowColor='rgba(4,10,13,0.48)';
    c.shadowBlur=variant==='raised'?14:10;
    c.shadowOffsetX=0;
    c.shadowOffsetY=variant==='raised'?4:2;
    roundedPath(c,box,radius);
    c.fillStyle='#0a171c';
    c.fill();
    c.restore();
  }
  const palette={
    panel:{top:'#18363d',mid:'#122a30',bot:'#0e2126',edge:'rgba(216,180,108,0.46)',hi:'rgba(245,222,176,0.14)'},
    raised:{top:'#20454d',mid:'#17353c',bot:'#122a30',edge:'rgba(226,192,122,0.58)',hi:'rgba(245,222,176,0.20)'},
    inset:{top:'#0c1e23',mid:'#0f242a',bot:'#0b1a1f',edge:'rgba(200,164,98,0.32)',hi:'rgba(154,208,196,0.08)'},
    score:{top:'#153238',mid:'#10262c',bot:'#0b1c21',edge:'rgba(216,180,108,0.54)',hi:'rgba(245,222,176,0.18)'},
  }[variant];
  const grad=c.createLinearGradient(box.x,box.y,box.x,box.y+box.height);
  grad.addColorStop(0,palette.top);
  grad.addColorStop(.52,palette.mid);
  grad.addColorStop(1,palette.bot);
  roundedPath(c,box,radius);
  c.fillStyle=grad;
  c.fill();

  c.save();
  c.clip();
  // Subtle top silk rim highlight
  const sheen=c.createLinearGradient(box.x,box.y,box.x+box.width,box.y);
  sheen.addColorStop(0,'rgba(245,222,176,0)');
  sheen.addColorStop(.2,palette.hi);
  sheen.addColorStop(.8,palette.hi);
  sheen.addColorStop(1,'rgba(245,222,176,0)');
  c.fillStyle=sheen;
  c.fillRect(box.x+1,box.y,Math.max(0,box.width-2),1.5);

  if(options?.accentBar){
    c.fillStyle=options.accentBar==='cinnabar'?'#c94b3b':'#d8b46c';
    c.fillRect(box.x+14,box.y,Math.min(48,Math.max(20,box.width*.2)),2.5);
  }
  c.restore();

  // Outer antique-gold stroke
  c.strokeStyle=palette.edge;
  c.lineWidth=1;
  roundedPath(c,{x:box.x+.5,y:box.y+.5,width:Math.max(0,box.width-1),height:Math.max(0,box.height-1)},Math.max(0,radius-.5));
  c.stroke();

  if(options?.corners&&box.width>=48&&box.height>=48){
    const inset=5,arm=Math.min(12,box.width*.12,box.height*.12);
    c.strokeStyle='rgba(216,180,108,0.34)';
    c.lineWidth=1;
    c.beginPath();
    c.moveTo(box.x+inset+arm,box.y+inset);c.lineTo(box.x+inset,box.y+inset);c.lineTo(box.x+inset,box.y+inset+arm);
    c.moveTo(box.x+box.width-inset-arm,box.y+box.height-inset);c.lineTo(box.x+box.width-inset,box.y+box.height-inset);c.lineTo(box.x+box.width-inset,box.y+box.height-inset-arm);
    c.stroke();
  }
  c.restore();
}

/** Soft warm lantern bloom behind featured hero portraits on dark lacquer surfaces. */
export function paintLanternHalo(c:Context,cx:number,cy:number,rx:number,ry:number,alpha=1):void {
  if(rx<=0||ry<=0)return;
  c.save();
  c.translate(cx,cy);
  c.scale(1,ry/rx);
  const g=c.createRadialGradient(0,0,0,0,0,rx);
  g.addColorStop(0,`rgba(246,206,134,${.18*alpha})`);
  g.addColorStop(.45,`rgba(196,158,92,${.09*alpha})`);
  g.addColorStop(.78,`rgba(107,194,180,${.04*alpha})`);
  g.addColorStop(1,'rgba(16,38,44,0)');
  c.fillStyle=g;
  c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();
  c.strokeStyle=`rgba(216,180,108,${.28*alpha})`;
  c.lineWidth=1;
  c.beginPath();c.arc(0,0,rx*.76,0,Math.PI*2);c.stroke();
  c.restore();
}

/** Deep twilight celadon lacquer backdrop with subtle warm lantern pool, corner vignette & silk weave. */
export function paintAtelierBackdrop(
  c:Context,
  page:{width:number;height:number},
  options?:{finale?:boolean;holes?:readonly {box:Box;radius?:number}[]},
):void {
  const {width,height}=page;
  if(width<=0||height<=0)return;
  c.save();
  const base=c.createLinearGradient(0,0,0,height);
  base.addColorStop(0,'#0c1e24');
  base.addColorStop(.45,'#132b32');
  base.addColorStop(1,'#0a181c');
  c.fillStyle=base;
  c.fillRect(0,0,width,height);

  // Subtle diagonal silk sheen
  const random=paperRandom(0xa7e1);
  c.fillStyle='rgba(255,246,220,0.012)';
  for(let i=0;i<60;i++){
    const x=random()*width,y=random()*height,w=24+random()*90;
    c.fillRect(x,y,w,1);
  }

  // Warm lantern pool slightly above center
  const cx=width*.5,cy=height*.42,r=Math.max(width,height)*.72;
  const pool=c.createRadialGradient(cx,cy,0,cx,cy,r);
  pool.addColorStop(0,'rgba(242,202,130,0.095)');
  pool.addColorStop(.45,'rgba(110,180,168,0.045)');
  pool.addColorStop(1,'rgba(10,24,28,0)');
  c.fillStyle=pool;
  c.fillRect(0,0,width,height);

  // Corner vignette
  const vig=c.createRadialGradient(cx,cy,Math.min(width,height)*.26,cx,cy,Math.hypot(width,height)*.62);
  vig.addColorStop(0,'rgba(4,10,13,0)');
  vig.addColorStop(.65,'rgba(4,10,13,0.18)');
  vig.addColorStop(1,'rgba(3,8,11,0.44)');
  c.fillStyle=vig;
  c.fillRect(0,0,width,height);

  if(options?.finale)paintInkSeep(c,page,options.holes??[]);
  c.restore();
}

const atelierBakes=new WeakMap<Phaser.Scene,Map<string,{signature:string;key:string}>>();
let atelierSerial=0;

function getSlots(scene:Phaser.Scene):Map<string,{signature:string;key:string}> {
  let slots=atelierBakes.get(scene);
  if(!slots){
    slots=new Map();atelierBakes.set(scene,slots);
    scene.events?.once?.('shutdown',()=>{
      for(const bake of slots!.values())if(scene.textures.exists(bake.key))scene.textures.remove(bake.key);
      atelierBakes.delete(scene);
    });
  }
  return slots;
}

/** Bake and cache a whole deep-lacquer page backdrop once per layout. */
export function bakedAtelierBackdrop(
  scene:Phaser.Scene,
  slot:string,
  width:number,
  height:number,
  finale=false,
):Phaser.GameObjects.Image|undefined {
  if(!paperStockAvailable(scene)||typeof scene.add?.image!=='function'||!(width>0)||!(height>0))return;
  const density=paperBakeDensity(width,height,scene.scale?.zoom??1);
  const signature=JSON.stringify([slot,width,height,density,finale]);
  const slots=getSlots(scene);
  const known=slots.get(slot);
  let key=known&&known.signature===signature&&scene.textures.exists(known.key)?known.key:undefined;
  if(!key){
    const tex=scene.textures.createCanvas(`atelier-bake/${slot}/${++atelierSerial}`,Math.ceil(width*density),Math.ceil(height*density));
    if(!tex)return;
    const c=tex.getContext();
    c.save();c.scale(density,density);
    paintAtelierBackdrop(c,{width,height},{finale});
    c.restore();tex.refresh();
    key=tex.key;
    if(known&&known.key!==key&&scene.textures.exists(known.key))scene.textures.remove(known.key);
    slots.set(slot,{signature,key});
  }
  return asPaperSheet(scene.add.image(0,0,key).setOrigin(0).setScale(1/density).setName('atelier/'+slot));
}

export {smooth,rgba,roundedPath};
