import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import type {ScoreBeat} from './scorePresentation';
import {hasActualBenefit} from './JokerExperience';
import {scoreContributions} from './ScoreContribution';
import {readableFractionText} from './scoreText';
import {UI_FONT} from './theme';
import {OWNED_SCORE_SPRING} from './inkwaveSpring';
import {OwnedCardTilt,ownedTiltLayer,OWNED_TILT_LIMITS} from './OwnedCardTilt';
import {SpringCardTransform,SPRING_PRESETS} from './SpringMotion';
import type {Box} from './layout';

export type OwnedJokerMotionTier='ordinary'|'multiplier'|'multiply';
export interface OwnedJokerMotionCue {eventId:string;sourceInstanceId:string;tier:OwnedJokerMotionTier;label:string}
export interface OwnedJokerPose {x:number;y:number;angle:number;scale:number}
export const OWNED_SOURCE_REBOUND=OWNED_SCORE_SPRING.reboundAt*2;
type Marker=Phaser.GameObjects.Container;
const owners=new WeakMap<Marker,{eventId:string;cancel:()=>void;promise:Promise<void>}>();

/** Only an exact saved, beneficial owned-source event can request this accent. */
export function ownedJokerMotionCue(trace:ScoreTrace,candidate:unknown):OwnedJokerMotionCue|undefined {
 const event=candidate as ScoreEvent;
 if(!event?.eventId||event.sourceType!=='joker'||!trace.sourceJokers.some(j=>j.instanceId===event.sourceInstanceId&&j.definitionId===event.sourceDefinitionId))return;
 if(!trace.events.some(saved=>saved===event||saved.eventId===event.eventId&&JSON.stringify(saved)===JSON.stringify(event))||!hasActualBenefit(event))return;
 const contributions=scoreContributions(event),numeric=contributions.find(c=>c.kind==='multiply')??contributions.find(c=>c.target==='M')??contributions[0];
 const tier:OwnedJokerMotionTier=numeric?.kind==='multiply'?'multiply':numeric?.target==='M'?'multiplier':'ordinary';
 return {eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,tier,label:numeric?.label??(event.operation==='retrigger-card'?'再触发':event.operation.includes('coefficient')||event.operation==='add-growth'?'↑'+readableFractionText(event.value):'+'+readableFractionText(event.value))};
}

/** Slot position, drag and external hit rectangle belong to marker, never this layer. */
export function ownedJokerScoreLayer(scene:Phaser.Scene,marker:Marker):Marker {
 let visual=marker.getData('scorePoseRoot') as Marker|undefined;
 if(!visual?.active){visual=scene.add.container(0,0).setName('owned-joker/score-pose');marker.add(visual);marker.setData('scorePoseRoot',visual);}
 const children=marker.list.filter(child=>child!==visual&&!child.getData('scoreMotionFixed'));
 if(children.length){marker.remove(children);ownedTiltLayer(scene,visual).add(children);}
 return visual;
}

export function ownedJokerMotionDuration(tier:OwnedJokerMotionTier,beat?:ScoreBeat,speed=1):number {
 if(beat?.phrase)return beat.impact;
 return Math.max(beat?.impact??0,tier==='multiply'?400:tier==='multiplier'?290:230,50/OWNED_SCORE_SPRING.reboundAt*speed);
}

/** Damped physical impulse, sampled with bounded substeps in inkwaveSpring. */
export function ownedJokerScorePose(t:number,tier:OwnedJokerMotionTier,ordinal=0,weight=1):OwnedJokerPose {
 const p=Math.max(0,Math.min(1,t)),power=(tier==='multiply'?1.7:tier==='multiplier'?1.3:1)*weight,dir=ordinal%2?-1:1;
 if(p===1)return {x:0,y:0,angle:0,scale:1};
 const sway=OWNED_SCORE_SPRING.value(p*.5)*(p>.7?((1-p)/.3)**2:1);
 return {x:dir*5.5*power*sway,y:-10*power*Math.abs(sway),angle:dir*7*power*sway,scale:1+.025*power*sway};
}
export function ownedJokerAnticipation(t:number,tier:OwnedJokerMotionTier,ordinal=0,weight=1,lift=16):OwnedJokerPose {
 const u=1-(1-Math.max(0,Math.min(1,t)))**3,dir=ordinal%2?-1:1,power=(tier==='multiply'?1.2:1)*weight;
 return {x:-dir*4*u*power,y:-lift*u,angle:-dir*7*u*power,scale:1+.025*u};
}
export function ownedJokerLiftRoom(marker:Marker,ceiling:number):number {
 const art=marker.getData('scoreArtBounds') as {x:number;y:number}|undefined;if(!art)return 0;
 return Math.max(0,Math.min(30,marker.getWorldTransformMatrix().transformPoint(art.x,art.y).y-ceiling));
}

