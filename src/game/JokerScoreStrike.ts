import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';
import {Rational} from '../domain/rational';
import type {Box} from './layout';
import type {ScoreAnimate} from './ScorePosture';
import type {ScoreBeat} from './scorePresentation';
import {scoreContributions,type ScoreContribution} from './ScoreContribution';
import {ownedJokerMotionCue,ownedJokerScoreLayer,cancelOwnedJokerScoreMotion,fitOwnedJokerPose,ownedJokerAnticipation} from './OwnedJokerScoreMotion';
import {OWNED_SCORE_SPRING} from './inkwaveSpring';
import type {Edition} from '../cards/types';
import {mountPolychromeCardIridescence} from './PolychromeCardIridescence';
import {savedHeroAttachment} from './HeroAttachmentFacts';
import {strikeFlightPoint,drawStrikeWake,drawStrikeContact,strikeArtGlow} from './ScoreStrikeLayers';
import {ImageAfterimages} from './ImageAfterimages';
export {strikeFlightPoint} from './ScoreStrikeLayers';

type Point={x:number;y:number};
export const STRIKE_RETURN_LANDING=OWNED_SCORE_SPRING.firstCrossAt*2;
export interface JokerScoreStrikeCue {eventId:string;sourceInstanceId:string;edition?:Edition;contributions:ScoreContribution[]}
/** The saved handoff moves this one real card; its arithmetic remains ordinary +M. */
export function heroCardScoreStrikeCue(trace:ScoreTrace,event:ScoreEvent):JokerScoreStrikeCue|undefined {
 const saved=savedHeroAttachment(trace,'erxiang');
 if(!saved||saved.event.eventId!==event.eventId||event.rootId!==trace.rootId||!trace.events.some(e=>e===event||JSON.stringify(e)===JSON.stringify(event))||event.operation!=='add-multiplier'||!event.targetCardId||!trace.cards.some(c=>c.id===event.targetCardId))return;
 const contributions=scoreContributions(event).filter(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))>0);
 if(contributions.length===1&&contributions[0].target==='M'&&contributions[0].kind==='add')return {eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,contributions};
}
export function jokerScoreStrikeCue(trace:ScoreTrace,event:ScoreEvent):JokerScoreStrikeCue|undefined {
 if(!ownedJokerMotionCue(trace,event))return;
 const contributions=scoreContributions(event).filter(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))>0);
 if(contributions.length)return {eventId:event.eventId,sourceInstanceId:event.sourceInstanceId,edition:trace.sourceJokers.find(j=>j.instanceId===event.sourceInstanceId)?.edition,contributions};
}

/** All four slots, hit hold and real-time visibility floors are composed once. */
export function jokerStrikeBeat(base:ScoreBeat,multiply:boolean,speed=1):ScoreBeat {
 const rate=[1,2,4].includes(speed)?speed:1,key=base.phrase?.role==='accent',opening=base.phrase?.role==='opening',p=base.phrase?.progress??Math.min(1,(base.phrase?.pulse??0)/24);
 const windup=Math.max(key?160:opening?110:Math.round(72-32*p)+(multiply?6:0),(key?85:opening?55:20)*rate),flight=Math.max(key?115:opening?95:Math.round(90-30*p),(key?70:60)*rate);
 const hold=Math.max(key?55:40,(key?55:40)*rate);let recovery=Math.max(key?220:opening?150:Math.round(130-30*p),(key?105:50)*rate),rest=key?80:opening?25:Math.round(12-6*p);
 if(base.phrase?.paired)recovery=Math.max(recovery,Math.ceil(Math.max(0,50*rate-hold)/STRIKE_RETURN_LANDING));
 rest=Math.max(rest,(key?35:0)*rate);rest+=Math.max(0,(base.phrase?.budgetMs??0)-windup-flight-hold-recovery-rest);
 return {...base,windup,flight,impact:hold+recovery,rest,strike:{hold,recovery}};
}

/** Preserve the damped spring, bounding the post-crossing excursion to a local lane. */
export function strikeReturnFraction(t:number,distance:number,overshoot=8):number {
 const s=OWNED_SCORE_SPRING.value(t*.5),tail=t>.65?((1-t)/.35)**2:1;return t<STRIKE_RETURN_LANDING?s:Math.tanh(s*Math.max(1,distance)/overshoot)*overshoot/Math.max(1,distance)*tail;
}

