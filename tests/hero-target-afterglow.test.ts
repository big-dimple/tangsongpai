import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroTargetAfterglow,HERO_TARGET_AFTERGLOW_MS} from '../src/game/HeroTargetAfterglow';
import type {HeroInkBox} from '../src/game/HeroVisibleSurface';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());
const effects=(card:Phaser.GameObjects.Container)=>card.list.filter(o=>o.name==='hero/target-afterglow') as Phaser.GameObjects.Graphics[];
const bounds=(card:Phaser.GameObjects.Container):HeroInkBox=>{const b=card.getBounds();return{x:b.x,y:b.y,width:b.width,height:b.height,inkKind:'face',ownerId:String(card.getData('cardId'))};};

it('follows exact transformed targets, fades within its bounded lifetime and replaces the previous event',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),b=f.card('b',{x:240,y:100,width:70,height:100}),body=f.scene.add.container(2,4).setAngle(7).setScale(.9),other=[...a.list];a.remove(other);body.add(other);a.add(body);a.setData('cardBodyRoot',body);
 const glow=new HeroTargetAfterglow(f.scene,()=> 'full'),signal=new AbortController(),cards=[a,b].map(container=>({id:String(container.getData('cardId')),container,width:70,height:100}));
 try{
  glow.play({cards,root:f.root,masks:()=>[bounds(a),bounds(b)],signal:signal.signal});const ink=effects(body)[0];expect(ink).toBeTruthy();expect(effects(b)).toHaveLength(1);expect(ink.input).toBeFalsy();expect(ink.commandBuffer.length).toBeGreaterThan(0);
  const moveIndex=ink.commandBuffer.indexOf(5),initialMove=ink.commandBuffer.slice(moveIndex,moveIndex+3);const before=ink.getWorldTransformMatrix().transformPoint(0,0);a.setPosition(300,220);body.setAngle(25).setScale(1.2);f.step(100,100);const after=ink.getWorldTransformMatrix().transformPoint(0,0);expect(after).not.toEqual(before);expect(ink.commandBuffer.length).toBeGreaterThan(0);const nextMove=ink.commandBuffer.indexOf(5);expect(ink.commandBuffer.slice(nextMove,nextMove+3)).not.toEqual(initialMove);
  glow.play({cards:[cards[1]],root:f.root,masks:()=>[],signal:signal.signal});expect(effects(body)).toHaveLength(0);expect(effects(b)).toHaveLength(1);
  f.step(HERO_TARGET_AFTERGLOW_MS-1,HERO_TARGET_AFTERGLOW_MS-1);expect(effects(b)).toHaveLength(1);f.step(HERO_TARGET_AFTERGLOW_MS,1);expect(effects(b)).toHaveLength(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('dynamically clips against other card faces and print, allowing no ink when entirely covered',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),front=f.card('front',{x:300,y:100,width:70,height:100});const signal=new AbortController();let masks:HeroInkBox[]=[bounds(a),bounds(front)];
 const glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks:()=>masks,signal:signal.signal});const ink=effects(a)[0],full=ink.commandBuffer.length;expect(full).toBeGreaterThan(0);
  // A wide foreground card covers every candidate segment, including stroke widths.
  front.setPosition(a.x,a.y).setScale(2);masks=[bounds(a),bounds(front)];f.step(100,100);expect(ink.commandBuffer).toHaveLength(0);
  front.setPosition(300,150).setScale(1);masks=[bounds(a),bounds(front),{x:90,y:90,width:90,height:20,inkKind:'print'}];f.step(200,100);expect(ink.commandBuffer.length).toBeGreaterThan(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('keeps the whole stroke inside the viewport even when a card is rotated near an edge',()=>{
 const f=nativeHeroRuntime({width:200,height:200,density:1,renderer:2}),container=f.card('edge',{x:0,y:40,width:70,height:100}).setAngle(8),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'edge',container,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});const ink=effects(container)[0],commands=ink.commandBuffer,m=ink.getWorldTransformMatrix(),points:{x:number;y:number}[]=[];let stroke=0;
  for(let i=0;i<commands.length;){const op=commands[i++];if(op===6){stroke=commands[i];i+=3;}else if(op===7){stroke=0;i+=2;}else if(op===5||op===4){const p=m.transformPoint(commands[i++],commands[i++]),marginX=4+stroke*Math.hypot(m.a,m.c)/2,marginY=4+stroke*Math.hypot(m.b,m.d)/2;points.push(p);expect(p.x).toBeGreaterThanOrEqual(marginX);expect(p.x).toBeLessThanOrEqual(200-marginX);expect(p.y).toBeGreaterThanOrEqual(marginY);expect(p.y).toBeLessThanOrEqual(200-marginY);}else if(op!==1&&op!==8&&op!==9)throw new Error(`unexpected command ${op}`);}
  expect(points.length).toBeGreaterThan(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('keeps sparks on a rotating card with paper material while still protecting real art',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:150,y:130,width:70,height:100}).setAngle(2),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 const m=a.getWorldTransformMatrix(),corners=[[-34,-49],[34,-49],[-34,49],[34,49]].map(([x,y])=>m.transformPoint(x,y)),x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));
 const paper:HeroInkBox={x,y,width:Math.max(...corners.map(p=>p.x))-x,height:Math.max(...corners.map(p=>p.y))-y,ownerId:'a',inkKind:'paper'};
 let masks:HeroInkBox[]=[bounds(a),paper];
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks:()=>masks,signal:controller.signal});const ink=effects(a)[0];expect(ink.getData('electricSegments')).toBeGreaterThan(0);
  masks=[bounds(a),paper,{x:60,y:20,width:180,height:220,ownerId:'a',inkKind:'art'}];f.step(40,40);expect(ink.getData('electricSegments')).toBe(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('reserves viewport space for the transformed stroke under nonuniform scaling',()=>{
 const f=nativeHeroRuntime({width:200,height:200,density:1,renderer:2}),a=f.card('hearts-3',{x:176,y:100,width:70,height:100}).setScale(4,.5),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');let count=0;
 try{
  glow.play({cards:[{id:'hearts-3',container:a,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});const ink=effects(a)[0];
  for(let time=0;time<1100;time+=100){if(time)f.step(time,100);const c=ink.commandBuffer,m=ink.getWorldTransformMatrix();let stroke=0;for(let i=0;i<c.length;){const op=c[i++];if(op===6){stroke=c[i];i+=3;}else if(op===7){stroke=0;i+=2;}else if(op===5||op===4){const p=m.transformPoint(c[i++],c[i++]),marginX=4+stroke*Math.hypot(m.a,m.c)/2,marginY=4+stroke*Math.hypot(m.b,m.d)/2;count++;expect(p.x).toBeGreaterThanOrEqual(marginX);expect(p.x).toBeLessThanOrEqual(200-marginX);expect(p.y).toBeGreaterThanOrEqual(marginY);expect(p.y).toBeLessThanOrEqual(200-marginY);}else if(op!==1&&op!==8&&op!==9)throw new Error(`unexpected command ${op}`);}}
  expect(count).toBeGreaterThan(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('bounds the actual filled band widths after rotation and nonuniform scaling',()=>{
 const f=nativeHeroRuntime(),a=f.card('transformed',{x:350,y:220,width:70,height:100}).setScale(4,.5).setAngle(30),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'transformed',container:a,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});const ink=effects(a)[0],c=ink.commandBuffer,m=ink.getWorldTransformMatrix(),bands:{color:number;points:{x:number;y:number}[]}[]=[];let color=0,points:{x:number;y:number}[]=[];
  for(let i=0;i<c.length;){const op=c[i++];if(op===7){color=c[i];i+=2;}else if(op===1)points=[];else if(op===5||op===4)points.push(m.transformPoint(c[i++],c[i++]));else if(op===8)bands.push({color,points});else if(op===6)i+=3;else if(op!==9)throw new Error(`unexpected command ${op}`);}
  const limits=new Map([[0x76c8f2,6.2],[0x1768c3,6.2],[0xf3fdff,3.4]]);expect(new Set(bands.map(b=>b.color))).toEqual(new Set(limits.keys()));
  for(const {color,points:p} of bands){expect(p.length).toBeGreaterThanOrEqual(4);const widthA=Math.hypot(p[0].x-p[3].x,p[0].y-p[3].y),widthB=Math.hypot(p[1].x-p[2].x,p[1].y-p[2].y);expect(Math.max(widthA,widthB)).toBeLessThanOrEqual(limits.get(color)!+1e-6);}
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
 try{glow.play({cards,root:f.root,masks:()=>[],signal:controller.signal});expect(cards.flatMap(c=>effects(c.container))).toHaveLength(5);glow.play({cards:cards.slice(5),root:f.root,masks:()=>[],signal:controller.signal,retainOthers:true});expect(cards.flatMap(c=>effects(c.container))).toHaveLength(5);controller.abort();expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);glow.play({cards,root:f.root,masks:()=>[],signal:controller.signal});expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);}finally{glow.destroy();f.root.destroy();}
});

it('shares one mask traversal across targets and redraws at most 30Hz without delaying cleanup',()=>{
 const f=nativeHeroRuntime(),cards=Array.from({length:5},(_,i)=>{const container=f.card(String(i),{x:30+i*120,y:100,width:70,height:100});return{id:String(i),container,width:70,height:100};}),masks=vi.fn(()=>[]),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards,root:f.root,masks,signal:controller.signal});expect(masks).toHaveBeenCalledTimes(1);
  f.step(10,10);f.step(20,10);f.step(30,10);expect(masks).toHaveBeenCalledTimes(1);f.step(40,10);expect(masks).toHaveBeenCalledTimes(2);
  f.step(HERO_TARGET_AFTERGLOW_MS,HERO_TARGET_AFTERGLOW_MS-40);expect(masks).toHaveBeenCalledTimes(2);expect(cards.flatMap(c=>effects(c.container))).toHaveLength(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('gives only the real beneficiary a brief clipped edge response before fading',()=>{
 const f=nativeHeroRuntime(),a=f.card('beneficiary',{x:100,y:100,width:70,height:100}),b=f.card('other',{x:250,y:100,width:70,height:100}),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'beneficiary',container:a,width:70,height:100}],root:f.root,masks:()=>[bounds(a),bounds(b)],signal:controller.signal});
  const ink=effects(a)[0];expect(ink.getData('impactOutlineSegments')).toBeGreaterThan(0);expect(effects(b)).toHaveLength(0);
  f.step(560,560);expect(ink.getData('impactOutlineSegments')).toBe(0);expect(effects(a)).toHaveLength(1);
  controller.abort();expect(effects(a)).toHaveLength(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('keeps the protection masks of separately retained impact requests',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),b=f.card('b',{x:300,y:100,width:70,height:100}),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});
  glow.play({cards:[{id:'b',container:b,width:70,height:100}],root:f.root,masks:()=>[{x:220,y:20,width:220,height:240,inkKind:'print'}],signal:controller.signal,retainOthers:true});
  const first=effects(a)[0],second=effects(b)[0];expect(first.getData('electricSegments')).toBeGreaterThan(0);expect(second.getData('electricSegments')).toBe(0);
  f.step(40,40);expect(first.getData('electricSegments')).toBeGreaterThan(0);expect(second.getData('electricSegments')).toBe(0);
 }finally{glow.destroy();f.root.destroy();}
});