/** Rotation is fitted to its own safe lane, including the very tight phone rack. */
export function fitOwnedJokerPose(pose:OwnedJokerPose,width:number,height:number,portrait:boolean,liftRoom=0):OwnedJokerPose {
 const rad=Math.abs(pose.angle)*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),padY=(portrait?1:12)+liftRoom,padX=portrait?(liftRoom?6:3):9;
 const rotatedW=width*c+height*s,rotatedH=height*c+width*s;
 const scale=Math.min(pose.scale,(width+padX*2)/rotatedW,(height+padY*2)/rotatedH),roomX=(width+padX*2-rotatedW*scale)/2,roomY=(height+padY*2-rotatedH*scale)/2;
 return {...pose,scale,x:Math.max(-roomX,Math.min(roomX,pose.x)),y:Math.max(-roomY,Math.min(roomY,pose.y))};
}

export interface OwnedJokerMotionOptions {
 context:EffectContext;arrival:Promise<void>;beat?:ScoreBeat;portrait:boolean;reducedMotion:boolean;speed?:number;liftRoom?:number;
 onPhase?:(phase:'windup'|'impact'|'rebound'|'rest')=>void;
}
export function cancelOwnedJokerScoreMotion(marker:Marker):void {owners.get(marker)?.cancel();(marker.getData('ownedTilt') as OwnedCardTilt|undefined)?.reset();}

/** Fit the artwork, including the existing hover tilt/parallax, inside its fixed hit lane. */
export function fitOwnedJokerIdlePose(pose:OwnedJokerPose,width:number,height:number,art:Box,phone:boolean):OwnedJokerPose {
 const {angle,parallax}=OWNED_TILT_LIMITS[phone?'phone':'desktop'],a=(Math.abs(pose.angle)+angle)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const x=Math.abs(art.x+art.width/2)+art.width/2,y=Math.abs(art.y+art.height/2)+art.height/2;
 const scale=Math.min(pose.scale,Math.max(0,width/2-Math.abs(pose.x)-parallax)/(x*c+y*s),Math.max(0,height/2-Math.abs(pose.y)-parallax)/(y*c+x*s));
 return {...pose,scale};
}

/** Rest -> one small weight shift -> inertial settle -> a longer rest. No periodic
 * bob, rule RNG or wall-clock catch-up. Each seat has deterministic varied pauses. */
