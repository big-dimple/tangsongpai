import type Phaser from 'phaser';
import {cardVisualRoot} from './CardVisualRoot';
import type {EffectContext} from '../core/EffectQueue';
import {HeroTargetAttachmentState,ATTACHMENT_RELEASE_MS,type AttachmentDraft,type AttachmentMotion} from './HeroTargetAttachmentState';
import type {InkBox,InkPoint} from './AssistInkGeometry';
import {drawHeroAtmosphere,drawHeroOriginStream,heroAtmosphereStyle,HERO_SOURCE_CURRENT_MS,HERO_ATMOSPHERE_BUDGET} from './HeroCardAttachmentAtmosphere';
import {textDensity} from './TextRaster';
import {UI_FONT} from './theme';
import type {ScoreTrace} from '../domain/scoreR2';
import {SushiDiscardCardPresentation} from './SushiDiscardCardPresentation';
import {cssViewport} from '../platform/Viewport';
import {HeroSkillParticles,HERO_NATIVE_PARTICLE_BUDGET} from './HeroSkillParticles';
import type {HeroEffectOrigin} from './HeroEffectOrigin';
import type {XinEnergyAppearance} from './XinPerimeterEnergy';
import {HeroAttachmentPhases,type HeroAttachmentPhaseObserver} from './HeroAttachmentPhases';
import {HeroSourceEcho} from './HeroSourceEcho';
import {HeroLiveSmoke} from './HeroLiveSmoke';
import {heroInkBox,heroVisiblePatch,type HeroInkBox} from './HeroVisibleSurface';
import {drawHandoffEar} from './HandoffEar';
import {HeroTargetAfterglow} from './HeroTargetAfterglow';

export interface AttachmentCard {container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container;rank?:number;width:number;height:number;center?:{x:number;y:number};labelWidth?:number}
export interface HeroTargetAttachmentOptions {
 root:()=>Phaser.GameObjects.Container|undefined;target:(id:string)=>AttachmentCard|undefined;
 source:()=>HeroEffectOrigin|undefined;motion:()=>AttachmentMotion;blocked:()=>boolean;speed?:()=>number;
 labelExclusions?:()=>readonly InkBox[];
 sourceExclusions?:()=>readonly InkBox[];
 sourceArtExclusions?:()=>readonly InkBox[];
 onPhase?:HeroAttachmentPhaseObserver;
}
type Mark={container:Phaser.GameObjects.Container;edge:Phaser.GameObjects.Graphics;label?:Phaser.GameObjects.Text;ear?:Phaser.GameObjects.Graphics;earWorld?:InkBox};
function cardBox(root:Phaser.GameObjects.Container,card:AttachmentCard):InkBox {
 const parent=root.getWorldTransformMatrix(),matrix=cardVisualRoot(card).getWorldTransformMatrix(),points=[[-card.width/2,-card.height/2],[card.width/2,-card.height/2],[-card.width/2,card.height/2],[card.width/2,card.height/2]].map(([x,y])=>{const w=matrix.transformPoint(x,y);return parent.applyInverse(w.x,w.y);}),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
 return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
function union(boxes:readonly InkBox[]):InkBox {const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};}

/** Existing exact-instance ownership with two bounded visual layers; never owns a card pose or score clock. */
export class HeroTargetAttachment {
 private readonly state=new HeroTargetAttachmentState();
 private readonly marks=new Map<string,Mark>();
 private atmosphere?:Phaser.GameObjects.Graphics;
 private flight?:Phaser.GameObjects.Graphics;
 private flightCurrent?:Phaser.GameObjects.Graphics;
 private cadence=0;
 private pulseAfter=0;
 private sourceElapsed=0;
 private staticKey='';
 private blurred=false;
 private destroyed=false;
 private readonly sushi:SushiDiscardCardPresentation;
 private readonly particles:HeroSkillParticles;
 private readonly afterglow:HeroTargetAfterglow;
 private glowMaskRoot?:Phaser.GameObjects.Container;
 private glowMaskSupplier?:()=>readonly HeroInkBox[];

