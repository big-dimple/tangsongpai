import type Phaser from 'phaser';
import type {InkBox,InkPoint} from './AssistInkGeometry';
import preset from './presets/lempo-sword-slash.json';

// Lempo-FX@755ec9a3, Sword Slash parameters, MIT (c) 2026 EG dev.
// Source and platform adaptation: docs/production/evidence/sushi-lempo-slash-2026-10-18/README.md.
export const SUSHI_SWORD_SLASH=preset.settings;
export const SUSHI_SLASH_LIFETIME_MS=SUSHI_SWORD_SLASH.lifetime*1000;
const widthStops=SUSHI_SWORD_SLASH.widthCurve.map(p=>[Number(p[0]),Number(p[1])] as const);
const alphaStops=SUSHI_SWORD_SLASH.alphaStops.map(p=>[p[0],p[1]/255] as const);
const colorStops=SUSHI_SWORD_SLASH.colorStops.map(p=>[Number(p[0]),parseInt(String(p[1]).slice(1),16)] as const);
const valueAt=(stops:readonly (readonly [number,number])[],t:number,smooth=false)=>{
 const end=stops.findIndex(p=>p[0]>=t);if(end<=0)return stops[end<0?stops.length-1:0][1];const a=stops[end-1],b=stops[end];let u=(t-a[0])/(b[0]-a[0]);if(smooth)u=u*u*(3-2*u);return a[1]+(b[1]-a[1])*u;
};
function slashColor(stops:readonly (readonly [number,number])[],t:number):number {
 const end=stops.findIndex(p=>p[0]>=t);if(end<=0)return stops[end<0?stops.length-1:0][1];const a=stops[end-1],b=stops[end],u=(t-a[0])/(b[0]-a[0]),channel=(shift:number)=>Math.round(((a[1]>>shift)&255)*(1-u)+((b[1]>>shift)&255)*u);return channel(16)<<16|channel(8)<<8|channel(0);
}
export const sushiSlashColor=(t:number)=>slashColor(colorStops,t);
const exileColorStops=[[0,0xfff6d2],[.3,0xffbf64],[.7,0xef5432],[1,0x8d1725]] as const;
/** Product palette override; upstream Lempo preset bytes and geometric/alpha curves remain intact. */
export const SUSHI_EXILE_SLASH_PALETTE={edge:0xff5c38,core:0xfff6d2,color:(t:number)=>slashColor(exileColorStops,t)};
export interface SwordSlashSample extends InkPoint {width:number;alpha:number;color:number;normal:InkPoint}
/** The existing single-card trajectory supplies head/tail. No trail history or new runtime is installed. */
export function sushiSwordSlashSamples(width:number,height:number,path:readonly InkPoint[],age:number):SwordSlashSample[] {
 if(age<0||age>=1||path.length<2)return[];const tail=path[0],head=path[path.length-1],dx=tail.x-head.x,dy=tail.y-head.y,length=Math.hypot(dx,dy);if(length<.01)return[];
 const normal={x:-dy/length,y:dx/length},count=Math.min(SUSHI_SWORD_SLASH.maxPoints,Math.max(2,Math.floor(length/SUSHI_SWORD_SLASH.minDist)+1)),fit=Math.min(1,width/112,height/159),glow=SUSHI_SWORD_SLASH.glowWidth;
 return Array.from({length:count},(_,i)=>{const t=i/(count-1),x=head.x+dx*t,y=head.y+dy*t,nominal=(SUSHI_SWORD_SLASH.widthStart+(SUSHI_SWORD_SLASH.widthEnd-SUSHI_SWORD_SLASH.widthStart)*t)*SUSHI_SWORD_SLASH.widthMult*valueAt(widthStops,t,true)*fit,cap=2*Math.min(Math.abs(normal.x)>.00001?(width/2-1-Math.abs(x))/Math.abs(normal.x):Infinity,Math.abs(normal.y)>.00001?(height/2-1-Math.abs(y))/Math.abs(normal.y):Infinity)/glow;
  return{x,y,width:Math.max(0,Math.min(nominal,cap)),alpha:valueAt(alphaStops,t)*(1-age),color:sushiSlashColor(t),normal};});
}
/** Convex ribbon clipping retains visible slivers on overlapping phone hands instead of dropping the entire ribbon. */
function clipHalf(points:readonly InkPoint[],axis:'x'|'y',edge:number,greater:boolean):InkPoint[]{
 const out:InkPoint[]=[];if(!points.length)return out;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],insideA=greater?a[axis]>=edge:a[axis]<=edge,insideB=greater?b[axis]>=edge:b[axis]<=edge;if(insideA)out.push(a);if(insideA!==insideB){const u=(edge-a[axis])/(b[axis]-a[axis]);out.push({...{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u},[axis]:edge});}}
 return out;
}
function visibleRibbon(points:InkPoint[],boxes:readonly InkBox[]):InkPoint[][] {
 let pieces=[points];
 for(const b of boxes){const next:InkPoint[][]=[],left=b.x-1,right=b.x+b.width+1,top=b.y-1,bottom=b.y+b.height+1;
  for(const p of pieces){const x=Math.min(...p.map(v=>v.x)),y=Math.min(...p.map(v=>v.y)),r=Math.max(...p.map(v=>v.x)),d=Math.max(...p.map(v=>v.y));if(r<=left||x>=right||d<=top||y>=bottom){next.push(p);continue;}
   const middle=clipHalf(clipHalf(p,'x',left,true),'x',right,false);
   next.push(clipHalf(p,'x',left,false),clipHalf(p,'x',right,true),clipHalf(middle,'y',top,false),clipHalf(middle,'y',bottom,true));
  }
  pieces=next.filter(p=>p.length>=3&&Math.abs(p.reduce((a,v,i)=>{const n=p[(i+1)%p.length];return a+v.x*n.y-n.x*v.y;},0))>.02);if(pieces.length>12)return[];if(!pieces.length)break;
 }
 return pieces;
}
/** A bounded filled ribbon in the current card's Graphics; retains all preset colors/width/alpha stops. */
export function drawSushiSwordSlash(g:Phaser.GameObjects.Graphics,width:number,height:number,path:readonly InkPoint[],age:number,occluders:readonly InkBox[],palette?:typeof SUSHI_EXILE_SLASH_PALETTE){
 const samples=sushiSwordSlashSamples(width,height,path,age),s=SUSHI_SWORD_SLASH,layers=[{width:s.glowWidth,alpha:s.glowAlpha*(1-s.edgeSoftness),color:palette?.edge??parseInt(s.edgeColor.slice(1),16)},{width:1+(s.glowWidth-1)*s.edgeSoftness,alpha:s.glowAlpha*s.edgeSoftness,color:palette?.edge??parseInt(s.edgeColor.slice(1),16)},{width:1,alpha:s.intensity},{width:s.coreWidth,alpha:s.intensity,color:palette?.core??parseInt(s.coreColor.slice(1),16)}];let quads=0;
 g.setBlendMode(s.blend==='Additive'?'ADD':'NORMAL');
 for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],quad=(factor:number)=>[{x:a.x+a.normal.x*a.width*factor/2,y:a.y+a.normal.y*a.width*factor/2},{x:b.x+b.normal.x*b.width*factor/2,y:b.y+b.normal.y*b.width*factor/2},{x:b.x-b.normal.x*b.width*factor/2,y:b.y-b.normal.y*b.width*factor/2},{x:a.x-a.normal.x*a.width*factor/2,y:a.y-a.normal.y*a.width*factor/2}];
  for(const layer of layers){const alpha=Math.min(1,(a.alpha+b.alpha)/2*layer.alpha);if(alpha<=0)continue;for(const poly of visibleRibbon(quad(layer.width),occluders)){if(quads>=4*(s.maxPoints-1))return{points:samples.length,quads,preset:preset.id};g.fillStyle(layer.color??(palette?.color??sushiSlashColor)((i-.5)/(samples.length-1)),alpha).fillPoints(poly,true);quads++;}}
 }
 return{points:samples.length,quads,preset:preset.id};
}
