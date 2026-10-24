import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import type Phaser from 'phaser';
import {xinEnergyRecipe,xinEnergyFootprint,xinEnergyOverlaps} from '../src/game/XinPerimeterEnergy';
import {heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {HeroSkillParticles} from '../src/game/HeroSkillParticles';

const require=createRequire(import.meta.url),NativeParticle=require('phaser/src/gameobjects/particles/Particle.js'),EmitterOp=require('phaser/src/gameobjects/particles/EmitterOp.js'),TransformMatrix=require('phaser/src/gameobjects/components/TransformMatrix.js');
const style=heroAtmosphereStyle({key:'saved',targetId:'actual',releaseReason:'laohuan.refill'}),identity=(x:number,y:number)=>({x,y});
/** Actual pinned Particle.fire/update and EmitterOps; only emitter/texture/scene shell is synthetic. */
function native(config:Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,worldMatrix=new TransformMatrix()){
 const defaults={accelerationX:0,accelerationY:0,alpha:1,angle:0,bounce:0,delay:0,hold:0,lifespan:1000,maxVelocityX:10000,maxVelocityY:10000,moveToX:0,moveToY:0,quantity:1,rotate:0,scaleX:1,scaleY:1,speedX:0,speedY:0,tint:0xffffff,x:0,y:0},ops:any={color:{active:false}};
 for(const [key,value]of Object.entries(defaults)){ops[key]=new EmitterOp(key,value);ops[key].loadConfig(config);}ops.speedY.active=false;
 const emitter={ops,anims:[],scene:{},worldMatrix,radial:false,moveTo:false,acceleration:false,gravityX:0,gravityY:0,getAnim:()=>null,getFrame:()=>({width:64,height:32,texture:{}}),getEmitZone:()=>undefined,getDeathZone:()=>false},particle=new NativeParticle(emitter) as Phaser.GameObjects.Particles.Particle;
 expect(particle.fire()).toBe(true);return{particle,tick:(delta:number)=>particle.update(delta,delta/1000,[])};
}
const recipe=(phase:'candidate'|'retained',core=false,ignite=false,visible:((p:Phaser.GameObjects.Particles.Particle)=>boolean)=()=>true)=>xinEnergyRecipe('actual/kept',64,89.6,style,phase,core,ignite,visible);
it('moves and turns a directional bitmap along the card exterior through actual Phaser Particle.update with delta time',()=>{
 const a=native(recipe('retained')),b=native(recipe('retained')),start={x:a.particle.x,y:a.particle.y};
 for(let i=0;i<40;i++)a.tick(10);for(let i=0;i<20;i++)b.tick(20);a.tick(0);b.tick(0);
 expect(Math.hypot(a.particle.x-start.x,a.particle.y-start.y)).toBeGreaterThan(4);expect(a.particle.x).toBeCloseTo(b.particle.x,7);expect(a.particle.y).toBeCloseTo(b.particle.y,7);expect(a.particle.rotation).toBeCloseTo(b.particle.rotation,7);expect(a.particle.alpha).toBeCloseTo(b.particle.alpha,7);expect(a.particle.scaleX*64/a.particle.scaleY/32).toBeGreaterThan(2);expect(Math.abs(a.particle.x)>32||Math.abs(a.particle.y)>44.8).toBe(true);
});
it('keeps a readable short core and thicker retained wake at the same particle count',()=>{
 const sample=(phase:'candidate'|'retained',core:boolean)=>{const config=recipe(phase,core),p=native(config);p.tick(160);p.tick(0);return{config,length:p.particle.scaleX*64,height:p.particle.scaleY*32,alpha:p.particle.alpha};},candidate=sample('candidate',false),retained=sample('retained',false),core=sample('retained',true);
 expect(candidate.height).toBeGreaterThanOrEqual(14);expect(retained.height).toBeGreaterThan(candidate.height*1.3);expect(retained.alpha).toBeGreaterThan(candidate.alpha);expect(core.length).toBeLessThan(retained.length*.6);expect(core.config.maxAliveParticles).toBe(3);expect(retained.config.maxAliveParticles).toBe(6);expect(candidate.config.maxAliveParticles).toBe(6);expect(retained.config.blendMode).toBe('NORMAL');
});
it('limits a real saved-eye size accent to initial births instead of replaying it during indefinite flow',()=>{
 const initial=recipe('retained',false,true),ordinary=recipe('retained',false,false),ratios:number[]=[];
 for(let i=0;i<8;i++){const a=native(initial),b=native(ordinary);a.tick(0);b.tick(0);ratios.push(a.particle.scaleY/b.particle.scaleY);}
 expect(ratios.slice(0,2).every(n=>n>1.09)).toBe(true);expect(ratios.slice(2).every(n=>Math.abs(n-1)<1e-8)).toBe(true);
});
it('strengthens only live selection without resetting birth age or requiring another receipt',()=>{
 let selected=false;const n=native(xinEnergyRecipe('actual',64,89.6,style,'candidate',false,false,()=>true,()=>selected));n.tick(300);n.tick(0);const height=n.particle.scaleY,life=n.particle.lifeCurrent;selected=true;n.tick(0);expect(n.particle.scaleY).toBeCloseTo(height*1.25);expect(n.particle.lifeCurrent).toBe(life);selected=false;n.tick(0);expect(n.particle.scaleY).toBeCloseTo(height);
});
it('checks the whole rotated stretched bitmap footprint rather than its center when preserving print and controls',()=>{
 const p=native(recipe('retained')).particle;Object.assign(p,{x:50,y:0,rotation:Math.PI/4,scaleX:1,scaleY:.2});const box=xinEnergyFootprint(p,identity);expect(box.x).toBeLessThan(37);expect(xinEnergyOverlaps(box,{x:30,y:-3,width:8,height:6})).toBe(true);const world=xinEnergyFootprint(p,(x,y)=>({x:100+x*.5,y:200+y*.5}));expect(world.width).toBeCloseTo(box.width*.5);expect(world.height).toBeCloseTo(box.height*.5);
 const visible=(particle:Phaser.GameObjects.Particles.Particle)=>!xinEnergyOverlaps(xinEnergyFootprint(particle,identity),{x:-32,y:-44.8,width:64,height:89.6}),guarded=recipe('retained',false,false,visible);let visibleFrames=0,hiddenFrames=0;
 for(let birth=0;birth<24;birth++){const n=native(guarded);for(let i=0;i<30;i++){n.tick(25);const faceOverlap=xinEnergyOverlaps(xinEnergyFootprint(n.particle,identity),{x:-32,y:-44.8,width:64,height:89.6});if(n.particle.alpha>0){visibleFrames++;expect(faceOverlap).toBe(false);}else hiddenFrames++;}}
 expect(visibleFrames).toBeGreaterThan(600);expect(hiddenFrames).toBeLessThan(120);
});
it('the actual shared emitter alpha guard clips a wake tip at a transformed foreign control while preserving a clear particle',()=>{
 class Node extends EventEmitter {active=true;visible=true;alpha=1;setName(){return this;}setData(){return this;}add(){return this;}start(){return this;}addDeathZone(){return this;}getWorldTransformMatrix(){return world;}destroy(){if(this.active){this.active=false;this.emit('destroy');}}}
 const world=new TransformMatrix().applyITRS(150,400,.2,.9,.9),rootMatrix=new TransformMatrix().applyITRS(10,20,.1,.8,.8),configs:Phaser.Types.GameObjects.Particles.ParticleEmitterConfig[]=[],host=new Node(),protectedBoxes:{x:number;y:number;width:number;height:number}[]=[],scene={game:{renderer:{type:2}},scale:{width:780,height:1688,zoom:.5},textures:{exists:()=>true},add:{particles:(_x:number,_y:number,_key:string,config:Phaser.Types.GameObjects.Particles.ParticleEmitterConfig)=>{configs.push(config);return new Node();}}},owner=new HeroSkillParticles(scene as unknown as Phaser.Scene);
 owner.sync('saved',[{id:'actual/kept',container:host as unknown as Phaser.GameObjects.Container,width:64,height:89.6}],style,{active:true,getWorldTransformMatrix:()=>rootMatrix} as Phaser.GameObjects.Container,protectedBoxes,true,true,{phase:'retained',igniteIds:['actual/kept']});
 try{const n=native(configs[0],world);n.tick(100);n.tick(0);expect(n.particle.alpha).toBeGreaterThan(0);const box=xinEnergyFootprint(n.particle,(x,y)=>{const w=world.transformPoint(x,y);return rootMatrix.applyInverse(w.x,w.y);});protectedBoxes.push({x:box.x+box.width-1,y:box.y+box.height/2-1,width:2,height:2});n.tick(0);expect(n.particle.alpha).toBe(0);protectedBoxes.length=0;n.tick(0);expect(n.particle.alpha).toBeGreaterThan(0);}finally{owner.clear();}expect(host.listenerCount('destroy')).toBe(0);
});
