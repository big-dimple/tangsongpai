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
  /** Optional owner check for view replacement or a changed score presentation. */
  isCurrent?:()=>boolean;
}

type Point={x:number;y:number};
interface Tongue {right:boolean;body:Point[];core?:Point[];centerX:number;tipY:number;baseY:number}
const DURATION=1700;
const EDGE=2.5; // Leave room for raster antialiasing around protected world bounds.
const VIEWPORT_GAP=4; // A whole contour should have breathing room at a screen edge.
const REACH=80; // Contains the full raised tips throughout their animation.
const MAX_GUARDS=256,MAX_AREAS=128;
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

/** Parse the original study's M/C/L/Z contours into small, smooth polygons once. */
function contour(d:string):Point[] {
  const tokens=d.match(/[MCLZ]|-?\d+(?:\.\d+)?/g)??[],out:Point[]=[];
  let i=0,current:Point={x:0,y:0},command='';
  const num=()=>Number(tokens[i++]);
  while(i<tokens.length){
    if(/^[MCLZ]$/.test(tokens[i]))command=tokens[i++];
    if(command==='Z')break;
    if(command==='M'||command==='L'){current={x:num(),y:num()};out.push(current);command='L';continue;}
    if(command==='C'){
      const a={x:num(),y:num()},b={x:num(),y:num()},end={x:num(),y:num()},start=current;
      for(let step=1;step<=6;step++){
        const t=step/6,u=1-t;
        out.push({x:u*u*u*start.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*end.x,
          y:u*u*u*start.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*end.y});
      }
      current=end;continue;
    }
    throw new Error('Unsupported aura contour');
  }
  return out;
}
function tongue(right:boolean,d:string,core?:string):Tongue {
  const body=contour(d),xs=body.map(p=>p.x),ys=body.map(p=>p.y);
  return {right,body,core:core?contour(core):undefined,centerX:(Math.min(...xs)+Math.max(...xs))/2,tipY:Math.min(...ys),baseY:Math.max(...ys)};
}
// Source coordinates and colors are taken from the provided v3 score-panel study.
// Each contour has its own staggered rise/fade; gaps are preserved between contours.
const TONGUES:Tongue[]=[
  tongue(false,'M 3 86 C -6 80 -10 72 -9 62 C -8 54 -13 48 -11 42 C -6 46 -5 52 -5 57 C -3 50 -4 41 -6 34 C 1 40 1 48 1 54 C 3 47 8 42 7 35 C 13 42 10 51 9 57 L 12 84 Z',
    'M -4 78 C -6 70 -7 61 -7 54 C -4 59 -4 64 -3 68 C -1 64 -1 58 -2 53 C 2 58 1 65 1 71 C 1 74 2 77 1 79 Z'),
  tongue(false,'M -16 65 C -19 60 -19 53 -17 47 C -15 42 -15 38 -16 34 C -11 38 -10 45 -12 50 C -13 56 -12 62 -13 65 Z'),
  tongue(false,'M -4 5 C -10 -3 -12 -12 -8 -20 C -7 -25 -8 -30 -10 -34 C -4 -30 -3 -25 -3 -20 C 1 -25 3 -31 2 -38 C 10 -31 9 -24 7 -18 C 11 -21 14 -26 14 -31 C 19 -23 15 -16 13 -10 C 12 -5 13 0 12 5 Z',
    'M -4 0 C -7 -6 -6 -11 -5 -17 C -2 -13 -3 -8 -1 -6 C 1 -9 2 -14 2 -18 C 6 -13 5 -8 3 -3 L 4 0 Z'),
  tongue(false,'M 5 -1 C 13 -6 21 -6 29 -9 C 37 -12 44 -9 52 -7 C 58 -6 63 -8 67 -11 C 65 -5 58 -2 50 -2 C 42 -2 36 -5 29 -4 C 19 -3 12 1 5 2 Z'),
  tongue(false,'M 50 -4 C 47 -9 49 -14 49 -19 C 54 -15 54 -10 53 -6 Z',
    'M 50 -7 C 50 -10 51 -12 51 -15 C 53 -12 52 -9 52 -7 Z'),
  tongue(true,'M 180 -4 C 178 -10 181 -15 182 -23 C 188 -18 188 -11 186 -6 Z',
    'M 183 -7 C 182 -11 184 -13 184 -17 C 186 -14 185 -10 185 -7 Z'),
  tongue(true,'M 185 -1 C 195 -6 204 -8 214 -6 C 223 -4 232 -5 241 -10 C 237 -4 231 -1 223 -1 C 213 -1 207 -4 199 -2 C 193 -1 189 1 185 2 Z'),
  tongue(true,'M 239 5 C 238 -1 238 -8 241 -15 C 243 -21 241 -27 240 -33 C 246 -29 248 -23 247 -18 C 251 -23 253 -29 252 -34 C 259 -27 259 -20 256 -14 C 260 -16 263 -20 264 -24 C 268 -15 263 -8 260 -3 C 258 1 258 4 258 7 Z',
    'M 246 0 C 244 -6 247 -11 247 -16 C 250 -12 249 -8 250 -6 C 253 -9 254 -13 254 -17 C 258 -12 257 -7 255 -3 L 256 0 Z'),
  tongue(true,'M 249 85 L 249 62 C 248 54 249 47 251 40 C 255 46 255 52 254 58 C 258 52 261 46 260 39 C 266 48 263 56 261 63 C 263 71 260 80 257 84 Z',
    'M 253 78 C 253 71 252 64 253 57 C 255 61 255 66 255 70 C 257 66 258 62 258 58 C 260 64 258 71 257 77 Z'),
  tongue(true,'M 269 70 C 266 64 268 57 270 52 C 272 47 272 42 270 37 C 276 42 276 49 273 55 C 271 61 273 66 271 69 Z')
];

