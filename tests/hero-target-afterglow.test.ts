import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroTargetAfterglow,HERO_TARGET_AFTERGLOW_MS} from '../src/game/HeroTargetAfterglow';
import type {HeroInkBox} from '../src/game/HeroVisibleSurface';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());
const effects=(card:Phaser.GameObjects.Container)=>card.list.filter(o=>o.name==='hero/target-afterglow') as Phaser.GameObjects.Graphics[];
const bounds=(card:Phaser.GameObjects.Container):HeroInkBox=>{const b=card.getBounds();return{x:b.x,y:b.y,width:b.width,height:b.height,inkKind:'face',ownerId:String(card.getData('cardId'))};};

it('follows exact transformed targets, fades within one second and replaces the entire previous event',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),b=f.card('b',{x:240,y:100,width:70,height:100}),body=f.scene.add.container(2,4).setAngle(7).setScale(.9),other=[...a.list];a.remove(other);body.add(other);a.add(body);a.setData('cardBodyRoot',body);
 const glow=new HeroTargetAfterglow(f.scene,()=> 'full'),signal=new AbortController(),cards=[a,b].map(container=>({id:String(container.getData('cardId')),container,width:70,height:100}));
 try{
  glow.play({cards,root:f.root,masks:()=>[bounds(a),bounds(b)],signal:signal.signal});const ink=effects(body)[0];expect(ink).toBeTruthy();expect(effects(b)).toHaveLength(1);expect(ink.input).toBeFalsy();expect(ink.commandBuffer.length).toBeGreaterThan(0);
  const moveIndex=ink.commandBuffer.indexOf(5),initialMove=ink.commandBuffer.slice(moveIndex,moveIndex+3);const before=ink.getWorldTransformMatrix().transformPoint(0,0);a.setPosition(300,220);body.setAngle(25).setScale(1.2);f.step(100,100);const after=ink.getWorldTransformMatrix().transformPoint(0,0);expect(after).not.toEqual(before);expect(ink.commandBuffer.length).toBeGreaterThan(0);const nextMove=ink.commandBuffer.indexOf(5);expect(ink.commandBuffer.slice(nextMove,nextMove+3)).not.toEqual(initialMove);
  glow.play({cards:[cards[1]],root:f.root,masks:()=>[],signal:signal.signal});expect(effects(body)).toHaveLength(0);expect(effects(b)).toHaveLength(1);
  f.step(999,HERO_TARGET_AFTERGLOW_MS-1);expect(effects(b)).toHaveLength(1);f.step(1000,1);expect(effects(b)).toHaveLength(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('dynamically clips against other card faces and print, allowing no ink when entirely covered',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),front=f.card('front',{x:300,y:100,width:70,height:100});const signal=new AbortController();let masks:HeroInkBox[]=[bounds(a),bounds(front)];
 const glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks:()=>masks,signal:signal.signal});const ink=effects(a)[0],full=ink.commandBuffer.length;expect(full).toBeGreaterThan(0);
  // A wide foreground card covers every candidate segment, including stroke widths.
  front.setPosition(a.x,a.y).setScale(2);masks=[bounds(a),bounds(front)];f.step(100,100);expect(ink.commandBuffer).toHaveLength(0);
  front.setPosition(300,150).setScale(1);masks=[bounds(a),bounds(front),{x:90,y:90,width:90,height:20,inkKind:'print'}];f.step(200,100);expect(ink.commandBuffer.length).toBeGreaterThan(0);expect(ink.commandBuffer.length).toBeLessThan(full);
 }finally{glow.destroy();f.root.destroy();}
});

