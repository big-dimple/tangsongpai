import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {Box} from './layout';
import type {InkPoint} from './AssistInkGeometry';
import type {HeroClimaxView} from './HeroClimax';
import {mountXinRefillLock,type XinRefillLockCue} from './XinRefillLock';

/** Temporarily reuse the inactive score body, keeping hand hits, HUD and skill controls clear. */
export function xinRefillEyeSlot(score:Box):Box|undefined {
 const height=Math.min(100,score.height-34),width=Math.min(300,score.width-20,height*8/3);if(width<80||height<30)return;
 const h=width*3/8;return{x:score.x+(score.width-width)/2,y:score.y+28+(score.height-28-h)/2,width,height:h};
}
/** One saved activation through the actual candidate reveal. No candidate identities before reveal. */
export class XinRefillSequence {
 private stage?:HeroClimaxView;private root?:Phaser.GameObjects.Container;private context?:EffectContext;
 private ink?:Phaser.GameObjects.Graphics;private tween?:Phaser.Tweens.Tween;private unbind?:()=>void;private finish?:()=>void;
 private still=false;private token=0;private origin?:InkPoint;private viewport?:Box;
 constructor(private readonly scene:Phaser.Scene){scene.events.once('shutdown',this.clear,this);}
 get active():boolean {return !!this.stage?.group.active;}
 begin(root:Phaser.GameObjects.Container,viewport:Box,cue:XinRefillLockCue,context:EffectContext,reduced:boolean,eyeSlot:Box|undefined,finish:()=>void):HeroClimaxView|undefined {
  this.clear();if(context.signal.aborted||!root.active)return;
  const stage=mountXinRefillLock(this.scene,root,viewport,cue,reduced,eyeSlot);if(!stage)return;
  // The skill-area cut-in already showed the dedicated eyes; this owner only anchors the celestial reveal.
  stage.group.setAlpha(0);this.stage=stage;this.viewport=viewport;this.root=root;this.context=context;this.still=reduced;this.finish=finish;
  stage.group.once('destroy',()=>{if(this.stage===stage)this.clear();});
  const box=stage.group.getData('bounds') as Box,m=root.getWorldTransformMatrix();this.origin=m.transformPoint(box.x+box.width/2,box.y+box.height-2);
  const abort=()=>this.clear();context.signal.addEventListener('abort',abort,{once:true});this.unbind=()=>context.signal.removeEventListener('abort',abort);
  return{...stage,dispose:()=>this.clear(),reduce:()=>{this.still=true;stage.reduce();if(this.tween)this.clear();},release:async()=>{await stage.release();if(this.stage===stage)this.clear();}};
 }
 /** Returns the eye's world origin for the existing face-down deal, without delaying input. */
 reveal(targets:readonly {id:string;box:Box;container?:Phaser.GameObjects.Container}[],protectedPrint:readonly Box[]):InkPoint|undefined {
  const stage=this.stage,root=this.root,context=this.context,origin=this.origin;if(!stage?.group.active||!root?.active||!context||context.signal.aborted||!origin){this.clear();return;}
  if(this.still||!targets.length){this.clear();return;}
  const token=++this.token,cursor={t:0},viewport=this.viewport!,inverse=root.getWorldTransformMatrix();
  const holes=targets.map(t=>{const a=inverse.applyInverse(t.box.x,t.box.y);return{x:a.x-6,y:a.y-6,width:t.box.width+12,height:t.box.height+12};});
  // The player's candidate faces and all existing controls stay completely clear.
  for(const object of root.list){const o=object as Phaser.GameObjects.Rectangle;if(!o.active||!o.visible||!o.input||!(o.input.enabled||o.name?.startsWith('action/')))continue;const b=o.getBounds(),a=inverse.applyInverse(b.x,b.y);holes.push({x:a.x-3,y:a.y-3,width:b.width+6,height:b.height+6});}
  this.ink=this.scene.add.graphics().setName('hero/xin-candidate-focus').setData('targetIds',targets.map(t=>t.id)).setData('clearWindows',holes);root.add(this.ink);
  stage.group.setData('decisionPhase','saved-candidate-reveal').setData('candidateIds',targets.map(t=>t.id)).setAlpha(0);
  holes.push({x:0,y:0,width:viewport.width,height:60});
  const from=inverse.applyInverse(origin.x,origin.y),eyeY=from.y-30,r=Math.min(86,viewport.width*.22);
  const paint=()=>{
   const ink=this.ink;if(token!==this.token||!ink?.active||context.signal.aborted)return;
   const fade=cursor.t<.18?cursor.t/.18:cursor.t>.78?(1-cursor.t)/.22:1;
   ink.clear().setAlpha(fade);
   const cuts=[0,viewport.height,...holes.flatMap(b=>[Math.max(0,b.y),Math.min(viewport.height,b.y+b.height)])].sort((a,b)=>a-b);
   ink.fillStyle(0x111c21,.54);
   for(let i=1;i<cuts.length;i++){const y=cuts[i-1],bottom=cuts[i];if(bottom<=y)continue;const spans=holes.filter(b=>b.y<bottom&&b.y+b.height>y).sort((a,b)=>a.x-b.x);let x=0;for(const b of spans){if(b.x>x)ink.fillRect(x,y,b.x-x,bottom-y);x=Math.max(x,b.x+b.width);}if(x<viewport.width)ink.fillRect(x,y,viewport.width-x,bottom-y);}
   for(const b of holes.slice(0,targets.length))ink.lineStyle(3,0xd8bd79,.92).strokeRoundedRect(b.x,b.y,b.width,b.height,5);
   // A single calm celestial eye, opening once. It neither flashes nor chases faces.
   const open=.5+.5*Math.min(1,cursor.t/.3),cx=from.x,cy=eyeY,hh=30*open;
   const upper=Array.from({length:25},(_,i)=>{const u=i/24;return{x:cx-r+2*r*u,y:cy-hh*Math.sin(Math.PI*u)**.85};}),lower=[...upper].reverse().map(p=>({x:p.x,y:cy+(cy-p.y)*.85})),outline=[...upper,...lower];
   ink.fillStyle(0xe9debd,.96).fillPoints(outline,true).lineStyle(4,0x284c50).strokePoints(outline,true);
   ink.lineStyle(3,0xd6bb76,.85).strokePoints(upper.map(p=>({x:p.x,y:p.y-7})),false);
   ink.fillStyle(0x367d79).fillCircle(cx,cy,23*open).lineStyle(2,0xd6bb76).strokeCircle(cx,cy,17*open).fillStyle(0x192c33).fillCircle(cx,cy,8);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3-.5;ink.lineStyle(3,0x182e34).lineBetween(cx+Math.cos(a)*10,cy+Math.sin(a)*10,cx+Math.cos(a+.3)*20*open,cy+Math.sin(a+.3)*20*open);}
   ink.fillStyle(0xe5cc91).fillPoints([{x:cx,y:cy-43},{x:cx+5,y:cy-37},{x:cx,y:cy-32},{x:cx-5,y:cy-37}],true);
   root.bringToTop(ink);
  };paint();
  this.tween=this.scene.tweens.add({targets:cursor,t:1,duration:1100,ease:'Linear',onUpdate:paint,onComplete:()=>{if(token!==this.token)return;this.tween=undefined;this.clear();}});
  return{...origin};
 }
 clear():void {this.token++;this.unbind?.();this.unbind=undefined;this.tween?.remove();this.tween=undefined;this.ink?.destroy();this.ink=undefined;const stage=this.stage,finish=this.finish;this.stage=undefined;this.finish=undefined;this.root=undefined;this.context=undefined;this.origin=undefined;this.viewport=undefined;stage?.dispose();finish?.();}
}
