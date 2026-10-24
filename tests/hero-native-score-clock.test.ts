import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import type Phaser from 'phaser';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {heroScoreAction} from '../src/game/HeroScoreAction';
import {prepareHeroScoreStrike,prepareHeroLossPose} from '../src/game/HeroScoreStrike';
import {HeroPortraitScoreMotion} from '../src/game/HeroPortraitScoreMotion';
import {scorePhrase} from '../src/game/ScorePhrase';
import {scorePerformanceCue} from '../src/game/ScorePerformance';
import {AudioEngine} from '../src/audio/AudioEngine';
import {CardBodyMotion} from '../src/game/CardBodyMotion';

const require=createRequire(import.meta.url);
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

async function runtime(hero:'amo'|'erxiang'|'azao'|'xiemu'|'touye'|'laohuan',speed:1|2|4,lose=false){
 const saved=await currentHeroReceipt(hero,lose);let state=saved.after,trace=saved.trace,event=saved.cue?.event;
 if(hero==='laohuan'){const result=await saved.saved.dispatch({type:'PlayHand',selectedIds:[saved.targetIds[0]]});if(!result.ok)throw Error(result.code);state=saved.saved.state;trace=state.lastTrace!;event=trace.events.find(e=>e.sourceType==='card'&&e.targetCardId===saved.targetIds[0]&&e.operation==='add-heat');}
 const action=heroScoreAction(trace,event!,saved.targetIds)!,beat=scorePhrase(trace.events,'100',speed,trace,saved.targetIds).get(event!.eventId)!,f=nativeHeroRuntime({width:1180,height:844,density:1,renderer:2});
 Object.assign(window,{matchMedia:()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}})});f.scene.sys.settings={visible:true};f.scene.textures.createCanvas=()=>undefined;
 let now=100000;vi.spyOn(Date,'now').mockImplementation(()=>now);
 const TweenManager=require('phaser/src/tweens/TweenManager.js'),manager:Phaser.Tweens.TweenManager&{start:()=>void}=new TweenManager(f.scene);f.scene.tweens=manager;f.scene.events.emit('boot');manager.start();manager.timeScale=speed;manager.setLagSmooth(1000,1000);
 const cards=action.targetIds.map((id,i)=>({id,container:f.card(id,{x:300+i*80,y:510,width:72,height:100}),width:72,height:100}));
 const bodies=cards.map(row=>{const body=f.scene.add.container(0,0),children=[...row.container.list];row.container.remove(children);body.add(children);row.container.add(body);return new CardBodyMotion(f.scene,row.container,body,()=>false,()=>false);}),order=[...f.root.list],rest=cards.map(row=>({x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle,parent:row.container.parentContainer,children:[...row.container.list]}));
 const readout=(x:number)=>{const text=f.scene.add.text(x,260,'35');text.alpha=1;text.setAlpha=(value:number)=>{text.alpha=value;return text;};text.canvas={width:20,height:16};f.root.add(text);return text;},H=readout(530),M=readout(700),image=f.scene.add.image(130,530,'portrait').setName('hero/portrait').setDisplaySize(160,200);f.root.add(image);
 const imageRest={x:image.x,y:image.y,sx:image.scaleX,sy:image.scaleY,angle:image.angle,tint:image.tintTopLeft},controller=new AbortController(),context={generation:8,signal:controller.signal},owner={state,score:trace,replay:false,generation:8},phases:string[]=[],portrait=new HeroPortraitScoreMotion(f.scene,image,{heroId:hero,bounds:{x:30,y:390,width:210,height:280},reducedMotion:()=>false}),binding=portrait.bindActionGesture({trace,event:event!,context,beat,retainedIds:saved.targetIds,onPhase:phase=>phases.push(phase)})!;
 const audio=new AudioEngine(),impact=vi.spyOn(audio,'scoreImpact').mockImplementation(()=>{}),rebound=vi.spyOn(audio,'scoreRebound').mockImplementation(()=>{});let impactAt=0,reboundAt=0;
 const animate=(config:Phaser.Types.Tweens.TweenBuilderConfig,ctx:{signal:AbortSignal})=>new Promise<void>(resolve=>{if(ctx.signal.aborted){resolve();return;}const finish=()=>{ctx.signal.removeEventListener('abort',cancel);resolve();},tween=manager.add({...config,onComplete:finish}),cancel=()=>{tween.remove();finish();};ctx.signal.addEventListener('abort',cancel,{once:true});});
 const bodyJobs=action.positive?bodies.flatMap(body=>{const job=body.claim(context,beat,{x:130,y:530});return job?[job]:[];}):[];
 const options={context,beat,portrait:false,liftRoom:18,targets:{H,M},cells:{H:{x:500,y:240,width:80,height:35},M:{x:670,y:240,width:80,height:35}},animate,refresh:()=>{},onStep:(elapsed:number)=>{binding.step(elapsed);for(const body of bodyJobs)body.step(elapsed);},onDispose:()=>{binding.dispose();for(const body of bodyJobs)body.dispose();},onRebound:(remaining:number)=>{reboundAt=now;const cue=scorePerformanceCue(owner,event!,context,{...beat,impact:remaining},speed,'rebound');if(cue)audio.consumePerformance(cue);}};
 const strike=(action.positive?prepareHeroScoreStrike(f.scene,f.root,action,cards,options):prepareHeroLossPose(f.scene,action,cards,options))!;
 const tick=async()=>{now+=16;f.step(now,16);await Promise.resolve();await Promise.resolve();};
 const run=async(promise:Promise<void>)=>{let done=false;void promise.then(()=>done=true);for(let i=0;i<300&&!done;i++)await tick();expect(done).toBe(true);await promise;};
 const arrive=()=>{impactAt=now;const cue=scorePerformanceCue(owner,event!,context,beat,speed,'impact');if(cue)audio.consumePerformance(cue);};
 const restored=()=>{cards.forEach((row,i)=>{expect(row.container.active).toBe(true);expect({x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle,parent:row.container.parentContainer}).toEqual((({children,...pose})=>pose)(rest[i]));expect(row.container.list).toEqual(rest[i].children);const body=bodies[i].body;expect([body.x,body.y,body.angle,body.scaleX,body.scaleY]).toEqual([0,0,0,1,1]);});expect({x:image.x,y:image.y,sx:image.scaleX,sy:image.scaleY,angle:image.angle,tint:image.tintTopLeft}).toEqual(imageRest);expect(f.root.list.filter(o=>order.includes(o))).toEqual(order);};
 const close=()=>{controller.abort();portrait.destroy();manager.shutdown();f.root.destroy();f.step(now+16,16);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);};
 return{...f,action,beat,cards,rest,context,controller,manager,image,imageRest,phases,binding,strike,impact,rebound,H,M,tick,run,arrive,restored,close,interval:()=>reboundAt-impactAt};
}