 private readonly sourceEcho:HeroSourceEcho;
 private readonly liveSmoke:HeroLiveSmoke;
 private readonly refillSmoke:HeroLiveSmoke;
 private burstAbort?:()=>void;
 private readonly phases:HeroAttachmentPhases;
 private readonly refillPhases:HeroAttachmentPhases;
 private phaseContext?:EffectContext;
 private pendingLanding?:EffectContext;
 private phaseReason?:string;
 private confirmedGlowTargets:readonly string[]=[];
 private readonly glowImpacts=new Set<string>();
 private readonly sourceKeys=new Set<string>();
 private readonly blur=()=>{this.blurred=true;this.hide();};
 private readonly focus=()=>{this.blurred=false;};
 private readonly visibility=()=>{if(document.hidden)this.hide();};
 private readonly tick=(_time:number,delta:number)=>this.update(delta,false);
 constructor(private readonly scene:Phaser.Scene,private readonly options:HeroTargetAttachmentOptions){
  this.particles=new HeroSkillParticles(scene);
  this.afterglow=new HeroTargetAfterglow(scene,()=>this.options.motion());

  this.sourceEcho=new HeroSourceEcho(scene);
  this.liveSmoke=new HeroLiveSmoke(scene);this.refillSmoke=new HeroLiveSmoke(scene);
  this.phases=new HeroAttachmentPhases(options.onPhase);this.refillPhases=new HeroAttachmentPhases(options.onPhase);
  this.sushi=new SushiDiscardCardPresentation(scene,options.root,id=>{const card=options.target(id);return card?{id,...card}:undefined;},()=>options.motion()!=='full',options.source,options.onPhase,()=>[...(options.labelExclusions?.()??[]),...(options.sourceArtExclusions?.()??[])]);
  scene.events.on('update',this.tick);scene.events.once('shutdown',this.destroy,this);
  window.addEventListener('blur',this.blur);window.addEventListener('focus',this.focus);document.addEventListener('visibilitychange',this.visibility);
 }
 preview(draft:AttachmentDraft|undefined):void {if(this.destroyed)return;if(draft?.releaseReason==='amo.exile'){this.clear();return;}this.sushi.clear();const previous=this.state.value?.generation;this.state.setMotion(this.options.motion());this.state.preview(draft);const changed=previous!==this.state.value?.generation;if(changed){this.afterglow.clear();this.phases.end('replaced');this.phaseContext=undefined;this.pendingLanding=undefined;this.phaseReason=undefined;this.disposeVisuals();this.pulseAfter=0;if(draft?.confirmed)this.activateSource(draft.key);}this.update(0,changed);}
 previewSushiDiscard(ids:readonly string[]):void {if(this.destroyed)return;this.phases.end('replaced');this.phaseContext=undefined;this.phaseReason=undefined;this.state.clear();this.disposeVisuals();if(!ids.length){this.sushi.clear();return;}this.sushi.preview(ids);this.sushi.step(0,true);}
 previewSushiKings(ids:readonly string[],factor:3|4):void {if(this.destroyed)return;this.phases.end('replaced');this.phaseContext=undefined;this.phaseReason=undefined;this.state.clear();this.disposeVisuals();if(!ids.length){this.sushi.clear();return;}this.sushi.prepareKings(ids,factor);this.sushi.step(0,true);}
 beginSushiDiscard(trace:ScoreTrace,context:EffectContext):boolean {return !this.destroyed&&this.sushi.bindSaved(trace,context);}
 cutSushiDiscard(id:string,progress:number):boolean {return !this.destroyed&&this.sushi.cut(id,progress);}
 presentSushiDiscard(trace:ScoreTrace,eventId:string,context:EffectContext,arrival:Promise<void>,travelMs:number,impactMs:number,sink:InkPoint):void {if(!this.destroyed)this.sushi.present(trace,eventId,context,arrival,travelMs,impactMs,sink);}
 impactRetainedCard(id:string,eventId:string,context:EffectContext):void {
  if(this.destroyed||context.signal.aborted||this.options.motion()!=='full')return;const root=this.options.root(),card=this.options.target(id);if(!root?.active||!card?.container.active)return;
  this.burstAbort?.();const remaining=(this.state.value?.targetIds??[]).filter(target=>target!==id);this.state.retainTargets(remaining);if(!remaining.length){this.phases.publish('settled');this.phases.end();}this.particles.releaseTarget(id);this.liveSmoke.releaseTarget(id);this.removeMark(id);
  const style=heroAtmosphereStyle({key:eventId,targetId:id,releaseReason:'laohuan.refill'}),layout=this.layout(root,new Set([card.container]));this.refillPhases.bind({owner:'retained-impact',activationId:eventId,eventId,reasonKey:'laohuan.refill',targetIds:[id],sourceTargetIds:[],motion:'full',context});this.refillPhases.publish('impact');if(this.destroyed||context.signal.aborted||!this.refillPhases.isCurrent(eventId))return;const done=()=>{this.refillPhases.publish('settled');this.refillPhases.end();};if(!this.refillSmoke.playImpact(eventId,{id,...card},style,root,layout.masks,context,done,()=>this.layout(root,new Set([card.container])).masks)){done();return;}
  const cancel=()=>{this.refillSmoke.clear();this.refillPhases.end('aborted');};context.signal.addEventListener('abort',cancel,{once:true});this.burstAbort=()=>{context.signal.removeEventListener('abort',cancel);cancel();};
 }
 private activateSource(key:string):void {this.pulseAfter=this.sourceKeys.has(key)||this.options.motion()!=='full'?Infinity:0;this.sourceElapsed=0;this.sourceKeys.add(key);}
 consume(targetId:string,eventId:string,context:EffectContext,confirmedTargets:readonly string[]=[]):void {if(this.destroyed)return;const previous=this.state.value?.eventId;if(this.state.consume(targetId,eventId,context)){this.phaseContext=context;if(!previous){this.confirmedGlowTargets=[...confirmedTargets];this.glowImpacts.clear();this.activateSource(this.state.value!.key);}}this.update(0);}
 commit(eventId:string,context:EffectContext,confirmedTargets:readonly string[]=[]):void {const id=this.state.value?.targetId;if(id)this.consume(id,eventId,context,confirmedTargets);}
 retainTargets(ids:readonly string[]):void {this.state.retainTargets(ids);this.update(0);}
 resolveSaved(draft:AttachmentDraft,eventId:string,context:EffectContext):void {if(context.signal.aborted)return;this.preview(draft);this.commit(eventId,context);this.release({eventId,reasonKey:draft.releaseReason},context);}
 private startAfterglow(context:EffectContext,ids:readonly string[],retainOthers=false):void {
  const root=this.options.root();if(!root?.active||context.signal.aborted||!ids.length)return;
  const members=ids.map(id=>({id,card:this.options.target(id)})).filter((v):v is {id:string;card:AttachmentCard}=>!!v.card?.container.active&&v.card.container.visible);if(!members.length)return;
  // layout's masks include all cards regardless of its target set. Reusing the
  // supplier keeps successive same-scene impacts to one tree walk per redraw.
  if(this.glowMaskRoot!==root||!this.glowMaskSupplier){this.glowMaskRoot=root;this.glowMaskSupplier=()=>[...this.layout(root,new Set()).masks,...(this.options.sourceExclusions?.()??[]).slice(0,-1).map(b=>({...this.localBounds(root,b),inkKind:'art' as const}))];}
  this.afterglow.play({root,cards:members.map(({id,card})=>({id,...card})),masks:this.glowMaskSupplier,signal:context.signal,isCurrent:card=>this.options.target(card.id)?.container===card.container,retainOthers});
 }
 /** Wait for both actual landing and the source current, without delaying the score queue. */
 landed(context:EffectContext):void {if(!this.destroyed&&this.phaseContext?.signal===context.signal&&this.state.value?.eventId){this.pendingLanding=context;this.settleLanding();}}
 private settleLanding():void {
  const context=this.pendingLanding,state=this.state.value;if(!context)return;
  if(context.signal.aborted||this.phaseContext?.signal!==context.signal||!state?.eventId||this.options.motion()!=='full'){this.pendingLanding=undefined;return;}
  if(!state.suppressSource&&this.particles.available&&Number.isFinite(this.pulseAfter)&&this.sourceElapsed<HERO_SOURCE_CURRENT_MS)return;
  this.pendingLanding=undefined;this.flight?.destroy();this.flight=undefined;this.flightCurrent?.destroy();this.flightCurrent=undefined;this.startAfterglow(context,this.confirmedGlowTargets);
 }
 /** The caller supplies beneficiaries from an actual positive saved score action. */
 impactSavedTargets(ids:readonly string[],context:EffectContext):void {if(!this.destroyed)this.startAfterglow(context,ids,true);}
 impactConfirmedTarget(event:{eventId:string;targetCardId?:string;reasonKey?:string},context:EffectContext):void {const id=event.targetCardId;if(this.destroyed||this.phaseContext?.signal!==context.signal||event.reasonKey!=='erxiang.handoff'||!id||!this.confirmedGlowTargets.includes(id)||this.glowImpacts.has(event.eventId))return;this.glowImpacts.add(event.eventId);this.startAfterglow(context,[id],true);}
 release(event:{eventId:string;targetCardId?:string;reasonKey?:string},context:EffectContext):void {if(this.destroyed)return;if(this.state.release(event,context)){if(this.pendingLanding?.signal===context.signal&&!this.state.value?.failed)this.startAfterglow(context,this.confirmedGlowTargets,true);this.pendingLanding=undefined;this.phaseReason=event.reasonKey;this.phases.setReason(event.reasonKey);this.phases.publish('impact');if(this.state.value?.failed)this.afterglow.clear();else if(event.reasonKey!=='erxiang.handoff')this.startAfterglow(context,event.targetCardId?this.confirmedGlowTargets.filter(id=>id===event.targetCardId):this.confirmedGlowTargets);if(!this.state.value){this.phases.publish('settled');this.phases.end();}}this.update(0);}
 clear(cause='cleared'):void {this.confirmedGlowTargets=[];this.glowImpacts.clear();this.afterglow.clear();this.burstAbort?.();this.burstAbort=undefined;this.refillSmoke.clear();this.refillPhases.end(cause);this.phases.end(cause);this.phaseContext=undefined;this.pendingLanding=undefined;this.phaseReason=undefined;this.sushi.clear(cause);this.state.clear();this.disposeVisuals();}
 private hide():void {this.pendingLanding=undefined;this.afterglow.clear();this.burstAbort?.();this.burstAbort=undefined;this.sushi.suspend();this.phases.suspend('hidden');this.state.suspend();if(!this.state.value)this.phases.end('hidden');this.pulseAfter=Infinity;this.disposeVisuals();}
 private removeMark(id:string):void {const mark=this.marks.get(id);mark?.edge.destroy();mark?.label?.destroy();mark?.ear?.destroy();this.marks.delete(id);}
 private disposeVisuals():void {this.particles.clear();this.liveSmoke.clear();this.sourceEcho.clear();for(const id of [...this.marks.keys()])this.removeMark(id);this.atmosphere?.destroy();this.atmosphere=undefined;this.flight?.destroy();this.flight=undefined;this.flightCurrent?.destroy();this.flightCurrent=undefined;this.staticKey='';}
 private localBounds(root:Phaser.GameObjects.Container,b:InkBox):InkBox {const m=root.getWorldTransformMatrix(),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>m.applyInverse(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};}
 /** Exact Graphics ink bounds in world coordinates feed the existing scene exclusions. */
 handoffEarExclusions():InkBox[] {
  const boxes:InkBox[]=[];
  for(const mark of this.marks.values()){const ear=mark.ear,b=ear?.getData('inkBounds') as InkBox|undefined;if(!ear?.active||!ear.visible||ear.alpha<=0||!b)continue;
   let visible=true;for(let parent=ear.parentContainer;parent;parent=parent.parentContainer)if(!parent.active||!parent.visible||parent.alpha<=0)visible=false;if(!visible)continue;
   const m=ear.getWorldTransformMatrix(),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>m.transformPoint(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
   const world=mark.earWorld??(mark.earWorld={x:0,y:0,width:0,height:0});Object.assign(world,{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y});boxes.push(world);
  }return boxes;
 }
 private syncHandoffEars(members:readonly {id:string;card:AttachmentCard}[],root:Phaser.GameObjects.Container,handoff:boolean,alpha:number):void {
  const base=handoff?this.layout(root,new Set(members.map(t=>t.card.container)),true):undefined;
  for(const {id,card}of members){const mark=this.marks.get(id);if(!mark)continue;
   if(!base){mark.ear?.destroy();mark.ear=undefined;mark.earWorld=undefined;continue;}
   const declared=card.visual??card.container.getData('cardBodyRoot') as Phaser.GameObjects.Container|undefined;if(declared&&!declared.active){if(mark.ear?.active)mark.ear.setVisible(false);continue;}
   const patch=heroVisiblePatch({id,...card},root,base.masks);if(!patch){mark.ear?.setVisible(false);continue;}
   const body=cardVisualRoot(card),m=body.getWorldTransformMatrix(),sx=Math.max(.1,Math.hypot(m.a,m.b)),sy=Math.max(.1,Math.hypot(m.c,m.d));
   const ear=mark.ear?.active?mark.ear:(mark.ear=this.scene.add.graphics().setName('hero/handoff-ear').setData('targetId',id));if(ear.parentContainer!==body)body.add(ear);
   const box={x:patch.x+Math.max(0,patch.width-14/sx),y:patch.y,width:Math.min(patch.width,14/sx),height:Math.min(patch.height,18/sy)};
   ear.setVisible(drawHandoffEar(ear,box,this.state.value?.kind==='group'&&this.state.value.releaseReason==='erxiang.handoff'?'听政目标：同点有效牌每次普通点数改加倍率':undefined,{x:sx,y:sy},this.options.motion()==='full'?this.state.value?.clock??0:0)).setAlpha(alpha);
  }
 }
 private layout(root:Phaser.GameObjects.Container,targets:ReadonlySet<Phaser.GameObjects.Container>,ignoreHandoff=false){
  const ignored=ignoreHandoff?new Set(this.handoffEarExclusions()):undefined;
  const protectedBoxes:InkBox[]=[],masks:HeroInkBox[]=[],costs:InkBox[]=[],costIds:string[]=[];let portrait:InkBox|undefined,avatar:InkBox|undefined;
  const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const object of list){const o=object as Phaser.GameObjects.Container;if(!o.active||!o.visible||o.alpha<.01||o.name==='hero/live-smoke')continue;
   if(o.getData('cardFace')){
    const box=cardBox(root,{container:o,width:Number(o.getData('width')),height:Number(o.getData('height'))});
    masks.push(heroInkBox(root,o,box,'face'));
    // Normal cards and duplicate preview faces remain wholly protected. Targets expose only blank paper, never their print.
    if(!targets.has(o))protectedBoxes.push(box);
    if(o.list.some(child=>{const text=child as Phaser.GameObjects.Text;return text.type==='Text'&&text.visible&&text.text==='弃';})){costs.push(box);costIds.push(String(o.getData('cardId')));}
   }
   if(o.type==='Text'||o.type==='Image'){
    const b=(o as unknown as Phaser.GameObjects.Text).getBounds(),local=this.localBounds(root,b);protectedBoxes.push(local);masks.push(heroInkBox(root,o,local,o.type==='Text'||o.getData('heroInkPrint')?'print':o.getData('heroInkPaper')?'paper':'art'));if(o.name==='hero/portrait')portrait=local;if(o.type==='Image'&&(o as unknown as Phaser.GameObjects.Image).texture.key.startsWith('avatar-')&&local.y<90)avatar=local;
   }
   if(o.list)walk(o.list);
  }};walk(root.list);for(const b of this.options.labelExclusions?.()??[]){if(ignored?.has(b))continue;const box=this.localBounds(root,b);protectedBoxes.push(box);masks.push({...box,inkKind:'print'});}for(const b of this.options.sourceArtExclusions?.()??[]){const box=this.localBounds(root,b);protectedBoxes.push(box);masks.push({...box,inkKind:'art'});}const mobile=cssViewport(this.scene).width<600;return{protectedBoxes,masks,costs,costIds,portrait:mobile?avatar??portrait:portrait??avatar,sourceKind:mobile&&avatar||!portrait&&avatar?'avatar':'portrait'};
 }
 private source(root:Phaser.GameObjects.Container,portrait:InkBox|undefined,boxes:readonly InkBox[]){
  const explicit=this.options.source();if(explicit)return{point:root.getWorldTransformMatrix().applyInverse(explicit.x,explicit.y),kind:explicit.kind??'skill'};
  if(portrait){const target=union(boxes),cx=portrait.x+portrait.width/2,cy=portrait.y+portrait.height/2,dx=target.x+target.width/2-cx,dy=target.y+target.height/2-cy,d=Math.max(.001,Math.hypot(dx,dy)),scale=1/Math.max(Math.abs(dx)/(portrait.width/2),Math.abs(dy)/(portrait.height/2),.001);return{point:{x:cx+dx*scale+dx/d*12,y:cy+dy*scale+dy/d*12},kind:'portrait'};}
  return undefined;
 }
 private avoidControls(label:Phaser.GameObjects.Text,card:AttachmentCard,group:boolean):void {
  const exclusions=this.options.labelExclusions?.()??[],overlaps=(b:InkBox)=>exclusions.some(a=>b.x<a.x+a.width&&b.x+b.width>a.x&&b.y<a.y+a.height&&b.y+b.height>a.y);if(!overlaps(label.getBounds()))return;
  if(!group){label.y=(card.center?.y??0)-card.height/2-11/Math.max(.2,Math.abs(card.container.scaleY));if(!overlaps(label.getBounds()))return;}
  const bounds=label.getBounds(),worldX=bounds.x+bounds.width/2,worldY=bounds.y+bounds.height/2,matrix=card.container.getWorldTransformMatrix(),original=matrix.applyInverse(worldX,worldY),candidates=exclusions.flatMap(b=>[b.x-4-bounds.width/2,b.x+b.width+4+bounds.width/2]).sort((a,b)=>Math.abs(a-worldX)-Math.abs(b-worldX));
  for(const x of candidates){const b={...bounds,x:x-bounds.width/2};if(b.x<4||b.x+b.width>cssViewport(this.scene).width-4||overlaps(b))continue;label.x+=matrix.applyInverse(x,worldY).x-original.x;break;}
 }
 private update(delta:number,force=true):void {
  if(this.destroyed)return;if(this.blurred||document.hidden||this.options.blocked()){this.hide();return;}
  this.liveSmoke.setFrozen(this.options.motion()!=='full');this.liveSmoke.step(delta);this.refillSmoke.step(delta);
  if(this.sushi.active){this.sushi.step(delta,force);return;}
  const before=this.state.value;this.state.setMotion(this.options.motion());if(this.options.motion()!=='full')this.pulseAfter=Infinity;const speed=this.options.speed?.()??1;if(before&&Number.isFinite(this.pulseAfter))this.sourceElapsed+=Math.max(0,Math.min(50,delta))*(Number.isFinite(speed)&&speed>0?speed:1);this.state.advance(delta);this.settleLanding();if(before?.phase==='release'&&!this.state.value){this.phases.publish('settled');this.phases.end();}const viewport=cssViewport(this.scene),hz=viewport.width<600?HERO_ATMOSPHERE_BUDGET.portraitHz:HERO_ATMOSPHERE_BUDGET.desktopHz;this.cadence+=delta;if(!force&&this.cadence<1000/hz)return;this.cadence%=1000/hz;
  const state=this.state.value,root=this.options.root();if(!state||!root?.active){this.phases.end('expired');this.disposeVisuals();return;}
  const ids=state.targetIds??[state.targetId],limit=state.kind==='candidate'&&state.releaseReason==='laohuan.refill'?HERO_NATIVE_PARTICLE_BUDGET.targets:HERO_ATMOSPHERE_BUDGET.targets,members=ids.map(id=>({id,card:this.options.target(id)})).filter((t):t is {id:string;card:AttachmentCard}=>!!t.card?.container.active&&t.card.container.visible).filter(t=>{const b=t.card.container.getBounds();return b.right>0&&b.bottom>0&&b.x<viewport.width&&b.y<viewport.height;}).slice(0,limit);
  if(!members.length){this.hide();return;}
  // Group actions still bind every real affected card individually.  A synthetic
  // union target would draw an edge/label across gaps and empty slots, which is
  // especially misleading for the multi-card release states.
  const boxes=members.map(t=>cardBox(root,t.card)),targets=members;
  const visible=new Set(targets.map(t=>t.id));for(const id of this.marks.keys())if(!visible.has(id))this.removeMark(id);
  const prepared=!state.eventId&&state.kind!=='assist',full=this.options.motion()==='full'&&(this.state.accepted||prepared)&&this.particles.available,releasing=state.phase==='release',release=releasing?Math.min(1,state.elapsed/ATTACHMENT_RELEASE_MS):0;
  for(const {id,card}of targets){
   const {container,width,height}=card,center=card.center??{x:0,y:0};let mark=this.marks.get(id);
   if(!mark||mark.container!==container||!mark.edge.active){this.removeMark(id);const edge=this.scene.add.graphics().setName('hero/target-edge').setData('targetId',id).setData('attachmentKind',state.kind??'card');container.add(edge);const showLabel=state.kind!=='assist'&&!!state.label&&state.label!=='待转'&&state.releaseReason!=='erxiang.handoff'&&(!state.kind||state.kind!=='group'||id===targets[0]?.id),label=showLabel?this.scene.add.text(0,0,state.label!,{fontFamily:UI_FONT,fontSize:'13px',fontStyle:'bold',color:'#215f70',backgroundColor:'#edf7f5',padding:{x:3,y:1},resolution:textDensity(this.scene)}).setOrigin(.5).setName('hero/target-tag').setData('targetId',id):undefined;if(label)container.add(label);mark={container,edge,label};this.marks.set(id,mark);}
   const {edge,label}=mark,sx=Math.max(.2,Math.abs(container.scaleX)),sy=Math.max(.2,Math.abs(container.scaleY));edge.clear().setPosition(center.x,center.y);
   if(label){const text=releasing?(state.resolvedLabel??state.label!):state.kind==='candidate'&&state.selectedIds?.includes(id)?'待留':state.label!;label.setText(text).setData('fullText',text);if(card.labelWidth&&label.width>card.labelWidth*sx&&state.kind==='wager')label.setText(releasing?(state.failed?'未成':'已成'):'新?');const group=state.kind==='group';label.setScale(1/sx,1/sy).setPosition(group?center.x:center.x-width/2+(label.width/2+2)/sx,group?center.y-height/2-11/sy:center.y+height/2+11/sy).setAlpha(1-release);this.avoidControls(label,card,group);}
   edge.setData('phase',state.phase).setData('eventId',state.eventId).setData('generation',state.generation).setData('flowPhase',full?state.clock%1600/1600:0).setData('memberIds',ids).setData('width',width).setData('height',height).setData('labelText',label?.text);
  }
  const sourceMembers=members.filter(t=>state.sourceTargetIds===undefined||state.sourceTargetIds.includes(t.id)),sourceBoxes=sourceMembers.map(t=>cardBox(root,t.card));
  const style=heroAtmosphereStyle(state);this.syncHandoffEars(members,root,style.key==='handoff',1-release);
  const layout=this.layout(root,new Set(members.map(t=>t.card.container))),source=sourceBoxes.length?this.source(root,layout.portrait,sourceBoxes):undefined;if(source?.kind==='portrait')source.kind=layout.sourceKind;
  const energy:XinEnergyAppearance|undefined=state.kind==='candidate'&&style.key==='retain'?{phase:state.label==='候选'?'candidate':'retained',igniteIds:state.label==='候选'?ids:state.sourceTargetIds??[],selectedIds:state.selectedIds}:undefined;
  if(this.state.accepted&&this.options.onPhase){this.phases.bind({owner:'card',activationId:state.key,eventId:state.eventId,reasonKey:this.phaseReason??state.releaseReason??'erxiang.handoff',targetIds:members.map(t=>t.id),sourceTargetIds:state.suppressSource?[]:sourceMembers.map(t=>t.id),motion:this.options.motion(),context:this.phaseContext});if(state.eventId)this.phases.publish('committed');if(full)this.phases.resume();else this.phases.suspend('motion');}
  if(this.destroyed||this.state.value!==state||this.phaseContext?.signal.aborted)return;
  if(energy)layout.protectedBoxes.push(...boxes);
  if(!this.atmosphere?.active){this.atmosphere=this.scene.add.graphics().setName('hero/attachment-atmosphere');root.add(this.atmosphere);}
  const smoke=this.liveSmoke.sync(state.key,members.map(t=>({id:t.id,...t.card})),style,root,layout.masks,this.options.motion()!=='off',release,state.failed===true,()=>this.layout(root,new Set(members.map(t=>t.card.container))).masks,prepared);
  this.particles.sync(state.key,members.filter(t=>!smoke.has(t.id)).map(t=>({id:t.id,...t.card})),style,root,layout.protectedBoxes,full&&style.key==='legacy-assist',state.ignite!==false&&Number.isFinite(this.pulseAfter)&&state.clock<=420,energy);if(releasing)this.particles.impact(undefined,state.failed===true);
  this.sourceEcho.sync(root,style,state.clock,layout.protectedBoxes,full&&style.key==='legacy-assist'&&!state.suppressSource&&!state.failed,(releasing?1.5:1)*(1-release),layout.portrait);
  const staticKey=JSON.stringify([boxes,style.key,state.phase,full,smoke.size,prepared]);if(releasing||this.staticKey!==staticKey){if(style.key!=='legacy-assist')this.atmosphere.clear().setData('stats',{markers:0,particles:0,presentation:'visible-surface'});else{const stats=drawHeroAtmosphere(this.atmosphere,{style,clock:state.clock,targets:boxes,protectedBoxes:layout.protectedBoxes,full:false,alpha:1-release,failed:state.failed});this.atmosphere.setData('stats',stats);}this.staticKey=staticKey;}
  this.atmosphere.setData('phase',state.phase).setData('memberIds',members.map(t=>t.id)).setData('costIds',style.key==='exile'?layout.costIds:[]).setData('protectedPrint',layout.protectedBoxes).setData('clock',state.clock).setData('cadenceHz',hz).setData('sourceKind',source?.kind);
  const progress=Number.isFinite(this.pulseAfter)?this.sourceElapsed/HERO_SOURCE_CURRENT_MS:-1;
  if(full&&this.state.accepted&&!state.suppressSource&&!releasing&&!state.failed&&source&&progress>=0&&progress<1){
   this.phases.publish('source');
   if(this.destroyed||this.state.value!==state||this.phaseContext?.signal.aborted)return;
   if(!this.flight?.active){this.flight=this.scene.add.graphics().setName('hero/target-travel');root.add(this.flight);}if(!this.flightCurrent?.active){this.flightCurrent=this.scene.add.graphics().setName('hero/target-current');root.add(this.flightCurrent);}const protectedBoxes=layout.protectedBoxes,stats=drawHeroOriginStream(this.flight,source.point,sourceBoxes,style,progress,protectedBoxes,1-release,this.flightCurrent);this.flight.setData('stats',stats).setData('progress',progress).setData('sourceKind',source.kind).setData('source',source.point).setData('targetIds',sourceMembers.map(t=>t.id));this.flightCurrent.setData('stats',stats).setData('progress',progress).setData('protectedBoxes',protectedBoxes);
  }else{this.flight?.destroy();this.flight=undefined;this.flightCurrent?.destroy();this.flightCurrent=undefined;}
  if(this.state.accepted)this.phases.publish('attached');
 }
 destroy():void {if(this.destroyed)return;this.destroyed=true;this.clear('destroyed');this.afterglow.destroy();this.scene.events.off('update',this.tick);this.scene.events.off('shutdown',this.destroy,this);window.removeEventListener('blur',this.blur);window.removeEventListener('focus',this.focus);document.removeEventListener('visibilitychange',this.visibility);}
}
