import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroLiveSmoke,HERO_SMOKE_TOTAL_PIXELS} from '../src/game/HeroLiveSmoke';
import {HeroSmokeQuality} from '../src/game/HeroSmokeQuality';
import {HERO_SMOKE_VERTEX,HERO_SMOKE_FRAGMENT} from '../src/game/HeroSmokeShader';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {retainedRefillImpact} from '../src/game/HeroAttachmentFacts';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {layout} from '../src/game/layout';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
/** Resource/uniform boundary double only. These checks do NOT compile GLSL or verify GPU pixels. */
function shaderRuntime(width=1280){
 // This resource double clones uniforms rather than submitting GPU work. Host
 // JIT/GC pauses must not drive adaptive quality; explicit quality stress tests
 // exercise that feedback separately while these strict clock assertions stay.
 let syntheticNow=0;if(!vi.isMockFunction(performance.now))vi.spyOn(performance,'now').mockImplementation(()=>syntheticNow+=.01);
 const f=nativeHeroRuntime({width,height:844,density:width<600?2:1,renderer:2}),scene=f.scene as any,programs:any[]=[],textures=new Set<string>(),shaderCache=new Map();
 scene.game.loop={rawDelta:16};scene.game.renderer.setBlendMode=vi.fn();scene.game.renderer.gl={MAX_TEXTURE_SIZE:1,MAX_FRAGMENT_UNIFORM_VECTORS:2,FRAGMENT_SHADER:3,HIGH_FLOAT:4,getParameter:(key:number)=>key===1?4096:64,getShaderPrecisionFormat:()=>({precision:23})};
 scene.cache={shader:{has:(key:string)=>shaderCache.has(key),add:(key:string,value:unknown)=>shaderCache.set(key,value)}};scene.textures.remove=(key:string)=>textures.delete(key);
 scene.add.shader=vi.fn((key:string,x:number,y:number,w:number,h:number)=>{
  const shader:any=new f.Zone(scene,x,y,w,h),uniforms:Record<string,any>={},draws:any[]=[];shader.program={webGLProgram:{}};shader.uniforms=uniforms;shader.draws=draws;
  shader.setUniform=(name:string,value:unknown)=>{uniforms[name]=value;return shader;};shader.setRenderToTexture=(name:string)=>{textures.add(name);shader.once('destroy',()=>textures.delete(name));return shader;};shader.renderWebGL=()=>draws.push(structuredClone(uniforms));programs.push(shader);return scene.sys.displayList.add(shader);
 });
 const render=()=>{for(const shader of programs)if(shader.active)shader.renderWebGL(scene.game.renderer,shader,{});},images=()=>{const found:Phaser.GameObjects.Image[]=[];const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const o of list){if(o.name==='hero/live-smoke'&&o.active)found.push(o as Phaser.GameObjects.Image);const nested=(o as Phaser.GameObjects.Container).list;if(nested)walk(nested);}};walk(f.root.list);return found;};
 return{...f,programs,textures,render,images,frame:(time:number,delta=16)=>{scene.game.loop.rawDelta=delta;f.step(time,delta);render();}};
}
const style=heroAtmosphereStyle({key:'contract',targetId:'target',releaseReason:'erxiang.handoff'});
it('starts low, requires render confidence for high, downgrades on measured stress and recovers from idle fallback',()=>{
 const q=new HeroSmokeQuality(true);for(let i=0;i<250;i++)q.sample(16,0,false);expect(q.index).toBe(0);
 for(let i=0;i<200;i++)q.sample(16,.2);expect(q.index).toBe(1);for(let i=0;i<10;i++)q.noteRender();for(let i=0;i<120;i++)q.sample(16,.2);expect(q.index).toBe(2);
 for(let i=0;i<3;i++)q.sample(33,4);expect(q.index).toBe(1);for(let i=0;i<45;i++)q.sample(33,4);expect(q.index).toBe(0);expect(q.fallback).toBe(true);for(let i=0;i<320;i++)q.sample(16,0,false);expect(q.fallback).toBe(false);
 const modest=new HeroSmokeQuality(false);for(let i=0;i<300;i++){modest.noteRender();modest.sample(16,0);}expect(modest.index).toBe(1);
});
it('measured submission cost alone downgrades a healthy frame clock',()=>{
 const q=new HeroSmokeQuality(true);for(let i=0;i<360;i++){q.noteRender();q.sample(16,.2);}expect(q.index).toBe(2);
 for(let i=0;i<3;i++)q.sample(16,4);expect(q.index).toBe(1);
});
it('shares a hard framebuffer budget across managers and eight real targets, then releases every output',()=>{
 // This is a framebuffer/resource double; host GC/structuredClone time is not GPU submission cost.
 let sampled=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>sampled+=.02);
 try {
 const f=shaderRuntime(),first=new HeroLiveSmoke(f.scene),next=new HeroLiveSmoke(f.scene),cards=Array.from({length:8},(_,i)=>({id:'capacity/'+i,container:f.card('capacity/'+i,{x:70+i*130,y:400,width:72,height:100}),width:72,height:100}));
 first.sync('one',cards.slice(0,1),style,f.root,[],true);f.render();expect(f.programs[0].draws[0]['uLayers.value'].y).toBe(1);for(let time=0;time<3200;time+=16){first.step(16);f.render();}expect(f.images()[0].getData('smokeQuality')).toBe('high');expect(f.images()[0].getData('energyLayerCount')).toBe(3);
 expect(next.sync('seven',cards.slice(1),style,f.root,[],true).size).toBe(7);
 for(let time=3200;time<6500;time+=16){first.step(16);next.step(16);f.render();expect(f.images().reduce((n,i)=>n+i.getData('smokePixels'),0)).toBeLessThanOrEqual(HERO_SMOKE_TOTAL_PIXELS);expect(f.images().length).toBeLessThanOrEqual(8);}
 first.clear();next.clear();expect(f.textures.size).toBe(0);expect(f.images()).toHaveLength(0);expect(f.programs.every(p=>!p.active)).toBe(true);f.root.destroy();
 }finally{clock.mockRestore();}
});
it('stops on reduced/hidden/offscreen/destroy and latches a renderer failure instead of recompiling each frame',()=>{
 const f=shaderRuntime(390),smoke=new HeroLiveSmoke(f.scene),c=f.card('target',{x:150,y:400,width:72,height:100}),card={id:'target',container:c,width:72,height:100},sync=(active=true)=>smoke.sync('one',[card],style,f.root,[],active);
 sync();expect(f.textures.size).toBe(1);sync(false);expect(f.textures.size).toBe(0);sync();c.setPosition(-500,-500);smoke.step(16);expect(f.textures.size).toBe(0);c.setPosition(186,450);sync();f.root.setVisible(false);smoke.step(16);expect(f.textures.size).toBe(0);f.root.setVisible(true);sync();c.destroy();expect(f.textures.size).toBe(0);smoke.clear();
 const broken=new HeroLiveSmoke(f.scene),other={id:'broken',container:f.card('broken',{x:150,y:400,width:72,height:100}),width:72,height:100},attempts=(f.scene.add.shader as any).mock.calls.length;(f.scene.add.shader as any).mockImplementation(()=>{throw Error('compile failed');});for(let i=0;i<10;i++)broken.sync('broken',[other],style,f.root,[],true);expect((f.scene.add.shader as any).mock.calls.length-attempts).toBe(1);broken.clear();f.root.destroy();
});
it('finishes a real impact callback even if output becomes unavailable, and never finishes an aborted impact',()=>{
 const f=shaderRuntime(),smoke=new HeroLiveSmoke(f.scene),card={id:'impact',container:f.card('impact',{x:150,y:400,width:72,height:100}),width:72,height:100},abort=new AbortController(),done=vi.fn();
 expect(smoke.playImpact('impact',card,style,f.root,[],{generation:4,signal:abort.signal},done)).toBe(true);f.root.setVisible(false);for(let i=0;i<20;i++)smoke.step(16);expect(done).toHaveBeenCalledOnce();expect(f.textures.size).toBe(0);f.root.setVisible(true);expect(smoke.playImpact('aborted',card,style,f.root,[],{generation:4,signal:abort.signal},done)).toBe(true);abort.abort();smoke.step(16);expect(done).toHaveBeenCalledOnce();expect(f.textures.size).toBe(0);smoke.clear();f.root.destroy();
});
it('the actual Qin lost receipt extinguishes forks in the same update, without an impact flare or changed save',async()=>{
 const receipt=await currentHeroReceipt('touye',true),f=shaderRuntime(390),smoke=new HeroLiveSmoke(f.scene),ids=receipt.before.stage!.touyeWager!.commit!.refill!.refilledIds,cards=ids.map((id,i)=>({id,container:f.card(id,{x:90+i*100,y:400,width:72,height:100}),width:72,height:100})),wager=heroAtmosphereStyle({key:receipt.eventId,targetId:ids[0],releaseReason:'touye.'});
 try{expect(receipt.cue!.event.reasonKey).toMatch(/^touye\.lost\./);smoke.sync(receipt.eventId,cards,wager,f.root,[],true);f.render();expect(f.programs.filter(p=>p.active).every(p=>p.draws.at(-1)['uLayers.value'].w===1)).toBe(true);smoke.sync(receipt.eventId,cards,wager,f.root,[],true,0,true);f.render();expect(f.programs.filter(p=>p.active).every(p=>p.draws.at(-1)['uLayers.value'].w===0&&p.draws.at(-1)['uParams.value'].z===0)).toBe(true);expect(receipt.restore().state).toEqual(receipt.saved.state);}finally{smoke.clear();f.root.destroy();expect(f.textures.size).toBe(0);}
});
it.each([1280,390])('%i: selected Su intent prepares exactly3 real cards, moves/cancels safely, and cuts red on the still-live body',async width=>{
 const receipt=await currentHeroReceipt('amo'),f=shaderRuntime(width),ids=receipt.before.handOrder,boxes=layout({width,height:844},{top:0,right:0,bottom:0,left:0},width<600?'portrait':'desktop',{count:ids.length}).cards,cards=new Map(ids.map((id,i)=>[id,f.card(id,boxes[i].visual)])),bodies=new Map([...cards].map(([id,c])=>{const body=f.scene.add.container(0,0),printed=[...c.list];c.remove(printed);body.add(printed);c.add(body);c.setData('cardBodyRoot',body);return[id,body] as const;})),events:string[]=[],abort=new AbortController(),layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const c=cards.get(id);return c?{container:c,visual:bodies.get(id),width:Number(c.getData('width')),height:Number(c.getData('height'))}:undefined;},source:()=>({x:60,y:75}),motion:()=> 'full',blocked:()=>false,onPhase:e=>events.push(e.phase)}),prepared=ids.slice(-3),main=ids.filter(id=>!prepared.includes(id));
 try{layer.previewSushiDiscard(prepared);for(let time=0;time<3400;time+=16)f.frame(time);expect(new Set(f.images().map(i=>i.getData('targetCardId')))).toEqual(new Set(prepared));expect(main).toHaveLength(5);expect(f.images().every(i=>i.getData('energyStage')==='prepared')).toBe(true);expect(f.programs.filter(p=>p.active).every(p=>p.draws.at(-1)['uLayers.value'].w===.55&&p.draws.at(-1)['uGlow.value'].x>p.draws.at(-1)['uGlow.value'].z)).toBe(true);expect(events).toEqual([]);expect(layer.cutSushiDiscard(prepared[0],.5)).toBe(false);expect([...cards.values()].every(c=>c.active&&c.alpha===1)).toBe(true);
  layer.previewSushiDiscard(ids.slice(0,3));f.frame(3450);expect(new Set(f.images().map(i=>i.getData('targetCardId')))).toEqual(new Set(ids.slice(0,3)));layer.previewSushiDiscard([]);f.frame(3500);expect(f.textures.size).toBe(0);expect(f.root.list.some(o=>o.name.startsWith('hero/sushi-discard/'))).toBe(false);
  expect(layer.beginSushiDiscard(receipt.trace,{generation:17,signal:abort.signal})).toBe(true);
  let arrive!:()=>void;const arrival=new Promise<void>(resolve=>arrive=resolve);layer.presentSushiDiscard(receipt.trace,receipt.eventId,{generation:17,signal:abort.signal},arrival,10,20,{x:200,y:100});arrive();await Promise.resolve();
  const id=receipt.targetIds[0];expect(layer.cutSushiDiscard(id,.45)).toBe(true);for(let time=3550;time<4000;time+=16)f.frame(time);
  const holder=f.root.list.find(o=>o.name==='hero/sushi-discard/'+id) as Phaser.GameObjects.Container,ink=holder.list.find(o=>o.type==='Graphics') as Phaser.GameObjects.Graphics;
  expect(ink.commandBuffer).toContain(0xff5c38);expect(holder.getData('slashProgress')).toBe(.45);expect(f.programs.filter(p=>p.active&&p.getData('targetCardId')===id).at(-1).draws.at(-1)['uAppearance.value'].y).toBeCloseTo(.55);expect(cards.get(id)!.alpha).toBe(1);expect(layer.cutSushiDiscard(id,1)).toBe(true);expect(holder.active).toBe(false);expect(cards.get(id)!.active).toBe(true);expect(f.images().some(i=>i.getData('targetCardId')===id)).toBe(false);
  const other=receipt.targetIds[1];bodies.get(other)!.destroy();expect(cards.get(other)!.active).toBe(true);expect(f.images().some(i=>i.getData('targetCardId')===other)).toBe(false);expect(f.root.list.some(o=>o.name==='hero/sushi-discard/'+other)).toBe(false);expect(receipt.restore().state).toEqual(receipt.saved.state);
 }finally{abort.abort();layer.destroy();f.root.destroy();expect(f.textures.size).toBe(0);expect(f.programs.every(p=>!p.active)).toBe(true);}
});
const heroes=[['amo','amo.exile'],['erxiang','erxiang.handoff'],['azao','azao.multiply-multiplier'],['xiemu','xiemu.multiply-multiplier'],['touye','touye.'],['laohuan','laohuan.refill']] as const;
const geometries={amo:'paper-ember',erxiang:'paper-transfer',azao:'paper-five-petal',xiemu:'paper-flame',touye:'paper-lightning',laohuan:'paper-ink-leaf'};
it.each(heroes.flatMap(([hero,reason])=>[1280,390].map(width=>({hero,reason,width}))))('$hero/$width routes ALL actual saved targets through distinct layered uniforms for over3s and releases only on the real event',async({hero,reason,width})=>{
 const receipt=await currentHeroReceipt(hero),f=shaderRuntime(width),ids=[...new Set([...receipt.before.handOrder,...receipt.targetIds])],boxes=layout({width,height:844},{top:0,right:0,bottom:0,left:0},width<600?'portrait':'desktop',{count:ids.length}).cards,cards=new Map(ids.map((id,i)=>[id,f.card(id,boxes[i].visual)])),abort=new AbortController(),context={generation:17,signal:abort.signal},layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const c=cards.get(id);return c?{container:c,width:Number(c.getData('width')),height:Number(c.getData('height'))}:undefined;},source:()=>({x:60,y:75}),motion:()=> 'full',blocked:()=>false});
 const bodies=new Map([...cards].map(([id,c])=>{const body=(f.scene as any).add.container(3,-2).setAngle(6).setScale(.98,1.01).setName('card/body'),printed=[...c.list];c.remove(printed);body.add(printed);c.add(body);c.setData('cardBodyRoot',body);return[id,body] as const;}));
 let arrival!:()=>void;const arrived=new Promise<void>(resolve=>arrival=resolve);
 try{
  if(hero==='amo'){expect(layer.beginSushiDiscard(receipt.trace,context)).toBe(true);layer.presentSushiDiscard(receipt.trace,receipt.eventId,context,arrived,600,180,{x:600,y:150});}
  else if(hero==='laohuan')layer.preview({key:receipt.eventId,targetId:receipt.targetIds[0],targetIds:receipt.targetIds,sourceTargetIds:receipt.targetIds,kind:'candidate',label:'已留',releaseReason:reason,confirmed:true});
  else{const targets=hero==='touye'?receipt.before.stage!.touyeWager!.commit!.refill!.refilledIds:receipt.targetIds;layer.preview({key:receipt.before.runId+'/attachment',targetId:targets[0],targetIds:targets,...(hero==='azao'||hero==='xiemu'||hero==='erxiang'?{kind:'group' as const}:hero==='touye'?{kind:'wager' as const,confirmed:true}:{}),releaseReason:reason});if(receipt.cue!.targetIds)layer.retainTargets(receipt.cue!.targetIds);layer.commit(receipt.eventId,context);}
  const late=new Map(receipt.targetIds.map(id=>[id,0]));for(let time=0;time<3650;time+=16){if(hero==='amo'&&time===800){layer.cutSushiDiscard(receipt.targetIds[0],.8);}f.frame(time);const live=f.images();if(time===16)for(const image of live){const body=bodies.get(image.getData('targetCardId'))!;if(hero!=='amo')expect(image.parentContainer).toBe(body);else{const actual=image.parentContainer!.getWorldTransformMatrix().transformPoint(0,0),expected=body.getWorldTransformMatrix().transformPoint(0,0);expect(actual.x).toBeCloseTo(expected.x);expect(actual.y).toBeCloseTo(expected.y);}};expect(live.every(i=>receipt.targetIds.includes(i.getData('targetCardId')))).toBe(true);if(time>=3000)for(const image of live)late.set(image.getData('targetCardId'),late.get(image.getData('targetCardId'))!+1);}
  for(const [id,count]of late)expect(count,id).toBeGreaterThan(25);for(const id of receipt.targetIds){const snapshots=f.programs.filter(p=>p.getData('targetCardId')===id).flatMap(p=>p.draws).filter(u=>u['uParams.value']?.x>3);expect(snapshots.length,id).toBeGreaterThan(0);expect(new Set(snapshots.map(u=>u['uParams.value'].y)).size).toBeGreaterThan(5);if(hero==='erxiang')expect(snapshots.every(u=>u['uAppearance.value'].y>0&&u['uAppearance.value'].y<=.22)).toBe(true);expect(snapshots.every(u=>u['uLayers.value'].x>0&&u['uLayers.value'].y>=1&&u['uLayers.value'].y<=3&&u['uLayers.value'].w===(hero==='laohuan'?.55:1))).toBe(true);}expect(f.images().every(i=>i.flipY&&!i.input&&i.getData('energyGeometry')===geometries[hero])).toBe(true);
  if(hero==='amo'){for(const id of receipt.targetIds){layer.cutSushiDiscard(id,1);cards.get(id)!.destroy();}arrival();await Promise.resolve();}else if(hero==='laohuan'){const result=await receipt.saved.dispatch({type:'PlayHand',selectedIds:[receipt.targetIds[0]]});if(!result.ok)throw Error(result.code);const event=receipt.saved.state.lastTrace!.events.find(e=>retainedRefillImpact(e,receipt.targetIds))!;layer.impactRetainedCard(receipt.targetIds[0],event.eventId,context);}else layer.release(receipt.cue!.event,context);
  for(let time=3650;time<4200;time+=16)f.frame(time);expect(f.textures.size).toBe(0);expect(f.images()).toHaveLength(0);expect(receipt.restore().state).toEqual(receipt.saved.state);
 }finally{abort.abort();layer.destroy();f.root.destroy();expect(f.programs.every(p=>!p.active)).toBe(true);expect(f.textures.size).toBe(0);}
});