it.each((['amo','erxiang','azao','xiemu','touye','laohuan'] as const).flatMap(hero=>([1,2,4] as const).map(speed=>({hero,speed}))))('$hero real Phaser TweenManager at $speed x drives faces, portrait and one shared audio arrival/rebound',async({hero,speed})=>{
 const f=await runtime(hero,speed);
 try{expect(f.strike).toBeDefined();await f.run(f.strike.windup);expect(f.impact).not.toHaveBeenCalled();expect(f.phases).toEqual(['waiting']);expect(f.image.tintTopLeft).not.toBe(f.imageRest.tint);await f.run(f.strike.fly());expect(f.impact).not.toHaveBeenCalled();
  const source=f.root.list.find(o=>o.name==='hero/score-carrier')??f.cards[0].container,landing=source.getData('strike');expect(source.getData('heroChargeProgress')).toBeGreaterThan(.95);expect(landing.landingBounds.y).toBeGreaterThanOrEqual(landing.cell.y+landing.cell.height);expect((f.action.contributions[0].target==='H'?f.H:f.M).alpha).toBe(1);
  const land=f.strike.land();f.arrive();await f.run(land);expect(f.impact).toHaveBeenCalledTimes(1);expect(f.rebound).toHaveBeenCalledTimes(1);expect(f.interval()).toBeGreaterThanOrEqual(50);expect(f.phases).toEqual(['waiting','impact','rebound','rest']);f.restored();expect(f.manager.getTweens()).toHaveLength(0);
 }finally{f.close();}
});

it.each(['windup','flight','hold','rebound'] as const)('native shared clock abort during %s restores all genuine objects and has no late second hit',async phase=>{
 const f=await runtime('xiemu',4);let pending=f.strike.windup;
 try{if(phase==='windup')await f.tick();else {await f.run(pending);pending=f.strike.fly();if(phase==='flight')await f.tick();else {await f.run(pending);pending=f.strike.land();f.arrive();if(phase==='hold')await f.tick();else {for(let i=0;i<30&&f.rebound.mock.calls.length===0;i++)await f.tick();expect(f.rebound).toHaveBeenCalledTimes(1);}}}
  f.controller.abort();await f.run(pending);const count=f.rebound.mock.calls.length;for(let i=0;i<30;i++)await f.tick();expect(f.rebound).toHaveBeenCalledTimes(count);f.restored();expect(f.manager.getTweens()).toHaveLength(0);
 }finally{f.close();}
});

it.each([1,2,4] as const)('Qin actual lost receipt at %sx keeps the native clock quiet and restores the pending new cards',async speed=>{
 const f=await runtime('touye',speed,true);
 try{await f.run(f.strike.windup);await f.run(f.strike.fly());const land=f.strike.land();f.arrive();await f.run(land);expect(f.impact).not.toHaveBeenCalled();expect(f.rebound).not.toHaveBeenCalled();expect(f.M.alpha).toBe(1);f.restored();}finally{f.close();}
});
