import type Phaser from 'phaser';
import {SpringCardTransform} from './SpringMotion';
export const OWNED_TILT_LIMITS={phone:{angle:.7,parallax:.3},desktop:{angle:1.2,parallax:.6}} as const;

/** Adapted from fbb614a8 PhaserCardTilt: layout -> score spring -> tilt -> base art.
 * Reads pointer input only; the existing outer hit/drag owner keeps all control. */
export function ownedTiltLayer(scene:Phaser.Scene,spring:Phaser.GameObjects.Container){
 let tilt=spring.getData('tiltRoot') as Phaser.GameObjects.Container|undefined;
 if(!tilt?.active){tilt=scene.add.container(0,0).setName('owned-joker/tilt-pose');spring.add(tilt);spring.setData('tiltRoot',tilt);}
 return tilt;
}

export class OwnedCardTilt {
 readonly motion=new SpringCardTransform(0,0);
 private readonly art?:Phaser.GameObjects.Container;
 private readonly baseArt:{x:number;y:number};
 private destroyed=false;
 private depth={x:0,lift:0};
 private readonly limits:typeof OWNED_TILT_LIMITS.phone|typeof OWNED_TILT_LIMITS.desktop;
 constructor(private readonly scene:Phaser.Scene,private readonly marker:Phaser.GameObjects.Container,
  private readonly tilt:Phaser.GameObjects.Container,private readonly allowed:()=>boolean,phone=scene.game.canvas.getBoundingClientRect().width<700){
  this.limits=OWNED_TILT_LIMITS[phone?'phone':'desktop'];
  this.art=tilt.list.find(o=>o.getData('f09-active')!==undefined) as Phaser.GameObjects.Container|undefined;
  this.baseArt={x:this.art?.x??0,y:this.art?.y??0};
  if(typeof window!=='undefined'){window.addEventListener('pointermove',this.move,true);window.addEventListener('pointerup',this.release);window.addEventListener('pointercancel',this.reset);window.addEventListener('blur',this.reset);}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
 }
 /** Nominal outer-card coordinates are never normalized from the tilted bounds. */
 point(worldX:number,worldY:number):void {
  if(this.destroyed||!this.allowed())return;
  const frame=this.marker.getData('frame') as {width:number;height:number},p=this.marker.getLocalPoint(worldX,worldY);
  if(!frame?.width||!frame.height)return;
  const inside=Math.abs(p.x)<=frame.width/2&&Math.abs(p.y)<=frame.height/2;
  const nx=inside?Math.max(-1,Math.min(1,p.x/(frame.width/2))):0,ny=inside?Math.max(-1,Math.min(1,p.y/(frame.height/2))):0;
  const {angle:degrees,parallax}=this.limits,angle=degrees*Math.PI/180;
  this.motion.setTarget(nx*parallax,ny*parallax,undefined,nx*angle);
  this.motion.scaleX.setTarget(1-Math.abs(nx)*.008);this.motion.scaleY.setTarget(1-Math.abs(ny)*.005);
 }
 private readonly move=(e:PointerEvent)=>{
  if(this.destroyed||typeof document!=='undefined'&&document.querySelector('dialog[open]'))return;
  const r=this.scene.game.canvas.getBoundingClientRect(),camera=this.scene.cameras.main;
  const point=camera.getWorldPoint((e.clientX-r.left)*this.scene.scale.width/r.width,(e.clientY-r.top)*this.scene.scale.height/r.height);
  this.point(point.x,point.y);
 };
 /** One existing idle spring supplies depth; pointer and score ownership stay separate. */
 setIdleDepth(pose:{x:number;y:number}):void {this.depth={x:Math.max(-1,Math.min(1,pose.x/1.6)),lift:Math.max(0,Math.min(1,-pose.y/1.4))};}
 private readonly visibility=()=>{if(document.hidden)this.reset();};
 private readonly release=():void=>{this.motion.setTarget(0,0,1,0);};
 update(effectiveDtSeconds:number,reduced:boolean):void {
  if(this.destroyed)return;
  if(reduced||typeof document!=='undefined'&&document.hidden){this.reset();return;}
  if(!Number.isFinite(effectiveDtSeconds)||effectiveDtSeconds<=0)return;
  if(!this.allowed()){this.reset();return;}
  this.motion.step(effectiveDtSeconds);
  const {x,lift}=this.depth,{angle,parallax}=this.limits,limit=angle*Math.PI/180,clamp=(n:number,b:number)=>Math.max(-b,Math.min(b,n));
  // Axis compression and relative art offset suggest pitch/yaw inside the fixed lane.
  this.tilt.setRotation(clamp(this.motion.rotation.value+x*limit*.55,limit)).setScale(this.motion.scaleX.value*(1-Math.abs(x)*.035-lift*.012),this.motion.scaleY.value*(1-Math.abs(x)*.005-lift*.012));
  if(this.art?.active)this.art.setPosition(this.baseArt.x+clamp(this.motion.x.value+x*parallax,parallax),this.baseArt.y+clamp(this.motion.y.value-lift*parallax,parallax));
 }
 readonly reset=():void=>{
  this.depth={x:0,lift:0};this.motion.reset();if(this.tilt.active)this.tilt.setRotation(0).setScale(1);
  if(this.art?.active)this.art.setPosition(this.baseArt.x,this.baseArt.y);
 };
 destroy():void {
  if(this.destroyed)return;this.reset();this.destroyed=true;
  if(typeof window!=='undefined'){window.removeEventListener('pointermove',this.move,true);window.removeEventListener('pointerup',this.release);window.removeEventListener('pointercancel',this.reset);window.removeEventListener('blur',this.reset);}
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);
 }
}
