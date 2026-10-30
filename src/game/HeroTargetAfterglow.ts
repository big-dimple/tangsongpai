import type Phaser from 'phaser';
import {clearInkRuns,exteriorOrbitPoint,type InkBox,type InkPoint} from './AssistInkGeometry';
import {cardVisualRoot} from './CardVisualRoot';
import type {HeroInkBox} from './HeroVisibleSurface';
import type {AttachmentMotion} from './HeroTargetAttachmentState';

export const HERO_TARGET_AFTERGLOW_MS=1000;
export interface AfterglowCard {id:string;container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container;width:number;height:number}
export interface AfterglowRequest {
 cards:readonly AfterglowCard[];
 root:Phaser.GameObjects.Container;
 /** Current root-local ink bounds, including all other card faces and controls. */
 masks:()=>readonly HeroInkBox[];
 signal:AbortSignal;
 /** Verify this exact container still represents the target, including during pagination. */
 isCurrent?:(card:AfterglowCard)=>boolean;
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
/** A single rounded perimeter outside the card, broken only at protected ink. */
function outline(w:number,h:number,pad:number):InkPoint[] {
 const x=w/2,y=h/2,points:InkPoint[]=[{x:-x,y:-y-pad},{x,y:-y-pad}];
 const corners=[{x,y:-y,start:-Math.PI/2},{x,y,start:0},{x:-x,y,start:Math.PI/2},{x:-x,y:-y,start:Math.PI}];
 for(let c=0;c<corners.length;c++){
  const corner=corners[c];
  for(let i=1;i<=6;i++){const angle=corner.start+i*Math.PI/12;points.push({x:corner.x+Math.cos(angle)*pad,y:corner.y+Math.sin(angle)*pad});}
  if(c===0)points.push({x:x+pad,y});
  else if(c===1)points.push({x:-x,y:y+pad});
  else if(c===2)points.push({x:-x-pad,y:-y});
 }
 points.push(points[0]);return points;
}
/** Short, separate paths stay outside the printed card and never form a frame. */
function paths(w:number,h:number,pad:number,elapsed:number):InkPoint[][] {
 const box={x:-w/2,y:-h/2,width:w,height:h},perimeter=2*(w+h+pad*4),length=Math.min(18*pad/4,perimeter*.08)/perimeter;
 return [0,1,2].map(lane=>Array.from({length:9},(_,i)=>{
  const u=i/8,p=exteriorOrbitPoint(box,elapsed/5500+lane/3+u*length,pad);
  // Small continuous bends travel with each arc; no per-frame random flashes.
  const bend=Math.sin(u*Math.PI*3+elapsed/650+lane*2)*pad*.18;
  return{x:p.x+p.nx*bend,y:p.y+p.ny*bend};
 }));
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
  this.clear();this.drawElapsed=0;
  const {root,signal}=request;
  if(this.destroyed||signal.aborted||this.motion()!=='full'||document.hidden)return;
  for(const card of request.cards.slice(0,5)){
   if(this.glows.has(card.id))continue;
   const body=cardVisualRoot(card);
   if(!Number.isFinite(card.width+card.height)||card.width<=0||card.height<=0||request.isCurrent?.(card)===false||!visibleThrough(body,root)||!visibleThrough(card.container,root))continue;
   const ink=this.scene.add.graphics().setName('hero/target-afterglow').setData('targetCardId',card.id);body.add(ink);
   const cancel=()=>this.remove(card.id),glow:Glow={request,card,body,ink,elapsed:0,cancel};this.glows.set(card.id,glow);
   signal.addEventListener('abort',cancel,{once:true});body.once('destroy',cancel);if(body!==card.container)card.container.once('destroy',cancel);
  }
  if(this.glows.size){const masks=request.masks();for(const glow of this.glows.values())this.draw(glow,masks);}
 }
 private draw(glow:Glow,masks:readonly HeroInkBox[]):void {
  const {root}=glow.request,card=glow.card,m=glow.body.getWorldTransformMatrix(),sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d),scale=Math.min(sx,sy);
  glow.ink.clear().setData('electricSegments',0).setData('electricHeads',[]);if(!Number.isFinite(scale)||scale<.01)return;
  const radius=1.1/scale,pad=2.5/scale;
  const boxes:InkBox[]=[{x:-card.width/2,y:-card.height/2,width:card.width,height:card.height},...masks.filter(b=>!(b.ownerId===card.id&&b.inkKind==='face')).map(b=>localBox(b,root,glow.body))];
  const alpha=Math.max(0,Math.min(1,(HERO_TARGET_AFTERGLOW_MS-glow.elapsed)/350));
  let segments=0;const heads:InkPoint[]=[];
  for(const run of clearInkRuns(outline(card.width,card.height,pad),boxes,radius)){
   segments+=run.length-1;
   glow.ink.lineStyle(1/scale,0x4ab6df,alpha*.68).beginPath().moveTo(run[0].x,run[0].y);for(const p of run.slice(1))glow.ink.lineTo(p.x,p.y);glow.ink.strokePath();
  }
  for(const path of paths(card.width,card.height,pad,glow.elapsed))for(const run of clearInkRuns(path,boxes,radius)){
   segments+=run.length-1;if(!heads.length)heads.push(run[run.length-1]);
   glow.ink.lineStyle(2/scale,0x61bdf5,alpha*.38).beginPath().moveTo(run[0].x,run[0].y);for(const p of run.slice(1))glow.ink.lineTo(p.x,p.y);glow.ink.strokePath();
   glow.ink.lineStyle(1.1/scale,0x168ed0,alpha*.9).beginPath().moveTo(run[0].x,run[0].y);for(const p of run.slice(1))glow.ink.lineTo(p.x,p.y);glow.ink.strokePath();
   glow.ink.lineStyle(.6/scale,0xe8faff,alpha*.9).beginPath().moveTo(run[0].x,run[0].y);for(const p of run.slice(1))glow.ink.lineTo(p.x,p.y);glow.ink.strokePath();
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
  const masks=this.glows.values().next().value!.request.masks();
  for(const glow of this.glows.values())this.draw(glow,masks);
 }
 private remove(id:string):void {const glow=this.glows.get(id);if(!glow)return;this.glows.delete(id);const {signal}=glow.request,card=glow.card;signal.removeEventListener('abort',glow.cancel);glow.body.off('destroy',glow.cancel);if(glow.body!==card.container)card.container.off('destroy',glow.cancel);if(glow.ink.active)glow.ink.destroy();}
 clear():void {for(const id of [...this.glows.keys()])this.remove(id);}
 readonly destroy=():void=>{if(this.destroyed)return;this.destroyed=true;this.clear();this.scene.events.off('update',this.tick);this.scene.events.off('shutdown',this.destroy);this.scene.events.off('destroy',this.destroy);window.removeEventListener('blur',this.hide);document.removeEventListener('visibilitychange',this.visibility);};
}
