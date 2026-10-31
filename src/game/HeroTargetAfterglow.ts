import type Phaser from 'phaser';
import {type InkBox,type InkPoint} from './AssistInkGeometry';
import {drawElectricFork,electricFork,electricSeed,electricVariation,ELECTRIC_CLEARANCE_PX} from './HeroElectricGeometry';
import {cardVisualRoot} from './CardVisualRoot';
import {cssViewport} from '../platform/Viewport';
import type {HeroInkBox} from './HeroVisibleSurface';
import type {AttachmentMotion} from './HeroTargetAttachmentState';

export const HERO_TARGET_AFTERGLOW_MS=1500;
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
interface Glow {request:AfterglowRequest;card:AfterglowCard;body:Phaser.GameObjects.Container;ink:Phaser.GameObjects.Graphics;elapsed:number;cancel:()=>void}

function visibleThrough(node:Phaser.GameObjects.Container,root:Phaser.GameObjects.Container):boolean {
 for(let n:Phaser.GameObjects.Container|null=node;n;n=n.parentContainer){if(!n.active||!n.visible||n.alpha<=0)return false;if(n===root)return true;}return false;
}
function localBox(box:InkBox,root:Phaser.GameObjects.Container,body:Phaser.GameObjects.Container):InkBox {
 const r=root.getWorldTransformMatrix(),m=body.getWorldTransformMatrix();
 const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>{const p=r.transformPoint(x,y);return m.applyInverse(p.x,p.y);});
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
/** Choose an exposed straight side: rounded-card corners are still inside its face box. */
function edgeAnchor(w:number,h:number,pad:number,side:number,u:number):InkPoint&{nx:number;ny:number} {
 if(side===0)return{x:(u-.5)*w,y:-h/2-pad,nx:0,ny:-1};
 if(side===1)return{x:w/2+pad,y:(u-.5)*h,nx:1,ny:0};
 if(side===2)return{x:(.5-u)*w,y:h/2+pad,nx:0,ny:1};
 return{x:-w/2-pad,y:(.5-u)*h,nx:-1,ny:0};
}
/** View-only, exact-card ownership; the caller supplies current protective ink bounds. */
export class HeroTargetAfterglow {
 private readonly glows=new Map<string,Glow>();
 private destroyed=false;
 private drawElapsed=0;
 private readonly tick=(_time:number,delta:number)=>this.update(delta);
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
   const cancel=()=>this.remove(card.id),glow:Glow={request,card,body,ink,elapsed:0,cancel};this.glows.set(card.id,glow);
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
  // A screen-space stroke must not grow under nonuniform transforms. Protect
  // its widest half-width plus antialiasing even along the compressed axis.
  const clearance=2.9/scale+(ELECTRIC_CLEARANCE_PX-2.9)/minimum,pad=clearance+1.1/minimum;
  // The unrotated local face already protects this card's paper. Reprojecting
  // that paper's world AABB into a rotating body would enlarge it twice and
  // erase every exterior spark. Real art and text remain protected.
  const boxes:InkBox[]=[{x:-card.width/2,y:-card.height/2,width:card.width,height:card.height},...masks.filter(b=>!(b.ownerId===card.id&&(b.inkKind==='face'||b.inkKind==='paper'))).map(b=>localBox(b,root,glow.body))];
  // Check actual world-space points; a rotated card turns a viewport strip's
  // local bounding box into a false obstacle over otherwise visible ink.
  const viewport=cssViewport(this.scene),safeX=4+clearance*Math.hypot(m.a,m.c),safeY=4+clearance*Math.hypot(m.b,m.d);
  const visible=(p:InkPoint)=>{const q=m.transformPoint(p.x,p.y);return q.x>=safeX&&q.x<=viewport.width-safeX&&q.y>=safeY&&q.y<=viewport.height-safeY;};
  // A visible impact gives way to shorter, dimmer residual discharges.
  const age=Math.max(0,Math.min(1,glow.elapsed/HERO_TARGET_AFTERGLOW_MS));
  const alpha=Math.max(0,Math.min(1,(HERO_TARGET_AFTERGLOW_MS-glow.elapsed)/600))*(1-.25*age);
  let segments=0,attached=false;const heads:InkPoint[]=[];
  const seed=electricSeed(card.id);
  // Top and bottom remain usable when neighboring cards leave no side gap.
  // The short second discharge is deliberately different from the main one.
  for(let lane=0;lane<3;lane++){
   // Try a side only when both broad edges are fully hidden or off-screen.
   if(lane===2&&segments)break;
   const variation=electricVariation(seed+lane*71),direction=electricVariation(seed+lane*71+19)>.5?1:-1,topFirst=electricVariation(seed+90)>.45,side=lane===0?(topFirst?0:2):lane===1?(topFirst?2:0):(variation>.5?1:3);
   const travel=.5+.5*Math.sin(glow.elapsed/(320+variation*180)+variation*6.28),u=direction>0?.10+.24*travel:.90-.24*travel,p=edgeAnchor(card.width,card.height,pad,side,u),tangent={x:-p.ny*direction,y:p.nx*direction},outward={x:p.nx,y:p.ny};
   const sideLength=side%2?card.height:card.width,available=(direction>0?1-u:u)*sideLength-clearance;
   const length=Math.min(((lane===0?48:lane===1?21:15)+variation*4)*(1-.30*age)/scale,sideLength*.70,available);if(length<4/scale)continue;
   const result=drawElectricFork(glow.ink,electricFork(p,tangent,outward,length,seed+lane*31,(glow.elapsed+(seed%370))/105,.85),boxes,scale,alpha*(lane===0?1:lane===1?.68:.50),visible,clearance);
   segments+=result.segments;heads.push(...result.heads);
   if(result.segments&&!attached){
    // The blue-white contact touches only the outer border. Card print, art,
    // neighboring cards and controls still use the ordinary exclusion boxes.
    const inset=Math.min(clearance+.5/minimum,card.width*.25,card.height*.25),inner={x:-card.width/2+inset,y:-card.height/2+inset,width:card.width-2*inset,height:card.height-2*inset};
   const contact={x:p.x-outward.x*(pad-.35/scale),y:p.y-outward.y*(pad-.35/scale)};
    const linked=drawElectricFork(glow.ink,[[p,contact]],[inner,...boxes.slice(1)],scale,alpha*.8,visible,clearance);
    segments+=linked.segments;heads.push(...linked.heads);attached=linked.segments>0;
   }
  }
  glow.ink.setData('electricSegments',segments).setData('electricHeads',heads);
 }
 private update(delta:number):void {
  const dt=Math.max(0,Number.isFinite(delta)?delta:0);this.drawElapsed+=dt;
  for(const [id,glow] of this.glows){const {root,signal,isCurrent}=glow.request,card=glow.card;
   if(signal.aborted||document.hidden||this.motion()!=='full'||isCurrent?.(card)===false||!glow.ink.active||cardVisualRoot(card)!==glow.body||!visibleThrough(glow.body,root)||!visibleThrough(card.container,root)){this.remove(id);continue;}
   glow.elapsed+=dt;if(glow.elapsed>=HERO_TARGET_AFTERGLOW_MS)this.remove(id);
  }
  if(this.drawElapsed<1000/30||!this.glows.size)return;
  this.drawElapsed%=1000/30;
  this.drawAll();
 }
 private remove(id:string):void {const glow=this.glows.get(id);if(!glow)return;this.glows.delete(id);const {signal}=glow.request,card=glow.card;signal.removeEventListener('abort',glow.cancel);glow.body.off('destroy',glow.cancel);if(glow.body!==card.container)card.container.off('destroy',glow.cancel);if(glow.ink.active)glow.ink.destroy();}
 clear():void {for(const id of [...this.glows.keys()])this.remove(id);}
 readonly destroy=():void=>{if(this.destroyed)return;this.destroyed=true;this.clear();this.scene.events.off('update',this.tick);this.scene.events.off('shutdown',this.destroy);this.scene.events.off('destroy',this.destroy);window.removeEventListener('blur',this.hide);document.removeEventListener('visibilitychange',this.visibility);};
}
