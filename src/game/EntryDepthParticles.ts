import type {Box} from './layout';
import type {CharacterId} from './characters';

// Adapted from Magic UI Floating3DParticles (MIT), efe76fc5755eca1142dd4f74c1d6f0ace2887e3c.
// spawnParticle, deriveProjection and tick's polar projection are retained below.
// Local changes: bounded directional bands, gold/teal palette, delta time and two native renderers.
// Full notice: public/licenses/magicui-floating-3d-particles.MIT.txt.
export const ENTRY_PARTICLE_SOURCE='magicui/efe76fc5755eca1142dd4f74c1d6f0ace2887e3c';
export const ENTRY_PARTICLE_BUDGET={mobile:32,desktop:64,breakpoint:768,depth:.25,maxDpr:2,mobileHz:30,desktopHz:60,brush:32} as const;
// A few exterior motes echo the existing six hero effect palettes, without triggering an ability.
export const ENTRY_HERO_TINTS:Record<CharacterId,number>={amo:0x399cc4,touye:0x788ce8,laohuan:0x67ad87,erxiang:0x29a8e1,azao:0xdab761,xiemu:0xf08e45};
export interface EntryParticle {
 angle:number;radius:number;y:number;size:number;angularSpeed:number;opacity:number;
 screenX:number;screenY:number;projectedScale:number;
 cx:number;cy:number;span:number;height:number;drift:number;color:number;front:boolean;bright:boolean;
}
export interface EntryParticleField {width:number;height:number;particles:EntryParticle[]}
export function deriveEntryProjection(depth:number){
 const t=Math.max(0,Math.min(1,depth)),fov=800-t*600,perspectiveDistance=100+t*700;
 return{fov,perspectiveDistance,depthRange:t*Math.min(400,fov+perspectiveDistance-1)};
}
export function spawnEntryParticle(width:number,height:number,size:number,opacity:number,random:()=>number=Math.random){
 const variance=size*.4;
 return{angle:random()*Math.PI*2,radius:random()*Math.max(width,height)*1.2,y:(random()-.5)*height*2,size:Math.max(.5,size-variance+random()*variance*2),angularSpeed:.0015+random()*.001,opacity:Math.min(1,Math.max(0,opacity-.2+random()*.4)),screenX:0,screenY:0,projectedScale:1};
}
/** Confine the upstream field to two rising side bands and the current hero's exterior. */
export function createEntryParticleField(width:number,height:number,viewportWidth:number,anchor?:Box,identity?:number,random:()=>number=Math.random):EntryParticleField {
 const count=viewportWidth<ENTRY_PARTICLE_BUDGET.breakpoint?ENTRY_PARTICLE_BUDGET.mobile:ENTRY_PARTICLE_BUDGET.desktop;
 const particles=Array.from({length:count},(_,i)=>{
  const front=i%16===0,hero=!!anchor&&!front&&i%3===1,left=i%2===0;
  const span=hero?Math.min(42,Math.max(14,anchor!.width*.12)):width*(front?.12:.22),tall=hero?Math.max(30,anchor!.height*.56):height*.65;
  const p=spawnEntryParticle(span,tall,front?7:hero?5:3.5,front?.22:hero?.48:.28,random);
  // Narrow the original full-screen radial spread; vertical drift remains the upstream motion.
  p.radius=random()*span*1.2;
  return{...p,cx:hero?(left?anchor!.x-8:anchor!.x+anchor!.width+8):width*(left?.12:.88),cy:hero?anchor!.y+anchor!.height*.56:height*.58,span,height:tall,drift:hero?.38:front?.22:.16,color:hero&&identity!==undefined&&i%4===1?identity:left?0xc19a52:0x4b9c9f,front:front||hero,bright:i%11===0};
 });
 const field={width,height,particles};advanceEntryParticleField(field,0,true);return field;
}
export function advanceEntryParticleField(field:EntryParticleField,deltaMs:number,staticFrame=false,random:()=>number=Math.random):void {
 const frames=staticFrame?0:Math.max(0,Math.min(100,deltaMs))*60/1000,{fov,perspectiveDistance,depthRange}=deriveEntryProjection(ENTRY_PARTICLE_BUDGET.depth);
 for(const p of field.particles){
  p.angle+=p.angularSpeed*frames;p.y-=p.drift*frames;
  if(p.y < -p.height){p.y=p.height;p.radius=random()*p.span*1.2;}else if(p.y>p.height){p.y=-p.height;p.radius=random()*p.span*1.2;}
  const denom=Math.max(1,fov+perspectiveDistance+(staticFrame?0:Math.sin(p.angle)*depthRange)),scale=fov/denom;
  p.screenX=p.cx+Math.cos(p.angle)*p.radius*scale;p.screenY=p.cy+p.y*scale;p.projectedScale=scale;
 }
}
export function entryParticleVisible(p:EntryParticle,field:EntryParticleField,protectedBoxes:readonly Box[]):boolean {
 const r=p.size*p.projectedScale*1.3,x=p.screenX,y=p.screenY;
 return x+r>0&&y+r>0&&x-r<field.width&&y-r<field.height&&!protectedBoxes.some(b=>x+r>b.x&&x-r<b.x+b.width&&y+r>b.y&&y-r<b.y+b.height);
}
/** One cached tiny soft brush per palette/core variant; never full-surface blur or per-frame gradients. */
export function paintEntryParticleBrush(c:CanvasRenderingContext2D,color:number,bright:boolean):void {
 const n=ENTRY_PARTICLE_BUDGET.brush,h=n/2,rgb=[color>>16&255,color>>8&255,color&255].join(','),g=c.createRadialGradient(h,h,0,h,h,h);
 g.addColorStop(0,`rgba(${rgb},.95)`);g.addColorStop(.18,`rgba(${rgb},.72)`);g.addColorStop(.5,`rgba(${rgb},.18)`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(0,0,n,n);
 if(bright){c.fillStyle='#fff4d6';c.fillRect(h-.5,h-4,1,8);c.fillRect(h-3,h-.5,6,1);}
}
