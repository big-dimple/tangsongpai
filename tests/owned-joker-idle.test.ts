import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {OwnedJokerIdleMotion,mountOwnedJokerIdle} from '../src/game/OwnedJokerScoreMotion';
import {layout,type Box} from '../src/game/layout';
import {OwnedCardTilt,OWNED_TILT_LIMITS} from '../src/game/OwnedCardTilt';

afterEach(()=>vi.unstubAllGlobals());
const art={x:-28.8,y:-36,width:57.6,height:72};
it('rests between finite weight shifts at 30/60/120fps instead of continuously bobbing',()=>{
 const ends=[];
 for(const fps of [30,60,120]){
  const idle=new OwnedJokerIdleMotion(0),poses=Array.from({length:fps*24},()=>idle.step(1000/fps,63.6,89.04,art,true));
  const stable=poses.filter((p,i)=>i&&p.x===poses[i-1].x&&p.y===poses[i-1].y&&p.angle===poses[i-1].angle);
  expect(stable.length/poses.length).toBeGreaterThan(.45);
  expect(Math.min(...poses.map(p=>p.y))).toBeLessThan(-.5);expect(Math.max(...poses.map(p=>Math.abs(p.x)))).toBeGreaterThan(.6);
  expect(Math.max(...poses.map(p=>Math.abs(p.angle)))).toBeLessThan(1.1);expect(Math.max(...poses.map(p=>Math.abs(p.y)))).toBeLessThan(1.6);ends.push(poses.at(-1)!);
 }
 for(const p of ends.slice(1)){expect(Math.abs(p.x-ends[0].x)).toBeLessThan(.03);expect(Math.abs(p.y-ends[0].y)).toBeLessThan(.07);expect(Math.abs(p.angle-ends[0].angle)).toBeLessThan(.04);}
});
it('each seat has varied bounded episodes, while hover interrupts a shift and settles to a readable rest',()=>{
 const tracks=Array.from({length:5},(_,i)=>{const idle=new OwnedJokerIdleMotion(i);return Array.from({length:1800},()=>idle.step(1000/60,63.6,89.04,art,true));});
 const firstMoves=tracks.map(poses=>poses.findIndex(p=>Math.abs(p.x)>.15));expect(new Set(firstMoves).size).toBe(5);
 for(const poses of tracks)expect(poses.some(p=>p.x===0&&p.y===0&&p.angle===0)).toBe(true);
 const idle=new OwnedJokerIdleMotion(2);let moving=idle.step(0,63.6,89.04,art,true);for(let i=0;i<600&&Math.abs(moving.x)<.3;i++)moving=idle.step(1000/60,63.6,89.04,art,true);
 expect(Math.abs(moving.x)).toBeGreaterThan(.25);const next=idle.step(1000/60,63.6,89.04,art,true,false);expect(Math.abs(next.x-moving.x)).toBeLessThan(.1);
 let rest=next;for(let i=0;i<180;i++)rest=idle.step(1000/60,63.6,89.04,art,true,false);expect(rest).toEqual({x:0,y:0,angle:0,scale:1});
 for(let i=0;i<240;i++)expect(idle.step(1000/60,63.6,89.04,art,true,false)).toEqual(rest);
 for(let i=0;i<90;i++)expect(idle.step(1000/60,63.6,89.04,art,true,true)).toEqual(rest);
});
it('drops long-pause backlog and ignores invalid or frozen delta without changing the next step',()=>{
 const a=new OwnedJokerIdleMotion(2),b=new OwnedJokerIdleMotion(2);
 for(let i=0;i<120;i++){a.step(1000/60,63.6,89.04,art,true);b.step(1000/60,63.6,89.04,art,true);}
 const held=a.step(0,63.6,89.04,art,true);for(const dt of [0,-1,NaN,Infinity])expect(a.step(dt,63.6,89.04,art,true)).toEqual(held);
 expect(a.step(60000,63.6,89.04,art,true)).toEqual(b.step(50,63.6,89.04,art,true));
 expect(a.step(1000/60,63.6,89.04,art,true)).toEqual(b.step(1000/60,63.6,89.04,art,true));
});
it.each([[320,568],[390,740],[844,390],[1366,768]])('keeps all five actual artwork corners and reserved hover tilt inside fixed slots at %sx%s',(width,height)=>{
 const l=layout({width,height},{top:0,right:0,bottom:0,left:0}),phone=width<700;
 for(const [ordinal,b] of l.slots.entries()){
  const aw=Math.min(b.width-2,(b.height-2)*.8),ah=aw/.8,a:Box={x:-aw/2,y:-ah/2,width:aw,height:ah},idle=new OwnedJokerIdleMotion(ordinal),limits=OWNED_TILT_LIMITS[phone?'phone':'desktop'];
  for(let i=0;i<1440;i++){
   const p=idle.step(1000/60,b.width,b.height,a,phone),angle=(Math.abs(p.angle)+limits.angle)*Math.PI/180,parallax=limits.parallax;
   const halfX=(aw*Math.cos(angle)+ah*Math.sin(angle))*p.scale/2+Math.abs(p.x)+parallax,halfY=(ah*Math.cos(angle)+aw*Math.sin(angle))*p.scale/2+Math.abs(p.y)+parallax;
   expect(halfX).toBeLessThanOrEqual(b.width/2+1e-6);expect(halfY).toBeLessThanOrEqual(b.height/2+1e-6);
  }
 }
});