/** Clip a polygon to a rectangle. Its convex clip bounds also contain the renderer's triangles. */
function clip(points:readonly Point[],b:Box):Point[] {
  let out=[...points];
  const edges:readonly [keyof Point,number,boolean][]=[['x',b.x,true],['x',b.x+b.width,false],['y',b.y,true],['y',b.y+b.height,false]];
  for(const [axis,edge,greater] of edges){
    if(!out.length)break;
    const input=out;out=[];
    const inside=(p:Point)=>greater?p[axis]>=edge:p[axis]<=edge;
    for(let i=0;i<input.length;i++){
      const p=input[i],q=input[(i+1)%input.length],pin=inside(p),qin=inside(q);
      if(pin)out.push(p);
      if(pin!==qin){const t=(edge-p[axis])/(q[axis]-p[axis]);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
    }
  }
  return out;
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

/** Find the smallest world-space translation that keeps a whole raised flame safe. */
function fittingShift(worldBox:Box,localBox:Box,area:Box,localBounds:Box,top:number,m:{a:number;b:number;c:number;d:number},minimum:number):Point|undefined {
  const inset=.02,epsilon=inset/minimum;
  const left=area.x+inset-worldBox.x,right=area.x+area.width-inset-worldBox.x-worldBox.width;
  const topShift=area.y+inset-worldBox.y,bottom=area.y+area.height-inset-worldBox.y-worldBox.height;
  if(left>right||topShift>bottom)return;
  const det=m.a*m.d-m.b*m.c,ix=m.d/det,iy=-m.c/det,jx=-m.b/det,jy=m.a/det;
  const limits:readonly [number,number,number][]=[
    [ix,iy,localBounds.x+localBounds.width-localBox.x-localBox.width-epsilon],
    [-ix,-iy,localBox.x-localBounds.x-epsilon],
    [jx,jy,top-localBox.y-localBox.height-epsilon],
    [-jx,-jy,localBox.y-localBounds.y-epsilon]
  ];
  if(left<=0&&right>=0&&topShift<=0&&bottom>=0&&limits.every(([, ,limit])=>limit>=0))return {x:0,y:0};
  let polygon:Point[]=[{x:left,y:topShift},{x:right,y:topShift},{x:right,y:bottom},{x:left,y:bottom}];
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

/**
 * A 1.7s, non-interactive visual. It does not start a clock or wait on scoring.
 * Both Canvas and WebGL receive the same clipped filled polygons; no inverse mask
 * or blend mode is required. The owner owns event eligibility and replay policy.
 */
export function mountHighMultiplierAura(scene:Phaser.Scene,options:HighMultiplierAuraOptions):()=>void {
  const {root,signal}=options;
  if(signal.aborted||options.reduced()||!shown(root)||(typeof document!=='undefined'&&document.hidden)||options.isCurrent?.()===false)return noop;
  const ink=scene.add.graphics().setName('score/high-multiplier-aura').setData('eventId',options.eventId).setData('elapsed',0).setData('visibleSegments',0);
  root.add(ink);
  let elapsed=0,disposed=false,destroyingInk=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    scene.events.off('postupdate',tick);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);
    scene.events.off('sleep',dispose);scene.events.off('pause',dispose);root.off('destroy',dispose);ink.off('destroy',inkDestroyed);signal.removeEventListener('abort',dispose);
    if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
    if(typeof window!=='undefined')window.removeEventListener('blur',dispose);
    if(!destroyingInk&&ink.active)ink.destroy();
  };
  const inkDestroyed=()=>{destroyingInk=true;dispose();};
  const hidden=()=>{if(document.hidden)dispose();};
  const tick=(_time:number,delta:number)=>{
    if(disposed)return;
    if(signal.aborted||options.reduced()||options.isCurrent?.()===false||!shown(root)||!ink.active||ink.parentContainer!==root||(typeof document!=='undefined'&&document.hidden)){dispose();return;}
    elapsed+=Number.isFinite(delta)?Math.max(0,delta):0;
    if(elapsed>=DURATION){dispose();return;}
    ink.clear().setData('elapsed',elapsed).setData('visibleSegments',0);
    let board:Box|undefined,viewport:Box|undefined,guards:readonly Box[]|undefined;
    try{board=options.getBoard();viewport=options.getViewport();guards=options.getGuards();}catch{return;}
    // Unknown, invalid or overwhelming guard lists fail closed for this frame.
    if(!valid(board)||!valid(viewport)||!guards||!Array.isArray(guards)||guards.length>MAX_GUARDS||guards.some(b=>!b||!Number.isFinite(b.x+b.y+b.width+b.height)||b.width<0||b.height<0))return;
    const matrix=root.getWorldTransformMatrix(),det=matrix.a*matrix.d-matrix.b*matrix.c;
    const sum=matrix.a**2+matrix.b**2+matrix.c**2+matrix.d**2;
    const largest=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2),minimum=Math.abs(det)/largest;
    if(!Number.isFinite(minimum)||minimum<.05)return;
    const world=(p:Point):Point=>matrix.transformPoint(p.x,p.y),local=(p:Point):Point=>matrix.applyInverse(p.x,p.y);
    const inner:Box={x:viewport.x+EDGE,y:viewport.y+EDGE,width:viewport.width-2*EDGE,height:viewport.height-2*EDGE};
    if(!valid(inner))return;
    const region=intersect(inner,bbox(corners(pad(board,REACH)).map(world)));if(!region)return;
    let areas:Box[]=[region];const protectedGuards:Box[]=[];
    for(const guard of guards){
      if(guard.width===0||guard.height===0)continue;
      const protectedGuard=pad(guard,EDGE);if(!overlaps(protectedGuard,region))continue;
      // A world AABB wholly inside the board is already excluded in local space.
      const localGuard=corners(protectedGuard).map(local);
      if(localGuard.every(p=>p.x>=board!.x&&p.x<=board!.x+board!.width&&p.y>=board!.y&&p.y<=board!.y+board!.height))continue;
      protectedGuards.push(protectedGuard);
      const next:Box[]=[];for(const area of areas){next.push(...subtract(area,protectedGuard));if(next.length>MAX_AREAS)return;}
      areas=next;if(!areas.length)return;
    }
    const safeBoard=pad(board,EDGE/minimum),bounds=pad(board,REACH);
    const outside=subtract(bounds,safeBoard),scale=Math.min(1.12,board.width/250,board.height/100);
    const fit:Box={x:inner.x+VIEWPORT_GAP,y:inner.y+VIEWPORT_GAP,width:inner.width-2*VIEWPORT_GAP,height:inner.height-2*VIEWPORT_GAP};
    if(!valid(fit))return;
    const boardWorld=bbox(corners(board).map(world)),sideRoom=32*scale*largest;
    const leftTight=boardWorld.x-fit.x<sideRoom,rightTight=fit.x+fit.width-boardWorld.x-boardWorld.width<sideRoom;
    const raisedTop=leftTight||rightTight;
    let visible=0;
    for(let index=0;index<TONGUES.length;index++){
      const shape=TONGUES[index],delay=(index%5)*46+Math.floor(index/5)*23+(raisedTop&&index===7?60:0),age=elapsed-delay;
      if(age<=0)continue;
      const alpha=smooth(age/290)*smooth((DURATION-elapsed)/(410+delay));if(alpha<=.005)continue;
      const grow=.72+.28*smooth(age/420),rise=4.6*clamp(age/(DURATION-delay)),offset=shape.right?board.x+board.width-250*scale:board.x;
      const period=1400+index*60,phase=age*2*Math.PI/period+index*1.85,height=Math.max(1,shape.baseY-shape.tipY);
      // Side flames need more room than a phone's narrow outer gutter offers.
      // Move each intact silhouette to a separate place along the top edge,
      // keeping its own phase and core. Lift the other top contours as well so
      // their bases remain outside the protected score panel.
      const side=index===0||index===1||index===8||index===9;
      const relocated=side&&raisedTop,top=relocated||raisedTop&&!side;
      const main=index===0||index===8,inset=Math.min(board.width*(main ? .28 : .34),scale*(main ? 90 : 110));
      const anchorX=relocated?(shape.right?board.x+board.width-inset:board.x+inset):offset+shape.centerX*scale;
      const anchorY=top?board.y-EDGE/minimum-.5:board.y+shape.baseY*scale;
      // Keep the relocated flames in the short band between the score frame
      // and the listening illustration, where their tips remain legible.
      const ribbon=raisedTop&&(index===3||index===6);
      const scaleX=scale*(relocated ? .75 : ribbon ? (shape.right ? .36 : .42) : raisedTop&&index===2 ? .85 : raisedTop&&index===7 ? .72 : 1);
      const scaleY=scale*(relocated ? (shape.right ? .47 : .33) : ribbon ? .38 : raisedTop&&index===2 ? .80 : raisedTop&&index===7 ? .61 : 1);
      // The phone's raised, shorter flames need visible motion of their own,
      // not just a common fade. Each contour keeps a different, slow phase.
      const breathing=raisedTop ? 1+.14*Math.sin(phase+index*.57) : 1;
      const bodyColor=raisedTop?0x7952d7:0xa273ec;
      const shimmer=raisedTop ? .90+.10*Math.sin(phase+index*.43) : 1;
      // Bend and lengthen the tip, not the entire contour. Vary phase within a
      // multi-pronged contour as well as between contours; the white core shares
      // this same displacement field. Slow periods avoid flicker or jitter.
      const position=(p:Point):Point=>{
        const weight=smooth((shape.baseY-p.y)/height),branch=(p.x-shape.centerX)*.09;
        const bend=(raisedTop?4:2.8)*Math.sin(phase+branch),stretch=1.6+1.4*Math.sin(phase*.9+index*.4+branch*.45);
        return {x:anchorX+((p.x-shape.centerX)*(.91+.09*grow)+weight*bend)*scaleX,
          y:anchorY+((p.y-shape.baseY)*grow*breathing-rise-weight*stretch)*scaleY};
      };
      // Fit the *whole* animated body before clipping to content guards. Moving
      // the core by the same amount preserves its relation to the silhouette;
      // cutting a polygon at the viewport would leave visibly flattened tips.
      const body=shape.body.map(position),geometry=shape.core?[...body,...shape.core.map(position)]:body;
      const geometryLocal=bbox(geometry),bodyWorld=bbox(geometry.map(world));
      if(bodyWorld.width>fit.width||bodyWorld.height>fit.height)continue;
      let shiftX=0,shiftY=0;
      if(raisedTop){
        const available=intersect(fit,region);if(!available)continue;
        let chosen=fittingShift(bodyWorld,geometryLocal,available,bounds,safeBoard.y,matrix,minimum);
        const hitsGuard=(shift:Point)=>protectedGuards.some(guard=>overlaps(pad({...bodyWorld,x:bodyWorld.x+shift.x,y:bodyWorld.y+shift.y},.02),guard));
        if(!chosen||hitsGuard(chosen)){
          chosen=undefined;let distance=Infinity;
          for(const area of areas){
            const available=intersect(fit,area);if(!available)continue;
            const candidate=fittingShift(bodyWorld,geometryLocal,available,bounds,safeBoard.y,matrix,minimum);
            // Each area was already partitioned outside every protected guard.
            if(!candidate)continue;
            const d=candidate.x**2+candidate.y**2;if(d<distance){chosen=candidate;distance=d;}
          }
        }
        if(!chosen)continue;shiftX=chosen.x;shiftY=chosen.y;
      }else{
        shiftX=bodyWorld.x<fit.x?fit.x-bodyWorld.x:bodyWorld.x+bodyWorld.width>fit.x+fit.width?fit.x+fit.width-bodyWorld.x-bodyWorld.width:0;
        shiftY=bodyWorld.y<fit.y?fit.y-bodyWorld.y:bodyWorld.y+bodyWorld.height>fit.y+fit.height?fit.y+fit.height-bodyWorld.y-bodyWorld.height:0;
      }
      const origin=world({x:0,y:0}),shift=shiftX||shiftY?local({x:origin.x+shiftX,y:origin.y+shiftY}):{x:0,y:0};
      const paint=(path:readonly Point[],color:number,opacity:number)=>{
        const positioned=path.map(p=>{const q=position(p);return {x:q.x+shift.x,y:q.y+shift.y};}),boundsLocal=bbox(positioned);
        // Raised phone flames have already been fitted as whole contours.
        // Drawing them directly avoids partition boundaries cutting distant ink.
        if(raisedTop){ink.fillStyle(color,opacity).fillPoints(positioned,true);if(color===bodyColor)visible++;return;}
        for(const exterior of outside){
          if(!overlaps(boundsLocal,exterior))continue;
          const localPart=clip(positioned,exterior);if(localPart.length<3)continue;
          const worldPart=localPart.map(world),boundsWorld=bbox(worldPart);
          for(const area of areas){
            if(!overlaps(boundsWorld,area))continue;
            const part=clip(worldPart,area);if(part.length<3)continue;
            const draw=part.map(local);ink.fillStyle(color,opacity).fillPoints(draw,true);
            if(color===bodyColor)visible++;
          }
        }
      };
      paint(shape.body,0x6c3bd0,alpha*.21);
      paint(shape.body,bodyColor,alpha*(raisedTop ? .86 : .72)*shimmer*(ribbon ? .7 : 1));
      if(shape.core)paint(shape.core,0xf5e7ff,alpha*(raisedTop ? .96 : .82)*shimmer);
    }
    ink.setData('visibleSegments',visible);
  };
  scene.events.on('postupdate',tick);scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);
  scene.events.once('sleep',dispose);scene.events.once('pause',dispose);root.once('destroy',dispose);ink.once('destroy',inkDestroyed);signal.addEventListener('abort',dispose,{once:true});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  if(typeof window!=='undefined')window.addEventListener('blur',dispose);
  return dispose;
}