export class OwnedJokerIdleMotion {
 private phase:'rest'|'shift'|'settle'='rest';
 private elapsed=0;
 private episode=0;
 private canShift=true;
 private pause:number;
 private shift={x:0,y:0,duration:0};
 readonly motion=new SpringCardTransform(0,0);
 constructor(private readonly ordinal:number){this.pause=1200+this.vary(1)*2200;for(const spring of [this.motion.x,this.motion.y,this.motion.scaleX,this.motion.scaleY,this.motion.rotation])spring.setConfig(SPRING_PRESETS.gentle);}
 private vary(salt:number):number {let n=Math.imul(this.ordinal+1,0x45d9f3b)^Math.imul(this.episode+1,0x9e3779b9)^Math.imul(salt,0x27d4eb2d);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
 reset(pose:OwnedJokerPose):void {this.motion.reset(pose.x,pose.y,pose.scale,pose.angle*Math.PI/180);this.phase='settle';this.elapsed=0;}
 step(deltaMs:number,width:number,height:number,art:Box,phone:boolean,canShift=true):OwnedJokerPose {
  const dt=Number.isFinite(deltaMs)&&deltaMs>0?Math.min(deltaMs/1000,.05):0;
  if(dt){
   if(this.canShift!==canShift){this.canShift=canShift;this.phase='settle';this.elapsed=0;}
   if(!canShift&&this.phase==='shift')this.phase='settle';
   if(this.phase==='rest'&&canShift){this.elapsed+=dt*1000;if(this.elapsed>=this.pause){this.episode++;this.elapsed=0;this.phase='shift';const direction=this.vary(2)<.5?-1:1;this.shift={x:direction*(.7+this.vary(3)*.9),y:-(.4+this.vary(4)*.9),duration:550+this.vary(5)*350};}}
   if(this.phase==='shift'){
    this.elapsed+=dt*1000;const t=Math.min(1,this.elapsed/this.shift.duration),ease=t*t*(3-2*t),x=this.shift.x*ease;
    // Lean follows displacement and its lagging velocity, rather than a second oscillator.
    this.motion.setTarget(x,this.shift.y*ease,1,(x*.55-this.motion.x.velocity*.018)*Math.PI/180);
    this.motion.step(dt);if(t===1)this.phase='settle';
   }else if(this.phase==='settle'){
    this.motion.setTarget(0,0,1,0);if(this.motion.step(dt)){this.motion.reset();this.phase='rest';this.elapsed=0;this.pause=2400+this.vary(6)*3400;}
   }
  }
  return fitOwnedJokerIdlePose({x:this.motion.x.value,y:this.motion.y.value,angle:this.motion.rotation.value*180/Math.PI,scale:this.motion.scaleX.value},width,height,art,phone);
 }
}

/** Per-frame float yields its entire layer to score/drag; material retains its own 15fps. */
export function mountOwnedJokerIdle(scene:Phaser.Scene,marker:Marker,options:{reducedMotion:()=>boolean;canFloat:()=>boolean;canTilt?:()=>boolean;ordinal:number}):void {
 const visual=ownedJokerScoreLayer(scene,marker),frame=marker.getData('frame') as Phaser.GameObjects.Rectangle;
 const tilt=ownedTiltLayer(scene,visual),decorations=visual.list.filter(o=>o!==tilt);visual.remove(decorations);tilt.add(decorations);
 const width=frame?.width??64,height=frame?.height??90,art=marker.getData('scoreArtBounds') as Box|undefined;
 const bounds=art??{x:-width/2,y:-height/2,width,height},idle=new OwnedJokerIdleMotion(options.ordinal),allowed=options.canTilt??options.canFloat,phone=scene.game.canvas.getBoundingClientRect().width<700;
 const pointerTilt=new OwnedCardTilt(scene,marker,tilt,allowed,phone);marker.setData('ownedTilt',pointerTilt);
 const shadows=[{width:.92,height:4.2,alpha:.05},{width:.8,height:2.8,alpha:.075},{width:.64,height:1.6,alpha:.1}].map(p=>{const shadow=scene.add.ellipse(0,height/2-2.2,width*p.width,p.height,0x26313a,p.alpha).setName('owned-joker/float-shadow').setData('scoreMotionFixed',true);marker.addAt(shadow,0);return shadow;});let yielded=true,still=false,depthMix=0;
 const shadowPose=(p:{x:number;y:number})=>{const lift=Math.max(0,Math.min(1,-p.y/1.4)),lean=Math.max(-1,Math.min(1,p.x/1.6));for(const shadow of shadows)shadow.setPosition(-lean*(phone?.9:1.4),height/2-2.2).setScale(1-lift*.16,1-lift*.22).setAlpha(.9-lift*.18);};
 const update=(_time:number,delta:number)=>{
  if(!visual.active||!marker.active)return;
  const reduced=options.reducedMotion(),hidden=typeof document!=='undefined'&&document.hidden;
  // Both numeric strikes and source gestures own this layer. Never reset it at
  // presentation/drag entry, even for the one frame after idle was active.
  if(owners.has(marker)||!allowed()){if(!yielded)shadowPose({x:0,y:0});yielded=true;still=false;depthMix=0;return;}
  if(reduced){if(!still){pointerTilt.reset();visual.setPosition(0,0).setAngle(0).setScale(1);shadowPose({x:0,y:0});}still=true;yielded=true;depthMix=0;return;}
  still=false;
  if(hidden){yielded=true;depthMix=0;return;}
  if(!Number.isFinite(delta)||delta<=0)return;
  if(yielded){idle.reset({x:visual.x,y:visual.y,angle:visual.angle,scale:visual.scaleX});yielded=false;}
  const p=idle.step(delta,width,height,bounds,phone,options.canFloat()),sx=p.scale*(1-Math.abs(p.angle)*.002);
  depthMix=Math.min(1,depthMix+Math.min(delta,50)/160);const depth={x:p.x*depthMix,y:p.y*depthMix};
  pointerTilt.setIdleDepth(depth);pointerTilt.update(marker.getData('scoreHitStop')?0:delta/1000,false);
  if(visual.x!==p.x||visual.y!==p.y||visual.angle!==p.angle||visual.scaleX!==sx||visual.scaleY!==p.scale)visual.setPosition(p.x,p.y).setAngle(p.angle).setScale(sx,p.scale);
  shadowPose(depth);
 };
 const dispose=()=>{pointerTilt.destroy();scene.events.off('update',update);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);marker.off('destroy',dispose);};
 scene.events.on('update',update);scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);marker.once('destroy',dispose);
}