class Node extends EventEmitter {
 active=true;x=0;y=0;angle=0;scaleX=1;scaleY=1;alpha=1;width=63.6;height=89.04;list:Node[]=[];parentContainer?:Node;data=new Map<string,any>();writes=0;
 get rotation(){return this.angle*Math.PI/180;}
 getLocalPoint(x:number,y:number){return {x:x-this.x,y:y-this.y};}
 setData(k:string,v:any){this.data.set(k,v);return this;}getData(k:string){return this.data.get(k);}setName(_s:string){return this;}
 add(nodes:Node|Node[]){for(const n of Array.isArray(nodes)?nodes:[nodes]){n.parentContainer?.remove(n);this.list.push(n);n.parentContainer=this;}return this;}
 addAt(n:Node,_i:number){return this.add(n);}remove(nodes:Node|Node[]){for(const n of Array.isArray(nodes)?nodes:[nodes]){this.list=this.list.filter(x=>x!==n);n.parentContainer=undefined;}return this;}
 setPosition(x:number,y:number){this.writes++;this.x=x;this.y=y;return this;}setAngle(a:number){this.angle=a;return this;}setRotation(a:number){return this.setAngle(a*180/Math.PI);}setScale(x:number,y=x){this.scaleX=x;this.scaleY=y;return this;}setAlpha(a:number){this.alpha=a;return this;}
}
it('pointer release settles the existing tilt instead of snapping or moving the fixed hit owner',()=>{
 const input=new EventTarget();vi.stubGlobal('window',input);
 const marker=new Node(),frame=new Node(),artNode=new Node().setPosition(0,-3).setData('f09-active',true),tilt=new Node();tilt.add([frame,artNode]);marker.add(tilt).setData('frame',frame);
 const scene={game:{canvas:{getBoundingClientRect:()=>({width:1366})}}},controller=new OwnedCardTilt(scene as any,marker as any,tilt as any,()=>true);
 controller.point(25,12);for(let i=0;i<20;i++)controller.update(1/60,false);const before=tilt.rotation;expect(before).toBeGreaterThan(0);expect(before).toBeLessThan(OWNED_TILT_LIMITS.desktop.angle*Math.PI/180);
 input.dispatchEvent(new Event('pointerup'));expect(tilt.rotation).toBe(before);controller.update(1/60,false);expect(tilt.rotation).toBeGreaterThan(0);
 for(let i=0;i<150;i++)controller.update(1/60,false);expect([tilt.rotation,tilt.scaleX,tilt.scaleY,artNode.x,artNode.y]).toEqual([0,1,1,0,-3]);expect([marker.x,marker.y,marker.angle,marker.scaleX,marker.scaleY]).toEqual([0,0,0,1,1]);controller.destroy();
});
function mounted(viewportWidth=390){
 let float=true,allowed=true,reduced=false,hidden=false;const events=new EventEmitter(),documentEvents=new EventTarget();
 vi.stubGlobal('document',{get hidden(){return hidden;},addEventListener:documentEvents.addEventListener.bind(documentEvents),removeEventListener:documentEvents.removeEventListener.bind(documentEvents)});
 const frame=new Node(),artNode=new Node().setPosition(0,-3).setData('f09-active',true),marker=new Node().setData('frame',frame).setData('scoreArtBounds',art);marker.add([frame,artNode]);
 const rect=vi.fn(()=>({width:viewportWidth,height:740})),scene={events,add:{container:()=>new Node(),ellipse:()=>new Node()},game:{canvas:{getBoundingClientRect:rect}}};
 mountOwnedJokerIdle(scene as any,marker as any,{ordinal:1,reducedMotion:()=>reduced,canFloat:()=>float,canTilt:()=>allowed});
 const visual=marker.getData('scorePoseRoot') as Node,pose=()=>[visual.x,visual.y,visual.angle,visual.scaleX,visual.scaleY];
 return {events,marker,visual,artNode,rect,pose,tick:(time:number,delta=1000/60)=>events.emit('update',time,delta),float:(v:boolean)=>{float=v;},allowed:(v:boolean)=>{allowed=v;},reduced:(v:boolean)=>{reduced=v;},hidden:(v:boolean)=>{hidden=v;documentEvents.dispatchEvent(new Event('visibilitychange'));}};
}
it('the actual listener holds still, settles hover, yields to score/drag and resumes from the owner pose',()=>{
 const f=mounted();for(let i=0;i<120;i++)f.tick(i*1000/120,1000/120);expect(f.visual.writes).toBeLessThan(4);expect(f.rect).toHaveBeenCalledOnce();
 for(let i=0;i<600&&Math.abs(f.visual.x)<.25;i++)f.tick(1000+i*17);expect(Math.abs(f.visual.x)).toBeGreaterThan(.2);
 const held=f.pose();f.float(false);f.tick(50000);expect(Math.abs(f.visual.x-held[0])).toBeLessThan(.1);for(let i=0;i<180;i++)f.tick(50017+i*17);expect(f.pose()).toEqual([0,0,0,1,1]);
 f.allowed(false);f.visual.setPosition(7,-12).setAngle(9).setScale(.95);const owned=f.pose(),count=f.visual.writes;for(let i=0;i<20;i++)f.tick(70000+i*17);expect(f.pose()).toEqual(owned);expect(f.visual.writes).toBe(count);
 // The real owner restores its pose before relinquishing the layer.
 f.visual.setPosition(0,0).setAngle(0).setScale(1);f.allowed(true);f.float(true);f.tick(120000);expect(Math.abs(f.visual.y)).toBeLessThan(.5);expect(Math.abs(f.visual.angle)).toBeLessThan(.3);
 expect([f.marker.x,f.marker.y,f.marker.angle,f.marker.scaleX,f.marker.scaleY]).toEqual([0,0,0,1,1]);f.events.emit('shutdown');const after=f.visual.writes;f.tick(150000);expect(f.visual.writes).toBe(after);expect(f.events.listenerCount('update')).toBe(0);
});
it('hidden/invalid-delta holds, reduced-motion identity and a smooth resume do not replay wall time',()=>{
 const f=mounted();for(let i=0;i<120;i++)f.tick(i*17);const held=f.pose();
 for(const dt of [0,-10,NaN,Infinity])f.tick(80000,dt);expect(f.pose()).toEqual(held);
 f.hidden(true);f.tick(90000,60000);expect(f.pose()).toEqual(held);f.hidden(false);f.tick(150000,1000/60);expect(Math.abs(f.visual.y-held[1])).toBeLessThan(.1);
 f.reduced(true);f.tick(160000);expect(f.pose()).toEqual([0,0,0,1,1]);const writes=f.visual.writes;for(let i=0;i<30;i++)f.tick(160000+i*17);expect(f.visual.writes).toBe(writes);
 f.reduced(false);f.tick(180000);expect(Math.abs(f.visual.y)).toBeLessThan(.5);f.events.emit('shutdown');
});

