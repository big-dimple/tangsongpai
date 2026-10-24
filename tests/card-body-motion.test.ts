import {afterEach,expect,it,vi} from 'vitest';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {CardBodyMotion} from '../src/game/CardBodyMotion';

afterEach(()=>vi.unstubAllGlobals());
function fixture(reduced=false,width=64){
 const f=nativeHeroRuntime({width:390,height:844,density:1,renderer:2}),outer=f.card('real-card',{x:220,y:520,width,height:width*1.4}),body=f.scene.add.container(0,0),children=[...outer.list];outer.remove(children);body.add(children);outer.add(body);
 let allowed=true;const listeners=f.scene.events.listenerCount('update'),motion=new CardBodyMotion(f.scene,outer,body,()=>reduced,()=>allowed),pose=()=>[body.x,body.y,body.angle,body.scaleX,body.scaleY],rest=[outer.x,outer.y,outer.angle,outer.scaleX,outer.scaleY],tick=(n=1)=>{for(let i=0;i<n;i++)f.step(i*16,16);};
 return {...f,outer,body,motion,pose,rest,tick,allow:(v:boolean)=>allowed=v,reduced:(v:boolean)=>reduced=v,close:()=>{outer.destroy();expect(f.scene.events.listenerCount('update')).toBe(listeners);}};
}
it('selection and draft give finite face responses without moving layout or the genuine printed children',()=>{
 const f=fixture(),children=[...f.body.list];f.motion.input(false,false);f.motion.input(true,false);f.tick(8);expect(f.body.y).toBeLessThan(-.1);expect(Math.abs(f.body.angle)).toBeGreaterThan(.1);f.tick(220);expect(f.pose()).toEqual([0,0,0,1,1]);
 f.motion.input(true,false);f.tick(20);expect(f.pose()).toEqual([0,0,0,1,1]);f.motion.hint('chosen-target',{x:20,y:100});f.tick(5);expect(f.body.x).toBeLessThan(0);expect(f.body.y).toBeLessThan(0);f.tick(220);f.motion.hint('chosen-target',{x:20,y:100});f.tick(20);expect(f.pose()).toEqual([0,0,0,1,1]);
 expect([f.outer.x,f.outer.y,f.outer.angle,f.outer.scaleX,f.outer.scaleY]).toEqual(f.rest);expect(f.body.list).toEqual(children);f.close();
});
it.each([64,132])('selection at %spx stays clearly tilted under a stationary hover, fits the original lift reserve and settles once',width=>{
 const f=fixture(false,width);f.motion.input(false,true);f.motion.input(true,true);f.tick(8);expect(Math.abs(f.body.angle)).toBeGreaterThan(3);expect(f.body.y).toBeLessThan(-.2);const cornerRise=width*Math.sin(Math.abs(f.body.angle)*Math.PI/180)/2;expect(16-f.body.y+cornerRise).toBeLessThanOrEqual(22.01);f.tick(220);expect(f.pose()).toEqual([0,0,0,1,1]);f.motion.input(true,true);f.tick(20);expect(f.pose()).toEqual([0,0,0,1,1]);f.close();
});
it('saved windup and hit are sampled by the shared score clock; input, stale callbacks and abort cannot compete',()=>{
 const f=fixture(),abort=new AbortController(),context={generation:4,signal:abort.signal},beat={windup:120,flight:100,impact:240,rest:0,strength:'role' as const,strike:{hold:40,recovery:200}};
 const job=f.motion.claim(context,beat,{x:20,y:80})!;job.step(120);expect(f.body.x).toBeLessThan(0);expect(f.body.y).toBeLessThan(0);const held=f.pose();f.allow(false);f.motion.input(true,true);f.tick(40);expect(f.pose()).toEqual(held);
 job.step(220);expect(Math.abs(f.body.angle)).toBeGreaterThan(1);f.reduced(true);f.tick();expect(f.pose()).toEqual([0,0,0,1,1]);f.reduced(false);job.step(220);expect(Math.abs(f.body.angle)).toBeGreaterThan(1);abort.abort();expect(f.pose()).toEqual([0,0,0,1,1]);job.step(300);expect(f.pose()).toEqual([0,0,0,1,1]);
 const next=f.motion.claim({generation:5,signal:new AbortController().signal},beat)!;next.step(120);const live=f.pose();job.dispose();job.step(100);expect(f.pose()).toEqual(live);next.step(460);expect(f.pose()).toEqual([0,0,0,1,1]);next.dispose();expect([f.outer.x,f.outer.y,f.outer.angle,f.outer.scaleX,f.outer.scaleY]).toEqual(f.rest);f.close();
});
it('reduced motion and score ownership suppress selection response and shutdown removes the existing update listener',()=>{
 const f=fixture(true);f.motion.input(false,false);f.motion.input(true,false);f.motion.hint('draft');f.tick(30);expect(f.pose()).toEqual([0,0,0,1,1]);
 const job=f.motion.claim({generation:1,signal:new AbortController().signal},{windup:100,flight:0,impact:120,rest:0,strength:'role'})!;job.step(100);expect(f.pose()).toEqual([0,0,0,1,1]);f.scene.events.emit('shutdown');expect(f.scene.events.listenerCount('update')).toBe(0);job.step(120);expect(f.pose()).toEqual([0,0,0,1,1]);f.outer.destroy();
});
