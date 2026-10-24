import type Phaser from 'phaser';
import type {AtmosphereStyle} from './HeroCardAttachmentAtmosphere';
import {heroSmokePixels} from './HeroSmokeGrain';

type Particle=Phaser.GameObjects.Particles.Particle;
export const HERO_ENERGY_TEXTURE={coreWidth:32,wakeWidth:64,height:32,maxRgbaBytes:61440} as const;
export const hasHeroEnergy=(style:AtmosphereStyle)=>['exile','handoff','charge','burn','wager'].includes(style.key);
export const heroEnergyTextureKey=(style:AtmosphereStyle,core:boolean)=>`hero-energy-${style.key}-${core?'core32':'wake64'}-v1`;
const css=(color:number)=>'#'+color.toString(16).padStart(6,'0');
/** Five local glyphs share native Canvas/Phaser capabilities, not a generic recolored smoke atlas. */
function glyph(c:CanvasRenderingContext2D,style:AtmosphereStyle,x:number,y:number,r:number){
 c.save();c.translate(x,y);c.fillStyle=css(style.glow);c.strokeStyle=css(style.spark);c.lineWidth=1.4;
 if(style.shape==='petal'){for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*2/5);c.beginPath();c.ellipse(0,-r*.46,r*.29,r*.6,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}}
 else if(style.shape==='vortex'){for(let i=0;i<2;i++){c.beginPath();c.arc(0,0,r*.8,i*Math.PI,i*Math.PI+Math.PI*1.55);c.stroke();}c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,d=i%2?r*.3:r;const px=Math.cos(a)*d,py=Math.sin(a)*d;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();}
 else if(style.shape==='flame'){c.beginPath();c.moveTo(-r*.68,r*.5);c.bezierCurveTo(-r,-r*.1,-r*.1,-r*.1,0,-r);c.bezierCurveTo(r*.08,-r*.25,r*.9,-r*.1,r*.6,r*.5);c.bezierCurveTo(r*.3,r,-r*.4,r,-r*.68,r*.5);c.closePath();c.fill();c.stroke();}
 else if(style.shape==='ember'){c.beginPath();c.moveTo(0,-r);c.lineTo(r*.65,r*.18);c.lineTo(0,r*.85);c.lineTo(-r*.65,r*.18);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(-r*.8,-r*.3);c.lineTo(-r*.3,r*.5);c.moveTo(r*.4,-r*.7);c.lineTo(r*.9,r*.2);c.stroke();}
 else {c.beginPath();c.moveTo(-r,r*.7);c.bezierCurveTo(-r*.3,-r*.6,r*.2,-r*.8,r,-r*.6);c.bezierCurveTo(r*.15,-r*.2,r*.4,r*.5,-r,r*.7);c.closePath();c.fill();c.stroke();}
 c.fillStyle=css(style.spark);c.beginPath();c.ellipse(0,0,r*.2,r*.34,0,0,Math.PI*2);c.fill();c.restore();
}
/** Lazy two-texture cache per hero: max60KiB nominal RGBA across the five heroes, shared by both renderers. */
export function heroEnergyTexture(scene:Phaser.Scene,style:AtmosphereStyle,core:boolean):string|undefined {
 const key=heroEnergyTextureKey(style,core);if(scene.textures.exists(key))return key;
 const bitmap=scene.textures.createCanvas(key,core?32:64,32);if(!bitmap)return;const c=bitmap.getContext();if(!core&&style.key==='exile'){const haze=c.createImageData(64,32);haze.data.set(heroSmokePixels(64,32,style.glow));c.putImageData(haze,0,0);}c.save();c.shadowColor=css(style.glow);c.shadowBlur=4;
 if(core){c.strokeStyle=css(style.ink);c.lineWidth=4;glyph(c,{...style,glow:style.ink,spark:style.ink},16,16,12);glyph(c,style,16,16,9.6);}
 else {const body=c.createLinearGradient(2,16,62,16);body.addColorStop(0,'rgba(0,0,0,0)');body.addColorStop(.28,css(style.ink));body.addColorStop(.78,css(style.glow));body.addColorStop(1,css(style.spark));c.fillStyle=body;c.beginPath();c.moveTo(2,23);c.bezierCurveTo(18,7,39,5,60,15);c.bezierCurveTo(45,29,25,17,2,23);c.closePath();c.fill();c.strokeStyle=css(style.spark);c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(9,20);c.bezierCurveTo(25,12,39,10,54,15);c.stroke();glyph(c,style,53,15,style.shape==='petal'?8:6);if(style.shape==='petal')glyph(c,style,31,16,3.4);if(style.shape==='vortex'){c.beginPath();c.moveTo(14,25);c.bezierCurveTo(30,29,45,20,52,12);c.stroke();}}
 c.restore();bitmap.refresh();return key;
}
/** Short directed exterior channels; larger quads remain outside all printed card faces. */
export function heroEnergyPoint(style:AtmosphereStyle,width:number,height:number,lane:number,t:number,burst=false){
 const reverse=(style.shape==='petal'||style.shape==='vortex')!==(lane%3===1),u=reverse?1-t:t,travel=Math.max(6,width*.5-Math.min(62,width*1.05)*.5+4),wave=style.shape==='smoke'?4:style.shape==='flame'?6:3;
 if(lane%3!==2){const dx=travel*2,dy=Math.cos(u*Math.PI*2)*wave*Math.PI*2,extra=burst?Math.sin(t*Math.PI)*18:0;return{x:-travel+dx*u+(burst?(u-.5)*width*.55:0),y:-height/2-(lane%3===1?64:34)+Math.sin(u*Math.PI*2)*wave-extra,angle:Math.atan2(dy,dx)*180/Math.PI+(reverse?180:0)};}
 const rising=style.shape==='flame'||style.shape==='ember',v=rising?1-u:u;return{x:width/2+32+Math.sin(u*Math.PI)*4+(burst?t*18:0),y:-height/2+height*.42*v-(burst?t*20:0),angle:(rising?-1:1)*(reverse?-1:1)<0?-90:90};
}
/** Native EmitterOps own motion/pooling; the same bounded pool becomes a larger finite arrival burst. */
export function heroEnergyRecipe(style:AtmosphereStyle,width:number,height:number,core:boolean,visible:(p:Particle)=>boolean,burst:()=>boolean):Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
 const cap=core?7:9,length=core?Math.min(28,width*.52):Math.min(62,width*1.05),thickness=core?Math.min(26,width*.52):Math.min(28,16+width*.12),births=new WeakMap<Particle,{lane:number;t?:number;burst?:boolean;point?:ReturnType<typeof heroEnergyPoint>}>();let ordinal=0;
 const point=(p:Particle,t:number)=>{const b=births.get(p),hit=burst();if(b?.t===t&&b.burst===hit&&b.point)return b.point;const q=heroEnergyPoint(style,width,height,b?.lane??0,t,hit);if(b){b.t=t;b.burst=hit;b.point=q;}return q;},strength=()=>burst()?1.42:1;
 return{emitting:false,blendMode:'NORMAL',tint:0xffffff,lifespan:core?620:960,frequency:core?60:110,quantity:1,maxAliveParticles:cap,maxParticles:0,speed:0,
  x:{onEmit:(p:Particle|undefined)=>{if(!p)return 0;births.set(p,{lane:ordinal++%3});return point(p,0).x-p.x;},onUpdate:(p:Particle,_k:string,t:number)=>point(p,t).x},
  y:{onEmit:(p:Particle|undefined)=>p?point(p,0).y-p.y:0,onUpdate:(p:Particle,_k:string,t:number)=>point(p,t).y},
  rotate:{onEmit:(p:Particle|undefined)=>p?point(p,0).angle:0,onUpdate:(p:Particle,_k:string,t:number)=>point(p,t).angle},
  scaleX:{onEmit:()=>length/(core?32:64)*strength(),onUpdate:()=>length/(core?32:64)*strength()},
  scaleY:{onEmit:()=>thickness/32*strength(),onUpdate:()=>thickness/32*strength()},
  alpha:{onEmit:(p:Particle|undefined)=>p&&visible(p)?1:0,onUpdate:(p:Particle,_k:string,t:number)=>visible(p)?(core?1:.96)*Math.min(1,.6+t*6)*(t<.7?1:(1-t)/.3):0}
 };
}
