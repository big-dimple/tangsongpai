import type Phaser from 'phaser';
import {cardVisualRoot} from './CardVisualRoot';
import type {InkBox} from './AssistInkGeometry';
import type {AtmosphereStyle} from './HeroCardAttachmentAtmosphere';
import type {HeroParticleCard} from './HeroSkillParticles';
import {HeroSmokeQuality,type HeroSmokeProfile} from './HeroSmokeQuality';
import {HERO_SMOKE_KEY,HERO_SMOKE_VERTEX,HERO_SMOKE_FRAGMENT} from './HeroSmokeShader';
import type {EffectContext} from '../core/EffectQueue';
import {cssViewport} from '../platform/Viewport';
import {heroEnergyLayers} from './HeroEnergyLayers';
import {heroVisiblePatch,drawPreparedSurface,type HeroInkBox} from './HeroVisibleSurface';

const owners=new WeakMap<Phaser.Scene,Set<HeroLiveSmoke>>();let serial=0;
type LiveSmokeCard=HeroParticleCard&{releaseProgress?:number};
type NativeShader=Phaser.GameObjects.Shader&{renderWebGL:(renderer:Phaser.Renderer.WebGL.WebGLRenderer,src:Phaser.GameObjects.Shader,camera:Phaser.Cameras.Scene2D.Camera,parentMatrix?:Phaser.GameObjects.Components.TransformMatrix)=>void};
const rgb=(color:number)=>({x:(color>>16&255)/255,y:(color>>8&255)/255,z:(color&255)/255});
/** One Phaser Shader->framebuffer->Image, on the real target. No DOM canvas, new engine, RAF, timer or input object. */
class HeroSmokeTarget {
 private shader?:Phaser.GameObjects.Shader;private image?:Phaser.GameObjects.Image;private flow?:Phaser.GameObjects.Graphics;private card?:HeroParticleCard;private key='';private output='';private signature='';private dirty=true;private age=0;private phase=0;private cadence=0;private burst=0;private unavailable=false;private profile?:HeroSmokeProfile;private geometry='';private unbindCard?:()=>void;
 cpu=0;
 get pixels(){return this.shader&&this.profile?this.profile.width*this.profile.height:0;}
 get failed(){return this.unavailable;}
 constructor(private readonly scene:Phaser.Scene,private readonly quality:HeroSmokeQuality){}
 step(delta:number):void {
  if((!this.shader&&!this.flow)||!this.profile)return;const dt=Math.max(0,Math.min(50,delta));this.age+=dt;this.phase=(this.phase+dt/1000*(3+this.quality.index*1.8+this.burst*14))%(Math.PI*2);this.cadence+=dt;
  if(this.cadence>=1000/this.profile.hz){this.cadence%=1000/this.profile.hz;this.shader?.setUniform('uParams.value',{x:this.age/1000,y:this.phase,z:this.burst,w:this.quality.index});this.dirty=true;}
 }
 sync(key:string,card:HeroParticleCard,style:AtmosphereStyle,root:Phaser.GameObjects.Container,boxes:readonly HeroInkBox[],impact:number,profile:HeroSmokeProfile,failed:boolean,prepared:boolean,useGL:boolean):boolean {
  const patch=heroVisiblePatch(card,root,boxes,prepared);if(!patch){this.clear();return false;}
  const maxW=prepared?(profile.name==='high'?48:profile.name==='medium'?32:24):(profile.name==='high'?80:profile.name==='medium'?64:48),maxH=prepared?(profile.name==='high'?64:profile.name==='medium'?48:32):(profile.name==='high'?96:profile.name==='medium'?80:64);
  profile={...profile,width:Math.min(profile.width,maxW),height:Math.min(profile.height,maxH),padding:0};this.profile=profile;
  const w=patch.width,h=patch.height;
  // The handoff ear and its small inward waves lead; the older long wisp stays subordinate.
  const alpha=(style.key==='handoff'?.22:1)*(failed?.28:prepared?.7:1)*(1-impact);
  if(this.key!==key||this.card?.container!==card.container){this.clear();this.age=0;this.phase=0;const dead=()=>this.clear();card.container.once('destroy',dead);this.unbindCard=()=>card.container.off('destroy',dead);}this.key=key;this.card=card;this.burst=!failed&&impact>0?Math.sin(Math.min(1,impact)*Math.PI):0;
  try{
   const geometry=[w,h,impact,failed,prepared,patch.x,patch.y].join('/');if(this.geometry!==geometry){this.geometry=geometry;this.dirty=true;}
   if(!useGL||this.unavailable){
    if(this.shader||this.image)this.release();if(!this.flow?.active){this.flow=this.scene.add.graphics().setName('hero/prepared-material');card.container.add(this.flow);this.dirty=true;}
    if(this.dirty){const start=performance.now();drawPreparedSurface(this.flow,patch,this.age,style.glow,style.spark,['exile','handoff','charge','burn','wager','retain'].indexOf(style.key));this.cpu=performance.now()-start;this.dirty=false;}
    this.flow.setAlpha(alpha).setData('targetCardId',card.id).setData('materialPatch',patch).setData('energyStage',prepared?'prepared':'committed');return true;
   }
   const signature=profile.width+'/'+profile.height+'/'+profile.octaves+'/'+prepared;if(!this.shader||this.signature!==signature){this.release();this.create(card,style,w,h);this.signature=signature;}
   if(!this.shader||!this.image)return false;
   this.shader.setUniform('uExtent.value',{x:w,y:h}).setUniform('uParams.value',{x:this.age/1000,y:this.phase,z:this.burst,w:this.quality.index});
   const layers=heroEnergyLayers(style.key,profile,w,h,failed,prepared);
   this.shader.setUniform('uAppearance.value',{x:['exile','handoff','charge','burn','wager','retain'].indexOf(style.key),y:alpha,z:prepared?1:2,w:0}).setUniform('uLayers.value',layers.uniform);
   this.image.setPosition(patch.x+w/2,patch.y+h/2).setDisplaySize(w,h).setData('targetCardId',card.id).setData('materialPatch',patch).setData('smokeQuality',profile.name).setData('smokePixels',profile.width*profile.height).setData('clockwisePhase',this.phase).setData('energyGeometry',layers.geometry).setData('energyLayerCount',layers.uniform.y).setData('energyStage',prepared?'prepared':'committed');return true;
  }catch{this.unavailable=true;this.clear();return useGL?this.sync(key,card,style,root,boxes,impact,profile,failed,prepared,false):false;}
 }
 private create(card:HeroParticleCard,style:AtmosphereStyle,width:number,height:number):void {
  const profile=this.profile!,cache=this.scene.cache.shader;if(!cache.has(HERO_SMOKE_KEY))cache.add(HERO_SMOKE_KEY,{key:HERO_SMOKE_KEY,vertexSrc:HERO_SMOKE_VERTEX,fragmentSrc:HERO_SMOKE_FRAGMENT,uniforms:{uExtent:{type:'2f',value:{x:width,y:height}},uInk:{type:'3f',value:rgb(style.ink)},uGlow:{type:'3f',value:rgb(style.glow)},uSpark:{type:'3f',value:rgb(style.spark)},uParams:{type:'4f',value:{x:0,y:0,z:0,w:0}},uAppearance:{type:'4f',value:{x:0,y:1,z:0,w:0}},uLayers:{type:'4f',value:heroEnergyLayers(style.key,profile,width,height).uniform},uOctaves:{type:'1f',value:2}}});
  this.output='hero-smoke-output/'+serial++;const shader=this.scene.add.shader(HERO_SMOKE_KEY,0,0,profile.width,profile.height).setName('hero/live-smoke-program').setData('targetCardId',card.id).setData('activationId',this.key) as NativeShader;this.shader=shader;
  if(!shader.program?.webGLProgram)throw new Error('Hero smoke program unavailable');
  shader.setUniform('uExtent.value',{x:width,y:height}).setUniform('uInk.value',rgb(style.ink)).setUniform('uGlow.value',rgb(style.glow)).setUniform('uSpark.value',rgb(style.spark)).setUniform('uOctaves.value',profile.octaves).setUniform('uLayers.value',heroEnergyLayers(style.key,profile,width,height).uniform).setUniform('uParams.value',{x:this.age/1000,y:this.phase,z:this.burst,w:this.quality.index});(this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).setBlendMode(0);shader.setRenderToTexture(this.output);
  const render=shader.renderWebGL;shader.renderWebGL=(renderer,src,camera,parentMatrix)=>{if(!this.dirty)return;const start=performance.now();renderer.setBlendMode(0);render.call(shader,renderer,src,camera,parentMatrix);this.cpu=performance.now()-start;this.quality.noteRender();this.dirty=false;};this.scene.sys.displayList.sendToBack(shader);
  this.image=this.scene.add.image(0,0,this.output).setName('hero/live-smoke').setFlipY(true).setDisplaySize(width,height);card.container.add(this.image);this.dirty=true;
 }
 private release():void {this.image?.destroy();this.image=undefined;this.flow?.destroy();this.flow=undefined;this.shader?.destroy();this.shader=undefined;if(this.output&&this.scene.textures.exists(this.output))this.scene.textures.remove(this.output);this.output='';this.signature='';}
 clear():void {this.release();this.unbindCard?.();this.unbindCard=undefined;this.card=undefined;this.key='';this.geometry='';}
}
export const HERO_SMOKE_TOTAL_PIXELS=131072;
/** Shared shader core, at most8 real-instance outputs. Scene total framebuffer pixels are bounded across all tiers. */
export class HeroLiveSmoke {
 private readonly targets=new Map<string,HeroSmokeTarget>();private readonly quality:HeroSmokeQuality;private readonly capable:boolean;private maskCpu=0;private unavailable=false;private frozen=false;
 private latest?:{key:string;cards:readonly LiveSmokeCard[];style:AtmosphereStyle;root:Phaser.GameObjects.Container;readBoxes:()=>readonly InkBox[];impact:number;failed:boolean;prepared:boolean};
 private impact?:{elapsed:number;duration:number;context:EffectContext;done:()=>void};
 constructor(private readonly scene:Phaser.Scene){
  const renderer=scene.game?.renderer as Phaser.Renderer.WebGL.WebGLRenderer|undefined,gl=renderer?.type===2?renderer.gl:undefined;
  this.capable=!!gl&&typeof scene.add.shader==='function'&&gl.getParameter(gl.MAX_TEXTURE_SIZE)>=256&&gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)>=32;
  const precise=gl?.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);this.quality=new HeroSmokeQuality(this.capable&&!!precise&&precise.precision>=16&&gl!.getParameter(gl!.MAX_TEXTURE_SIZE)>=1024);
 }
 step(delta:number):void {
  this.quality.sample(this.scene.game?.loop?.rawDelta??delta,this.maskCpu+[...this.targets.values()].reduce((n,t)=>n+t.cpu,0),this.targets.size>0&&!this.frozen);
  if(this.impact){this.impact.elapsed+=Math.max(0,Math.min(50,delta));if(this.impact.context.signal.aborted){this.clear();return;}if(this.impact.elapsed>=this.impact.duration){const done=this.impact.done;this.clear();done();return;}if(this.latest)this.latest.impact=this.impact.elapsed/this.impact.duration;}
  for(const target of this.targets.values())target.step(this.frozen?0:delta);const state=this.latest;if(state)this.sync(state.key,state.cards,state.style,state.root,state.readBoxes(),true,state.impact,state.failed,state.readBoxes,state.prepared);
 }
 setFrozen(value:boolean):void {this.frozen=value;}
 sync(key:string,cards:readonly LiveSmokeCard[],style:AtmosphereStyle,root:Phaser.GameObjects.Container,boxes:readonly InkBox[],active:boolean,impact=0,failed=false,readBoxes=()=>boxes,prepared=false):ReadonlySet<string> {
  cards=cards.filter(card=>{const declared=card.visual??card.container.getData('cardBodyRoot') as Phaser.GameObjects.Container|undefined;return !declared||declared.active;}).map(card=>({...card,occlusionOwner:card.occlusionOwner??card.container,container:cardVisualRoot(card)}));
  const live=new Set<string>();if(!active||style.key==='legacy-assist'||(this.scene.game?.renderer as Phaser.Renderer.WebGL.WebGLRenderer|undefined)?.contextLost||document.hidden||!root.active||!root.visible){this.clearVisuals();return live;}
  // The actual quad works for discard proxies containing only Graphics; getBounds can be empty or enlarged by the effect itself.
  const start=performance.now(),viewport=cssViewport(this.scene),peers=owners.get(this.scene)??new Set<HeroLiveSmoke>(),other=[...peers].filter(p=>p!==this).reduce((n,p)=>n+p.targets.size,0),selected=cards.filter(c=>{if(!c.container.active||!c.container.visible||c.container.alpha===0)return false;for(let p=c.container.parentContainer;p;p=p.parentContainer)if(!p.active||!p.visible||p.alpha===0)return false;const m=c.container.getWorldTransformMatrix(),points=[[-c.width/2,-c.height/2],[c.width/2,-c.height/2],[-c.width/2,c.height/2],[c.width/2,c.height/2]].map(([x,y])=>m.transformPoint(x,y));return Math.max(...points.map(p=>p.x))>0&&Math.max(...points.map(p=>p.y))>0&&Math.min(...points.map(p=>p.x))<viewport.width&&Math.min(...points.map(p=>p.y))<viewport.height;}).slice(0,Math.max(0,8-other)),ids=new Set(selected.map(c=>c.id));
  for(const [id,target]of this.targets)if(!ids.has(id)){target.clear();this.targets.delete(id);}
  const peerPixels=[...peers].filter(p=>p!==this).reduce((sum,p)=>sum+[...p.targets.values()].reduce((n,t)=>n+t.pixels,0),0),tier=this.quality.tier,perTarget=Math.max(0,HERO_SMOKE_TOTAL_PIXELS-peerPixels)/Math.max(1,selected.length),scale=Math.min(1,Math.sqrt(perTarget/(tier.width*tier.height))),profile={...tier,width:Math.max(1,Math.floor(tier.width*scale)),height:Math.max(1,Math.floor(tier.height*scale))};
  for(const card of selected){let target=this.targets.get(card.id);if(!target){target=new HeroSmokeTarget(this.scene,this.quality);this.targets.set(card.id,target);}if(target.sync(key,card,style,root,boxes,card.releaseProgress??impact,profile,failed,prepared,this.capable&&!this.unavailable&&!this.quality.fallback))live.add(card.id);if(target.failed)this.unavailable=true;}
  if(live.size){peers.add(this);owners.set(this.scene,peers);this.latest={key,cards:selected,style,root,readBoxes,impact,failed,prepared};}else this.clearVisuals();this.maskCpu=performance.now()-start;return live;
 }
 playImpact(key:string,card:HeroParticleCard,style:AtmosphereStyle,root:Phaser.GameObjects.Container,boxes:readonly InkBox[],context:EffectContext,done:()=>void,readBoxes=()=>boxes):boolean {const live=this.sync(key,[card],style,root,boxes,!context.signal.aborted,0,false,readBoxes);if(!live.has(card.id))return false;this.impact={elapsed:0,duration:240,context,done};return true;}
 releaseTarget(id:string):void {this.targets.get(id)?.clear();this.targets.delete(id);if(this.latest)this.latest.cards=this.latest.cards.filter(c=>c.id!==id);}
 private clearVisuals():void {for(const target of this.targets.values())target.clear();this.targets.clear();this.latest=undefined;this.maskCpu=0;const peers=owners.get(this.scene);peers?.delete(this);if(!peers?.size)owners.delete(this.scene);}
 clear():void {this.clearVisuals();this.impact=undefined;}
}