/** One arrival Promise owns card peak, local burst and the caller's numeric/audio impact. */
export function playOwnedJokerScoreMotion(scene:Phaser.Scene,marker:Marker,cue:OwnedJokerMotionCue,options:OwnedJokerMotionOptions):Promise<void> {
 if(options.context.signal.aborted||!marker.active||typeof document!=='undefined'&&document.hidden)return Promise.resolve();
 const previous=owners.get(marker);if(previous?.eventId===cue.eventId)return previous.promise;
 previous?.cancel();(marker.getData('ownedTilt') as OwnedCardTilt|undefined)?.reset();
 const visual=ownedJokerScoreLayer(scene,marker),frame=marker.getData('frame') as Phaser.GameObjects.Rectangle;
 visual.setPosition(0,0).setAngle(0).setScale(1);
 const width=frame?.width??64,height=frame?.height??90,rest={x:visual.x,y:visual.y,angle:visual.angle,scaleX:visual.scaleX,scaleY:visual.scaleY},ordinal=Number(marker.getData('slotIndex')??0)+(options.beat?.phrase?.sourcePulse??0),receipt=options.beat?.phrase?.role==='receipt',motionWeight=Math.max(.65,options.beat?.phrase?.accentWeight??1);
 const fx=scene.add.graphics().setName('owned-joker/score-rays').setData('scoreMotionFixed',true);marker.addAt(fx,0);
 const color=cue.tier==='multiply'?0xc98a39:cue.tier==='multiplier'?0xb8473a:0x397965,rays=options.reducedMotion?0:cue.tier==='multiply'?12:cue.tier==='multiplier'?9:6;
 const bounds={x:width/2+(options.portrait?3:9),y:height/2+(options.portrait?1:12)},history:OwnedJokerPose[]=[];
 let stopped=false,cleaned=false,wake!:()=>void,tween:Phaser.Tweens.Tween|undefined,label:Phaser.GameObjects.Text|undefined,original:Phaser.GameObjects.Text|undefined,wasVisible=false,rebounded=false;
 const canceled=new Promise<void>(resolve=>wake=resolve);
 const restore=()=>{if(cleaned)return;cleaned=true;if(visual.active)visual.setPosition(rest.x,rest.y).setAngle(rest.angle).setScale(rest.scaleX,rest.scaleY);if(original?.active)original.setVisible(wasVisible);label?.destroy();fx.destroy();};
 const cancel=()=>{if(stopped)return;stopped=true;tween?.remove();restore();wake();};
 const phase=(value:'windup'|'impact'|'rebound'|'rest')=>{marker.setData('scoreMotionEventId',cue.eventId).setData('scoreMotionPhase',value).setData('scoreMotionTier',cue.tier);options.onPhase?.(value);};
 const pose=(value:OwnedJokerPose)=>{if(!visual.active)return;const p=fitOwnedJokerPose(value,width,height,options.portrait,options.liftRoom);visual.setPosition(rest.x+p.x,rest.y+p.y).setAngle(rest.angle+p.angle).setScale(rest.scaleX*p.scale,rest.scaleY*p.scale);return p;};
 const draw=(progress:number,p?:OwnedJokerPose)=>{
  if(!fx.active)return;fx.clear();const alpha=(options.reducedMotion?.45:.75)*(options.beat?.phrase?.accentWeight??1)*(1-progress);
  fx.lineStyle(cue.tier==='multiply'?2:1,color,alpha).strokeRoundedRect(-width/2,-height/2,width,height,4);
  if(p){history.unshift(p);history.length=Math.min(history.length,3);}
  history.slice(1).forEach((h,i)=>{fx.lineStyle(1,color,alpha*.2/(i+1));for(const side of [-1,1]){const x=Math.max(-bounds.x,Math.min(bounds.x,side*width/2+h.x));fx.lineBetween(x,-height*.28,x,height*.28);}});
  for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2,start=.78+progress*.12,end=.9+progress*.1,rx=width/2+3,ry=height/2+4;fx.lineStyle(i%3===0?2:1,color,alpha*(1-i%3*.12));fx.lineBetween(Math.max(-bounds.x,Math.min(bounds.x,Math.cos(a)*rx*start)),Math.max(-bounds.y,Math.min(bounds.y,Math.sin(a)*ry*start)),Math.max(-bounds.x,Math.min(bounds.x,Math.cos(a)*rx*end)),Math.max(-bounds.y,Math.min(bounds.y,Math.sin(a)*ry*end)));}
 };
 const runTween=(duration:number,update:(t:number)=>void)=>new Promise<void>(resolve=>{const cursor={t:0};tween=scene.tweens.add({targets:cursor,t:1,duration,ease:'Linear',onUpdate:()=>{if(!stopped&&visual.active)update(cursor.t);},onComplete:()=>resolve()});});
 const hidden=()=>{if(document.hidden)cancel();};
 const owner={eventId:cue.eventId,cancel,promise:Promise.resolve()};owners.set(marker,owner);
 options.context.signal.addEventListener('abort',cancel,{once:true});marker.once('destroy',cancel);scene.events.once('shutdown',cancel);scene.events.once('destroy',cancel);if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
 owner.promise=(async()=>{
  try{
   phase('windup');
   if(!options.reducedMotion&&!receipt)void runTween(Math.max(18,options.beat?.windup??55),t=>pose(ownedJokerAnticipation(t,cue.tier,ordinal,motionWeight,Math.min(18,options.liftRoom??0))));
   draw(.65);
   await Promise.race([options.arrival,canceled]);if(stopped||options.context.signal.aborted||!visual.active)return;
   tween?.remove();ownedJokerScoreLayer(scene,marker);phase('impact');
   // Existing source receipts, when present, share this same visual layer.
   if(!visual.getByName('source/impact')){
    original=marker.getData('valueLabel') as Phaser.GameObjects.Text|undefined;
    if(original?.active){label=scene.add.text(original.x,original.y,cue.label,{fontFamily:UI_FONT,fontSize:'14px',color:cue.tier==='ordinary'?'#397965':'#b8473a',backgroundColor:'#fff9e9',resolution:Math.max(1,1/scene.scale.zoom)}).setOrigin(original.originX,original.originY).setName('owned-joker/score-value');
     if(label.width<=Number(original.getData('labelRoom')??width-6)&&label.height<=20){wasVisible=original.visible;original.setVisible(false);visual.add(label);}else {label.destroy();label=undefined;original=undefined;}}
   }
   const update=(t:number)=>{const p=options.reducedMotion||receipt?undefined:pose(ownedJokerScorePose(t,cue.tier,ordinal,motionWeight));draw(t,p);if(!rebounded&&t>=OWNED_SOURCE_REBOUND){rebounded=true;phase('rebound');}if(label?.active)label.setAlpha(1-t*.25);};
   update(0);await Promise.race([runTween(options.reducedMotion?Math.min(180,options.beat?.impact??180):ownedJokerMotionDuration(cue.tier,options.beat,options.speed),update),canceled]);
  }finally{
   options.context.signal.removeEventListener('abort',cancel);marker.off('destroy',cancel);scene.events.off('shutdown',cancel);scene.events.off('destroy',cancel);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
   tween?.remove();restore();if(owners.get(marker)===owner){owners.delete(marker);if(marker.active)phase('rest');}
  }
 })();return owner.promise;
}