/** The peak must be visible, rather than skipped between the hidden hold and
 * the first rendered recovery sample. Use this same tween's remaining slot. */
export function createStrikeReadoutRecoil(hold:number,recovery:number,amplitude:number){
 let firstVisible:number|undefined;
 return (elapsed:number)=>{
  if(elapsed<hold)return;
  firstVisible??=elapsed;
  const progress=Math.max(0,Math.min(1,(elapsed-firstVisible)/Math.max(1,hold+recovery-firstVisible))),s=OWNED_SCORE_SPRING.value(progress);
  return {scale:1+amplitude*s,lift:-3*s};
 };
}

let snapshotOrdinal=0;
interface StrikeOptions {
 context:EffectContext;beat:ScoreBeat;textureKey:string;artBounds:Box;portrait:boolean;liftRoom?:number;
 /** A centred, direct child of parent. Its external input hit rectangle stays fixed. */
 sourceCard?:boolean;
 arrivalWidth?:number;
 /** Real hero cards contact the numeric lane from below; digits stay visible throughout. */
 readableLanding?:boolean;
 targets:Record<'H'|'M',Phaser.GameObjects.Text>;cells:Record<'H'|'M',Box>;animate:ScoreAnimate;refresh:()=>void;
 onRebound?:(remainingMs:number)=>void;
 /** Existing Tween clock, in effective beat ms; external portrait/particles may sample it. */
 onStep?:(elapsed:number)=>void;onDispose?:()=>void;
 /** Live reduction affects decoration only; it never creates a second clock. */
 effects?:()=>boolean;
}
/** Joker art copies or the actual handoff card share the same flight/arrival/spring clock. */
export function prepareJokerScoreStrike(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,marker:Phaser.GameObjects.Container,cue:JokerScoreStrikeCue,options:StrikeOptions){
 const physical=!!options.sourceCard;
 if(options.context.signal.aborted||!marker.active||!options.beat.strike||!cue.contributions.length||cue.contributions.some(c=>Rational.fromJSON(c.after).compare(Rational.fromJSON(c.before))<=0))return;
 if(physical){const b=options.artBounds;
  if(marker.parentContainer!==parent||cue.contributions.length!==1||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0||Math.abs(b.x+b.width/2)>.01||Math.abs(b.y+b.height/2)>.01)return;
 }else if(!scene.textures.exists(options.textureKey))return;
 if(!physical)cancelOwnedJokerScoreMotion(marker);
 const visual=physical?marker:ownedJokerScoreLayer(scene,marker),rest={x:visual.x,y:visual.y,angle:visual.angle,sx:visual.scaleX,sy:visual.scaleY,alpha:visual.alpha};
 const abort=new AbortController(),context={generation:options.context.generation,signal:abort.signal},weight=options.beat.phrase?.accentWeight??1,motionWeight=Math.max(.65,weight),ordinal=Number(marker.getData('slotIndex')??0)+(options.beat.phrase?.sourcePulse??0),dir=ordinal%2?-1:1;
 const group=scene.add.container(0,0).setName('score/strike').setData('eventId',cue.eventId);parent.add(group);
 const local=(p:Point)=>parent.getWorldTransformMatrix().applyInverse(p.x,p.y),world=(p:Point)=>visual.getWorldTransformMatrix().transformPoint(p.x,p.y);
 const localBox=(box:Box):Box=>{const a=local(box),b=local({x:box.x+box.width,y:box.y+box.height});return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)};};
 const artCenter={x:options.artBounds.x+options.artBounds.width/2,y:options.artBounds.y+options.artBounds.height/2},home=local(world(artCenter));
 const targets=cue.contributions.map(c=>({contribution:c,text:options.targets[c.target],alpha:options.targets[c.target].alpha,cell:{...options.cells[c.target]},copy:undefined as Phaser.GameObjects.Container|undefined,glow:undefined as Phaser.FX.Glow|undefined,afterimages:undefined as ImageAfterimages|undefined,from:{x:0,y:0},to:{x:0,y:0},hit:{x:0,y:0},startWidth:0,startHeight:0,endWidth:0,endHeight:0,sx:1,sy:1}));
 const fragments:{image:Phaser.GameObjects.Image;x:number;y:number;dx:number;dy:number}[]=[],textures:string[]=[];
 const wake=scene.add.graphics().setName('score/strike-wake').setData('eventId',cue.eventId),sparks=scene.add.graphics().setName('score/strike-hit').setData('eventId',cue.eventId);group.add(wake);group.add(sparks);
 let disposed=false,rebounded=false;
 const phase=(value:'windup'|'flight'|'impact'|'rebound'|'rest')=>{if(marker.active)marker.setData('scoreMotionEventId',cue.eventId).setData('scoreMotionPhase',value).setData('scoreHitStop',value==='impact');group.setData('phase',value);};
 const dispose=()=>{if(disposed)return;disposed=true;abort.abort();options.context.signal.removeEventListener('abort',dispose);marker.off('destroy',dispose);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);
  if(visual.active){visual.setPosition(rest.x,rest.y).setAngle(rest.angle).setScale(rest.sx,rest.sy).setAlpha(rest.alpha);if(physical)visual.setData('phase','rest');}
  for(const target of targets){target.afterimages?.dispose();if(target.text.active)target.text.setAlpha(target.alpha).setData('scorePulseScale',1).setData('scorePulseY',0);}
  if(parent.active&&targets.some(target=>target.text.active))options.refresh();
  if(marker.active&&marker.getData('scoreMotionEventId')===cue.eventId)phase('rest');group.destroy();for(const key of textures)if(scene.textures.exists(key))scene.textures.remove(key);options.onDispose?.();
 };
 const hidden=()=>{if(document.hidden)dispose();};
 options.context.signal.addEventListener('abort',dispose,{once:true});marker.once('destroy',dispose);scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
 const tween=(duration:number,update:(t:number)=>void)=>{const p={t:0};return options.animate({targets:p,t:1,duration,ease:'Linear',onUpdate:()=>{if(!disposed)update(p.t);}},context);};
 const multiply=cue.contributions.some(c=>c.kind==='multiply'),tier=multiply?'multiply':cue.contributions.some(c=>c.target==='M')?'multiplier':'ordinary',rise=Math.min(multiply?24:18,options.liftRoom??Math.max(0,visual.getBounds().y-4)),frame=marker.getData('frame') as Phaser.GameObjects.Rectangle;
 const color=(target:typeof targets[number])=>target.contribution.target==='H'?0x247b93:target.contribution.kind==='multiply'?0x8c561f:0xb8473a;
 const pose=(value:{x:number;y:number;angle:number;scale:number})=>{const p=fitOwnedJokerPose(value,frame?.width??options.artBounds.width,frame?.height??options.artBounds.height,options.portrait,options.liftRoom);visual.setPosition(rest.x+p.x,rest.y+p.y).setAngle(rest.angle+p.angle).setScale(rest.sx*p.scale,rest.sy*p.scale);};
 phase('windup');marker.setData('scoreMotionTier',multiply?'multiply':cue.contributions.some(c=>c.target==='M')?'multiplier':'ordinary');
 const windup=tween(options.beat.windup,t=>{
  if(physical&&options.readableLanding){const u=1-(1-t)**3;visual.setPosition(rest.x-dir*4*u,rest.y+7*u*motionWeight).setAngle(rest.angle-dir*5*u*motionWeight).setScale(rest.sx*(1+.055*u),rest.sy*(1-.075*u));marker.setData('heroChargeProgress',u);}
  else pose(ownedJokerAnticipation(t,tier,ordinal,motionWeight,rise));
  options.onStep?.(t*options.beat.windup);
 });
 const fly=async()=>{
  if(disposed)return;phase('flight');
  const art=options.artBounds,center=local(world({x:art.x+art.width/2,y:art.y+art.height/2})),left=local(world({x:art.x,y:art.y+art.height/2})),top=local(world({x:art.x+art.width/2,y:art.y}));
  const startAngle=visual.angle;if(!physical)visual.setAlpha(rest.alpha*.42);
  for(const target of targets){
   const b=target.text.getBounds(),hit=local({x:b.centerX,y:b.centerY}),dx=hit.x-center.x,dy=hit.y-center.y,length=Math.hypot(dx,dy)||1;
   target.from=center;target.hit=hit;target.startWidth=Math.hypot(center.x-left.x,center.y-left.y)*2;target.startHeight=Math.hypot(center.x-top.x,center.y-top.y)*2;
   target.endWidth=Math.min(target.startWidth*.72,options.arrivalWidth??(options.portrait?(multiply?30:24):(multiply?48:38)));target.endHeight=target.endWidth*target.startHeight/target.startWidth;
   target.to={x:hit.x-dx/length*target.endHeight*.38,y:hit.y-dy/length*target.endHeight*.38};
   if(physical&&options.readableLanding){const lane=localBox(target.cell);target.hit={x:lane.x+lane.width/2,y:lane.y+lane.height/2};target.to={x:target.hit.x,y:lane.y+lane.height+target.endHeight/2+4};}
   if(physical){target.copy=visual;target.sx=visual.scaleX;target.sy=visual.scaleY;visual.setData('strike',{eventId:cue.eventId,sourceInstanceId:cue.sourceInstanceId,target:target.contribution.target,from:center,to:target.to,hit:target.hit,landingBounds:options.readableLanding?{x:target.to.x-target.endWidth/2,y:target.to.y-target.endHeight/2,width:target.endWidth,height:target.endHeight}:undefined,cell:target.cell,kind:target.contribution.kind});continue;}
   const copy=scene.add.container(center.x,center.y).setAngle(startAngle).setSize(target.startWidth,target.startHeight).setName('score/strike-card').setData('eventId',cue.eventId).setData('edition',cue.edition).setData('strike',{sourceInstanceId:cue.sourceInstanceId,target:target.contribution.target,from:center,to:target.to,hit:target.hit,landingBounds:options.readableLanding?{x:target.to.x-target.endWidth/2,y:target.to.y-target.endHeight/2,width:target.endWidth,height:target.endHeight}:undefined,cell:target.cell,kind:target.contribution.kind,edition:cue.edition});
   const artImage=scene.add.image(0,0,options.textureKey).setDisplaySize(target.startWidth,target.startHeight).setName('score/strike-art');copy.add(artImage);target.glow=strikeArtGlow(scene,artImage,color(target),options.portrait);
   mountPolychromeCardIridescence(scene,copy,{x:-target.startWidth/2,y:-target.startHeight/2,width:target.startWidth,height:target.startHeight},cue.edition);target.copy=copy;group.add(copy);
   target.afterimages=new ImageAfterimages(scene,group,artImage,context,{eventId:cue.eventId,capacity:options.portrait?2:3,life:Math.max(1,options.beat.flight*.9),alpha:.34});
  }
  await tween(options.beat.flight,t=>{wake.clear();const effects=options.effects?.()!==false;if(!physical)pose({x:dir*5*Math.sin(Math.PI*t),y:-rise*(1-.45*t),angle:dir*(7*Math.sin(Math.PI*t)-4*(1-t)),scale:1.02});for(const target of targets){const p=strikeFlightPoint(target.from,target.to,t,multiply?16:9),u=t*t*t;if(effects)drawStrikeWake(wake,target.from,target.to,t,multiply?16:9,color(target),options.portrait,weight);if(target.glow){target.glow.active=effects;target.glow.outerStrength=1.5+2.5*Math.sin(Math.PI*t)*weight;}target.copy?.setPosition(p.x,p.y).setScale(target.sx*(target.startWidth+(target.endWidth-target.startWidth)*u)/target.startWidth,target.sy*(target.startHeight+(target.endHeight-target.startHeight)*u)/target.startHeight).setAngle(startAngle*(1-u)+dir*(multiply?12:7)*Math.sin(Math.PI*t)).setData('phase','flight').setData('progress',u);target.afterimages?.sample(options.beat.windup+t*options.beat.flight,effects);}options.onStep?.(options.beat.windup+t*options.beat.flight);});
 };
 const land=()=>{
  if(disposed)return Promise.resolve();phase('impact');wake.clear();for(const target of targets)target.afterimages?.dispose();
  if(!physical)pose({x:dir*4,y:-rise*.5,angle:dir*6,scale:1.02});
  for(const target of targets){
   const text=target.text,box=localBox(text.getBounds()),width=Math.max(1,Math.min(1024,text.canvas.width)),height=Math.max(1,Math.min(256,text.canvas.height)),key='score-strike-old-'+(++snapshotOrdinal),snapshot=scene.textures.createCanvas(key,width,height);
   if(snapshot){snapshot.getContext().drawImage(text.canvas,0,0,width,height);snapshot.refresh();textures.push(key);
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){const image=scene.add.image(box.x,box.y,key).setOrigin(0).setDisplaySize(box.width,box.height).setCrop(col*width/3,row*height/2,width/3,height/2).setName('score/strike-fragment').setData('eventId',cue.eventId);group.add(image);const dx=physical&&options.readableLanding?(col===1?(row?1:-1):col-1)*(box.width*.9+8):(col-1)*(multiply?12:8),dy=physical&&options.readableLanding?(row-.5)*(box.height*1.2+8):(row-.5)*(multiply?16:10);if(physical&&options.readableLanding)image.setPosition(box.x+dx*.65,box.y+dy*.65).setAlpha(.35);fragments.push({image,x:box.x,y:box.y,dx,dy});}
   }
   text.setAlpha(physical&&options.readableLanding?target.alpha:0).setData('scorePulseScale',physical&&options.readableLanding?.86:1).setData('strikeEventId',cue.eventId).setData('strikeTarget',target.contribution.target);
  }
  const {hold,recovery}=options.beat.strike!,readoutRecoil=createStrikeReadoutRecoil(hold,recovery,(physical&&options.readableLanding?.27+(multiply?.28:0):.18+(multiply?.26:0))*weight);
  if(options.effects?.()!==false)for(const target of targets)drawStrikeContact(sparks,target.hit,target.from,localBox(target.cell),0,hold,recovery,STRIKE_RETURN_LANDING,color(target),target.contribution.kind==='multiply',options.portrait,weight);
  options.onStep?.(options.beat.windup+options.beat.flight);if(disposed)return Promise.resolve();
  return tween(options.beat.impact,t=>{
   const elapsed=t*options.beat.impact;marker.setData('scoreHitStop',elapsed<hold);const settle=Math.max(0,Math.min(1,(elapsed-hold)/recovery)),readout=readoutRecoil(elapsed);sparks.clear();
   if(elapsed>=hold&&!physical){const sway=OWNED_SCORE_SPRING.value(settle*.5)*(settle>.7?((1-settle)/.3)**2:1);pose({x:dir*5*sway,y:-rise*.4*Math.abs(sway),angle:dir*8*sway,scale:1+.02*sway});visual.setAlpha(rest.alpha*(.42+.58*Math.min(1,settle*1.5)));}
   for(const target of targets){const effects=options.effects?.()!==false;if(effects)drawStrikeContact(sparks,target.hit,target.from,localBox(target.cell),elapsed,hold,recovery,STRIKE_RETURN_LANDING,color(target),target.contribution.kind==='multiply',options.portrait,weight);if(target.glow){target.glow.active=effects;target.glow.outerStrength=1.5+3.5*(1-settle)*weight;}
    if(readout){target.text.setAlpha(target.alpha).setData('scorePulseScale',readout.scale).setData('scorePulseY',readout.lift);const distance=Math.hypot(target.to.x-home.x,target.to.y-home.y),s=strikeReturnFraction(settle,distance,options.portrait?4:8),homeX=physical?rest.sx:1/1.025,homeY=physical?rest.sy:1/1.025;target.copy?.setPosition(home.x+(target.to.x-home.x)*s,home.y+(target.to.y-home.y)*s).setScale(homeX+(target.sx*target.endWidth/target.startWidth-homeX)*Math.max(0,s),homeY+(target.sy*target.endHeight/target.startHeight-homeY)*Math.max(0,s)).setAngle((physical?rest.angle:0)+dir*8*s).setData('phase','return').setData('progress',settle);}
    else {if(physical&&options.readableLanding)target.text.setAlpha(target.alpha).setData('scorePulseScale',.86).setData('scorePulseY',2);const squash=(1-elapsed/Math.max(1,hold))*.1*motionWeight;target.copy?.setScale(target.sx*target.endWidth/target.startWidth*(1-squash),target.sy*target.endHeight/target.startHeight*(1+squash*.5)).setData('phase','impact').setData('progress',0);}
   }
   const fracture=Math.min(1,elapsed/Math.max(95,hold*2));for(const part of fragments)part.image.setPosition(part.x+part.dx*(physical&&options.readableLanding?.65+.35*fracture:fracture),part.y+part.dy*(physical&&options.readableLanding?.65+.35*fracture:fracture)).setAlpha((physical&&options.readableLanding?.35:1)*(1-fracture)**2);
   if(!rebounded&&settle>=STRIKE_RETURN_LANDING){rebounded=true;phase('rebound');if(options.beat.phrase?.paired)options.onRebound?.(options.beat.impact-elapsed);}
   if(!disposed){options.refresh();options.onStep?.(options.beat.windup+options.beat.flight+elapsed);}
  }).finally(dispose);
 };
 return {windup,fly,land,dispose};
}
