import {afterEach,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import type Phaser from 'phaser';
import {heroAttachmentFixture} from '../harness/fixtures/hero-attachments';
import {energySend} from '../harness/fixtures/score-energy';
import {heroCardScoreStrikeCue,prepareJokerScoreStrike} from '../src/game/JokerScoreStrike';
import {scorePhrase} from '../src/game/ScorePhrase';
import {AudioEngine} from '../src/audio/AudioEngine';
import {scorePerformanceCue} from '../src/game/ScorePerformance';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {heroScoreAction} from '../src/game/HeroScoreAction';
import {prepareHeroScoreStrike,prepareHeroLossPose} from '../src/game/HeroScoreStrike';

class Object2D extends EventEmitter {
 active=true;visible=true;alpha=1;x=0;y=0;angle=0;scaleX=1;scaleY=1;name='';width=80;height=110;parentContainer?:Object2D;list:Object2D[]=[];data=new Map<string,unknown>();
 canvas={width:50,height:20};
 setPosition(x:number,y:number){this.x=x;this.y=y;return this;}setY(y:number){this.y=y;return this;}setAngle(n:number){this.angle=n;return this;}setScale(x:number,y=x){this.scaleX=x;this.scaleY=y;return this;}setAlpha(n:number){this.alpha=n;return this;}
 setName(n:string){this.name=n;return this;}setData(k:string,v:unknown){this.data.set(k,v);return this;}getData(k:string){return this.data.get(k);}
 add(o:Object2D){o.parentContainer?.remove(o);this.list.push(o);o.parentContainer=this;return this;}addAt(o:Object2D,index:number){o.parentContainer?.remove(o);this.list.splice(index,0,o);o.parentContainer=this;return this;}remove(o:Object2D){const index=this.list.indexOf(o);if(index>=0)this.list.splice(index,1);if(o.parentContainer===this)o.parentContainer=undefined;return this;}clear(){return this;}lineStyle(){return this;}lineBetween(){return this;}strokeEllipse(){return this;}fillStyle(){return this;}fillTriangle(){return this;}
 getWorldTransformMatrix(){const a=this.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),p=this.parentContainer?.getWorldTransformMatrix();return {
  transformPoint:(x:number,y:number):{x:number;y:number}=>{const q={x:this.x+x*this.scaleX*c-y*this.scaleY*s,y:this.y+x*this.scaleX*s+y*this.scaleY*c};return p?p.transformPoint(q.x,q.y):q;},
  applyInverse:(x:number,y:number):{x:number;y:number}=>{const q=p?p.applyInverse(x,y):{x,y},dx=q.x-this.x,dy=q.y-this.y;return{x:(dx*c+dy*s)/this.scaleX,y:(-dx*s+dy*c)/this.scaleY};},
 };}
 getBounds(){const p=this.getWorldTransformMatrix().transformPoint(0,0);return{x:p.x-this.width/2,y:p.y-this.height/2,width:this.width,height:this.height,centerX:p.x,centerY:p.y};}
 destroy(){if(!this.active)return;this.active=false;this.emit('destroy');for(const o of [...this.list])o.destroy();this.parentContainer?.remove(this);}
}
afterEach(()=>vi.unstubAllGlobals());
function fixture(speed:1|2|4){
 const dom=new EventTarget();vi.stubGlobal('document',{hidden:false,addEventListener:dom.addEventListener.bind(dom),removeEventListener:dom.removeEventListener.bind(dom)});
 const f=heroAttachmentFixture('erxiang'),state=energySend(f.state,f.action),trace=state.lastTrace!,event=trace.events.find(e=>e.reasonKey==='erxiang.handoff')!,cue=heroCardScoreStrikeCue(trace,event)!;
 const beat=scorePhrase(trace.events,'100',speed,trace).get(event.eventId)!,root=new Object2D().setPosition(17,9).setScale(.9),card=new Object2D().setPosition(300,480).setScale(.8).setAngle(2),hit=new Object2D().setPosition(300,480);
 const attachment=new Object2D().setName('hero/target-edge'),art=new Object2D().setName('card/art');card.add(art).add(attachment);root.add(card).add(hit);
 const H=new Object2D().setPosition(200,180),M=new Object2D().setPosition(420,180);root.add(H).add(M);
 const allocated:Object2D[]=[],events=new EventEmitter(),snapshots:string[]=[],ticks:{config:Phaser.Types.Tweens.TweenBuilderConfig;context:{signal:AbortSignal};finish:()=>void}[]=[],abort=new AbortController(),phases:number[]=[];
 const scene={events,textures:{exists:()=>false,createCanvas:()=>{snapshots.push('old-number');return null;}},add:{container:(x:number,y:number)=>{const o=new Object2D().setPosition(x,y);allocated.push(o);return o;},graphics:()=>{const o=new Object2D();allocated.push(o);return o;}}};
 const animate=(config:Phaser.Types.Tweens.TweenBuilderConfig,context:{signal:AbortSignal})=>new Promise<void>(resolve=>{const tick={config,context,finish:resolve};ticks.push(tick);context.signal.addEventListener('abort',()=>resolve(),{once:true});});
 const options={context:{generation:1,signal:abort.signal},beat,sourceCard:true,textureKey:'',artBounds:{x:-40,y:-55,width:80,height:110},portrait:false,liftRoom:18,targets:{H,M},cells:{H:{x:160,y:165,width:80,height:30},M:{x:380,y:165,width:80,height:30}},animate,refresh:vi.fn(()=>{for(const text of [H,M])if(text.active)text.setScale(Number(text.getData('scorePulseScale')??1));}),onRebound:(remaining:number):void=>{phases.push(remaining);}};
 const snapshot=()=>({x:card.x,y:card.y,sx:card.scaleX,sy:card.scaleY,angle:card.angle,alpha:card.alpha,parent:card.parentContainer});
 const rest=snapshot(),strike=prepareJokerScoreStrike(scene as unknown as Phaser.Scene,root as unknown as Phaser.GameObjects.Container,card as unknown as Phaser.GameObjects.Container,cue,options as any)!;
 const tick=(index:number,t:number)=>{const r=ticks[index];(r.config.targets as {t:number}).t=t;(r.config.onUpdate as ()=>void)();};
 const finish=async(index:number)=>{tick(index,1);ticks[index].finish();await Promise.resolve();};
 return{root,card,hit,H,M,attachment,art,scene,ticks,abort,phases,allocated,snapshots,beat,strike,tick,finish,snapshot,rest,options,cue,state,trace,event};
}

