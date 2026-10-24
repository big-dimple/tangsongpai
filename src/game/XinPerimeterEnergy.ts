import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';
import type {AtmosphereStyle} from './HeroCardAttachmentAtmosphere';

export type XinEnergyPhase='candidate'|'retained';
export interface XinEnergyAppearance {phase:XinEnergyPhase;igniteIds:readonly string[];selectedIds?:readonly string[]}
export const XIN_ENERGY_BUDGET={core:3,wake:6} as const;
type Particle=Phaser.GameObjects.Particles.Particle;

/** Two local streams leave the full printed face intact, including narrow overlapping phone seats. */
export function xinEnergyPoint(width:number,height:number,lane:number,t:number):{x:number;y:number;angle:number} {
 const u=Math.max(0,Math.min(1,t)),travel=Math.max(7,width/2-Math.min(62,width*.68)/2-3);
 if(lane===0){const dx=travel*2,dy=Math.cos(u*Math.PI)*1.2*Math.PI;return{x:-travel+dx*u,y:-height/2-22+Math.sin(u*Math.PI)*1.2,angle:Math.atan2(dy,dx)*180/Math.PI};}
 const dx=Math.cos(u*Math.PI)*2*Math.PI,dy=height*.38;return{x:width/2+21+Math.sin(u*Math.PI)*2,y:-height/2+dy*u,angle:Math.atan2(dy,dx)*180/Math.PI};
}
/** Native EmitterOps own time and pooling. Selection reads live UI emphasis without a new source receipt. */
export function xinEnergyRecipe(_id:string,width:number,height:number,_style:AtmosphereStyle,phase:XinEnergyPhase,core:boolean,ignite:boolean,visible:(particle:Particle)=>boolean,selected:()=>boolean=()=>false):Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
 const retained=phase==='retained',life=core?720:1050,frequency=core?240:180,cap=core?XIN_ENERGY_BUDGET.core:XIN_ENERGY_BUDGET.wake;
 const length=core?Math.min(30,width*.38):Math.min(62,width*.68),thickness=core?(retained?12:9):(retained?20:14);
 const births=new WeakMap<Particle,{lane:number;accent:boolean;t?:number;point?:ReturnType<typeof xinEnergyPoint>}>();let ordinal=0;
 const position=(p:Particle,t:number)=>{const birth=births.get(p);if(birth?.t===t&&birth.point)return birth.point;const q=xinEnergyPoint(width,height,birth?.lane??0,t);if(birth){birth.t=t;birth.point=q;}return q;};
 const focus=()=>!retained&&selected()?1.25:1,warm=(p:Particle,t:number)=>births.get(p)?.accent?1+.1*Math.max(0,1-t/.25):1;
 const opacity=(p:Particle,t:number)=>visible(p)?Math.min(1,(core?1:retained?.96:.84)*focus())*Math.min(1,.6+t*5)*(t<.72?1:(1-t)/.28):0;
 // maxParticles gates alive+dead before reuse in Phaser3.90. maxAlive plus dead.pop keeps this pool bounded.
 return {emitting:false,blendMode:'NORMAL',tint:0xffffff,lifespan:life,frequency,quantity:1,maxAliveParticles:cap,maxParticles:0,speed:0,
  // Particle.fire adds offsets; a death-zone-rejected pooled Particle keeps its old x/y in Phaser3.90.
  x:{onEmit:(p:Particle|undefined)=>{if(!p)return 0;births.set(p,{lane:ordinal%2,accent:ignite&&ordinal<2});ordinal++;return position(p,0).x-p.x;},onUpdate:(p:Particle,_key:string,t:number)=>position(p,t).x},
  y:{onEmit:(p:Particle|undefined)=>p?position(p,0).y-p.y:0,onUpdate:(p:Particle,_key:string,t:number)=>position(p,t).y},
  rotate:{onEmit:(p:Particle|undefined)=>p?position(p,0).angle:0,onUpdate:(p:Particle,_key:string,t:number)=>position(p,t).angle},
  scaleX:{onEmit:(p:Particle|undefined)=>p?length/64*warm(p,0):0,onUpdate:(p:Particle,_key:string,t:number)=>length/64*warm(p,t)},
  scaleY:{onEmit:()=>thickness/32*focus(),onUpdate:(p:Particle,_key:string,t:number)=>thickness/32*focus()*warm(p,t)},
  alpha:{onEmit:(p:Particle|undefined)=>p?opacity(p,0):0,onUpdate:(p:Particle,_key:string,t:number)=>opacity(p,t)}
 };
}

/** Bounds of the entire stretched bitmap in the requested space, without Phaser getBounds' temporary vectors. */
export function xinEnergyFootprint(p:Particle,point:(x:number,y:number)=>{x:number;y:number}):InkBox {
 const c=Math.cos(p.rotation),s=Math.sin(p.rotation),halfWidth=p.frame.width/2,halfHeight=p.frame.height/2,x=c*p.scaleX*halfWidth,y=s*p.scaleX*halfWidth,u=-s*p.scaleY*halfHeight,v=c*p.scaleY*halfHeight;
 const center=point(p.x,p.y),a=point(p.x+x,p.y+y),b=point(p.x+u,p.y+v),rx=Math.abs(a.x-center.x)+Math.abs(b.x-center.x),ry=Math.abs(a.y-center.y)+Math.abs(b.y-center.y);
 return{x:center.x-rx,y:center.y-ry,width:rx*2,height:ry*2};
}
export function xinEnergyOverlaps(a:InkBox,b:InkBox,padding=2):boolean {return a.x<b.x+b.width+padding&&a.x+a.width>b.x-padding&&a.y<b.y+b.height+padding&&a.y+a.height>b.y-padding;}
