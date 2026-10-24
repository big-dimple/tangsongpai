import {afterEach,expect,it,vi} from 'vitest';
import {drawHandoffEar,handoffEarInk} from '../src/game/HandoffEar';
import {nativeHeroRuntime,nativeMaterials} from './fixtures/native-hero-runtime';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import type Phaser from 'phaser';
afterEach(()=>vi.unstubAllGlobals());
it('ear and both sets of waves fit the exposed patch throughout their cycle, including stroke and phone scaling',()=>{
 for(const box of [{x:-31,y:15,width:18,height:24},{x:14,y:4,width:12,height:16}])for(const pixels of [{x:1,y:1},{x:1.2,y:1.6}])for(let clock=0;clock<1440;clock+=40){
  const ink=handoffEarInk(box,pixels,clock)!;expect(ink.lines).toHaveLength(2);expect(ink.waves.filter(w=>w.side<0)).toHaveLength(3);expect(ink.waves.filter(w=>w.side>0)).toHaveLength(3);
  for(const [points,stroke] of [[ink.lines.flat(),ink.stroke],[ink.waves.flatMap(w=>w.points),ink.waveStroke]] as const)for(const p of points){expect(p.x-stroke/2).toBeGreaterThanOrEqual(box.x);expect(p.x+stroke/2).toBeLessThanOrEqual(box.x+box.width);expect(p.y-stroke/2).toBeGreaterThanOrEqual(box.y);expect(p.y+stroke/2).toBeLessThanOrEqual(box.y+box.height);}
 }
 expect(handoffEarInk({x:0,y:0,width:11,height:22})).toBeUndefined();expect(handoffEarInk({x:0,y:0,width:18,height:15})).toBeUndefined();
});
it('upper and lower wave fronts approach the ear slowly instead of expanding away',()=>{
 const box={x:0,y:0,width:16,height:22},before=handoffEarInk(box,undefined,0)!,after=handoffEarInk(box,undefined,120)!;
 for(let i=0;i<6;i++){const a=before.waves[i],b=after.waves[i];expect(b.points[6].y*a.side).toBeLessThan(a.points[6].y*a.side);expect(b.points.at(-1)!.x-b.points[0].x).toBeGreaterThan(a.points.at(-1)!.x-a.points[0].x);}
 expect(handoffEarInk(box,undefined,1440)!.waves).toEqual(before.waves);
});
it('three wave crests retain a clear raster gap on the actual DPR2 phone patch',()=>{
 for(let clock=0;clock<1440;clock+=60){const ink=handoffEarInk({x:0,y:0,width:14,height:18},undefined,clock)!;
  for(const side of [-1,1]){const crests=ink.waves.filter(w=>w.side===side).map(w=>w.points[6].y).sort((a,b)=>a-b);for(let i=1;i<crests.length;i++)expect((crests[i]-crests[i-1]-ink.waveStroke)*2).toBeGreaterThanOrEqual(1);}
 }
});
it('native Graphics uses only vector strokes, keeps readable meaning and owns no input or clock',()=>{
 const f=nativeHeroRuntime(),g=f.scene.add.graphics(),box={x:-30,y:15,width:18,height:24};f.root.add(g);const updateListeners=f.scene.events.listenerCount('update');
 expect(drawHandoffEar(g,box)).toBe(true);expect(g.getData('accessibleLabel')).toBe('听政目标：这张牌的首次普通点数改加倍率');expect(g.commandBuffer.length).toBeGreaterThan(0);expect(g.input).toBeNull();expect(f.emitters).toHaveLength(0);expect(f.scene.events.listenerCount('update')).toBe(updateListeners);
 expect(drawHandoffEar(g,{...box,width:4})).toBe(false);f.root.destroy();expect(g.active).toBe(false);
});

it('card-local scaling preserves a small CSS-sized glyph inside the actual exposed patch',()=>{
 const ink=handoffEarInk({x:-40,y:20,width:48,height:56},{x:.5,y:.75})!;expect(ink.bounds.width*.5).toBe(16);expect(ink.bounds.height*.75).toBe(22);
 expect(handoffEarInk({x:0,y:0,width:20,height:32},{x:.5,y:.5})).toBeUndefined();
});