it.each([390,1366])('mounted idle depth at %spx couples inner perspective/parallax to a separate table shadow',width=>{
 const f=mounted(width),tilt=f.visual.getData('tiltRoot') as Node,shadows=f.marker.list.filter(o=>o.getData('scoreMotionFixed')),shadow=shadows[0];
 f.tick(0);const floor={x:shadow.x,y:shadow.y,sx:shadow.scaleX,sy:shadow.scaleY,alpha:shadow.alpha};let peak=0,depth=0,parallax=0,shadowTravel=0,shadowScale=0;
 for(let i=0;i<900;i++){f.tick(i*17);if(Math.abs(f.visual.x)>peak){peak=Math.abs(f.visual.x);depth=Math.abs(tilt.scaleX-tilt.scaleY);parallax=Math.hypot(f.artNode.x,f.artNode.y+3);shadowTravel=Math.abs((f.visual.x-shadow.x)-(0-floor.x));shadowScale=Math.abs(shadow.scaleX-floor.sx);}}
 expect(peak).toBeGreaterThan(.5);expect(depth).toBeGreaterThan(.005);expect(parallax).toBeGreaterThan(.05);expect(shadowTravel).toBeGreaterThan(.7);expect(shadowScale).toBeGreaterThan(.04);
 f.float(false);for(let i=0;i<180;i++)f.tick(16000+i*17);expect([tilt.rotation,tilt.scaleX,tilt.scaleY,f.artNode.x,f.artNode.y]).toEqual([0,1,1,0,-3]);
 f.allowed(false);tilt.setRotation(.12).setScale(.94,.97);f.artNode.setPosition(4,-8);const owned=[tilt.rotation,tilt.scaleX,tilt.scaleY,f.artNode.x,f.artNode.y];for(let i=0;i<30;i++)f.tick(20017+i*17);expect([tilt.rotation,tilt.scaleX,tilt.scaleY,f.artNode.x,f.artNode.y]).toEqual(owned);
 tilt.setRotation(0).setScale(1);f.artNode.setPosition(0,-3);f.visual.setPosition(1,-1).setAngle(.4).setScale(1);f.allowed(true);f.float(true);f.tick(22000);expect(tilt.scaleX).toBeGreaterThan(.99);expect(Math.hypot(f.artNode.x,f.artNode.y+3)).toBeLessThan(.1);
 expect([f.marker.x,f.marker.y,f.marker.angle,f.marker.scaleX,f.marker.scaleY]).toEqual([0,0,0,1,1]);f.events.emit('shutdown');
});
