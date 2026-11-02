import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';
import {drawElectricFork,electricBranches,electricFork,electricSeed,electricVariation} from './HeroElectricGeometry';
import {cardVisualRoot} from './CardVisualRoot';
import {cssViewport} from '../platform/Viewport';
import type {HeroInkBox} from './HeroVisibleSurface';
import type {AttachmentMotion} from './HeroTargetAttachmentState';

export const HERO_TARGET_AFTERGLOW_MS=1850;
export interface AfterglowCard {id:string;container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container;width:number;height:number}
export interface AfterglowRequest {
 cards:readonly AfterglowCard[];
 root:Phaser.GameObjects.Container;
 /** Current root-local ink bounds, including all other card faces and controls. */
 masks:()=>readonly HeroInkBox[];
 signal:AbortSignal;
 /** Verify this exact container still represents the target, including during pagination. */
 isCurrent?:(card:AfterglowCard)=>boolean;
 /** A later impact may refresh its own card without extinguishing its peers. */
 retainOthers?:boolean;
}
interface Glow {request:AfterglowRequest;card:AfterglowCard;body:Phaser.GameObjects.Container;ink:Phaser.GameObjects.Graphics;elapsed:number;lastTime?:number;cancel:()=>void}

function visibleThrough(node:Phaser.GameObjects.Container,root:Phaser.GameObjects.Container):boolean {
 for(let n:Phaser.GameObjects.Container|null=node;n;n=n.parentContainer){if(!n.active||!n.visible||n.alpha<=0)return false;if(n===root)return true;}return false;
}
function localBox(box:InkBox,root:Phaser.GameObjects.Container,body:Phaser.GameObjects.Container):InkBox {
 const r=root.getWorldTransformMatrix(),m=body.getWorldTransformMatrix();
 const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>{const p=r.transformPoint(x,y);return m.applyInverse(p.x,p.y);});
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
/** View-only, exact-card ownership; the caller supplies current protective ink bounds. */
export class HeroTargetAfterglow {
 private readonly glows=new Map<string,Glow>();
 private destroyed=false;
 private drawElapsed=0;
 private lastFrameTime?:number;
 private readonly tick=(time:number,delta:number)=>{const dt=this.lastFrameTime===undefined?delta:Math.max(0,time-this.lastFrameTime);this.lastFrameTime=time;this.update(time,dt);};
 private readonly hide=()=>this.clear();
 private readonly visibility=()=>{if(document.hidden)this.clear();};
 constructor(private readonly scene:Phaser.Scene,private readonly motion:()=>AttachmentMotion){
  scene.events.on('update',this.tick);scene.events.once('shutdown',this.destroy);scene.events.once('destroy',this.destroy);
  window.addEventListener('blur',this.hide);document.addEventListener('visibilitychange',this.visibility);
 }
 play(request:AfterglowRequest):void {
  if(!request.retainOthers)this.clear();this.drawElapsed=0;
  const {root,signal}=request;
  if(this.destroyed||signal.aborted||this.motion()!=='full'||document.hidden)return;
  for(const card of request.cards.slice(0,5)){
   if(!this.glows.has(card.id)&&this.glows.size>=5)continue;
   if(this.glows.has(card.id))this.remove(card.id);
   const body=cardVisualRoot(card);
   if(!Number.isFinite(card.width+card.height)||card.width<=0||card.height<=0||request.isCurrent?.(card)===false||!visibleThrough(body,root)||!visibleThrough(card.container,root))continue;
   const ink=this.scene.add.graphics().setName('hero/target-afterglow').setData('targetCardId',card.id);body.add(ink);
   const now=this.scene.game.loop?.now,cancel=()=>this.remove(card.id),glow:Glow={request,card,body,ink,elapsed:0,lastTime:Number.isFinite(now)?now:undefined,cancel};this.glows.set(card.id,glow);
   signal.addEventListener('abort',cancel,{once:true});body.once('destroy',cancel);if(body!==card.container)card.container.once('destroy',cancel);
  }
  if(this.glows.size)this.drawAll();
 }
 private drawAll():void {
  // Retained impacts can come from different requests. Share a traversal only
  // when they explicitly use the same dynamic mask supplier.
  const bySupplier=new Map<AfterglowRequest['masks'],readonly HeroInkBox[]>();
  for(const glow of this.glows.values()){
   let masks=bySupplier.get(glow.request.masks);if(!masks){masks=glow.request.masks();bySupplier.set(glow.request.masks,masks);}
   this.draw(glow,masks);
  }
 }
 private draw(glow:Glow,masks:readonly HeroInkBox[]):void {
  const {root}=glow.request,card=glow.card,m=glow.body.getWorldTransformMatrix(),sum=m.a*m.a+m.b*m.b+m.c*m.c+m.d*m.d,det=m.a*m.d-m.b*m.c;
  const scale=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2),minimum=Math.abs(det)/scale;
  glow.ink.clear().setData('electricSegments',0).setData('electricHeads',[]);if(!Number.isFinite(scale)||!Number.isFinite(minimum)||minimum<.01)return;
  // Keep all ink outside the face even when the card is scaled or rotated.
  // Stroke widths stay bounded in screen space; the conservative minimum scale
  // also protects paper and controls under a nonuniform card transform.
  const clearance=3.2/minimum,pad=3.7/minimum;
  const boxes:InkBox[]=[{x:-card.width/2,y:-card.height/2,width:card.width,height:card.height},...masks.filter(b=>!(b.ownerId===card.id&&(b.inkKind==='face'||b.inkKind==='paper'))).map(b=>({...b,...localBox(b,root,glow.body)}))];
  glow.ink.setData('protectedBoxes',boxes);
  const viewport=cssViewport(this.scene),safeX=4+clearance*Math.hypot(m.a,m.c),safeY=4+clearance*Math.hypot(m.b,m.d);
  const visible=(p:InkPoint)=>{const q=m.transformPoint(p.x,p.y);return q.x>=safeX&&q.x<=viewport.width-safeX&&q.y>=safeY&&q.y<=viewport.height-safeY;};
  const fade=Math.max(0,Math.min(1,(HERO_TARGET_AFTERGLOW_MS-glow.elapsed)/520));
  const alpha=fade*(.88+.045*Math.sin(glow.elapsed/170));
  const seed=electricSeed(card.id),frame=Math.floor(glow.elapsed/140),w=card.width,h=card.height;
  const sides=[
   {a:{x:-w/2-pad,y:-h/2-pad},b:{x:w/2+pad,y:-h/2-pad},nx:0,ny:-1},
   {a:{x:w/2+pad,y:-h/2-pad},b:{x:w/2+pad,y:h/2+pad},nx:1,ny:0},
   {a:{x:w/2+pad,y:h/2+pad},b:{x:-w/2-pad,y:h/2+pad},nx:0,ny:1},
   {a:{x:-w/2-pad,y:h/2+pad},b:{x:-w/2-pad,y:-h/2-pad},nx:-1,ny:0},
  ];
  let segments=0;const heads:InkPoint[]=[],sideSegments:number[]=[];
  // Short, uneven channels join at the four corners. Re-forming local bends
  // and offshoots gives live electricity without flashing the whole card.
  const paint=(path:InkPoint[],strength:number):number=>{
   let painted=0;
   for(const run of clearInkRuns(path,boxes,clearance)){
    let safe:InkPoint[]=[];
    const stroke=()=>{
     if(safe.length<2)return;
     for(let i=1;i<safe.length;i++){
      const a=safe[i-1],b=safe[i],spark=electricVariation(seed+frame*127+i*43+Math.round((a.x+a.y)*7));
      // The luminous core widens and narrows along the jagged channel instead
      // of reading as a uniform frame. There is no full-card brightness pulse.
      for(const [width,color,opacity] of [[4.0+spark,0x45b9f5,.19],[2.1+spark*.9,0x1681cd,.75],[.9+spark*.7,0xf1fcff,.88]])
       glow.ink.lineStyle(width/scale,color,opacity*alpha*strength).lineBetween(a.x,a.y,b.x,b.y);
     }
     painted+=safe.length-1;
    };
    for(const p of run){if(visible(p))safe.push(p);else{stroke();safe=[];}}stroke();
   }
   return painted;
  };
  for(const [sideIndex,side] of sides.entries()){
   const dx=side.b.x-side.a.x,dy=side.b.y-side.a.y,steps=Math.max(6,Math.ceil(Math.hypot(dx,dy)*scale/8));
   const points=Array.from({length:steps+1},(_,i)=>{
    const t=i/steps,corner=i===0||i===steps,noise=electricVariation(seed+sideIndex*1009+i*37+frame*113),jag=corner?0:(.5+(sideIndex%2?4.2:8)*noise)/minimum;
    const skew=corner?0:(electricVariation(seed+sideIndex*733+i*53+frame*71)-.5)*3/minimum;
    return{x:side.a.x+dx*t+side.nx*jag+(dx?skew:0),y:side.a.y+dy*t+side.ny*jag+(dy?skew:0)};
   });
   const count=paint(points,1);sideSegments.push(count);segments+=count;
   // A substantial part of each side carries a tapering hot channel, so the
   // bright current reads around the card rather than as isolated sparks.
   const branchSeed=seed+sideIndex*503+frame*31,hotStart=Math.floor(steps*.32*electricVariation(branchSeed+17)),hotEnd=Math.min(steps,hotStart+Math.max(3,Math.round(steps*.58)));
   const hot=drawElectricFork(glow.ink,[points.slice(hotStart,hotEnd+1)],boxes,scale,alpha*.78,visible,clearance,[false,false]);segments+=hot.segments;
   // Uneven luminous forks flare out of the continuous perimeter. Each
   // starts on it, branches briefly, then reforms at another point.
   const tangent={x:dx/Math.hypot(dx,dy),y:dy/Math.hypot(dx,dy)},outward={x:side.nx,y:side.ny};
   for(let branch=0;branch<(sideIndex%2?1:2);branch++){
    const forkSeed=branchSeed+branch*317,part=branch?.55:.12,index=Math.max(1,Math.min(steps-2,Math.floor(steps*(part+.19*electricVariation(forkSeed))))),p=points[index];
    const available=Math.hypot(side.b.x-p.x,side.b.y-p.y),length=Math.min(((sideIndex%2?17:24)+12*electricVariation(forkSeed+73))/scale,available*.9);
    if(length<=5/scale||electricVariation(forkSeed+227)<.18)continue;
    const fork=drawElectricFork(glow.ink,electricFork(p,tangent,outward,length,forkSeed,frame,.85),boxes,scale,alpha*.95,visible,clearance,electricBranches(forkSeed,frame));
    segments+=fork.segments;heads.push(...fork.heads);
   }

  }
  glow.ink.setData('electricSegments',segments).setData('electricHeads',heads).setData('impactOutlineSegments',sideSegments.reduce((n,v)=>n+v,0)).setData('perimeterSides',sideSegments);
 }
 private update(time:number,delta:number):void {
  const dt=Math.max(0,Number.isFinite(delta)?delta:0);this.drawElapsed+=dt;
  for(const [id,glow] of this.glows){const {root,signal,isCurrent}=glow.request,card=glow.card;
   if(signal.aborted||document.hidden||this.motion()!=='full'||isCurrent?.(card)===false||!glow.ink.active||cardVisualRoot(card)!==glow.body||!visibleThrough(glow.body,root)||!visibleThrough(card.container,root)){this.remove(id);continue;}
   // The renderer can smooth its delta severely at low FPS. Wall-frame time
   // keeps the promised hold and fade bounded instead of lingering for seconds.
   const elapsed=glow.lastTime===undefined?dt:Math.max(0,time-glow.lastTime);glow.lastTime=time;
   glow.elapsed+=Number.isFinite(elapsed)?elapsed:0;if(glow.elapsed>=HERO_TARGET_AFTERGLOW_MS)this.remove(id);
  }
  if(this.drawElapsed<1000/30||!this.glows.size)return;
  this.drawElapsed%=1000/30;
  this.drawAll();
 }
 private remove(id:string):void {const glow=this.glows.get(id);if(!glow)return;this.glows.delete(id);const {signal}=glow.request,card=glow.card;signal.removeEventListener('abort',glow.cancel);glow.body.off('destroy',glow.cancel);if(glow.body!==card.container)card.container.off('destroy',glow.cancel);if(glow.ink.active)glow.ink.destroy();}
 clear():void {for(const id of [...this.glows.keys()])this.remove(id);}
 readonly destroy=():void=>{if(this.destroyed)return;this.destroyed=true;this.clear();this.scene.events.off('update',this.tick);this.scene.events.off('shutdown',this.destroy);this.scene.events.off('destroy',this.destroy);window.removeEventListener('blur',this.hide);document.removeEventListener('visibilitychange',this.visibility);};
}
