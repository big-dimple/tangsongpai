import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import type {InkBox} from '../src/game/AssistInkGeometry';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {cardVisualRoot} from '../src/game/CardVisualRoot';
import {nativeHeroRuntime,nativeMaterials} from './fixtures/native-hero-runtime';
import {layout} from '../src/game/layout';

afterEach(()=>vi.unstubAllGlobals());
const overlap=(a:InkBox,b:InkBox)=>a.x<b.x+b.width-.001&&a.x+a.width>b.x+.001&&a.y<b.y+b.height-.001&&a.y+a.height>b.y+.001;
function patchBounds(g:Phaser.GameObjects.Graphics):InkBox {
 const b=g.getData('materialPatch') as InkBox,m=g.getWorldTransformMatrix(),p=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>m.transformPoint(x,y)),x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return{x,y,width:Math.max(...p.map(p=>p.x))-x,height:Math.max(...p.map(p=>p.y))-y};
}
function insideOwn(g:Phaser.GameObjects.Graphics,card:Phaser.GameObjects.Container){
 const b=g.getData('materialPatch') as InkBox,m=g.getWorldTransformMatrix(),inverse=cardVisualRoot({container:card}).getWorldTransformMatrix(),w=Number(card.getData('width')),h=Number(card.getData('height'));
 for(const [x,y]of [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]){const p=m.transformPoint(x,y),q=inverse.applyInverse(p.x,p.y);expect(q.x).toBeGreaterThan(-w/2);expect(q.x).toBeLessThan(w/2);expect(q.y).toBeGreaterThan(-h/2);expect(q.y).toBeLessThan(h/2);}
}
it('Liu valid unsaved selection flows for3.2s, has no transfer text/dots, freezes and cleans without saved phases',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),cards=new Map(['hearts-13','hearts-12'].map((id,i)=>[id,f.card(id,{x:100+i*90,y:440,width:72,height:100})])),events:string[]=[];let motion:'full'|'reduced'='full';
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:72,height:100}:undefined;},source:()=>({x:30,y:70}),motion:()=>motion,blocked:()=>false,onPhase:e=>events.push(e.phase)});
 try{
  layer.preview({key:'valid-selected-K',targetId:'hearts-13',releaseReason:'erxiang.handoff',label:'待转'});const initial=[...nativeMaterials(f.root)[0].commandBuffer],samples=new Set<string>();
  for(let time=0;time<3250;time+=16){f.step(time);for(const g of nativeMaterials(f.root)){insideOwn(g,cards.get('hearts-13')!);expect(g.commandBuffer.length).toBeGreaterThan(50);if(time>3000)samples.add(JSON.stringify(g.commandBuffer));}}
  expect(samples.size).toBeGreaterThan(3);expect(nativeMaterials(f.root)[0].commandBuffer).not.toEqual(initial);expect(events).toEqual([]);expect(f.emitters).toHaveLength(0);expect(cards.get('hearts-13')!.list.some(o=>o.name==='hero/target-tag')).toBe(false);
  const atmosphere=f.root.list.find(o=>o.name==='hero/attachment-atmosphere') as Phaser.GameObjects.Graphics;expect(atmosphere.commandBuffer).toHaveLength(0);
  motion='reduced';f.step(3300,50);const still=[...nativeMaterials(f.root)[0].commandBuffer];for(let t=3350;t<6600;t+=50)f.step(t,50);expect(nativeMaterials(f.root)[0].commandBuffer).toEqual(still);
  motion='full';layer.preview({key:'valid-selected-Q',targetId:'hearts-12',releaseReason:'erxiang.handoff',label:'待转'});f.step(6650,50);expect(nativeMaterials(f.root).map(g=>g.getData('targetCardId'))).toEqual(['hearts-12']);
  Object.assign(document,{hidden:true});f.step(6700,50);expect(nativeMaterials(f.root)).toHaveLength(0);Object.assign(document,{hidden:false});f.step(6750,50);expect(nativeMaterials(f.root)).toHaveLength(1);
  cards.get('hearts-12')!.setPosition(-400,-400);f.step(6800,50);expect(nativeMaterials(f.root)).toHaveLength(0);layer.preview(undefined);expect(events).toEqual([]);
 }finally{layer.destroy();f.root.destroy();expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it('uses the moved/scaled real body, respects front card/own print/ear bounds and skips a completely covered target',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),c=f.card('hearts-13',{x:110,y:400,width:72,height:100}),body=f.scene.add.container(3,-2).setAngle(7).setScale(.94,1.03),printed=[...c.list];c.remove(printed);body.add(printed);c.add(body);c.setData('cardBodyRoot',body);f.root.setPosition(5,9).setScale(.9);
 const front=f.card('normal',{x:145,y:400,width:72,height:100}),ear=f.scene.add.image(-19,4,'ear').setDisplaySize(9,10).setData('heroInkPrint',true);body.add(ear);
 const button={x:90,y:445,width:130,height:16},layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='hearts-13'?{container:c,width:72,height:100}:undefined,source:()=>undefined,motion:()=> 'full',blocked:()=>false,labelExclusions:()=>[button]});
 try{
  layer.preview({key:'scaled',targetId:'hearts-13',releaseReason:'erxiang.handoff'});f.step(50,50);const g=nativeMaterials(f.root)[0];expect(g).toBeTruthy();insideOwn(g,c);expect(g.parentContainer).toBe(body);expect(overlap(patchBounds(g),front.getBounds())).toBe(false);expect(overlap(patchBounds(g),ear.getBounds())).toBe(false);expect(overlap(patchBounds(g),button)).toBe(false);
  for(const o of printed.filter(o=>o.type==='Text'))expect(overlap(patchBounds(g),(o as Phaser.GameObjects.Text).getBounds())).toBe(false);
  front.setPosition(c.x,c.y).setScale(2);f.step(100,50);expect(nativeMaterials(f.root)).toHaveLength(0);expect(f.root.list.some(o=>o.name==='hero/source-echo')).toBe(false);expect(f.emitters).toHaveLength(0);
  front.setVisible(false);f.step(150,50);expect(nativeMaterials(f.root)).toHaveLength(1);body.destroy();f.step(200,50);expect(nativeMaterials(f.root)).toHaveLength(0);
 }finally{layer.destroy();f.root.destroy();}
});
it.each([1280,390])('%i: scattered K♠/2♦/3♥ each stay on their own visible paper for3.2s; the five main cards and controls are untouched',width=>{
 const f=nativeHeroRuntime({width,height:844,density:width<600?2:1,renderer:2}),ids=['clubs-1','clubs-8','spades-13','diamonds-8','hearts-8','spades-1','diamonds-2','hearts-3'],targets=['spades-13','diamonds-2','hearts-3'],main=ids.filter(id=>!targets.includes(id)),boxes=layout({width,height:844},{top:0,right:0,bottom:0,left:0},width<600?'portrait':'desktop',{count:8}).cards,cards=new Map(ids.map((id,i)=>[id,f.card(id,boxes[i].visual)])),events:string[]=[],button={x:width*.3,y:765,width:width*.4,height:32};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>({x:30,y:70}),motion:()=> 'full',blocked:()=>false,labelExclusions:()=>[button],onPhase:e=>events.push(e.phase)}),samples=new Map(targets.map(id=>[id,new Set<string>()]));
 const check=()=>{const live=nativeMaterials(f.root);expect(new Set(live.map(g=>g.getData('targetCardId')))).toEqual(new Set(targets));for(const g of live){const id=String(g.getData('targetCardId'));insideOwn(g,cards.get(id)!);expect(overlap(patchBounds(g),button)).toBe(false);const order=f.root.list.indexOf(cards.get(id)!);for(const normal of main.map(id=>cards.get(id)!))if(f.root.list.indexOf(normal)>order)expect(overlap(patchBounds(g),normal.getBounds())).toBe(false);}for(const id of main)expect(nativeMaterials(cards.get(id)!)).toHaveLength(0);};
 try{
  layer.previewSushiDiscard(targets);for(let time=0;time<3250;time+=16){f.step(time);check();if(time>3000)for(const g of nativeMaterials(f.root))samples.get(g.getData('targetCardId'))!.add(JSON.stringify(g.commandBuffer));}for(const sample of samples.values())expect(sample.size).toBeGreaterThan(3);expect(events).toEqual([]);expect(f.emitters).toHaveLength(0);
  const k=cards.get('spades-13')!;k.setY(k.y-17);f.root.bringToTop(k);f.step(3300,50);check();expect([...cards.values()].every(c=>c.active&&c.alpha===1)).toBe(true);layer.previewSushiDiscard([]);expect(nativeMaterials(f.root)).toHaveLength(0);
 }finally{layer.destroy();f.root.destroy();expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
