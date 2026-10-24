import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreBeat} from './scorePresentation';
import {SpringCardTransform,SPRING_PRESETS} from './SpringMotion';
import {OWNED_SCORE_SPRING} from './inkwaveSpring';

/** A finite face response inside the existing layout/score carrier. No hit,
 * command, audio or timer lives here. A saved score clock preempts input. */
export class CardBodyMotion {
 private readonly spring=new SpringCardTransform(0,0);
 private selected?:boolean;
 private hovered=false;
 private selecting=false;
 private hintKey?:string;
 private score?:{dispose:()=>void};
 private destroyed=false;
 constructor(private readonly scene:Phaser.Scene,private readonly outer:Phaser.GameObjects.Container,readonly body:Phaser.GameObjects.Container,private readonly reduced:()=>boolean,private readonly inputAllowed:()=>boolean){
  for(const s of [this.spring.x,this.spring.y,this.spring.rotation])s.setConfig(SPRING_PRESETS.gentle);
  scene.events.on('update',this.update);scene.events.once('shutdown',this.destroy);outer.once('destroy',this.destroy);
 }
 input(selected:boolean,hovered:boolean):void {
  this.hovered=hovered;const changed=this.selected!==undefined&&this.selected!==selected;this.selected=selected;
  if(changed&&this.inputAllowed()&&!this.reduced()&&!this.score){const width=Number(this.outer.getData('width'))||64,height=Number(this.outer.getData('height'))||90,angle=Math.min(7,600/width);this.selecting=true;this.spring.y.velocity=height*(selected?-.8:.45);this.spring.rotation.velocity=(selected?1:-1)*angle*Math.PI/180*24;}
 }
 hint(key:string|undefined,source?:{x:number;y:number}):void {
  if(key===this.hintKey)return;this.hintKey=key;
  if(!key||!this.inputAllowed()||this.reduced()||this.score)return;
  const d=this.direction(source);this.spring.x.velocity=d.x*45;this.spring.y.velocity=d.y*45;this.spring.rotation.velocity=d.x*.65;
 }
 private direction(source?:{x:number;y:number}){const p=source?this.outer.getWorldTransformMatrix().applyInverse(source.x,source.y):{x:0,y:-1},n=Math.hypot(p.x,p.y)||1;return {x:p.x/n,y:p.y/n};}
 private reset(){this.spring.reset();this.selecting=false;if(this.body.active)this.body.setPosition(0,0).setAngle(0).setScale(1);}
 private readonly update=(_time:number,delta:number)=>{
  if(this.destroyed||!this.body.active)return;
  if(typeof document!=='undefined'&&document.hidden){this.score?.dispose();this.reset();return;}
  if(this.reduced()){this.reset();return;}
  if(this.score)return;
  if(!this.inputAllowed()){this.reset();return;}
  if(!Number.isFinite(delta)||delta<=0)return;this.spring.step(Math.min(delta/1000,.05));
  const width=Number(this.outer.getData('width'))||64,quietHover=this.hovered&&!this.selecting,angle=quietHover?1:Math.min(7,600/width),tilt=Math.max(-angle,Math.min(angle,this.spring.rotation.value*180/Math.PI)),lift=Math.max(0,22-(this.selected?16:this.hovered?4:0)-width*Math.sin(Math.abs(tilt)*Math.PI/180)/2);
  this.body.setPosition(Math.max(-3,Math.min(3,this.spring.x.value)),Math.max(-lift,Math.min(2,this.spring.y.value))).setAngle(tilt);
  if(Math.abs(this.spring.y.value)+Math.abs(this.spring.y.velocity)+Math.abs(this.spring.rotation.value)+Math.abs(this.spring.rotation.velocity)<.005)this.selecting=false;
 };
 /** Only the caller's saved-event windup/flight/land samples drive this gesture. */
 claim(context:EffectContext,beat:ScoreBeat,source?:{x:number;y:number}){
  if(context.signal.aborted||this.destroyed||!this.body.active)return;
  this.score?.dispose();this.reset();const direction=this.direction(source);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;context.signal.removeEventListener('abort',dispose);if(this.score===owner){this.score=undefined;this.reset();}};
  const owner={dispose};this.score=owner;context.signal.addEventListener('abort',dispose,{once:true});
  const step=(elapsed:number)=>{
   if(disposed||context.signal.aborted||!this.body.active)return;if(this.reduced()){this.reset();return;}
   const arrival=beat.windup+beat.flight;
   if(elapsed<arrival){const t=elapsed<=beat.windup?Math.min(1,elapsed/Math.max(1,beat.windup)):Math.max(0,1-(elapsed-beat.windup)/Math.max(1,beat.flight)),u=t*t*(3-2*t);this.body.setPosition(direction.x*4*u,direction.y*4*u).setAngle(direction.x*2*u).setScale(1-.012*u,1);}
   else{const t=Math.max(0,Math.min(1,(elapsed-arrival-(beat.strike?.hold??0))/Math.max(1,beat.strike?.recovery??beat.impact))),s=t===1?0:OWNED_SCORE_SPRING.value(t*.5)*(t>.7?((1-t)/.3)**2:1),side=direction.x<0?-1:1;this.body.setPosition(side*1.5*s,0).setAngle(side*3*s).setScale(1-.02*Math.abs(s),1);}
  };
  return {step,dispose};
 }
 readonly destroy=()=>{if(this.destroyed)return;this.score?.dispose();this.destroyed=true;this.scene.events.off('update',this.update);this.scene.events.off('shutdown',this.destroy);this.outer.off('destroy',this.destroy);this.reset();};
}
