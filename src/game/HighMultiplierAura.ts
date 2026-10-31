import type Phaser from 'phaser';
import type {Box} from './layout';

/** Presentation only. All boxes must be current, axis-aligned bounds. */
export interface HighMultiplierAuraOptions {
  root:Phaser.GameObjects.Container;
  /** Saved event identity is metadata only; the owner decides eligibility. */
  eventId:string;
  /** The real score-board box in root-local coordinates. */
  getBoard:()=>Box|undefined;
  /** Actual visible viewport in world coordinates, not a guessed safe area. */
  getViewport:()=>Box|undefined;
  /** Current world bounds of card faces, their print, buttons, and other protected content. */
  getGuards:()=>readonly Box[]|undefined;
  signal:AbortSignal;
  /** A live setting: turning reduced motion on also removes an existing cue. */
  reduced:()=>boolean;
  /** Current presentation speed; the default is normal speed. */
  speed?:()=>1|2|4;
  /** Optional owner check for view replacement or a changed score presentation. */
  isCurrent?:()=>boolean;
  /** The scoring owner requests a short fade only after the last score event. */
  ending?:()=>boolean;
  /** Called once when flame ink first appears. */
  onVisibleOnce?:()=>void;
  /** Called once when the natural visual fade begins. */
  onEnding?:(durationMs:number)=>void;
  /** Release any resource owned by the mounted effect. */
  onDispose?:()=>void;
}

