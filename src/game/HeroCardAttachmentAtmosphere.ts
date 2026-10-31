import type Phaser from 'phaser';
import type {AttachmentDraft} from './HeroTargetAttachmentState';
import {clearInkRuns,exteriorOrbitPoint,type InkBox,type InkPoint} from './AssistInkGeometry';
import type {SourceElectricDecision} from './HeroLineCurrent';
import {drawHeroFuse,fuseRouteSafe,routeHeroFuse} from './HeroFuse';

export const HERO_SOURCE_CURRENT_MS=900;
export const HERO_ATMOSPHERE_BUDGET={targets:5,particlesPerTarget:6,particles:30,sourceHeads:1,portraitHz:20,desktopHz:30} as const;
export type HeroAtmosphereKey='exile'|'handoff'|'charge'|'burn'|'wager'|'retain'|'legacy-assist';
export interface AtmosphereStyle {key:HeroAtmosphereKey;ink:number;glow:number;spark:number;shape:'smoke'|'flame'|'petal'|'ember'|'vortex'|'leaf';period:number}
const styles:Record<HeroAtmosphereKey,AtmosphereStyle>={
  exile:{key:'exile',ink:0x7e1d18,glow:0xf05e2c,spark:0xfff0cc,shape:'smoke',period:1900},
  handoff:{key:'handoff',ink:0x15539c,glow:0x29a8e1,spark:0xd0f7ff,shape:'flame',period:1650},
  charge:{key:'charge',ink:0x8b6b21,glow:0xdab761,spark:0xfff0b2,shape:'petal',period:2400},
  burn:{key:'burn',ink:0x9e3d25,glow:0xf08e45,spark:0xffdca2,shape:'ember',period:1600},
  wager:{key:'wager',ink:0x344d9e,glow:0x788ce8,spark:0xdde9ff,shape:'vortex',period:1750},
  retain:{key:'retain',ink:0x225b4c,glow:0x67ad87,spark:0xcce9b6,shape:'leaf',period:2150},
  'legacy-assist':{key:'legacy-assist',ink:0x245865,glow:0x65b3c1,spark:0xd1f0e9,shape:'smoke',period:1900},
};
/** Existing intent/event provenance selects style; no gameplay inference or numeric effect is added. */
export function heroAtmosphereStyle(draft:AttachmentDraft):AtmosphereStyle {
  const r=draft.releaseReason??'erxiang.handoff';return styles[r==='amo.exile'?'exile':r.startsWith('amo.assist')?'legacy-assist':r.startsWith('azao.')?'charge':r.startsWith('xiemu.')?'burn':r.startsWith('touye.')?'wager':r.startsWith('laohuan.')?'retain':'handoff'];
}
const blocked=(b:InkBox,boxes:readonly InkBox[])=>boxes.some(a=>b.x<=a.x+a.width+1&&b.x+b.width>=a.x-1&&b.y<=a.y+a.height+1&&b.y+b.height>=a.y-1);
function stroke(g:Phaser.GameObjects.Graphics,points:InkPoint[],boxes:readonly InkBox[],width:number,color:number,alpha:number):number {
  let count=0;for(const run of clearInkRuns(points,boxes,width/2+1)){g.lineStyle(width,color,alpha).beginPath();run.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();count+=run.length-1;}return count;
}
function mote(g:Phaser.GameObjects.Graphics,p:InkPoint&{nx:number;ny:number},size:number,style:AtmosphereStyle,alpha:number,boxes:readonly InkBox[]):boolean {
  const length=style.shape==='flame'?3.3:2,spread=style.shape==='petal'?2.4:1.8,rx=size*Math.max(spread,Math.abs(p.nx)*length+Math.abs(p.ny)),ry=size*Math.max(spread,Math.abs(p.ny)*length+Math.abs(p.nx));if(blocked({x:p.x-rx,y:p.y-ry,width:rx*2,height:ry*2},boxes))return false;
  g.fillStyle(style.glow,.12*alpha).fillCircle(p.x,p.y,size*1.8);
  if(style.shape==='smoke'){
    g.fillStyle(style.ink,.48*alpha).fillEllipse(p.x,p.y,size*3.1,size*1.8);g.fillStyle(style.glow,.34*alpha).fillEllipse(p.x-p.nx*size*.4,p.y-p.ny*size*.4,size*2,size*1.3);
  }else if(style.shape==='petal'){
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=p.x+Math.cos(a)*size*1.2,y=p.y+Math.sin(a)*size*1.2;g.fillStyle(style.ink,.85*alpha).fillCircle(x,y,size*.8).fillStyle(style.glow,.95*alpha).fillCircle(x,y,size*.5);}
  }else if(style.shape==='vortex'){
    const star=(scale:number)=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,r=size*(i%2?.42:1.6)*scale;return{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};});g.fillStyle(style.ink,.9*alpha).fillPoints(star(1),true).fillStyle(style.glow,.95*alpha).fillPoints(star(.66),true);
  }else {
    const tx=-p.ny,ty=p.nx;
    const shape=style.shape==='flame'?[[-1,-.5],[-.85,.7],[-.28,1.45],[.38,3.3],[.22,1.5],[.9,.55],[.8,-.6]]:[[-1,0],[0,length],[1,0],[0,-1]];
    const vertices=(scale:number)=>shape.map(([t,n])=>({x:p.x+(tx*t+p.nx*n)*size*scale,y:p.y+(ty*t+p.ny*n)*size*scale}));g.fillStyle(style.ink,.9*alpha).fillPoints(vertices(1),true).fillStyle(style.glow,.95*alpha).fillPoints(vertices(.68),true);
    if(style.shape==='leaf')g.lineStyle(.8,style.spark,.85*alpha).lineBetween(p.x-p.nx*size,p.y-p.ny*size,p.x+p.nx*size*1.7,p.y+p.ny*size*1.7);
  }g.fillStyle(style.spark,.88*alpha).fillCircle(p.x,p.y,Math.max(1,size*.4));return true;
}
export interface AtmosphereFrame {style:AtmosphereStyle;clock:number;targets:readonly InkBox[];protectedBoxes:readonly InkBox[];full:boolean;alpha:number;failed?:boolean;costs?:readonly InkBox[]}
/** Fixed analytic motes and filled haze share one Graphics. Nothing is emitted or left alive. */
export function drawHeroAtmosphere(g:Phaser.GameObjects.Graphics,frame:AtmosphereFrame){
  const {clock,protectedBoxes:boxes,full,alpha}=frame,style=frame.failed?{...frame.style,ink:0x746b64,glow:0x998e83,spark:0xcac1b6}:frame.style;g.clear();let particles=0,segments=0,markers=0,costParticles=0;
  for(const [index,box]of frame.targets.slice(0,HERO_ATMOSPHERE_BUDGET.targets).entries()){
    if(!full){
      const placed:InkPoint[]=[];for(const preferred of [.06,.32,.57,.82]){let found=false;for(const padding of [3,8,14,20]){for(const offset of [0,.04,-.04,.08,-.08,.12,-.12]){const p=exteriorOrbitPoint(box,preferred+offset,padding);if(placed.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<10)||blocked({x:p.x-4,y:p.y-4,width:8,height:8},boxes))continue;g.fillStyle(style.ink,.96).fillCircle(p.x,p.y,3.2).fillStyle(style.spark,1).fillCircle(p.x,p.y,1.3);placed.push(p);markers++;found=true;break;}if(found)break;}}
      continue;
    }
    for(let ribbon=0;ribbon<2;ribbon++){
      const direction=style.shape==='vortex'||style.shape==='petal'?-1:1,head=clock/style.period*direction+index*.13+ribbon/2,points=Array.from({length:25},(_,i)=>{const u=i/24,p=exteriorOrbitPoint(box,head-direction*.29*(1-u),4),wave=Math.sin(u*7+clock/410+index)*(style.shape==='smoke'?4.5:2.4);return{x:p.x+p.nx*wave,y:p.y+p.ny*wave};});
      segments+=stroke(g,points,boxes,13,style.ink,.17*alpha);segments+=stroke(g,points,boxes,6.3,style.glow,.4*alpha);segments+=stroke(g,points,boxes,2.1,style.spark,.9*alpha);
    }
    for(let i=0;i<HERO_ATMOSPHERE_BUDGET.particlesPerTarget;i++){
      const plume=i>=2,age=plume?(clock/1650+(i-2)/4+index*.11)%1:((clock+i*233+index*177)%1400)/1400,direction=style.shape==='vortex'||style.shape==='petal'?-1:1,p=exteriorOrbitPoint(box,clock/style.period*direction+i/6+index*.13,5+age*11),size=(style.shape==='smoke'?5.2:plume?3.6:2.6)+Math.sin(age*Math.PI)*(plume?3:1.8);
      if(plume){p.x=box.x+box.width/2+Math.sin(age*5+index+i)*13;p.y=box.y-8-age*(style.shape==='leaf'?90:118);p.nx=0;p.ny=-1;}
      if(style.shape==='ember'){p.y-=age*20;p.x+=Math.sin(age*Math.PI)*5;p.nx=0;p.ny=-1;}
      if(mote(g,p,size,style,(.45+.55*Math.sin(age*Math.PI))*alpha,boxes))particles++;
    }
  }
  // Exile's remainder is an outgoing ash cost, never another beneficiary halo.
  if(full&&!frame.failed)for(const [index,box]of (frame.costs??[]).slice(0,6).entries()){
    if(particles+costParticles>=HERO_ATMOSPHERE_BUDGET.particles)break;
    const age=((clock+index*160)%1100)/1100,p={x:box.x+box.width*.5-age*12,y:box.y-8-age*17,nx:-.5,ny:-1};
    if(mote(g,p,1.8,{...style,ink:0x777776,glow:0x93999b,spark:0xd4d7d6,shape:'smoke'},(1-age)*alpha,boxes))costParticles++;
  }
  return {particles,segments,markers,costParticles,targets:Math.min(frame.targets.length,HERO_ATMOSPHERE_BUDGET.targets),style:style.key,full};
}
/** One blue ignition front travels from the real hero to a real beneficiary. */
export function drawHeroOriginStream(g:Phaser.GameObjects.Graphics,source:InkPoint,targets:readonly InkBox[],_style:AtmosphereStyle,progress:number,boxes:readonly InkBox[],alpha:number,currentInk:Phaser.GameObjects.Graphics=g,_fallbackBoard?:InkBox,decision?:SourceElectricDecision,viewport?:InkBox){
  g.clear();if(currentInk!==g)currentInk.clear();const target=targets[0];
  if(!target||alpha<=0)return {segments:0,heads:0,electricSegments:0,electricHeads:[],sourceBurstSegments:0,scoreFallbackSegments:0};
  const end={x:target.x+target.width/2,y:target.y-7},guards=[...boxes,...targets];
  const bounds=viewport??{x:Math.min(source.x,end.x)-100,y:Math.min(source.y,end.y)-100,width:Math.abs(source.x-end.x)+200,height:Math.abs(source.y-end.y)+200};
  let route=decision?.route;
  // The beneficiary may move from hand to table during the presentation.
  // Reattach the end when possible without shifting the already travelled path.
  if(route&&Math.hypot(route.target.x-end.x,route.target.y-end.y)>4){
    const last={x:Math.max(bounds.x+4,Math.min(bounds.x+bounds.width-4,end.x)),y:Math.max(bounds.y+4,Math.min(bounds.y+bounds.height-4,end.y))};
    const moved={...route,points:[...route.points.slice(0,-1),last],target:end};route=fuseRouteSafe(moved,guards)?moved:undefined;if(decision)decision.route=route;
  }
  if(route&&!fuseRouteSafe(route,guards))route=undefined;
  // A moving hand may briefly cover a route. Limit recomputation so an
  // occluded screen cannot stall scoring while each frame searches again.
  if(!route&&(!decision||decision.lastAttempt===undefined||progress-decision.lastAttempt>=.2)){
    route=routeHeroFuse(source,end,guards,bounds);if(decision){decision.route=route;decision.lastAttempt=progress;}
  }
  if(!route)return {segments:0,heads:0,electricSegments:0,electricHeads:[],sourceBurstSegments:0,scoreFallbackSegments:0};
  const result=drawHeroFuse(currentInk,route,progress,guards,alpha);
  return {segments:result.segments,heads:result.heads.length,electricSegments:result.segments,electricHeads:result.heads,sourceBurstSegments:result.segments,scoreFallbackSegments:0,route:route.points,front:result.front};
}