it.each([false,true])('nested smoke follows the actual body and excludes its own image from protection (explicit=%s)',explicit=>{
 const f=shaderRuntime(),c=f.card('target',{x:350,y:400,width:72,height:100}),other=f.card('normal',{x:460,y:400,width:72,height:100}),body=(f.scene as any).add.container(4,-3).setAngle(7),printed=[...c.list];c.remove(printed);body.add(printed);c.add(body);c.setData('cardBodyRoot',body);
 const card={container:c,...(explicit?{visual:body}:{}),width:72,height:100},layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='target'?card:undefined,source:()=>({x:60,y:75}),motion:()=> 'full',blocked:()=>false});
 try{layer.preview({key:'nested',targetId:'target',releaseReason:'erxiang.handoff'});layer.commit('nested',{generation:1,signal:new AbortController().signal});f.frame(0);f.frame(16);const image=f.images()[0];expect(image).toBeTruthy();expect(image.parentContainer).toBe(body);
  const before={x:c.x,y:c.y,rotation:c.rotation},patch=image.getData('materialPatch'),expected=body.getWorldTransformMatrix().transformPoint(patch.x+patch.width/2,patch.y+patch.height/2);const actual=image.getWorldTransformMatrix().transformPoint(0,0);expect(actual.x).toBeCloseTo(expected.x);expect(actual.y).toBeCloseTo(expected.y);
  const boxes=(layer as any).layout(f.root,new Set([c])).protectedBoxes,own=image.getBounds();expect(boxes.some((b:any)=>Math.abs(b.x-own.x)<.01&&Math.abs(b.y-own.y)<.01&&Math.abs(b.width-own.width)<.01)).toBe(false);expect(boxes.some((b:any)=>Math.abs(b.x-other.getBounds().x)<.01&&Math.abs(b.width-other.getBounds().width)<.01)).toBe(true);expect({x:c.x,y:c.y,rotation:c.rotation}).toEqual(before);
 }finally{layer.destroy();f.root.destroy();expect(f.textures.size).toBe(0);}
});

it('static shader interface uses matching explicit precision for its shared texture varying',()=>{
 const varying=(source:string)=>{const declaration=source.match(/varying\s+(lowp|mediump|highp)\s+vec2\s+outTexCoord\s*;/);expect(declaration,'explicit interface precision; this does not compile or link GL').not.toBeNull();return declaration?.[1];};
 expect(varying(HERO_SMOKE_VERTEX)).toBe(varying(HERO_SMOKE_FRAGMENT));
});
