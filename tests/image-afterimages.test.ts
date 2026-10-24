import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {ImageAfterimages} from '../src/game/ImageAfterimages';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import {GameScene} from '../src/game/GameScene';

afterEach(()=>vi.unstubAllGlobals());
function fixture(capacity=3,portrait=false){
 const f=nativeHeroRuntime({width:portrait?390:1180,height:844,density:1,renderer:portrait?1:2}),parent=f.scene.add.container(17,30).setScale(.8),image=f.scene.add.image(80,120,portrait?'real-portrait':'real-joker').setDisplaySize(portrait?160:96,portrait?200:134).setOrigin(.2,.8).setAngle(-4),abort=new AbortController();f.root.add(parent);parent.add(image);
 const listeners=f.scene.events.listenerCount('shutdown'),trail=new ImageAfterimages(f.scene,parent,image,{generation:3,signal:abort.signal},{eventId:'real/saved/event',capacity,life:90,alpha:.34}),ghosts=()=>((parent.getByName('score/image-afterimages') as Phaser.GameObjects.Container|null)?.list??[]) as Phaser.GameObjects.Image[];
 return {...f,parent,image,abort,trail,ghosts,listeners};
}
it.each([false,true])('original image poses remain behind the actual outbound image and reuse a bounded pool (portrait=%s)',portrait=>{
 const cap=portrait?2:3,f=fixture(cap,portrait),old=f.image.getWorldTransformMatrix().transformPoint(0,0);f.image.setPosition(110,95).setAngle(3);const pose=[f.image.x,f.image.y,f.image.angle,f.image.scaleX,f.image.scaleY];f.trail.sample(24);expect(f.ghosts()).toHaveLength(1);const ghost=f.ghosts()[0],point=ghost.getWorldTransformMatrix().transformPoint(0,0);expect(point.x).toBeCloseTo(old.x);expect(point.y).toBeCloseTo(old.y);expect(ghost.texture.key).toBe(f.image.texture.key);expect(ghost.frame.name).toBe(f.image.frame.name);expect([ghost.originX,ghost.originY]).toEqual([.2,.8]);expect(ghost.alpha).toBeGreaterThan(.2);expect(ghost.input).toBeNull();expect([f.image.x,f.image.y,f.image.angle,f.image.scaleX,f.image.scaleY]).toEqual(pose);
 const allocated=new Set(f.ghosts());for(let i=2;i<80;i++){f.image.setPosition(110+i*3,95-i*2).setAngle(i%7);f.trail.sample(i*24);for(const g of f.ghosts())allocated.add(g);}expect(allocated.size).toBe(cap);expect(f.ghosts()).toHaveLength(cap);
 f.trail.dispose();const count=allocated.size;for(let i=0;i<10;i++){f.image.setX(200-i*10);f.trail.sample(2000+i*16);}expect(f.ghosts()).toHaveLength(0);expect([...allocated].every(g=>!g.active)).toBe(true);expect(allocated.size).toBe(count);expect(f.image.active).toBe(true);f.root.destroy();
});
it('stationary images create nothing; reduction clears old poses and cannot bridge a large hidden jump',()=>{
 const f=fixture();f.trail.sample(50);expect(f.ghosts()).toHaveLength(0);f.image.setX(100);f.trail.sample(80);expect(f.ghosts()[0].alpha).toBeGreaterThan(0);f.trail.sample(90,false);expect(f.ghosts().every(g=>g.alpha===0)).toBe(true);f.image.setX(500);f.trail.sample(120);expect(f.ghosts().every(g=>g.alpha===0)).toBe(true);f.image.setX(510);f.trail.sample(160);const live=f.ghosts().find(g=>g.alpha>0);expect(live).toBeDefined();expect(live!.x).toBeCloseTo(500);f.trail.sample(500);expect(f.ghosts().every(g=>g.alpha===0)).toBe(true);f.trail.dispose();f.root.destroy();
});
it.each(['abort','source-destroy','parent-destroy','shutdown'] as const)('%s disposes original-texture ghosts and stale sampling cannot revive them',kind=>{
 const f=fixture();f.image.setX(110);f.trail.sample(30);const ghosts=[...f.ghosts()];if(kind==='abort')f.abort.abort();else if(kind==='source-destroy')f.image.destroy();else if(kind==='parent-destroy')f.parent.destroy();else f.scene.events.emit('shutdown');f.trail.sample(200);f.trail.dispose();expect(ghosts.every(g=>!g.active)).toBe(true);if(kind!=='shutdown')expect(f.scene.events.listenerCount('shutdown')).toBe(f.listeners);f.root.destroy();
});

it.each([false,true])('GameScene existing portrait adapter samples its real image only before arrival (phone=%s)',phone=>{
 const f=nativeHeroRuntime({width:phone?390:1180,height:844,density:1,renderer:phone?1:2}),image=f.scene.add.image(120,430,'existing-hero-art').setDisplaySize(128,160),avatar=f.scene.add.image(40,40,'existing-avatar'),abort=new AbortController(),context={generation:7,signal:abort.signal};f.root.add([image,avatar]);
 const scene=Object.create(GameScene.prototype) as any,rest={x:image.x,y:image.y},gesture={step:(elapsed:number)=>image.setPosition(rest.x+(elapsed<100?elapsed*.3:30*(1-(elapsed-100)/180)),rest.y-elapsed*.02),dispose:()=>image.setPosition(rest.x,rest.y)};
 Object.assign(scene,{add:f.scene.add,events:f.scene.events,heroPortrait:image,heroPortraitMotion:{bindActionGesture:()=>gesture},roleAvatar:avatar,view:{layout:{mode:phone?'portrait':'desktop'}},presentation:{score:{},replay:false},heroStrikeCards:()=>[]});Object.defineProperty(scene,'reducedMotion',{get:()=>false});
 const beat={windup:60,flight:40,impact:180,rest:0,strike:{hold:40,recovery:140}},job=scene.bindHeroScorePose({positive:true,kind:'base',targetIds:[]},{sourceType:'character',eventId:'saved/portrait'},beat,context),ghosts=()=>f.root.list.filter(o=>o.name==='score/image-afterimages').flatMap(o=>(o as Phaser.GameObjects.Container).list) as Phaser.GameObjects.Image[];
 try{job.step(25);job.step(55);job.step(85);const live=[...ghosts()];expect(live.length).toBeGreaterThan(0);expect(live.length).toBeLessThanOrEqual(phone?2:3);expect(live.every(g=>g.texture.key===image.texture.key&&g.frame.name===image.frame.name&&g.input===null)).toBe(true);
  job.step(100);expect(ghosts()).toHaveLength(0);expect(live.every(g=>!g.active)).toBe(true);job.step(160);job.step(240);expect(ghosts()).toHaveLength(0);expect(image.active).toBe(true);
  scene.presentation.replay=true;expect(scene.portraitAfterimages(context,'replay',beat)).toBeUndefined();
 }finally{job.dispose();abort.abort();f.root.destroy();}
});