it.each([390,1280])('actual attachment at %spx owns one ear on visible paper and excludes it without self-chasing',width=>{
 const f=nativeHeroRuntime({width,height:844,density:width<700?3:1,renderer:2}),target=f.card('target',{x:100,y:440,width:72,height:100}),other=f.card('other',{x:145,y:440,width:72,height:100}),cards=new Map([['target',target],['other',other]]);
 const body=f.scene.add.container(0,0),print=[...target.list];target.remove(print);body.add(print);target.add(body).setData('cardBodyRoot',body);
 let motion:'full'|'reduced'='full';
 const layer:HeroTargetAttachment=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:72,height:100}:undefined;},source:()=>({x:30,y:70}),motion:()=>motion,blocked:()=>false,labelExclusions:()=>layer.handoffEarExclusions()});
 const find=()=>{const all:Phaser.GameObjects.GameObject[]=[];const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const o of list){all.push(o);if((o as Phaser.GameObjects.Container).list)walk((o as Phaser.GameObjects.Container).list);}};walk(f.root.list);return all.filter(o=>o.name==='hero/handoff-ear') as Phaser.GameObjects.Graphics[];};
 const overlaps=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 const materialBox=(g:Phaser.GameObjects.Graphics)=>{const b=g.getData('materialPatch'),m=g.getWorldTransformMatrix(),p=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>m.transformPoint(x,y)),x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return{x,y,width:Math.max(...p.map(p=>p.x))-x,height:Math.max(...p.map(p=>p.y))-y};};
 try{
  layer.preview({key:'select-real-target',targetId:'target',label:'待转'});expect(find()).toHaveLength(1);const ear=find()[0],first={...layer.handoffEarExclusions()[0]};expect(ear.getData('targetId')).toBe('target');expect(ear.input).toBeNull();expect(target.list.some(o=>o.name==='hero/target-tag')).toBe(false);
  expect(overlaps(first,{x:145,y:440,width:72,height:100})).toBe(false);const phases=new Set<number>();for(let i=0;i<12;i++){f.step(i*40,40);phases.add(ear.getData('wavePhase'));}expect(phases.size).toBeGreaterThan(5);expect(layer.handoffEarExclusions()).toEqual([first]);
  const materials=nativeMaterials(f.root).filter(g=>g.getData('targetCardId')==='target');expect(materials.length).toBeGreaterThan(0);for(const g of materials){expect(g.alpha).toBeGreaterThan(0);expect(g.alpha).toBeLessThanOrEqual(.2);expect(overlaps(materialBox(g),layer.handoffEarExclusions()[0])).toBe(false);}
  target.setPosition(220,320).setScale(.8).setAngle(4);f.step(600,40);const moved=layer.handoffEarExclusions()[0];expect(moved.y).toBeLessThan(first.y-100);expect(moved.width).toBeLessThan(17);expect(moved.height).toBeLessThan(20);
  motion='reduced';for(let i=0;i<12;i++){f.step(600+i*40,40);expect(ear.getData('wavePhase')).toBe(0);}motion='full';
  body.destroy();f.step(650,40);expect(ear.active).toBe(false);expect(find()).toHaveLength(0);expect(layer.handoffEarExclusions()).toEqual([]);
  layer.preview({key:'reselect',targetId:'other'});expect(ear.active).toBe(false);expect(find()).toHaveLength(1);expect(find()[0].getData('targetId')).toBe('other');
  layer.preview({key:'wencheng',targetId:'other',targetIds:['other'],kind:'group',releaseReason:'azao.multiply-multiplier'});expect(find()).toHaveLength(0);expect(layer.handoffEarExclusions()).toEqual([]);layer.clear();expect(find()).toHaveLength(0);
 }finally{layer.destroy();f.root.destroy();}
});
