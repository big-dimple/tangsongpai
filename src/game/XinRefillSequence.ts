import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {Box} from './layout';
import type {InkPoint} from './AssistInkGeometry';
import type {HeroClimaxView} from './HeroClimax';
import {mountXinRefillLock,type XinRefillLockCue} from './XinRefillLock';
import {drawHeroLineCurrent} from './HeroLineCurrent';

/** Temporarily reuse the inactive score body, keeping hand hits, HUD and skill controls clear. */
export function xinRefillEyeSlot(score:Box):Box|undefined {
 const height=Math.min(100,score.height-34),width=Math.min(300,score.width-20,height*8/3);if(width<80||height<30)return;
 const h=width*3/8;return{x:score.x+(score.width-width)/2,y:score.y+28+(score.height-28-h)/2,width,height:h};
}
/** One saved activation through the actual candidate reveal. No candidate identities before reveal. */
export class XinRefillSequence {
 private stage?:HeroClimaxView;private root?:Phaser.GameObjects.Container;private context?:EffectContext;
 private ink?:Phaser.GameObjects.Graphics;private currentInk?:Phaser.GameObjects.Graphics;private tween?:Phaser.Tweens.Tween;private unbind?:()=>void;private unpaint?:()=>void;private finish?:()=>void;
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
  this.ink=this.scene.add.graphics().setName('hero/xin-candidate-focus').setData('targetIds',targets.map(t=>t.id));root.add(this.ink);
  this.currentInk=this.scene.add.graphics().setName('hero/xin-candidate-current');root.add(this.currentInk);
  stage.group.setData('decisionPhase','saved-candidate-reveal').setData('candidateIds',targets.map(t=>t.id)).setAlpha(0);
  const from=inverse.applyInverse(origin.x,origin.y),eyeY=from.y-30,r=Math.min(86,viewport.width*.22),candidateHits=new Set(targets.map(target=>'card/'+target.id));
  const windowForPoints=(points:readonly {x:number;y:number}[],padding:number):Box=>{const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return{x:x-padding,y:y-padding,width:Math.max(...xs)-x+2*padding,height:Math.max(...ys)-y+2*padding};};
  const localBox=(box:Box,padding:number)=>windowForPoints([[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>inverse.applyInverse(x,y)),padding);
  const paint=()=>{
   const ink=this.ink;if(token!==this.token||!ink?.active||context.signal.aborted)return;
   const fade=cursor.t<.18?cursor.t/.18:cursor.t>.78?(1-cursor.t)/.22:1;
   const currentInk=this.currentInk;if(!currentInk?.active)return;ink.clear().setAlpha(fade);currentInk.clear().setAlpha(fade);
   // Candidates fly from the eye and can move again when selected. Track their
   // transformed card bodies, not their final seats, so the veil never dims a face.
   const candidateHoles=targets.flatMap(target=>{const card=target.container;if(!card)return[localBox(target.box,6)];if(!card.active||!card.visible||card.alpha<=0)return[];const m=card.getWorldTransformMatrix(),w=target.box.width/2,h=target.box.height/2;return[windowForPoints([[-w,-h],[w,-h],[-w,h],[w,h]].map(([x,y])=>{const p=m.transformPoint(x,y);return inverse.applyInverse(p.x,p.y);}),6)];});
   const controls:Box[]=[];for(const object of root.list){const o=object as Phaser.GameObjects.Rectangle;if(!o.active||!o.visible||!o.input||candidateHits.has(o.name)||!(o.input.enabled||o.name?.startsWith('action/')))continue;controls.push(localBox(o.getBounds(),3));}
   const holes=[...candidateHoles,...controls,{x:0,y:0,width:viewport.width,height:60}];ink.setData('clearWindows',holes);
   const cuts=[0,viewport.height,...holes.flatMap(b=>[Math.max(0,b.y),Math.min(viewport.height,b.y+b.height)])].sort((a,b)=>a-b);
   ink.fillStyle(0x111c21,.54);
   for(let i=1;i<cuts.length;i++){const y=cuts[i-1],bottom=cuts[i];if(bottom<=y)continue;const spans=holes.filter(b=>b.y<bottom&&b.y+b.height>y).sort((a,b)=>a.x-b.x);let x=0;for(const b of spans){if(b.x>x)ink.fillRect(x,y,b.x-x,bottom-y);x=Math.max(x,b.x+b.width);}if(x<viewport.width)ink.fillRect(x,y,viewport.width-x,bottom-y);}
   for(const b of candidateHoles)ink.lineStyle(3,0xd8bd79,.92).strokeRoundedRect(b.x,b.y,b.width,b.height,5);
   // A single calm celestial eye, opening once. It neither flashes nor chases faces.
   const open=.5+.5*Math.min(1,cursor.t/.3),cx=from.x,cy=eyeY,hh=30*open;
   const upper=Array.from({length:25},(_,i)=>{const u=i/24;return{x:cx-r+2*r*u,y:cy-hh*Math.sin(Math.PI*u)**.85};}),lower=[...upper].reverse().map(p=>({x:p.x,y:cy+(cy-p.y)*.85})),outline=[...upper,...lower];
   ink.fillStyle(0xe9debd,.96).fillPoints(outline,true).lineStyle(4,0x284c50).strokePoints(outline,true);
   ink.lineStyle(3,0xd6bb76,.85).strokePoints(upper.map(p=>({x:p.x,y:p.y-7})),false);
   const protectedLocal=protectedPrint.map(b=>{const a=inverse.applyInverse(b.x,b.y),z=inverse.applyInverse(b.x+b.width,b.y+b.height);return{x:Math.min(a.x,z.x),y:Math.min(a.y,z.y),width:Math.abs(z.x-a.x),height:Math.abs(z.y-a.y)};});
   const current=drawHeroLineCurrent(currentInk,u=>({x:cx-r+2*r*u,y:cy-hh*Math.sin(Math.PI*u)**.85-7}),0,1,cursor.t,[...holes,...protectedLocal],0xd6bb76,1);currentInk.setData('electricSegments',current.segments).setData('electricHeads',current.heads);
   ink.fillStyle(0x367d79).fillCircle(cx,cy,23*open).lineStyle(2,0xd6bb76).strokeCircle(cx,cy,17*open).fillStyle(0x192c33).fillCircle(cx,cy,8);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3-.5;ink.lineStyle(3,0x182e34).lineBetween(cx+Math.cos(a)*10,cy+Math.sin(a)*10,cx+Math.cos(a+.3)*20*open,cy+Math.sin(a+.3)*20*open);}
   ink.fillStyle(0xe5cc91).fillPoints([{x:cx,y:cy-43},{x:cx+5,y:cy-37},{x:cx,y:cy-32},{x:cx-5,y:cy-37}],true);
   root.bringToTop(ink);root.bringToTop(currentInk);
  };paint();
  // Read card transforms after all deal and selection tweens for this frame.
  this.scene.events.on('postupdate',paint);this.unpaint=()=>this.scene.events.off('postupdate',paint);
  this.tween=this.scene.tweens.add({targets:cursor,t:1,duration:1100,ease:'Linear',onComplete:()=>{if(token!==this.token)return;this.tween=undefined;this.clear();}});
  return{...origin};
 }
 clear():void {this.token++;this.unbind?.();this.unbind=undefined;this.unpaint?.();this.unpaint=undefined;this.tween?.remove();this.tween=undefined;this.ink?.destroy();this.ink=undefined;this.currentInk?.destroy();this.currentInk=undefined;const stage=this.stage,finish=this.finish;this.stage=undefined;this.finish=undefined;this.root=undefined;this.context=undefined;this.origin=undefined;this.viewport=undefined;stage?.dispose();finish?.();}
}