it.each([1,2,4] as const)('moves the actual target and attached material toward M before the single arrival at %sx; restores it without replacing a card or its hit',async speed=>{
 const f=fixture(speed),hit={x:f.hit.x,y:f.hit.y},savedChildren=[...f.card.list];expect(f.strike).toBeDefined();expect(f.snapshots).toEqual([]);
 f.tick(0,1);expect(f.card.y).toBeLessThan(f.rest.y);await f.finish(0);await f.strike.windup;
 const flight=f.strike.fly();f.tick(1,.5);expect(f.card.y).toBeLessThan(f.rest.y);expect(f.card.x).toBeGreaterThan(f.rest.x);expect(f.snapshots).toEqual([]);expect(f.M.alpha).toBe(1);
 await f.finish(1);await flight;expect(f.card.getData('strike')).toMatchObject({eventId:f.cue.eventId,target:'M',kind:'add'});expect(f.card.parentContainer).toBe(f.root);expect(f.card.list).toEqual(savedChildren);
 const land=f.strike.land();expect(f.snapshots).toHaveLength(1);expect(f.M.alpha).toBe(0);expect(f.H.alpha).toBe(1);
 const reveal=(f.beat.strike!.hold+16*speed)/f.beat.impact;f.tick(2,reveal);expect(f.M.alpha).toBe(1);expect(f.M.getData('scorePulseScale')).toBeGreaterThan(1.1);
 for(let t=reveal;t<=1;t+=.02)f.tick(2,Math.min(1,t));expect(f.phases).toHaveLength(1);expect(f.phases[0]/speed).toBeGreaterThan(0);
 await f.finish(2);await land;expect(f.snapshot()).toEqual(f.rest);expect(f.card.active).toBe(true);expect(f.attachment.active).toBe(true);expect(f.art.active).toBe(true);expect(f.card.list).toEqual(savedChildren);
 expect({x:f.hit.x,y:f.hit.y}).toEqual(hit);expect(f.allocated.every(o=>!o.active)).toBe(true);expect(f.M.getData('scorePulseScale')).toBe(1);expect(f.card.eventNames()).toEqual([]);expect(f.scene.events.eventNames()).toEqual([]);
});