it('cleans on abort, destroyed or hidden targets, identity replacement, motion changes and scene shutdown',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),b=f.card('b',{x:250,y:100,width:70,height:100});let motion:'full'|'reduced'='full',current=true;const glow=new HeroTargetAfterglow(f.scene,()=>motion),card=(container:Phaser.GameObjects.Container)=>({id:String(container.getData('cardId')),container,width:70,height:100}),controller=new AbortController();
 const play=()=>glow.play({cards:[card(a),card(b)],root:f.root,masks:()=>[],signal:controller.signal,isCurrent:()=>current});
 try{
  play();a.setVisible(false);f.step(10);expect(effects(a)).toHaveLength(0);expect(effects(b)).toHaveLength(1);a.setVisible(true);play();current=false;f.step(20);expect(effects(a)).toHaveLength(0);expect(effects(b)).toHaveLength(0);current=true;
  play();motion='reduced';f.step(30);expect(effects(a)).toHaveLength(0);expect(effects(b)).toHaveLength(0);play();expect(effects(a)).toHaveLength(0);motion='full';play();a.destroy();expect(effects(b)).toHaveLength(1);controller.abort();expect(effects(b)).toHaveLength(0);
  glow.play({cards:[card(b)],root:f.root,masks:()=>[],signal:new AbortController().signal});expect(effects(b)).toHaveLength(1);f.scene.events.emit('shutdown');expect(effects(b)).toHaveLength(0);expect(f.scene.events.listenerCount('update')).toBe(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('caps simultaneous targets at five and does not create effects for an aborted request',()=>{
 const f=nativeHeroRuntime(),cards=Array.from({length:7},(_,i)=>{const container=f.card(String(i),{x:40+i*100,y:100,width:60,height:80});return{id:String(i),container,width:60,height:80};}),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{glow.play({cards,root:f.root,masks:()=>[],signal:controller.signal});expect(cards.flatMap(c=>effects(c.container))).toHaveLength(5);controller.abort();expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);glow.play({cards,root:f.root,masks:()=>[],signal:controller.signal});expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);}finally{glow.destroy();f.root.destroy();}
});

it('shares one mask traversal across targets and redraws at most 30Hz without delaying cleanup',()=>{
 const f=nativeHeroRuntime(),cards=Array.from({length:5},(_,i)=>{const container=f.card(String(i),{x:30+i*120,y:100,width:70,height:100});return{id:String(i),container,width:70,height:100};}),masks=vi.fn(()=>[]),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards,root:f.root,masks,signal:controller.signal});expect(masks).toHaveBeenCalledTimes(1);
  f.step(10,10);f.step(20,10);f.step(30,10);expect(masks).toHaveBeenCalledTimes(1);f.step(40,10);expect(masks).toHaveBeenCalledTimes(2);
  f.step(1000,960);expect(masks).toHaveBeenCalledTimes(2);expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('draws one closed, outside cyan outline when unobstructed and clips that outline against a neighboring card',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),card={id:'a',container:a,width:70,height:100},controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');let masks:HeroInkBox[]=[];
 // Decode the actual Graphics commands for the cyan stroke, preserving move boundaries.
 const cyanPaths=(ink:Phaser.GameObjects.Graphics)=>{const commands=ink.commandBuffer,paths:{x:number;y:number}[][]=[];let color=0,run:{x:number;y:number}[]=[];
  for(let i=0;i<commands.length;){const op=commands[i++];if(op===6){color=commands[i+1];i+=3;}else if(op===5||op===4){const p={x:commands[i++],y:commands[i++]};if(color===0x4ab6df){if(op===5){run=[p];paths.push(run);}else run.push(p);}}else if(op!==1&&op!==9)throw new Error(`unexpected command ${op}`);}return paths;};
 try{
  glow.play({cards:[card],root:f.root,masks:()=>masks,signal:controller.signal});const ink=effects(a)[0],paths=cyanPaths(ink);expect(paths).toHaveLength(1);const outline=paths[0];expect(outline.length).toBeGreaterThan(20);expect(outline[0]).toEqual(outline.at(-1));expect(Math.min(...outline.map(p=>p.x))).toBeLessThan(-35);expect(Math.max(...outline.map(p=>p.x))).toBeGreaterThan(35);expect(Math.min(...outline.map(p=>p.y))).toBeLessThan(-50);expect(Math.max(...outline.map(p=>p.y))).toBeGreaterThan(50);expect(ink.getData('electricSegments')).toBeGreaterThan(0);expect(ink.getData('electricHeads')).toHaveLength(1);
  // This world-space face covers the whole right side of the target's outline.
  masks=[{x:a.x+30,y:a.y-70,width:30,height:140,ownerId:'neighbor',inkKind:'face'}];f.step(40,40);const clipped=cyanPaths(ink);expect(clipped.length).toBeGreaterThan(0);expect(clipped.every(path=>path.every(p=>p.x<28.9||p.x>61.1))).toBe(true);
 }finally{glow.destroy();f.root.destroy();}
});
