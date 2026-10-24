import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';
import type {AtmosphereStyle} from './HeroCardAttachmentAtmosphere';
import {cssViewport} from '../platform/Viewport';
import {attachmentEdgePoint} from './HeroTargetAttachmentState';
import {xinEnergyRecipe,xinEnergyFootprint,xinEnergyOverlaps,XIN_ENERGY_BUDGET,type XinEnergyAppearance} from './XinPerimeterEnergy';
import {xinEnergyTexture} from './XinEnergyTexture';
import {hasHeroEnergy,heroEnergyRecipe,heroEnergyTexture} from './HeroEnergyRecipe';
import {cardVisualRoot} from './CardVisualRoot';

// Adapted from phaserjs/examples@68140eca public/3.86: fire effects,
// emit zone loop, add emitter to container. MIT notice: public/licenses/phaser3-particle-recipes.MIT.txt.
// The example atlas is NOT covered by its code license. Use one cached native soft bitmap instead.
const SOFT='hero-particle-soft32-v1',TOTAL=128;
const budgets=new WeakMap<Phaser.Scene,{reserved:number}>();
export interface HeroParticleCard {id:string;container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container;occlusionOwner?:Phaser.GameObjects.Container;width:number;height:number}
type Row={card:HeroParticleCard;selected:boolean;xin:boolean;burst:boolean;fire?:Phaser.GameObjects.Particles.ParticleEmitter;edge?:Phaser.GameObjects.Particles.ParticleEmitter;dispose:()=>void;toLocal:(x:number,y:number)=>{x:number;y:number}};
export const HERO_NATIVE_PARTICLE_BUDGET={total:TOTAL,targets:8,firePerTarget:7,edgePerTarget:9,texturePixels:64*32} as const;
/** Canvas uses a cached precolored bitmap; both Phaser renderers retain actual moving particles. */
export function heroNativeParticlesAvailable(scene:Phaser.Scene):boolean {return scene.game?.renderer?.type===2||scene.game?.renderer?.type===1;}
export function heroParticleRecipe(style:AtmosphereStyle,width:number,fire:boolean):Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
 const scale=Math.min(24,width*.22)/32;
 // Phaser checks the alive+dead hard cap before dead.pop. The alive cap bounds native reuse without blocking it.
 return {emitting:false,blendMode:fire?'ADD':'NORMAL',color:fire?[style.spark,style.glow,style.ink]:[style.glow,style.ink],colorEase:fire?'quad.out':'quart.out',lifespan:fire?{min:480,max:650}:360,frequency:fire?32:40,quantity:1,maxAliveParticles:fire?7:9,maxParticles:0,scale:{start:scale*(fire?1:.65),end:0,ease:fire?'sine.out':'sine.in'},alpha:{start:fire?.65:.8,end:0},angle:{min:-100,max:-80},speed:fire?{min:45,max:75}:0};
}
function texture(scene:Phaser.Scene,style:AtmosphereStyle,canvasColor=style.glow):string|undefined {
 const canvas=scene.game.renderer.type===1,color=canvas?canvasColor:0xffffff,key=canvas?SOFT+'-'+color.toString(16):SOFT,rgb=[color>>16&255,color>>8&255,color&255].join(',');
 if(scene.textures.exists(key))return key;const bitmap=scene.textures.createCanvas(key,32,32);if(!bitmap)return;const c=bitmap.getContext(),g=c.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,`rgba(${rgb},1)`);g.addColorStop(.2,`rgba(${rgb},.8)`);g.addColorStop(.55,`rgba(${rgb},.22)`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(0,0,32,32);bitmap.refresh();return key;
}
function visibleCard(scene:Phaser.Scene,card:HeroParticleCard):boolean {
 const c=card.container;if(!c.active||c.visible===false||c.alpha===0)return false;for(let p=c.parentContainer;p;p=p.parentContainer)if(!p.active||!p.visible||p.alpha===0)return false;const m=c.getWorldTransformMatrix(),v=cssViewport(scene),w=(Math.abs(m.a)*card.width+Math.abs(m.c)*card.height)/2,h=(Math.abs(m.b)*card.width+Math.abs(m.d)*card.height)/2;return m.tx+w>0&&m.ty+h>0&&m.tx-w<v.width&&m.ty-h<v.height;
}
/** Official pooled emitters, owned by exact real card containers. No timer, interactive object or new render loop. */
export class HeroSkillParticles {
 private rows=new Map<string,Row>();private key='';private protected:readonly InkBox[]=[];private toRoot=(x:number,y:number)=>({x,y});private impacted=false;private readonly ignited=new Set<string>();
 constructor(private readonly scene:Phaser.Scene){}
 get available():boolean {return heroNativeParticlesAvailable(this.scene);}
 sync(key:string,cards:readonly HeroParticleCard[],style:AtmosphereStyle,root:Phaser.GameObjects.Container,protectedBoxes:readonly InkBox[],active:boolean,ignite=true,appearance?:XinEnergyAppearance):void {
  cards=cards.map(card=>({...card,container:cardVisualRoot(card)}));
  if(!active||!this.available){this.clear();return;}if(this.key!==key){this.clear();this.key=key;}this.protected=protectedBoxes;const r=root.getWorldTransformMatrix();this.toRoot=(x,y)=>r.applyInverse(x,y);
  const selected=cards.filter(c=>visibleCard(this.scene,c)).slice(0,8),allowed=new Set(selected.map(c=>c.id));for(const [id,row]of this.rows)if(!allowed.has(id)||!row.card.container.active||row.card.container!==selected.find(c=>c.id===id)?.container){row.dispose();this.rows.delete(id);}
  const xin=style.key==='retain'?appearance:undefined,energy=!xin&&hasHeroEnergy(style);if(this.impacted)return;
  for(const row of this.rows.values())row.selected=xin?.selectedIds?.includes(row.card.id)===true;
  for(const card of selected){if(!card.container.active||this.rows.has(card.id))continue;const row:Row={card,selected:xin?.selectedIds?.includes(card.id)===true,xin:!!xin,burst:false,dispose:()=>undefined,toLocal:(x,y)=>({x,y})};this.rows.set(card.id,row);
   const dead=()=>{row.fire?.destroy();row.edge?.destroy();card.container.off('destroy',dead);};row.dispose=dead;card.container.once('destroy',dead);
   const ignition=key+'/'+card.id,accent=ignite&&!this.ignited.has(ignition)&&(!xin||xin.igniteIds.includes(card.id));
   const visible=(p:Phaser.GameObjects.Particles.Particle)=>{const local=xinEnergyFootprint(p,(x,y)=>({x,y}));if(xinEnergyOverlaps(local,{x:-card.width/2,y:-card.height/2,width:card.width,height:card.height}))return false;const m=p.emitter.worldMatrix,world=xinEnergyFootprint(p,(x,y)=>m.transformPoint(x,y)),v=cssViewport(this.scene);if(world.x<0||world.y<0||world.x+world.width>v.width||world.y+world.height>v.height)return false;const box=xinEnergyFootprint(p,(x,y)=>{const w=m.transformPoint(x,y);return this.toRoot(w.x,w.y);});return !this.protected.some(b=>xinEnergyOverlaps(box,b));};
   const create=(fire:boolean)=>{let budget=budgets.get(this.scene);if(!budget){budget={reserved:0};budgets.set(this.scene,budget);}const cap=xin?(fire?XIN_ENERGY_BUDGET.core:XIN_ENERGY_BUDGET.wake):(fire?7:9);if(budget.reserved+cap>TOTAL)return false;
    const textureKey=xin?xinEnergyTexture(this.scene,fire):energy?heroEnergyTexture(this.scene,style,fire):texture(this.scene,style);if(!textureKey)return false;
    const config=xin?xinEnergyRecipe(card.id,card.width,card.height,style,xin.phase,fire,accent,visible,()=>row.selected):energy?heroEnergyRecipe(style,card.width,card.height,fire,visible,()=>row.burst):heroParticleRecipe(style,card.width,fire);if(this.scene.game.renderer.type===1){delete config.color;config.blendMode='NORMAL';}
    budget.reserved+=cap;const emitter=this.scene.add.particles(0,0,textureKey,config).setName('hero/native-'+(xin?(fire?'core':'wake'):(fire?'fire':'edge'))).setData('targetCardId',card.id).setData('activationId',key).setData('paletteMode',xin?'baked-energy':energy?'baked-hero-energy':this.scene.game.renderer.type===1?'precolored':'webgl-gradient').setData('energyStyle',energy?style.key:undefined).setData('energyPhase',xin?.phase).setData('ignition',accent);card.container.add(emitter);let released=false;emitter.once('destroy',()=>{if(!released){released=true;budget!.reserved-=cap;}});emitter.once('complete',()=>emitter.destroy());
    // Phaser3.90 DeathZone supplies particle.worldPosition, already including the emitter and parent transforms.
    emitter.addDeathZone({type:'onEnter',source:{contains:(x:number,y:number)=>{const local=row.toLocal(x,y);if(Math.abs(local.x)<card.width/2+5&&Math.abs(local.y)<card.height/2+5)return true;const p=this.toRoot(x,y),v=cssViewport(this.scene);return x<0||y<0||x>v.width||y>v.height||this.protected.some(b=>p.x>b.x-10&&p.x<b.x+b.width+10&&p.y>b.y-10&&p.y<b.y+b.height+10);}}});
    if(xin){if(fire)row.fire=emitter;else row.edge=emitter;emitter.start(0);}else if(fire){if(!energy)emitter.setPosition(0,-card.height/2-18);emitter.start(0,450);row.fire=emitter;}else{if(!energy)emitter.addEmitZone({type:'edge',quantity:24,source:{getPoints:(quantity:number)=>Array.from({length:quantity},(_,i)=>attachmentEdgePoint(card.width+26,card.height+26,i/quantity))}});emitter.start(0);row.edge=emitter;}return true;
   };if(xin){create(false);create(true);this.ignited.add(ignition);}else{if(!ignite)this.ignited.add(ignition);if(!this.ignited.has(ignition)&&create(true))this.ignited.add(ignition);create(false);}if(!row.fire&&!row.edge){row.dispose();this.rows.delete(card.id);}
  }
  for(const row of this.rows.values()){const m=row.card.container.getWorldTransformMatrix();row.toLocal=(x,y)=>m.applyInverse(x,y);row.fire?.setData('selectionEmphasis',row.selected);row.edge?.setData('selectionEmphasis',row.selected);}
 }
 releaseTarget(id:string):void {this.rows.get(id)?.dispose();this.rows.delete(id);}
 impact(onComplete?:()=>void,failed=false):void {if(this.impacted)return;this.impacted=true;const pending:Phaser.GameObjects.Particles.ParticleEmitter[]=[];for(const row of this.rows.values()){row.burst=!failed;if(row.xin){for(const [emitter,cap]of [[row.fire,XIN_ENERGY_BUDGET.core],[row.edge,XIN_ENERGY_BUDGET.wake]] as const){if(!emitter?.active)continue;emitter.getWorldTransformMatrix(emitter.worldMatrix);emitter.stop(true);emitter.setParticleLifespan(240);emitter.explode(cap);pending.push(emitter);}continue;}row.fire?.destroy();const edge=row.edge;if(!edge?.active)continue;if(edge.getData('energyStyle'))edge.getWorldTransformMatrix(edge.worldMatrix);if(failed)edge.setAlpha(.3);edge.stop(true);edge.setParticleLifespan(180);edge.setParticleSpeed(55,75);edge.explode(9);pending.push(edge);}if(onComplete){let remaining=pending.length;for(const emitter of pending)emitter.once('complete',()=>{if(--remaining===0)onComplete();});if(!remaining)onComplete();}}
 clear():void {for(const row of this.rows.values())row.dispose();this.rows.clear();this.key='';this.protected=[];this.impacted=false;}
}
