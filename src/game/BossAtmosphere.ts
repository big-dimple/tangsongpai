import type Phaser from 'phaser';
import {detailArt,decodeArtImage} from './DetailArt';
import {assetUrl} from './theme';
import type {R2RunState} from '../domain/run';
import type {Box} from './layout';
import {cssViewport} from '../platform/Viewport';
import {advanceEntryParticleField,paintEntryParticleBrush,ENTRY_PARTICLE_BUDGET,type EntryParticleField} from './EntryDepthParticles';
import {bossAtmosphereKey,bossGhostArea,bossParticleCount,bossParticleVisible,createBossParticleField,BOSS_ATMOSPHERE_BUDGET,BOSS_GHOST_RESOURCE,type BossAtmosphereMode} from './BossAtmosphereModel';
import {textDensity} from './TextRaster';

export const BOSS_GHOST_KEY='boss/general-95008f17';
const BOSS_GHOST_URL=assetUrl('assets/boss/general-95008f17.png');
const announced=new WeakMap<Phaser.Game,Set<string>>();
const owners=new WeakMap<Phaser.Scene,BossAtmosphere>(),art=new WeakMap<Phaser.Game,string>(),ART_CHANGED='boss-atmosphere-art-changed';
export interface BossAtmosphereOptions {reduced:()=>boolean;paused?:()=>boolean;ghostArea?:Box}
/** Inject only the real, already-loaded user PNG. There is no default URL, substitute art or failed-asset request. */
export function installBossGhostTexture(game:Phaser.Game,key:string|undefined):void {
 if(key&&key.startsWith('__'))return;if(key)art.set(game,key);else art.delete(game);game.events.emit(ART_CHANGED);
}
export function clearBossAtmosphere(scene:Phaser.Scene):void {owners.get(scene)?.destroy();}
export function syncBossAtmosphere(scene:Phaser.Scene,root:Phaser.GameObjects.Container,readRun:()=>R2RunState,mode:BossAtmosphereMode,options:BossAtmosphereOptions):void {
 if(!bossAtmosphereKey(readRun(),mode)){clearBossAtmosphere(scene);return;}
 let owner=owners.get(scene);if(!owner){owner=new BossAtmosphere(scene);owners.set(scene,owner);}owner.sync(root,readRun,mode,options);
}
function protectedAreas(root:Phaser.GameObjects.Container,width:number,height:number):Box[] {
 const boxes:Box[]=[],add=(b:Box)=>{if([b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0)boxes.push({x:b.x-4,y:b.y-4,width:b.width+8,height:b.height+8});};
 const walk=(nodes:Phaser.GameObjects.GameObject[])=>{for(const object of nodes){const o=object as Phaser.GameObjects.Container;if(!o.active||o.visible===false||o.alpha<=0)continue;if(o.type==='Text'||o.type==='Image'||o.input?.enabled)add((o as unknown as Phaser.GameObjects.Text).getBounds());if(o.list)walk(o.list);}};walk(root.list);
 const app=document.getElementById('app')?.getBoundingClientRect();if(app?.width&&app.height)for(const node of document.querySelectorAll<HTMLElement>('.shop-mobile-offers,.shop-inline-workshop,.run-menu-toggle,.run-menu-dock')){const b=node.getBoundingClientRect();if(b.width&&b.height)add({x:(b.x-app.x)*width/app.width,y:(b.y-app.y)*height/app.height,width:b.width*width/app.width,height:b.height*height/app.height});}
 return boxes;
}
/** A fixed Phaser Image pool uses the existing licensed entry projection. No emitter, shader, fullscreen veil or input target. */
class BossAtmosphere {
 private readonly layer:Phaser.GameObjects.Container;private ghost?:Phaser.GameObjects.Image;private ghostKey='';private nodes:Phaser.GameObjects.Image[]=[];private field?:EntryParticleField;
 private root?:Phaser.GameObjects.Container;private readRun?:()=>R2RunState;private mode:BossAtmosphereMode='preparation';private options:BossAtmosphereOptions={reduced:()=>false};private protected:Box[]=[];
 private readonly artOwner=new AbortController();private announcement?:Phaser.GameObjects.Text;private announcementTimer?:Phaser.Time.TimerEvent;
 private width=0;private height=0;private count=0;private elapsed=0;private listening=false;private blurred=false;private onScreen=true;private destroyed=false;private unavailable=false;
 private readonly media=window.matchMedia('(prefers-reduced-motion: reduce)');private readonly observer:MutationObserver;private readonly intersection?:IntersectionObserver;
 private readonly changed=()=>this.refresh();private readonly blur=()=>{this.blurred=true;this.refresh();};private readonly focus=()=>{this.blurred=false;this.refresh();};
 private readonly textureReady=(key:string)=>{if(key===art.get(this.scene.game))this.refresh();};
 constructor(private readonly scene:Phaser.Scene){
  this.layer=scene.add.container().setName('boss/atmosphere').setDepth(5).setData('ghostStatus','missing-art');
  if(scene.textures.exists(BOSS_GHOST_KEY))installBossGhostTexture(scene.game,BOSS_GHOST_KEY);
  else void detailArt(BOSS_GHOST_URL,false,this.artOwner.signal).then(src=>decodeArtImage(src,this.artOwner.signal)).then(image=>{if(this.destroyed||this.artOwner.signal.aborted)return;if(!scene.textures.exists(BOSS_GHOST_KEY))scene.textures.addImage(BOSS_GHOST_KEY,image);installBossGhostTexture(scene.game,BOSS_GHOST_KEY);}).catch(()=>{});
  document.addEventListener('visibilitychange',this.changed);window.addEventListener('blur',this.blur);window.addEventListener('focus',this.focus);window.addEventListener('tangsongpai-presentation',this.changed);this.media.addEventListener('change',this.changed);scene.game.events.on(ART_CHANGED,this.changed);scene.textures.on('addtexture',this.textureReady);
  this.observer=new MutationObserver(this.changed);this.observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  if(typeof IntersectionObserver!=='undefined'){this.intersection=new IntersectionObserver(([e])=>{if(e){this.onScreen=e.isIntersecting;this.refresh();}});this.intersection.observe(scene.game.canvas);}
  for(const event of ['pause','resume','sleep','wake'])scene.events.on(event,this.changed);scene.events.once('shutdown',this.destroy);scene.events.once('destroy',this.destroy);
 }
 sync(root:Phaser.GameObjects.Container,readRun:()=>R2RunState,mode:BossAtmosphereMode,options:BossAtmosphereOptions):void {
  this.root=root;this.readRun=readRun;this.mode=mode;this.options=options;const v=cssViewport(this.scene),device=navigator as Navigator&{deviceMemory?:number},count=bossParticleCount(v.width,device.hardwareConcurrency||8,device.deviceMemory||8);
  if(this.width!==v.width||this.height!==v.height||this.count!==count){this.releaseParticles();this.unavailable=false;this.width=v.width;this.height=v.height;this.count=count;}
  this.protected=protectedAreas(root,this.width,this.height);this.layer.setData('mode',mode).setData('bossKey',bossAtmosphereKey(readRun(),mode));this.refresh();
 }
 private visible():boolean {return !this.destroyed&&!this.blurred&&this.onScreen&&!document.hidden&&this.scene.scene.isActive()&&this.scene.sys?.settings.visible!==false&&this.scene.cameras?.main.visible!==false&&!!this.root?.active&&this.root.visible&&this.root.alpha>0&&!this.options.paused?.()&&!document.querySelector('dialog[open]');}
 private still():boolean {return this.options.reduced()||this.media.matches;}
 private refresh():void {
  if(this.destroyed)return;if(this.readRun&&!bossAtmosphereKey(this.readRun(),this.mode)){this.destroy();return;}
  const visible=this.visible(),still=this.still();this.layer.setVisible(visible).setData('motion',!visible?'paused':still?'reduced':'flowing');
  if(still)this.releaseParticles();else if(visible&&!this.nodes.length&&!this.unavailable)this.createParticles();
  const running=visible&&!still&&this.nodes.length>0;if(running!==this.listening){this.listening=running;this.elapsed=0;if(running)this.scene.events.on('update',this.tick);else this.scene.events.off('update',this.tick);}
  this.syncGhost();if(visible){this.announce();this.paint();}
 }
 private createParticles():void {
  this.field=createBossParticleField(this.width,this.height,this.count);
  for(const p of this.field.particles){const key='boss-edge-brush-'+p.color.toString(16);if(!this.scene.textures.exists(key)){const brush=this.scene.textures.createCanvas(key,ENTRY_PARTICLE_BUDGET.brush,ENTRY_PARTICLE_BUDGET.brush);if(!brush){this.unavailable=true;this.releaseParticles();return;}paintEntryParticleBrush(brush.getContext(),p.color,false);brush.refresh();}
   const image=this.scene.add.image(0,0,key).setName('boss/edge-particle').setBlendMode('NORMAL');this.layer.add(image);this.nodes.push(image);
  }advanceEntryParticleField(this.field,0,true);
 }
 private syncGhost():void {
  const key=art.get(this.scene.game),texture=key&&this.scene.textures.exists(key)?this.scene.textures.get(key):undefined,source=texture?.getSourceImage(),size=source as {width:number;height:number}|undefined;
  const area=texture?bossGhostArea(this.width,this.height,this.protected,this.options.ghostArea):undefined;
  const valid=!!size&&size.width>0&&size.height>0&&Math.abs(size.width/size.height-BOSS_GHOST_RESOURCE.aspect)<.02;
  if(!key||!texture||!valid||!area){this.ghost?.destroy();this.ghost=undefined;this.ghostKey='';this.layer.setData('ghostStatus',!key||!texture?'missing-art':!valid?'invalid-asset':'no-safe-area');return;}
  if(this.ghostKey!==key){this.ghost?.destroy();this.ghost=this.scene.add.image(0,0,key).setName('boss/ghost').setAlpha(BOSS_ATMOSPHERE_BUDGET.ghostOpacity);this.ghostKey=key;this.layer.add(this.ghost);}
  // Keep the original PNG bytes; only the runtime camera uses the approved head/shoulder region.
  const crop={x:Math.round(size!.width*.38),y:0,width:Math.round(size!.width*.25),height:Math.round(size!.height*.39)},scale=Math.min(area.width*.48/crop.width,area.height/crop.height);
  this.ghost!.setOrigin(0).setCrop(crop.x,crop.y,crop.width,crop.height).setScale(scale).setPosition(area.x+area.width-crop.width*scale-crop.x*scale,area.y-crop.y*scale);
  this.layer.setData('ghostStatus','ready').setData('ghostCrop',crop);
 }
 private announce():void {
  const key=this.readRun&&bossAtmosphereKey(this.readRun(),this.mode);if(!key||this.mode!=='preparation')return;
  const seen=announced.get(this.scene.game)??new Set<string>();announced.set(this.scene.game,seen);if(seen.has(key))return;
  const area=bossGhostArea(this.width,this.height,this.protected,this.options.ghostArea);if(!area)return;seen.add(key);
  const density=textDensity(this.scene);
  this.announcement=this.scene.add.text(Math.round((area.x+8)*density)/density,Math.round((area.y+area.height/2)*density)/density,'BOSS 来袭',{fontSize:'16px',fontFamily:'"Microsoft YaHei",sans-serif',color:'#8b4035',resolution:density}).setOrigin(0,.5).setName('boss/arrival');this.layer.add(this.announcement);
  this.announcementTimer=this.scene.time.delayedCall(2200,()=>{this.announcement?.destroy();this.announcement=undefined;this.announcementTimer=undefined;});
 }
 private readonly tick=(_time:number,delta:number)=>{
  if(this.destroyed)return;if(!this.readRun||!bossAtmosphereKey(this.readRun(),this.mode)){this.destroy();return;}if(!this.visible()||this.still()){this.refresh();return;}
  this.elapsed+=Math.max(0,Math.min(100,Number.isFinite(delta)?delta:0));const hz=this.width<700?BOSS_ATMOSPHERE_BUDGET.mobileHz:BOSS_ATMOSPHERE_BUDGET.desktopHz;if(this.elapsed<1000/hz)return;
  advanceEntryParticleField(this.field!,this.elapsed);this.elapsed=0;this.paint();
 };
 private paint():void {if(!this.field)return;for(const [i,p]of this.field.particles.entries()){const r=p.size*p.projectedScale;this.nodes[i].setVisible(bossParticleVisible(p,this.field,this.protected)).setPosition(p.screenX,p.screenY).setDisplaySize(r*2,r*2).setAlpha(Math.min(BOSS_ATMOSPHERE_BUDGET.opacity,p.opacity));}}
 private releaseParticles():void {for(const node of this.nodes)node.destroy();this.nodes=[];this.field=undefined;}
 readonly destroy=()=>{
  if(this.destroyed)return;this.destroyed=true;this.artOwner.abort();this.announcementTimer?.remove(false);this.announcement?.destroy();this.scene.events.off('update',this.tick);this.scene.events.off('shutdown',this.destroy);this.scene.events.off('destroy',this.destroy);for(const event of ['pause','resume','sleep','wake'])this.scene.events.off(event,this.changed);
  document.removeEventListener('visibilitychange',this.changed);window.removeEventListener('blur',this.blur);window.removeEventListener('focus',this.focus);window.removeEventListener('tangsongpai-presentation',this.changed);this.media.removeEventListener('change',this.changed);this.observer.disconnect();this.intersection?.disconnect();this.scene.game.events.off(ART_CHANGED,this.changed);this.scene.textures.off('addtexture',this.textureReady);
  this.releaseParticles();this.ghost?.destroy();this.layer.destroy(true);owners.delete(this.scene);
 };
}
