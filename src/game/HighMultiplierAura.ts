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
  /** Guards for a faint layer below the score's own foreground text. */
  getBackdropGuards?:()=>readonly Box[]|undefined;
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
const EDGE=2.5,VIEWPORT_GAP=4,REACH=80;
const MAX_GUARDS=256,MAX_AREAS=128;
const FLAMES:readonly Flame[]=[
  {position:.055,width:20,height:42,delay:45,phase:.2,lean:-3,baseOffset:-1},
  {position:.16,width:17,height:31,delay:145,phase:2.5,lean:2,baseOffset:0},
  {position:.23,width:21,height:50,delay:86,phase:1.0,lean:3,baseOffset:-1},
  {position:.325,width:18,height:38,delay:0,phase:1.5,lean:3,baseOffset:0},
  {position:.49,width:20,height:47,delay:55,phase:5.1,lean:-2,baseOffset:0},
  {position:.60,width:17,height:32,delay:65,phase:2.3,lean:-4,baseOffset:-1},
  {position:.68,width:22,height:46,delay:112,phase:4.0,lean:-3,baseOffset:0},
  {position:.85,width:21,height:49,delay:75,phase:4.8,lean:-2,baseOffset:-1},
  {position:.95,width:19,height:39,delay:25,phase:5.6,lean:3,baseOffset:-1}
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

/** Clip a sheet to a guard-free world-space rectangle, preserving its visible part. */
function clipSheet(points:readonly Point[],area:Box):Point[] {
  let output=[...points];
  const edges:readonly [keyof Point,number,number][]=[['x',area.x,1],['x',area.x+area.width,-1],['y',area.y,1],['y',area.y+area.height,-1]];
  for(const [axis,edge,sign] of edges){
    const input=output;output=[];if(!input.length)break;
    for(let i=0;i<input.length;i++){
      const p=input[i],q=input[(i+1)%input.length],a=(p[axis]-edge)*sign,b=(q[axis]-edge)*sign;
      if(a>=0)output.push(p);
      if((a>=0)!==(b>=0)){const t=a/(a-b);output.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
    }
  }
  return output;
}

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
  const anchor=root.list.find(object=>object.name==='score/source'||object.name.startsWith('score/formula-')||['score/heat','score/multiplier','score/total'].includes(object.name));
  const backdrop=anchor&&options.getBackdropGuards?scene.add.graphics().setName('score/high-multiplier-aura-backdrop'):undefined;
  if(backdrop&&anchor){root.add(backdrop);root.moveBelow(backdrop,anchor);}
  let elapsed=0,disposed=false,destroyingInk=false,notifiedVisible=false,endingAt:number|undefined;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    scene.events.off('postupdate',tick);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);
    scene.events.off('sleep',dispose);scene.events.off('pause',dispose);root.off('destroy',dispose);ink.off('destroy',inkDestroyed);signal.removeEventListener('abort',dispose);
    if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
    if(typeof window!=='undefined')window.removeEventListener('blur',dispose);
    if(!destroyingInk&&ink.active)ink.destroy();
    if(backdrop?.active)backdrop.destroy();
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
    ink.clear().setData('elapsed',elapsed).setData('visibleSegments',0).setData('rootSegments',0);backdrop?.clear();
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
    const partition=(items:readonly Box[]|undefined):{areas:Box[];protectedGuards:Box[]}|undefined=>{
      if(!items||!Array.isArray(items)||items.length>MAX_GUARDS||items.some(b=>!b||!Number.isFinite(b.x+b.y+b.width+b.height)||b.width<0||b.height<0))return;
      let areas:Box[]=[region];const protectedGuards:Box[]=[];
      for(const guard of items){
        if(guard.width===0||guard.height===0)continue;
        const protectedGuard=pad(guard,EDGE);if(!overlaps(protectedGuard,region))continue;
        protectedGuards.push(protectedGuard);
        const next:Box[]=[];for(const area of areas){next.push(...subtract(area,protectedGuard));if(next.length>MAX_AREAS)return;}
        areas=next;if(!areas.length)break;
      }
      return {areas,protectedGuards};
    };
    const protectedAreas=partition(guards);if(!protectedAreas?.areas.length)return;
    const {areas,protectedGuards}=protectedAreas;
    // The flames rise from the score panel's bottom edge. Live bounds protect
    // numbers, cards and controls, including while they move during scoring.
    const inset=EDGE/minimum,boardSafe={x:board.x+inset,y:board.y+inset,width:board.width-2*inset,height:board.height-2*inset};
    if(!valid(boardSafe))return;
    const size=Math.min(1,board.width/300,board.height/95),base=board.y+board.height-5*size;
    const available=intersect(fit,region);if(!available)return;
    const paintSafe=(points:Point[],color:number,alpha:number,anchor:number):boolean=>{
      const bounded=clipSheet(points,boardSafe);if(bounded.length<3)return false;
      const worldPoints=bounded.map(world),box=bbox(worldPoints);
      if(box.x>=fit.x&&box.y>=fit.y&&box.x+box.width<=fit.x+fit.width&&box.y+box.height<=fit.y+fit.height&&
        !protectedGuards.some(guard=>overlaps(pad(box,.02),guard))){ink.fillStyle(color,alpha).fillPoints(bounded,true);return true;}
      let painted=false;
      for(const area of areas){
        const open=intersect(fit,area);if(!open||!overlaps(box,open))continue;
        // A tiny inset keeps rounding at the guard edge from touching text.
        const safe={x:open.x+.02,y:open.y+.02,width:open.width-.04,height:open.height-.04};if(!valid(safe))continue;
        const clipped=clipSheet(worldPoints,safe).map(local);
        // Never leave a disconnected fleck floating above a protected number.
        if(clipped.length<3||Math.max(...clipped.map(p=>p.y))<anchor)continue;
        ink.fillStyle(color,alpha).fillPoints(clipped,true);painted=true;
      }
      return painted;
    };
    // A connected, uneven bed gives the flame body between the taller tongues.
    // Short sections let the bed flow around a changing number without cutting
    // a hole in the whole row.
    const rootLeft=board.x+4*size,rootRight=board.x+board.width-4*size;
    const rootBottom=board.y+board.height-Math.max(EDGE/minimum,3.5*size);
    let backdropVisible=false;
    if(backdrop?.active){
      let behind:ReturnType<typeof partition>;
      try{behind=partition(options.getBackdropGuards?.());}catch{behind=undefined;}
      if(behind?.areas.length){
        const baseAlpha=smooth(elapsed/180)*fade;
        const contour=Array.from({length:81},(_,i)=>{
          const u=i/80,x=rootLeft+(rootRight-rootLeft)*u;
          let lift=12+1.4*Math.sin(u*19+elapsed/1000);
          for(let j=0;j<9;j++){
            const center=(j+.42+(j%3)*.06)/9+.008*Math.sin(elapsed/1200+j*1.7);
            const width=u<center?.047+(j%2)*.012:.032+(j%3)*.008;
            const tip=Math.pow(Math.max(0,1-Math.abs(u-center)/width),.8);
            lift=Math.max(lift,10+(17+(j%4)*4+2*Math.sin(elapsed/850+j))*tip);
          }
          return {x,y:rootBottom-lift*size};
        });
        const layer=[...contour,{x:rootRight,y:rootBottom},{x:rootLeft,y:rootBottom}];
        const inner=layer.map(p=>({x:p.x,y:p.y+(rootBottom-p.y)*.5}));
        for(const [points,color,alpha] of [[layer,0x8549bc,.17],[inner,0xc392e5,.12]] as const){
          const bounded=clipSheet(points,boardSafe),wp=bounded.map(world),box=bbox(wp);
          for(const area of behind.areas){
            const open=intersect(fit,area);if(!open||!overlaps(box,open))continue;
            const safe={x:open.x+.02,y:open.y+.02,width:open.width-.04,height:open.height-.04};if(!valid(safe))continue;
            const clipped=clipSheet(wp,safe).map(local);if(clipped.length<3)continue;
            backdrop.fillStyle(color,alpha*baseAlpha).fillPoints(clipped,true);backdropVisible=true;
          }
        }
      }
    }
    const rootPieces=Math.min(80,Math.max(1,Math.ceil((rootRight-rootLeft)/Math.max(1,11*size))));
    const localGuards=protectedGuards.map(guard=>bbox(corners(guard).map(local)));
    const rootPeaks=FLAMES.flatMap((flame,i)=>{
      const drift=.004*Math.sin(elapsed/930+flame.phase),height=6+flame.height*.25+1.4*Math.sin(elapsed/710+flame.phase);
      const peak={center:flame.position+drift,left:.034+(i%2)*.005,right:.042-(i%3)*.003,height};
      if(i===FLAMES.length-1)return [peak];
      const next=FLAMES[i+1],between={center:(flame.position+next.position)/2-drift*.6,left:.025,right:.03,height:4+(i%3)*1.2+.7*Math.sin(elapsed/870+flame.phase)};
      return [peak,between];
    });
    const rootTop=(x:number)=>{
      const u=(x-board.x)/board.width;let lift=7+1.1*Math.sin(u*Math.PI*8+elapsed/1100);
      for(const peak of rootPeaks){const d=(u-peak.center)/(u<peak.center?peak.left:peak.right),shape=smooth(1-Math.abs(d));lift=Math.max(lift,5+peak.height*shape);}
      // Ease the crest down before a text boundary instead of chopping it flat.
      for(const guard of localGuards){
        if(guard.y>=rootBottom||guard.y+guard.height<=rootBottom-lift*size)continue;
        const distance=x<guard.x?guard.x-x:x>guard.x+guard.width?x-guard.x-guard.width:0;
        const influence=1-smooth(distance/(7*size));if(influence<=0)continue;
        const clearance=Math.max(1.8,(rootBottom-(guard.y+guard.height+.4))/size);
        lift=Math.min(lift,clearance+(lift-clearance)*(1-influence));
      }
      return rootBottom-lift*size;
    };
    const rootAlpha=smooth(elapsed/150)*fade;let rootVisible=0;
    for(let i=0;i<rootPieces&&rootAlpha>.005;i++){
      const x0=rootLeft+(rootRight-rootLeft)*i/rootPieces,x1=rootLeft+(rootRight-rootLeft)*(i+1)/rootPieces;
      const bed=[{x:x0,y:rootBottom-1.8*size},{x:x1,y:rootBottom-1.8*size},{x:x1,y:rootBottom},{x:x0,y:rootBottom}];
      let painted=paintSafe(bed,0x7135ad,.28*rootAlpha,rootBottom-2*size);
      const points=[...Array.from({length:5},(_,j)=>{const x=x0+(x1-x0)*j/4;return{x,y:rootTop(x)};}),{x:x1,y:rootBottom},{x:x0,y:rootBottom}];
      painted=paintSafe(points,0x7135ad,.48*rootAlpha,rootBottom-2*size)||painted;
      const inner=points.map(p=>({x:p.x,y:p.y+(rootBottom-p.y)*.50}));
      painted=paintSafe(inner,0xc28ae9,.38*rootAlpha,rootBottom-2*size)||painted;
      if(painted)rootVisible++;
    }
    let visible=0;const placed:number[]=[];
    for(const flame of FLAMES){
      const age=elapsed-flame.delay;if(age<=0)continue;
      const alpha=smooth(age/180)*fade;if(alpha<=.005)continue;
      const grow=.12+.88*smooth(age/340),phase=age/470+flame.phase;
      const x=board.x+board.width*flame.position,foot=base+flame.baseOffset*size;
      const h=flame.height*size*grow*(.92+.08*Math.sin(phase*.8+flame.phase));
      const w=flame.width*size,pulse=.86+.14*(.5+.5*Math.sin(phase+flame.phase));
      let sheets:Point[][]|undefined,shift=0;
      // Fit a whole tongue in the gaps around live text. The roots already
      // cover the row, so a blocked tongue can simply yield to its neighbours.
      for(const narrow of [1,.8,.65]){
        const candidate=[
          flameSheet(x,foot,w*1.25*narrow,h*1.04,phase,flame.lean*size,flame.phase),
          flameSheet(x,foot-.3*size,w*narrow,h,phase,flame.lean*size,flame.phase),
          flameSheet(x,foot-.5*size,w*.67*narrow,h*.76,phase,flame.lean*size*.8,flame.phase),
          flameSheet(x,foot-.8*size,w*.30*narrow,h*.48,phase,flame.lean*size*.55,flame.phase)
        ];
        const geometry=candidate.flat(),localBox=bbox(geometry),worldBox=bbox(geometry.map(world));
        for(const offset of [0,-4,4,-8,8,-12,12,-16,16,-20,20]){
          const dx=offset*size,cx=x+dx;if(placed.some(other=>Math.abs(other-cx)<19*size))continue;
          const moved={...worldBox,x:worldBox.x+matrix.a*dx,y:worldBox.y+matrix.b*dx};
          if(localBox.x+dx<boardSafe.x||localBox.x+localBox.width+dx>boardSafe.x+boardSafe.width||
            localBox.y<boardSafe.y||localBox.y+localBox.height>boardSafe.y+boardSafe.height||
            moved.x<fit.x||moved.y<fit.y||moved.x+moved.width>fit.x+fit.width||moved.y+moved.height>fit.y+fit.height||
            protectedGuards.some(guard=>overlaps(pad(moved,.02),guard)))continue;
          sheets=candidate;shift=dx;break;
        }
        if(sheets)break;
      }
      if(!sheets)continue;
      const colors=[0x793bc9,0x7943c9,0xb583ec,0xffeaff],opacities=[.24,.78,.82,.95];
      for(let i=0;i<sheets.length;i++)ink.fillStyle(colors[i],alpha*opacities[i]*pulse).fillPoints(sheets[i].map(p=>({x:p.x+shift,y:p.y})),true);
      placed.push(x+shift);visible++;
    }
    ink.setData('visibleSegments',visible).setData('rootSegments',rootVisible);
    if((visible>0||rootVisible>0||backdropVisible)&&!notifiedVisible&&endingAt===undefined){notifiedVisible=true;options.onVisibleOnce?.();}
  };
  scene.events.on('postupdate',tick);scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);
  scene.events.once('sleep',dispose);scene.events.once('pause',dispose);root.once('destroy',dispose);ink.once('destroy',inkDestroyed);signal.addEventListener('abort',dispose,{once:true});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  if(typeof window!=='undefined')window.addEventListener('blur',dispose);
  return dispose;
}
