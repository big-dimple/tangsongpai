import {afterEach,expect,it,vi} from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {nativeHeroRuntime,nativeMaterials} from './fixtures/native-hero-runtime';
import * as atmosphere from '../src/game/HeroCardAttachmentAtmosphere';
afterEach(()=>vi.unstubAllGlobals());
class Node extends EventEmitter {
 active=true;visible=true;alpha=1;type='Container';name='';x=0;y=0;scaleX=1;scaleY=1;width=28;height=16;text='';parentContainer?:Node;list:Node[]=[];data:Record<string,unknown>={};
 setName(n:string){this.name=n;return this;}setData(k:string,v:unknown){this.data[k]=v;return this;}getData(k:string){return this.data[k];}setText(t:string){this.text=t;return this;}setOrigin(){return this;}setScale(x:number,y=x){this.scaleX=x;this.scaleY=y;return this;}setPosition(x:number,y:number){this.x=x;this.y=y;return this;}setAlpha(a:number){this.alpha=a;return this;}
 add(n:Node){n.parentContainer=this;this.list.push(n);return this;}getWorldTransformMatrix():any {const p=this.parentContainer?.getWorldTransformMatrix(),x=this.x+(p?.tx??0),y=this.y+(p?.ty??0);return{a:1,b:0,c:0,d:1,tx:x,ty:y,transformPoint:(a:number,b:number)=>({x:a+x,y:b+y}),applyInverse:(a:number,b:number)=>({x:a-x,y:b-y})};}getBounds(){const m=this.getWorldTransformMatrix(),width=Number(this.data.width??this.width),height=Number(this.data.height??this.height);return{x:m.tx-width/2,y:m.ty-height/2,right:m.tx+width/2,bottom:m.ty+height/2};}destroy(){if(!this.active)return;this.active=false;for(const child of [...this.list])child.destroy();if(this.parentContainer)this.parentContainer.list=this.parentContainer.list.filter(c=>c!==this);this.emit('destroy');}
}
class Emitter extends Node {constructor(readonly config:any){super();}addDeathZone(){return this;}addEmitZone(){return this;}start(){return this;}}
it('actual shared renderer labels all seven saved Xin candidates and animates only their visible paper with bounded cleanup',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),cards=new Map<string,Phaser.GameObjects.Container>();for(let i=0;i<7;i++){const id='candidate/'+i;cards.set(id,f.card(id,{x:21+i*45,y:570,width:38,height:60}));}const ordinary=f.card('ordinary',{x:341,y:370,width:38,height:60});
 const updates=f.scene.events.listenerCount('update'),layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:38,height:60}:undefined;},source:()=>({x:30,y:60}),motion:()=> 'full',blocked:()=>false}),ids=[...cards.keys()];
 try{layer.preview({key:'saved/discard/candidates',targetId:ids[0],targetIds:ids,selectedIds:[ids[6]],kind:'candidate',label:'候选',releaseReason:'laohuan.refill',confirmed:true,suppressSource:true,ignite:true});const late=new Map(ids.map(id=>[id,new Set<string>()]));
  for(let time=0;time<3200;time+=16){f.step(time);for(const [id,card]of cards){const labels=card.list.filter(o=>o.name==='hero/target-tag') as Phaser.GameObjects.Text[];expect(labels,id).toHaveLength(1);expect(labels[0].text).toBe(id===ids[6]?'待留':'候选');const materials=nativeMaterials(card);expect(materials,id).toHaveLength(1);expect(materials[0].getData('targetCardId')).toBe(id);expect(materials[0].commandBuffer.length).toBeGreaterThan(50);if(time>3000)late.get(id)!.add(JSON.stringify(materials[0].commandBuffer));}expect(nativeMaterials(ordinary)).toHaveLength(0);expect(nativeMaterials(f.root)).toHaveLength(7);}
  expect([...late.values()].every(frames=>frames.size>3)).toBe(true);expect(f.emitters).toHaveLength(0);expect(f.root.list.find(n=>n.name==='hero/attachment-atmosphere')?.getData('stats')).toMatchObject({markers:0,presentation:'visible-surface'});
 }finally{layer.destroy();expect(nativeMaterials(f.root)).toHaveLength(0);expect(f.scene.events.listenerCount('update')).toBe(updates);f.root.destroy();f.step(3200);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it('a second saved choice keeps both cards owned but draws its actual source stream only to the new retained instance',()=>{
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});const root=new Node(),cards=new Map<string,Node>(),stream=vi.spyOn(atmosphere,'drawHeroOriginStream'),graphics=()=>{const g=new Proxy(new Node(),{get:(target,key):any=>key in target?Reflect.get(target,key):()=>g});g.type='Graphics';return g;};for(const [id,x]of [['prior/kept',80],['new/kept',220]] as const){const card=new Node().setPosition(x,600).setData('cardFace',true).setData('width',38).setData('height',60);cards.set(id,card);root.add(card);}const scene={events:new EventEmitter(),game:{renderer:{type:2}},scale:{width:390,height:844,zoom:1},textures:{exists:()=>true},add:{graphics,text:(_x:number,_y:number,text:string)=>Object.assign(new Node(),{type:'Text',text}),particles:(_x:number,_y:number,_key:string,config:any)=>new Emitter(config)}},layer=new HeroTargetAttachment(scene as unknown as Phaser.Scene,{root:()=>root as unknown as Phaser.GameObjects.Container,target:id=>{const container=cards.get(id);return container?{container:container as unknown as Phaser.GameObjects.Container,width:38,height:60}:undefined;},source:()=>({x:30,y:60}),motion:()=> 'full',blocked:()=>false}),owned=[...cards.keys()],draft={key:'saved/second-choice',targetId:owned[0],targetIds:owned,kind:'candidate' as const,label:'已留',releaseReason:'laohuan.refill',confirmed:true};
 try{
  layer.preview({...draft,sourceTargetIds:['new/kept']});
  const current=root.list.find(n=>n.name==='hero/target-current');expect(current).toBeDefined();
  expect(stream.mock.calls.at(-1)?.slice(0,7)).toEqual([expect.anything(),{x:30,y:60},[{x:201,y:570,width:38,height:60}],expect.anything(),0,expect.anything(),1]);
  expect(stream.mock.calls.at(-1)?.[7]).toBe(current);
  expect(root.list.find(n=>n.name==='hero/target-travel')?.data.targetIds).toEqual(['new/kept']);
  for(const card of cards.values())expect(card.list.find(n=>n.name==='hero/target-tag')?.text).toBe('已留');
  scene.events.emit('update',0,50);layer.preview({...draft,sourceTargetIds:['new/kept']});
  expect(stream.mock.calls.at(-1)?.[2]).toEqual([{x:201,y:570,width:38,height:60}]);
  expect(root.list.find(n=>n.name==='hero/target-travel')?.data.progress).toBeGreaterThan(0);
  layer.preview({...draft,sourceTargetIds:[]});scene.events.emit('update',0,50);
  expect(root.list.some(n=>n.name==='hero/target-travel')).toBe(false);
  expect(current?.active).toBe(false);expect(root.list.some(n=>n.name==='hero/target-current')).toBe(false);
  layer.preview({...draft,key:'other/hero-default'});
  expect(stream.mock.calls.at(-1)?.[2]).toEqual([{x:61,y:570,width:38,height:60},{x:201,y:570,width:38,height:60}]);
 }finally{layer.destroy();stream.mockRestore();}
 expect(scene.events.listenerCount('update')).toBe(0);
});
