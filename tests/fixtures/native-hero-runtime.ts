import {vi} from 'vitest';
import {createRequire} from 'node:module';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import type {Box} from '../../src/game/layout';

const require=createRequire(import.meta.url);
export const nativeLiving=(emitter:Phaser.GameObjects.Particles.ParticleEmitter)=>{const particles:Phaser.GameObjects.Particles.Particle[]=[];emitter.forEachAlive(p=>particles.push(p),null);return particles;};
export const nativeNontransparent=(p:Phaser.GameObjects.Particles.Particle)=>p.alpha>.05&&p.scaleX>0&&p.scaleY>0&&p.frame.width>0&&p.frame.height>0&&Number.isFinite(p.x+p.y+p.rotation+p.worldPosition.x+p.worldPosition.y);
/** Actual Graphics output, separate from the native particle pool checks. */
export function nativeMaterials(root:Phaser.GameObjects.Container):Phaser.GameObjects.Graphics[]{
 const result:Phaser.GameObjects.Graphics[]=[];const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const object of list){const o=object as Phaser.GameObjects.Container;if(!o.active||!o.visible||o.alpha<=.01)continue;if(o.name==='hero/prepared-material')result.push(o as unknown as Phaser.GameObjects.Graphics);if(o.list)walk(o.list);}};walk(root.list);return result;
}
/** Actual pinned game objects, lists, emitter config, pool and death zones; no browser or GPU is started. */
export function nativeHeroRuntime(spec={width:1280,height:720,density:1,renderer:2}){
 vi.stubGlobal('window',{devicePixelRatio:spec.density,addEventListener:()=>undefined,removeEventListener:()=>undefined});vi.stubGlobal('document',{documentElement:{},hidden:false,addEventListener:()=>undefined,removeEventListener:()=>undefined});vi.stubGlobal('importScripts',()=>undefined);
 const ParticleEmitter=require('phaser/src/gameobjects/particles/ParticleEmitter.js'),Container=require('phaser/src/gameobjects/container/Container.js'),Frame=require('phaser/src/textures/Frame.js'),Graphics=require('phaser/src/gameobjects/graphics/Graphics.js'),Zone=require('phaser/src/gameobjects/zone/Zone.js'),Image=require('phaser/src/gameobjects/image/Image.js'),UpdateList=require('phaser/src/gameobjects/UpdateList.js'),DisplayList=require('phaser/src/gameobjects/DisplayList.js');
 const emitters:Phaser.GameObjects.Particles.ParticleEmitter[]=[],events=new EventEmitter(),cache=new Map<string,unknown>();
 const textures={exists:()=>true,get:(key:string)=>{if(!cache.has(key)){const width=key.startsWith('hero-xin-')||key.includes('wake64')?64:32,texture:any={key,source:[{width,height:32,resolution:1,image:{},glTexture:{}}]},frame=new Frame(texture,'__BASE',0,0,0,width,32);texture.get=()=>frame;cache.set(key,texture);}return cache.get(key);}};
 const scene:any={events,game:{renderer:{type:spec.renderer}},scale:{width:spec.width*spec.density,height:spec.height*spec.density,zoom:1/spec.density},textures,sys:{events,queueDepthSort:()=>undefined,renderer:null,textures,input:{clear:()=>undefined}}};scene.sys.game=scene.game;scene.sys.displayList=new DisplayList(scene);scene.sys.updateList=new UpdateList(scene);scene.sys.updateList.start();
 const text=(x:number,y:number,value:string)=>{const zone=new Zone(scene,x,y,Math.max(16,value.length*8),18);zone.type='Text';zone.text=value;zone.setOrigin(0,0);zone.setText=(s:string)=>{zone.text=s;return zone;};return zone;};
 scene.add={container:(x=0,y=0)=>scene.sys.displayList.add(new Container(scene,x,y)),image:(x:number,y:number,key:string)=>scene.sys.displayList.add(new Image(scene,x,y,key)),graphics:()=>new Graphics(scene),text,particles:(x:number,y:number,key:string,config:any)=>{const emitter=new ParticleEmitter(scene,x,y,key,config);emitters.push(emitter);return scene.sys.displayList.add(emitter);}};
 const root=new Container(scene,0,0) as Phaser.GameObjects.Container,card=(id:string,b:Box)=>{const c=new Container(scene,b.x+b.width/2,b.y+b.height/2).setData('cardFace',true).setData('cardId',id).setData('width',b.width).setData('height',b.height),face=new Image(scene,0,0,'paper').setDisplaySize(b.width-2,b.height-2),rank=text(-b.width/2+5,-b.height/2+5,'5\n♥').setSize(18,35),corner=text(b.width/2-5,b.height/2-5,'5\n♥').setSize(18,35).setAngle(180);c.add([face,rank,corner]);root.add(c);return c as Phaser.GameObjects.Container;};
 return{scene,root,emitters,card,Container,Zone,text,step:(time:number,delta=16)=>{events.emit('preupdate',time,delta);events.emit('update',time,delta);}};
}
