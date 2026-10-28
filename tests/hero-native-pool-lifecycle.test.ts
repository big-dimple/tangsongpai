import {afterEach,expect,it,vi} from 'vitest';
import {HeroSkillParticles} from '../src/game/HeroSkillParticles';
import {heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {nativeHeroRuntime,nativeLiving,nativeNontransparent,nativeMaterials} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import type {HeroAttachmentPhaseEvent} from '../src/game/HeroAttachmentPhases';
import type {CharacterId} from '../src/domain/characters';
import type Phaser from 'phaser';
import {layout} from '../src/game/layout';
import {retainedRefillImpact} from '../src/game/HeroAttachmentFacts';

afterEach(()=>vi.unstubAllGlobals());
const heroes=[['amo','amo.exile'],['erxiang','erxiang.handoff'],['azao','azao.multiply-multiplier'],['xiemu','xiemu.multiply-multiplier'],['touye','touye.'],['laohuan','laohuan.refill']] as const;
it.each(heroes)('%s keeps its own native recipe emitting after the pool has filled and reused for over3s',(_hero,reason)=>{
 const f=nativeHeroRuntime(),c=f.card('pool-only/target',{x:360,y:360,width:72,height:100}),p=new HeroSkillParticles(f.scene),style=heroAtmosphereStyle({key:'pool-only',targetId:'pool-only/target',releaseReason:reason});
 p.sync('pool-only',[{id:'pool-only/target',container:c,width:72,height:100}],style,f.root,[],true,true,reason==='laohuan.refill'?{phase:'retained',igniteIds:[]}:undefined);
 try{let lateSamples=0;for(let time=0;time<3800;time+=16){f.step(time);const live=f.emitters.filter(e=>e.active);expect(live.reduce((n,e)=>n+e.getParticleCount(),0)).toBeLessThanOrEqual(reason==='laohuan.refill'?9:16);for(const e of live)expect(e.getParticleCount()).toBeLessThanOrEqual(e.maxAliveParticles);if(time>=3000&&live.some(e=>nativeLiving(e).some(nativeNontransparent)))lateSamples++;}expect(lateSamples).toBeGreaterThan(40);if(reason!=='laohuan.refill')expect(f.emitters.find(e=>e.name==='hero/native-fire')!.active).toBe(false);
 }finally{p.clear();c.destroy();f.step(3900);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it.each(heroes)('%s bounds eight target pools, suspends/resumes without ignition and releases the shared128 reservation',(hero,reason)=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),p=new HeroSkillParticles(f.scene),boxes=layout({width:390,height:844},{top:0,right:0,bottom:0,left:0},'portrait',{count:8}).cards,cards=boxes.map((box,i)=>({id:'capacity-only/'+i,container:f.card('capacity-only/'+i,box.visual),width:box.visual.width,height:box.visual.height})),style=heroAtmosphereStyle({key:'capacity-only',targetId:cards[0].id,releaseReason:reason}),appearance=hero==='laohuan'?{phase:'retained' as const,igniteIds:[]}:undefined;
 const sync=(active=true,ignite=true)=>p.sync('capacity-only',cards,style,f.root,[],active,ignite,appearance);
 try{sync();let lastWindow=0;for(let time=0;time<3800;time+=16){f.step(time);const active=f.emitters.filter(e=>e.active);expect(active.reduce((n,e)=>n+e.getParticleCount(),0)).toBeLessThanOrEqual(hero==='laohuan'?72:128);for(const e of active)expect(e.getParticleCount()).toBeLessThanOrEqual(e.maxAliveParticles);if(time>3000&&active.some(e=>nativeLiving(e).some(nativeNontransparent)))lastWindow++;}expect(lastWindow).toBeGreaterThan(40);sync(false);expect(f.emitters.every(e=>!e.active)).toBe(true);sync(true,false);expect(f.emitters.filter(e=>e.active).every(e=>e.getData('ignition')===false)).toBe(true);f.root.setVisible(false);sync();expect(f.emitters.every(e=>!e.active)).toBe(true);f.root.setVisible(true);sync();expect(f.emitters.filter(e=>e.active).every(e=>e.getData('ignition')===false)).toBe(true);p.clear();
  const next=new HeroSkillParticles(f.scene);next.sync('reservation-reuse',cards,heroAtmosphereStyle({key:'reuse',targetId:cards[0].id,releaseReason:'erxiang.handoff'}),f.root,[],true);expect(f.emitters.filter(e=>e.active)).toHaveLength(16);next.clear();
 }finally{p.clear();f.root.destroy();f.step(3900);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
async function receiptRuntime(hero:CharacterId,width:number,lose=false,cancelAt?:'committed'|'source'|'impact'){
 const receipt=await currentHeroReceipt(hero,lose),f=nativeHeroRuntime({width,height:844,density:width<600?2:1,renderer:2}),ids=[...new Set([...receipt.before.handOrder,...receipt.targetIds])],boxes=layout({width,height:844},{top:0,right:0,bottom:0,left:0},width<600?'portrait':'desktop',{count:ids.length}).cards,cards=new Map<string,Phaser.GameObjects.Container>(),events:HeroAttachmentPhaseEvent[]=[],abort=new AbortController(),context={generation:17,signal:abort.signal};let motion:'full'|'reduced'='full';
 ids.forEach((id,i)=>cards.set(id,f.card(id,boxes[i].visual)));const layer:HeroTargetAttachment=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>({x:60,y:75}),motion:()=>motion,blocked:()=>false,onPhase:event=>{events.push(event);if(event.phase===cancelAt)layer.clear('phase-cancelled');}}),reason=heroes.find(row=>row[0]===hero)![1];
 if(hero==='amo'){layer.previewSushiDiscard(receipt.targetIds);expect(f.emitters.filter(e=>e.active).every(e=>receipt.targetIds.includes(e.getData('targetCardId')))).toBe(true);expect(events).toHaveLength(0);expect(layer.beginSushiDiscard(receipt.trace,context)).toBe(true);}
 else if(hero==='laohuan')layer.preview({key:receipt.eventId,targetId:receipt.targetIds[0],targetIds:receipt.targetIds,sourceTargetIds:receipt.targetIds,kind:'candidate',label:'已留',releaseReason:reason,confirmed:true});
 else {const targets=hero==='touye'?receipt.before.stage!.touyeWager!.commit!.refill!.refilledIds:receipt.targetIds;layer.preview({key:receipt.before.runId+'/attachment',targetId:targets[0],targetIds:targets,...(hero==='azao'||hero==='xiemu'||hero==='erxiang'?{kind:'group' as const}:hero==='touye'?{kind:'wager' as const,confirmed:true}:{}),releaseReason:reason});if(hero!=='touye'){expect(f.emitters).toHaveLength(0);expect(events).toHaveLength(0);}if(receipt.cue!.targetIds)layer.retainTargets(receipt.cue!.targetIds);layer.commit(receipt.cue!.event.eventId,context);}
 let arrival!:()=>void;const arrived=new Promise<void>(resolve=>arrival=resolve);if(hero==='amo')layer.presentSushiDiscard(receipt.trace,receipt.eventId,context,arrived,600,180,{x:width*.6,y:150});
 return{...f,...receipt,cards,events,abort,context,layer,arrival,setMotion:(value:'full'|'reduced')=>{motion=value;}};
}
it.each(heroes)('%s binds the real saved instances, persists over3s and keeps local Graphics until its actual arrival',async(hero)=>{
 const f=await receiptRuntime(hero,1180),lateSamples=new Map(f.targetIds.map(id=>[id,0]));
 try{for(let time=0;time<3600;time+=16){if(hero==='amo'&&time===800){const id=f.targetIds[0];expect(f.layer.cutSushiDiscard(id,.8)).toBe(true);}f.step(time);const active=nativeMaterials(f.root);expect(active.every(e=>f.targetIds.includes(e.getData('targetCardId')))).toBe(true);if(time>3000){for(const id of f.targetIds)if(active.some(e=>e.getData('targetCardId')===id&&e.commandBuffer.length>0))lateSamples.set(id,lateSamples.get(id)!+1);}}
  for(const [id,count]of lateSamples)expect(count,id).toBeGreaterThan(30);if(hero!=='laohuan'){const committed=f.events.filter(e=>e.phase==='committed');expect(committed).toHaveLength(1);expect(committed[0].targetIds).toEqual(f.targetIds);expect(committed[0].eventId).toBe(f.eventId);expect(committed[0].context?.generation).toBe(17);}expect(f.events.some(e=>e.phase==='impact')).toBe(false);
  if(hero==='amo'){for(const id of f.targetIds){f.layer.cutSushiDiscard(id,1);f.cards.get(id)!.destroy();}f.arrival();await Promise.resolve();}
  else if(hero==='laohuan'){const played=await f.saved.dispatch({type:'PlayHand',selectedIds:[f.targetIds[0]]});if(!played.ok)throw Error(played.code);const event=f.saved.state.lastTrace!.events.find(e=>retainedRefillImpact(e,f.targetIds))!;f.layer.impactRetainedCard(f.targetIds[0],event.eventId,f.context);}
  else{f.layer.release({...f.cue!.event,eventId:'not-saved'},f.context);expect(f.events.some(e=>e.phase==='impact')).toBe(false);f.layer.release(f.cue!.event,f.context);}
  for(let time=3600;time<4100;time+=16)f.step(time);expect(f.emitters.every(e=>!e.active)).toBe(true);expect(f.events.filter(e=>e.phase==='impact')).toHaveLength(1);expect(f.events.some(e=>e.phase==='settled')).toBe(true);expect(f.events.some(e=>e.phase==='cancelled')).toBe(false);expect(f.restore().state).toEqual(f.saved.state);
 }finally{f.abort.abort();f.layer.destroy();f.root.destroy();f.step(4200);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it.each(['committed','source'] as const)('a %s observer can cancel without the same update creating a late pool or flight',async phase=>{
 const f=await receiptRuntime('erxiang',390,false,phase);
 try{expect(f.emitters.every(e=>!e.active)).toBe(true);expect(f.root.list.some(o=>o.name==='hero/target-travel')).toBe(false);const count=f.events.length;for(let time=0;time<400;time+=16)f.step(time);expect(f.events).toHaveLength(count);expect(f.events.filter(e=>e.phase==='cancelled')).toHaveLength(1);expect(f.events.some(e=>e.phase==='attached'||e.phase==='impact')).toBe(false);if(phase==='committed')expect(f.emitters).toHaveLength(0);
 }finally{f.abort.abort();f.layer.destroy();f.root.destroy();f.step(450);}
});
it('a retained-impact observer can cancel before native burst birth without a late settled callback',async()=>{
 const f=await receiptRuntime('laohuan',390,false,'impact');
 try{f.step(16);const count=f.emitters.length,played=await f.saved.dispatch({type:'PlayHand',selectedIds:[f.targetIds[0]]});if(!played.ok)throw Error(played.code);const event=f.saved.state.lastTrace!.events.find(e=>retainedRefillImpact(e,f.targetIds))!;f.layer.impactRetainedCard(f.targetIds[0],event.eventId,f.context);expect(f.emitters).toHaveLength(count);expect(f.emitters.every(e=>!e.active)).toBe(true);for(let time=32;time<500;time+=16)f.step(time);expect(f.events.filter(e=>e.owner==='retained-impact').map(e=>e.phase)).toEqual(['impact','cancelled']);
 }finally{f.abort.abort();f.layer.destroy();f.root.destroy();f.step(550);}
});
it.each(heroes)('%s cancels the real saved ownership on phone without late arrival or a revived pool',async(hero)=>{
 const f=await receiptRuntime(hero,390);
 try{const visible=new Map(f.targetIds.map(id=>[id,0]));for(let time=0;time<3600;time+=16){f.step(time);if(time>3000)for(const id of f.targetIds)if(nativeMaterials(f.root).some(e=>e.getData('targetCardId')===id&&e.commandBuffer.length>0))visible.set(id,visible.get(id)!+1);}for(const [id,count]of visible)expect(count,id).toBeGreaterThan(30);f.abort.abort();if(hero==='laohuan')f.layer.clear('presentation-cancelled');f.step(3650,50);expect(f.emitters.every(e=>!e.active)).toBe(true);const count=f.events.length;f.arrival();await Promise.resolve();for(let time=3700;time<4200;time+=16)f.step(time);expect(f.events).toHaveLength(count);expect(f.events.some(e=>e.phase==='cancelled')).toBe(true);expect(f.events.some(e=>e.phase==='impact'||e.phase==='settled')).toBe(false);
 }finally{f.layer.destroy();f.root.destroy();f.step(4300);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it('Qin losing receipt keeps only the real pending new IDs and publishes the actual lost reason at impact',async()=>{
 const f=await receiptRuntime('touye',1180,true);
 try{expect(f.targetIds).toEqual([]);const pending=f.before.stage!.touyeWager!.commit!.refill!.refilledIds;expect(f.events.find(e=>e.phase==='committed')!.targetIds).toEqual(pending);expect(f.cue!.event.reasonKey).toMatch(/^touye\.lost\./);f.layer.release(f.cue!.event,f.context);expect(f.events.find(e=>e.phase==='impact')).toMatchObject({eventId:f.eventId,reasonKey:f.cue!.event.reasonKey,targetIds:pending});for(let time=0;time<400;time+=16)f.step(time);expect(f.emitters.every(e=>!e.active)).toBe(true);
 }finally{f.abort.abort();f.layer.destroy();f.root.destroy();f.step(450);}
});
it('early reduced/hidden returns report availability without replaying source, fire or successful commit',async()=>{
 const f=await receiptRuntime('erxiang',390);
 try{f.step(16);expect(f.events.map(e=>e.phase)).toEqual(['committed','source','attached']);expect(Object.isFrozen(f.events[0])).toBe(true);expect(Object.isFrozen(f.events[0].targetIds)).toBe(true);f.setMotion('reduced');f.step(66,50);expect(f.emitters.every(e=>!e.active)).toBe(true);f.setMotion('full');f.step(116,50);expect(f.emitters.filter(e=>e.active).every(e=>e.name==='hero/native-edge'&&e.getData('ignition')===false)).toBe(true);expect(f.root.list.some(o=>o.name==='hero/target-travel')).toBe(false);Object.assign(document,{hidden:true});f.step(132);f.step(148);expect(f.events.filter(e=>e.phase==='suspended')).toHaveLength(2);Object.assign(document,{hidden:false});f.step(198,50);expect(f.events.filter(e=>e.phase==='resumed')).toHaveLength(2);expect(f.events.filter(e=>e.phase==='source'||e.phase==='committed'||e.phase==='attached')).toHaveLength(3);expect(f.root.list.some(o=>o.name==='hero/target-travel')).toBe(false);f.layer.release(f.cue!.event,f.context);for(let time=200;time<600;time+=16)f.step(time);expect(f.events.filter(e=>e.phase==='impact')).toHaveLength(1);expect(f.events.filter(e=>e.phase==='settled')).toHaveLength(1);expect(f.events.some(e=>e.phase==='cancelled')).toBe(false);
 }finally{f.abort.abort();f.layer.destroy();f.root.destroy();f.step(650);}
});