type Point={x:number;y:number};
interface Flame {position:number;width:number;height:number;delay:number;phase:number;lean:number;baseOffset:number}
export const HIGH_MULTIPLIER_FADE_MS=450;
const EDGE=2.5,VIEWPORT_GAP=4,REACH=80,MAX_SHIFT=16;
const MAX_GUARDS=256,MAX_AREAS=128;
const FLAMES:readonly Flame[]=[
  {position:.07,width:17,height:25,delay:45,phase:.2,lean:-3,baseOffset:-2},
  {position:.33,width:18,height:33,delay:0,phase:1.5,lean:3,baseOffset:0},
  {position:.40,width:13,height:23,delay:148,phase:3.1,lean:4,baseOffset:-1},
  {position:.60,width:13,height:24,delay:65,phase:2.3,lean:-4,baseOffset:-1},
  {position:.67,width:18,height:31,delay:112,phase:4.0,lean:-3,baseOffset:0},
  {position:.93,width:17,height:23,delay:25,phase:5.6,lean:3,baseOffset:-2}
];
const noop=()=>{};
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
const valid=(b:Box|undefined):b is Box=>!!b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.width)&&Number.isFinite(b.height)&&b.width>0&&b.height>0;
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const pad=(b:Box,n:number):Box=>({x:b.x-n,y:b.y-n,width:b.width+n*2,height:b.height+n*2});
function intersect(a:Box,b:Box):Box|undefined {
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);
  return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:undefined;
}
/** Partition a rectangle into disjoint rectangles with the guard cut out. */
function subtract(area:Box,guard:Box):Box[] {
  const hit=intersect(area,guard);if(!hit)return [area];
  const result:Box[]=[];
  const add=(x:number,y:number,width:number,height:number)=>{if(width>0&&height>0)result.push({x,y,width,height});};
  add(area.x,area.y,area.width,hit.y-area.y);
  add(area.x,hit.y+hit.height,area.width,area.y+area.height-hit.y-hit.height);
  add(area.x,hit.y,hit.x-area.x,hit.height);
  add(hit.x+hit.width,hit.y,area.x+area.width-hit.x-hit.width,hit.height);
  return result;
}
function bbox(points:readonly Point[]):Box {
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
function corners(b:Box):Point[]{return [{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];}

/** Smooth tapered sheets curl independently; inner sheets share their parent's flow. */
function flameSheet(x:number,base:number,width:number,height:number,phase:number,lean:number,seed:number):Point[] {
  const left:Point[]=[],right:Point[]=[];
  for(let i=0;i<=16;i++){
    const u=i/16,tip=smooth((u-.55)/.45),body=Math.pow(1-u,.68)*(.55+.45*Math.sin(Math.PI*u));
    const roll=Math.sin(phase+u*4.2+seed)*u*3.6+lean*u*u+tip*Math.sin(phase*.8+seed)*width*.22;
    const center=x+roll,bulge=1+.12*Math.sin(phase*1.2+u*8+seed),radius=width*.5*body*bulge;
    const y=base-height*u+tip*Math.sin(phase+seed)*1.7;
    left.push({x:center-radius*(1+.09*Math.sin(phase+u*7)),y});
    right.push({x:center+radius*(1+.09*Math.cos(phase+u*7)),y});
  }
  return [...left,...right.reverse()];
}

/** Find the smallest world-space translation keeping a whole flame in its safe band. */
function fittingShift(worldBox:Box,localBox:Box,area:Box,localBounds:Box,minY:number,maxY:number,m:{a:number;b:number;c:number;d:number},minimum:number):Point|undefined {
  const inset=.02,epsilon=inset/minimum;
  const left=area.x+inset-worldBox.x,right=area.x+area.width-inset-worldBox.x-worldBox.width;
  const top=area.y+inset-worldBox.y,bottom=area.y+area.height-inset-worldBox.y-worldBox.height;
  if(left>right||top>bottom)return;
  const det=m.a*m.d-m.b*m.c,ix=m.d/det,iy=-m.c/det,jx=-m.b/det,jy=m.a/det;
  const limits:readonly [number,number,number][]=[
    [ix,iy,localBounds.x+localBounds.width-localBox.x-localBox.width-epsilon],
    [-ix,-iy,localBox.x-localBounds.x-epsilon],
    [jx,jy,maxY-localBox.y-localBox.height-epsilon],
    [-jx,-jy,localBox.y-minY-epsilon]
  ];
  if(left<=0&&right>=0&&top<=0&&bottom>=0&&limits.every(([, ,limit])=>limit>=0))return {x:0,y:0};
  let polygon:Point[]=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
  for(const [a,b,limit] of limits){
    const input=polygon;polygon=[];
    for(let i=0;i<input.length;i++){
      const p=input[i],q=input[(i+1)%input.length],dp=a*p.x+b*p.y-limit,dq=a*q.x+b*q.y-limit,pin=dp<=0,qin=dq<=0;
      if(pin)polygon.push(p);
      if(pin!==qin){const t=dp/(dp-dq);polygon.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
    }
    if(!polygon.length)return;
  }
  let best:Point|undefined,distance=Infinity;
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],dx=q.x-p.x,dy=q.y-p.y,d=dx*dx+dy*dy;
    const t=d?clamp(-(p.x*dx+p.y*dy)/d):0,candidate={x:p.x+t*dx,y:p.y+t*dy},length=candidate.x**2+candidate.y**2;
    if(length<distance){best=candidate;distance=length;}
  }
  return best;
}
function shown(root:Phaser.GameObjects.Container):boolean {
  for(let n:Phaser.GameObjects.Container|null=root;n;n=n.parentContainer)if(!n.active||!n.visible||n.alpha<=0)return false;
  return true;
}

/** A non-interactive visual; scoring and replay eligibility remain with the owner. */
export function mountHighMultiplierAura(scene:Phaser.Scene,options:HighMultiplierAuraOptions):()=>void {
  const {root,signal}=options;
  if(signal.aborted||options.reduced()||!shown(root)||(typeof document!=='undefined'&&document.hidden)||options.isCurrent?.()===false)return noop;
  const ink=scene.add.graphics().setName('score/high-multiplier-aura').setData('eventId',options.eventId).setData('elapsed',0).setData('visibleSegments',0);
  root.add(ink);
  let elapsed=0,disposed=false,destroyingInk=false,notifiedVisible=false,endingAt:number|undefined;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    scene.events.off('postupdate',tick);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);
    scene.events.off('sleep',dispose);scene.events.off('pause',dispose);root.off('destroy',dispose);ink.off('destroy',inkDestroyed);signal.removeEventListener('abort',dispose);
    if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
    if(typeof window!=='undefined')window.removeEventListener('blur',dispose);
    if(!destroyingInk&&ink.active)ink.destroy();
    options.onDispose?.();
  };
  const inkDestroyed=()=>{destroyingInk=true;dispose();};
  const hidden=()=>{if(document.hidden)dispose();};
  const tick=(_time:number,delta:number)=>{
    if(disposed)return;
    if(signal.aborted||options.reduced()||options.isCurrent?.()===false||!shown(root)||!ink.active||ink.parentContainer!==root||(typeof document!=='undefined'&&document.hidden)){dispose();return;}
    const speed=options.speed?.()??1;
    elapsed+=(Number.isFinite(delta)?Math.max(0,delta):0)*(speed===2||speed===4?speed:1);
    if(endingAt===undefined&&options.ending?.()){
      endingAt=elapsed;options.onEnding?.(HIGH_MULTIPLIER_FADE_MS);
      if(disposed)return;
    }
    const fade=endingAt===undefined?1:smooth(1-(elapsed-endingAt)/HIGH_MULTIPLIER_FADE_MS);
    if(fade<=0){dispose();return;}
    ink.clear().setData('elapsed',elapsed).setData('visibleSegments',0);
    let board:Box|undefined,viewport:Box|undefined,guards:readonly Box[]|undefined;
    try{board=options.getBoard();viewport=options.getViewport();guards=options.getGuards();}catch{return;}
    if(!valid(board)||!valid(viewport)||!guards||!Array.isArray(guards)||guards.length>MAX_GUARDS||guards.some(b=>!b||!Number.isFinite(b.x+b.y+b.width+b.height)||b.width<0||b.height<0))return;
    const matrix=root.getWorldTransformMatrix(),det=matrix.a*matrix.d-matrix.b*matrix.c;
    const sum=matrix.a**2+matrix.b**2+matrix.c**2+matrix.d**2;
    const largest=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2),minimum=Math.abs(det)/largest;
    if(!Number.isFinite(minimum)||minimum<.05)return;
    const world=(p:Point):Point=>matrix.transformPoint(p.x,p.y),local=(p:Point):Point=>matrix.applyInverse(p.x,p.y);
    const inner:Box={x:viewport.x+EDGE,y:viewport.y+EDGE,width:viewport.width-2*EDGE,height:viewport.height-2*EDGE};
    const fit:Box={x:inner.x+VIEWPORT_GAP,y:inner.y+VIEWPORT_GAP,width:inner.width-2*VIEWPORT_GAP,height:inner.height-2*VIEWPORT_GAP};
    if(!valid(inner)||!valid(fit))return;
    const bounds=pad(board,REACH),region=intersect(inner,bbox(corners(bounds).map(world)));if(!region)return;
    let areas:Box[]=[region];const protectedGuards:Box[]=[];
    for(const guard of guards){
      if(guard.width===0||guard.height===0)continue;
      const protectedGuard=pad(guard,EDGE);if(!overlaps(protectedGuard,region))continue;
      protectedGuards.push(protectedGuard);
      const next:Box[]=[];for(const area of areas){next.push(...subtract(area,protectedGuard));if(next.length>MAX_AREAS)return;}
      areas=next;if(!areas.length)return;
    }
    // The flames rise from the score panel's bottom edge. The live guard
    // bounds protect numbers, cards and controls; unsafe tongues are omitted.
    const minY=board.y+EDGE/minimum,maxY=board.y+board.height-EDGE/minimum;
    const size=Math.min(1,board.width/300,board.height/95),base=board.y+board.height-5*size;
    const available=intersect(fit,region);if(!available)return;
    let visible=0;
    for(const flame of FLAMES){
      const age=elapsed-flame.delay;if(age<=0)continue;
      const alpha=smooth(age/180)*fade;if(alpha<=.005)continue;
      const grow=.12+.88*smooth(age/340),phase=age/470+flame.phase;
      const x=board.x+board.width*flame.position,foot=base+flame.baseOffset*size;
      const h=flame.height*size*grow*(.92+.08*Math.sin(phase*.8+flame.phase));
      const w=flame.width*size,pulse=.86+.14*(.5+.5*Math.sin(phase+flame.phase));
      const sheets=[
        flameSheet(x,foot,w*1.25,h*1.04,phase,flame.lean*size,flame.phase),
        flameSheet(x,foot-.3*size,w,h,phase,flame.lean*size,flame.phase),
        flameSheet(x,foot-.5*size,w*.67,h*.76,phase,flame.lean*size*.8,flame.phase),
        flameSheet(x,foot-.8*size,w*.30,h*.48,phase,flame.lean*size*.55,flame.phase)
      ];
      const geometry=sheets.flat(),localBox=bbox(geometry),worldBox=bbox(geometry.map(world));
      if(worldBox.width>fit.width||worldBox.height>fit.height)continue;
      let chosen=fittingShift(worldBox,localBox,available,bounds,minY,maxY,matrix,minimum);
      const hitsGuard=(shift:Point)=>protectedGuards.some(guard=>overlaps(pad({...worldBox,x:worldBox.x+shift.x,y:worldBox.y+shift.y},.02),guard));
      if(!chosen||hitsGuard(chosen)){
        chosen=undefined;let distance=Infinity;
        for(const area of areas){
          const open=intersect(fit,area);if(!open)continue;
          const candidate=fittingShift(worldBox,localBox,open,bounds,minY,maxY,matrix,minimum);if(!candidate)continue;
          const d=candidate.x**2+candidate.y**2;if(d<distance){chosen=candidate;distance=d;}
        }
      }
      if(!chosen||Math.hypot(chosen.x,chosen.y)>MAX_SHIFT)continue;
      const origin=world({x:0,y:0}),shift=chosen.x||chosen.y?local({x:origin.x+chosen.x,y:origin.y+chosen.y}):{x:0,y:0};
      // Keep each flame rooted at the bottom instead of sliding it up beside a number.
      if(Math.abs(shift.y)>3*size)continue;
      const colors=[0x793bc9,0x7943c9,0xb583ec,0xffeaff],opacities=[.24,.78,.82,.95];
      for(let i=0;i<sheets.length;i++)ink.fillStyle(colors[i],alpha*opacities[i]*pulse).fillPoints(sheets[i].map(p=>({x:p.x+shift.x,y:p.y+shift.y})),true);
      visible++;
    }
    ink.setData('visibleSegments',visible);
    if(visible>0&&!notifiedVisible&&endingAt===undefined){notifiedVisible=true;options.onVisibleOnce?.();}
  };
  scene.events.on('postupdate',tick);scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);
  scene.events.once('sleep',dispose);scene.events.once('pause',dispose);root.once('destroy',dispose);ink.once('destroy',inkDestroyed);signal.addEventListener('abort',dispose,{once:true});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  if(typeof window!=='undefined')window.addEventListener('blur',dispose);
  return dispose;
}