it('shares a dynamic mask traversal between impacts using the same supplier',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),b=f.card('b',{x:300,y:100,width:70,height:100}),masks=vi.fn(()=>[]),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks,signal:controller.signal});
  glow.play({cards:[{id:'b',container:b,width:70,height:100}],root:f.root,masks,signal:controller.signal,retainOthers:true});
  expect(masks).toHaveBeenCalledTimes(2);f.step(40,40);expect(masks).toHaveBeenCalledTimes(3);
 }finally{glow.destroy();f.root.destroy();}
});

it('reduces the target discharge after impact without changing card identity',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:150,y:130,width:70,height:100}),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 const blueAlpha=(ink:Phaser.GameObjects.Graphics)=>{const c=ink.commandBuffer,alphas:number[]=[];for(let i=0;i<c.length;){const op=c[i++];if(op===6)i+=3;else if(op===7){if(c[i]===0x1768c3)alphas.push(c[i+1]);i+=2;}else if(op===5||op===4)i+=2;else if(op!==1&&op!==8&&op!==9)throw new Error(`unexpected command ${op}`);}return Math.max(...alphas);};
 try{
  glow.play({cards:[{id:'a',container:a,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});const ink=effects(a)[0],initial=blueAlpha(ink);
  f.step(1200,1200);expect(effects(a)[0]).toBe(ink);expect(ink.getData('targetCardId')).toBe('a');expect(blueAlpha(ink)).toBeGreaterThan(0);expect(blueAlpha(ink)).toBeLessThan(initial);
 }finally{glow.destroy();f.root.destroy();}
});