it.each(['windup','flight','hold','rebound','hidden','shutdown'] as const)('cancellation at %s restores the real card/readout and suppresses stale phase callbacks',async phase=>{
 const f=fixture(4);let done:Promise<void>=f.strike.windup;
 if(phase==='windup')f.tick(0,.8);
 else {await f.finish(0);await f.strike.windup;done=f.strike.fly();f.tick(1,.7);if(!['flight'].includes(phase)){await f.finish(1);await done;done=f.strike.land();f.tick(2,phase==='rebound'?.9:.05);}}
 const count=f.phases.length;if(phase==='hidden')f.strike.dispose();else if(phase==='shutdown')f.scene.events.emit('shutdown');else f.abort.abort();await done;
 for(let i=0;i<f.ticks.length;i++)f.tick(i,1);expect(f.phases).toHaveLength(count);expect(f.snapshot()).toEqual(f.rest);expect(f.card.active).toBe(true);expect(f.M.alpha).toBe(1);expect(f.M.scaleX).toBe(1);expect(f.allocated.every(o=>!o.active)).toBe(true);
});

it('a parent mismatch refuses physical ownership instead of moving a world coordinate into another container',()=>{
 const f=fixture(1);f.strike.dispose();const another=new Object2D();expect(prepareJokerScoreStrike(f.scene as any,another as any,f.card as any,f.cue,f.options as any)).toBeUndefined();expect(f.snapshot()).toEqual(f.rest);
});

it('zero or negative arithmetic cannot manufacture a gain strike or its decoration',()=>{
 const f=fixture(1);f.strike.dispose();const allocated=f.allocated.length;
 for(const after of [f.cue.contributions[0].before,{n:'0',d:'1'}]){const cue={...f.cue,contributions:f.cue.contributions.map(c=>({...c,after}))};expect(prepareJokerScoreStrike(f.scene as any,f.root as any,f.card as any,cue,f.options as any)).toBeUndefined();}
 expect(f.allocated).toHaveLength(allocated);expect(f.snapshot()).toEqual(f.rest);
});

it.each([1,2,4] as const)('the same saved event reaches AudioEngine only on actual arrival/rebound callbacks at %sx',async speed=>{
 const f=fixture(speed),engine=new AudioEngine(),impact=vi.spyOn(engine,'scoreImpact').mockImplementation(()=>{}),rebound=vi.spyOn(engine,'scoreRebound').mockImplementation(()=>{}),owner={state:f.state,score:f.trace,replay:false};
 let realElapsed=0,reboundAt=0;
 const emit=(phase:'impact'|'rebound',remaining=f.beat.impact)=>{const cue=scorePerformanceCue(owner,f.event,f.options.context,{...f.beat,impact:remaining},speed,phase);if(cue)engine.consumePerformance(cue);};
 f.options.onRebound=remaining=>{reboundAt=realElapsed;emit('rebound',remaining);};
 await f.finish(0);await f.strike.windup;const flight=f.strike.fly();await f.finish(1);await flight;expect(impact).not.toHaveBeenCalled();expect(rebound).not.toHaveBeenCalled();
 const land=f.strike.land();emit('impact');emit('impact');expect(impact).toHaveBeenCalledTimes(1);expect(impact.mock.calls[0].slice(0,3)).toEqual([owner,f.event.eventId,'add']);
 for(let elapsed=0;elapsed<=f.beat.impact;elapsed+=1000/60*speed){realElapsed=elapsed/speed;f.tick(2,elapsed/f.beat.impact);}
 expect(rebound).toHaveBeenCalledTimes(1);expect(reboundAt).toBeGreaterThanOrEqual(50);expect(rebound.mock.calls[0].slice(0,2)).toEqual([owner,f.event.eventId]);
 expect(rebound.mock.calls[0][2]?.signal).toBe(f.options.context.signal);expect(rebound.mock.calls[0][2]?.durationMs).toBeLessThan(f.beat.impact/speed);
 await f.finish(2);await land;f.abort.abort();emit('impact');emit('rebound');expect(impact).toHaveBeenCalledTimes(1);expect(rebound).toHaveBeenCalledTimes(1);
});

async function groupFixture(hero:'amo'|'azao'|'xiemu'|'touye',speed:1|2|4=1,lose=false){
 const runtime=fixture(speed);runtime.strike.dispose();const f=await currentHeroReceipt(hero,lose),action=heroScoreAction(f.trace,f.cue!.event)!,cards=action.targetIds.map((id,i)=>{const container=new Object2D().setPosition(170+i*76,480).setScale(.7).setAngle(i%2?2:-2);container.add(new Object2D().setName('material/'+id));runtime.root.add(container);return{id,container,width:80,height:110};}),rest=cards.map(row=>({container:row.container,x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle,alpha:row.container.alpha,parent:row.container.parentContainer,children:[...row.container.list]})),order=[...runtime.root.list];
 const beat=scorePhrase(f.trace.events,'100',speed,f.trace).get(action.eventId)!,steps:number[]=[],options={...runtime.options,beat,onStep:(elapsed:number)=>steps.push(elapsed)},strike=(action.positive?prepareHeroScoreStrike(runtime.scene as any,runtime.root as any,action,cards as any,options as any):prepareHeroLossPose(runtime.scene as any,action,cards as any,options as any))!;
 const restored=()=>{for(const row of rest){expect(row.container.active).toBe(true);expect({x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle,alpha:row.container.alpha,parent:row.container.parentContainer}).toEqual({x:row.x,y:row.y,sx:row.sx,sy:row.sy,angle:row.angle,alpha:row.alpha,parent:row.parent});expect(row.container.list).toEqual(row.children);expect(row.children.every(c=>c.active)).toBe(true);}expect(runtime.root.list).toEqual(order);};
 return {...runtime,action,cards,rest,order,beat,steps,strike,restored};
}

it.each(['amo','azao','xiemu','touye'] as const)('%s moves only actual beneficiaries on one shared strike clock, preserving materials, hit and layer order',async hero=>{
 const f=await groupFixture(hero,4),world=f.cards.map(row=>row.container.getWorldTransformMatrix().transformPoint(0,0)),hit={x:f.hit.x,y:f.hit.y};expect(f.strike).toBeDefined();expect(f.action.costIds.every(id=>!f.cards.some(card=>card.id===id))).toBe(true);
 f.tick(1,.8);const source=f.root.list.find(o=>o.name==='hero/score-carrier')??f.cards[0].container;expect(source.getData('heroChargeProgress')).toBeGreaterThan(.9);expect(f.cards.some((row,i)=>row.container.getWorldTransformMatrix().transformPoint(0,0).y>world[i].y)).toBe(true);await f.finish(1);await f.strike.windup;const flight=f.strike.fly();await f.finish(2);await flight;const landing=source.getData('strike') as any;expect(landing.landingBounds.y).toBeGreaterThan(f.root.getWorldTransformMatrix().applyInverse(landing.cell.x,landing.cell.y+landing.cell.height).y);const land=f.strike.land();expect(f.M.alpha).toBe(1);for(let p=.2;p<1;p+=.04)f.tick(3,p);await f.finish(3);await land;
 expect(f.phases).toHaveLength(1);expect(f.steps[0]).toBeLessThan(f.steps.at(-1)!);expect(f.steps.at(-1)).toBe(f.beat.windup+f.beat.flight+f.beat.impact);expect({x:f.hit.x,y:f.hit.y}).toEqual(hit);f.restored();expect(f.scene.events.eventNames()).toEqual([]);
});

it.each(['windup','flight','hold','rebound','shutdown','member-destroy'] as const)('group cancellation at %s restores the exact faces/parents/layers and cannot emit a late rebound',async phase=>{
 const f=await groupFixture('xiemu',2);let done=f.strike.windup;
 if(phase==='windup')f.tick(1,.8);else {await f.finish(1);await done;done=f.strike.fly();f.tick(2,.6);if(phase!=='flight'){await f.finish(2);await done;done=f.strike.land();f.tick(3,phase==='rebound'?.9:.01);}}
 const count=f.phases.length;if(phase==='shutdown')f.scene.events.emit('shutdown');else if(phase==='member-destroy')f.cards[0].container.destroy();else f.abort.abort();await done;for(let i=1;i<f.ticks.length;i++)f.tick(i,1);expect(f.phases).toHaveLength(count);
 if(phase!=='member-destroy')f.restored();else {expect(f.cards.slice(1).every(row=>row.container.active&&row.container.parentContainer===f.root)).toBe(true);expect(f.root.list.some(o=>o.name==='hero/score-carrier')).toBe(false);}expect(f.M.alpha).toBe(1);expect(f.M.scaleX).toBe(1);
});

it('parent destruction never reattaches destroyed children or resurrects a carrier',async()=>{
 const f=await groupFixture('azao');f.root.destroy();await f.strike.windup;expect(f.cards.every(row=>!row.container.active)).toBe(true);expect(f.root.list).toEqual([]);f.tick(1,1);expect(f.root.list).toEqual([]);
});

it('Qin loss uses a small cold return without a numeric fracture, gain flight or audio rebound',async()=>{
 const f=await groupFixture('touye',4,true);f.tick(1,1);await f.finish(1);await f.strike.windup;const flight=f.strike.fly();await f.finish(2);await flight;const land=f.strike.land();f.tick(3,.2);expect(f.cards.some(row=>row.container.alpha<1)).toBe(true);await f.finish(3);await land;expect(f.snapshots).toEqual([]);expect(f.phases).toEqual([]);f.restored();
});