it('keeps each real target impact at a fixed contact point while it fades',()=>{
 const f=nativeHeroRuntime(),a=f.card('hearts-3',{x:100,y:100,width:70,height:100}),b=f.card('spades-5',{x:300,y:100,width:70,height:100}),controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');
 try{
  glow.play({cards:[{id:'hearts-3',container:a,width:70,height:100},{id:'spades-5',container:b,width:70,height:100}],root:f.root,masks:()=>[],signal:controller.signal});
  const heads=()=>[effects(a)[0].getData('electricHeads'),effects(b)[0].getData('electricHeads')];
  const first=heads();expect(first[0].length).toBeGreaterThan(0);expect(first[1].length).toBeGreaterThan(0);
  f.step(40,40);const next=heads();expect(next).toEqual(first);
  f.step(120,80);expect(heads()).toEqual(first);
 }finally{glow.destroy();f.root.destroy();}
});

it('draws small tapered strips outside the card and clips them against a neighboring card',()=>{
 const f=nativeHeroRuntime(),a=f.card('a',{x:100,y:100,width:70,height:100}),card={id:'a',container:a,width:70,height:100},controller=new AbortController(),glow=new HeroTargetAfterglow(f.scene,()=> 'full');let masks:HeroInkBox[]=[];
 // Decode actual blue filled strips, not just their protected center lines.
 const electricPaths=(ink:Phaser.GameObjects.Graphics)=>{const commands=ink.commandBuffer,paths:{x:number;y:number}[][]=[];let color=0,run:{x:number;y:number}[]=[];
  for(let i=0;i<commands.length;){const op=commands[i++];if(op===6){color=commands[i+1];i+=3;}else if(op===7){color=commands[i];i+=2;}else if(op===5||op===4){const p={x:commands[i++],y:commands[i++]};if(color===0x1768c3){if(op===5){run=[p];paths.push(run);}else run.push(p);}}else if(op!==1&&op!==8&&op!==9)throw new Error(`unexpected command ${op}`);}return paths;};
 try{
  glow.play({cards:[card],root:f.root,masks:()=>masks,signal:controller.signal});const ink=effects(a)[0],paths=electricPaths(ink);expect(paths.length).toBeGreaterThanOrEqual(4);expect(paths.every(path=>path.length>=4&&path.length<=5)).toBe(true);expect(paths.flat().every(p=>(p.x<=-35||p.x>=35||p.y<=-50||p.y>=50)&&(Math.abs(p.x)<=35.01||Math.abs(p.y)<=50.01))).toBe(true);expect(ink.getData('electricSegments')).toBeGreaterThan(0);expect(ink.getData('electricHeads').length).toBeGreaterThan(1);
  expect(paths.flat().some(p=>Math.abs(Math.abs(p.x)-35)<.6&&Math.abs(p.y)<50||Math.abs(Math.abs(p.y)-50)<.6&&Math.abs(p.x)<35)).toBe(true);
  // This world-space face covers the whole right side of the target's sparks.
  masks=[{x:a.x+30,y:a.y-70,width:30,height:140,ownerId:'neighbor',inkKind:'face'}];f.step(40,40);const clipped=electricPaths(ink);expect(clipped.length).toBeGreaterThan(0);expect(clipped.every(path=>path.every(p=>p.x<29.5||p.x>60.5))).toBe(true);
 }finally{glow.destroy();f.root.destroy();}
});
