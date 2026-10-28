import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import {createRun} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2WithHouseJoker,R2_HERO_FREQUENCY_VERSION,R2_HERO_FREQUENCY_HASH} from '../src/domain/r2GroupUpgrade';
import {withBossSuitRescueIdentity} from '../src/domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../src/domain/r2PokerEncounter';
import {savedXinRefillLock} from '../src/game/XinRefillLock';
import {savedHeroAttachment,retainedRefillImpact} from '../src/game/HeroAttachmentFacts';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {layout} from '../src/game/layout';
import {nativeHeroRuntime,nativeMaterials} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());
async function savedFixture(hero:'laohuan'|'erxiang',legacy=false){
 let slots:SaveSlots={revision:0,current:null,previous:null},fail=false;
 const store:SaveStore={read:async()=>slots,commit:async(revision,current,previous)=>{if(fail){fail=false;throw Error('save-failed');}slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return slots.revision;}},saved=await SavedRun.start(store,createRun({rulesVersion:'r2',seed:'formal-energy/'+hero,runId:'formal/'+hero,characterId:hero,r2Identity:legacy?withPokerEncounterIdentity(withBossSuitRescueIdentity(r2WithHouseJoker({contentVersion:R2_HERO_FREQUENCY_VERSION,contentHash:R2_HERO_FREQUENCY_HASH}))):newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}}),slots);
 for(const action of [{type:'LeaveShop'},{type:'EnterStage'}] as const)expect((await saved.dispatch(action)).ok).toBe(true);
 return{saved,failNext:()=>{fail=true;},restore:()=>SavedRun.restore(store,slots)};
}
const specs=[{width:1180,height:757,density:1,renderer:2},{width:390,height:844,density:2,renderer:2},{width:1180,height:757,density:1,renderer:1},{width:390,height:844,density:2,renderer:1}];
it.each(specs)('saved Xin receipt mounts the complete candidate/selection/retained/cleanup sample at $width/$renderer',async spec=>{
 const {saved,restore}=await savedFixture('laohuan'),f=nativeHeroRuntime(spec),cards=new Map<string,Phaser.GameObjects.Container>(),sources:string[][]=[];let motion:'full'|'reduced'='full',time=0;
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>({x:spec.width<600?70:60,y:spec.width<600?54:100}),motion:()=>motion,blocked:()=>false,onPhase:e=>{if(e.phase==='source')sources.push([...e.sourceTargetIds]);}});
 const mount=(ids:readonly string[])=>{for(const c of cards.values())c.destroy();cards.clear();const l=layout({width:spec.width,height:spec.height},{top:0,right:0,bottom:0,left:0},spec.width<600?'portrait':'desktop',{count:ids.length});for(const [i,id]of ids.entries())cards.set(id,f.card(id,l.cards[i].visual));};
 const observe=(ids:readonly string[])=>{
  const samples=new Map(ids.map(id=>[id,new Set<string>()]));
  for(let elapsed=0;elapsed<3520;elapsed+=16){f.step(time+=16);for(const id of ids){
   const active=nativeMaterials(f.root).filter(g=>g.getData('targetCardId')===id);expect(active,id).toHaveLength(1);expect(active[0].commandBuffer.length).toBeGreaterThan(50);expect(active[0].commandBuffer.length).toBeLessThan(2000);if(elapsed>3000)samples.get(id)!.add(JSON.stringify(active[0].commandBuffer));
  }}
  for(const id of ids)expect(samples.get(id)!.size,id+' has no ongoing local material').toBeGreaterThan(3);expect(f.emitters).toHaveLength(0);
 };
 const owned:string[]=[];
 try{
  for(let round=0;round<2;round++){
   const before=saved.state,discard=before.handOrder.find(id=>!owned.includes(id))!,result=await saved.dispatch({type:'DiscardHand',selectedIds:[discard]});if(!result.ok)throw Error(result.code);const cue=savedXinRefillLock(before,result)!;expect(cue.eventId).toBe(result.receipt.commandId+'/xin-refill-lock');const pending=saved.state.pendingRefill!;expect(pending.candidateIds).toHaveLength(3);mount(pending.candidateIds);
   const draft={key:pending.discardCommandId+'/candidates',targetId:pending.candidateIds[0],targetIds:pending.candidateIds,selectedIds:[] as string[],kind:'candidate' as const,label:'候选',releaseReason:'laohuan.refill',confirmed:true,suppressSource:true,ignite:true};layer.preview(draft);observe(pending.candidateIds);
   const id=pending.candidateIds[1],count=nativeMaterials(f.root).length;cards.get(id)!.y-=16;layer.preview({...draft,selectedIds:[id]});observe(pending.candidateIds);expect(nativeMaterials(f.root)).toHaveLength(count);expect((cards.get(id)!.list.find(o=>o.name==='hero/target-tag') as Phaser.GameObjects.Text).text).toBe('待留');for(const other of pending.candidateIds.filter(card=>card!==id))expect((cards.get(other)!.list.find(o=>o.name==='hero/target-tag') as Phaser.GameObjects.Text).text).toBe('候选');
   const beforeChoice=saved.state,choice=await saved.dispatch({type:'ChooseRefill',selectedIds:[id]});if(!choice.ok)throw Error(choice.code);const fresh=saved.state.handOrder.filter(card=>!beforeChoice.handOrder.includes(card));expect(fresh).toEqual([id]);owned.push(id);mount(saved.state.handOrder);const eventId=choice.receipt.commandId+'/laohuan-refill';layer.preview({key:eventId,targetId:owned[0],targetIds:owned,sourceTargetIds:fresh,kind:'candidate',label:'已留',releaseReason:'laohuan.refill',confirmed:true});observe(owned);expect(sources).toHaveLength(round+1);expect(sources.at(-1)).toEqual(fresh);
   expect(new Set(nativeMaterials(f.root).map(g=>g.getData('targetCardId')))).toEqual(new Set(owned));for(const [card,view]of cards)if(!owned.includes(card))expect(nativeMaterials(view)).toHaveLength(0);expect(restore().state).toEqual(saved.state);
  }
  const id=owned[0],play=await saved.dispatch({type:'PlayHand',selectedIds:[id]});if(!play.ok)throw Error(play.code);const event=saved.state.lastTrace!.events.find(event=>retainedRefillImpact(event,owned)===id)!;expect(event).toBeDefined();cards.get(id)!.setPosition(spec.width*.65,spec.height*.5).setScale(.86).setAngle(-4);
  const abort=new AbortController();layer.impactRetainedCard(id,event.eventId,{generation:1,signal:abort.signal});expect(f.emitters.filter(e=>e.active&&e.getData('targetCardId')===id).reduce((n,e)=>n+e.getParticleCount(),0)).toBeLessThanOrEqual(9);for(let i=0;i<20;i++)f.step(time+=16);expect(f.emitters.filter(e=>e.active&&e.getData('targetCardId')===id)).toHaveLength(0);abort.abort();motion='reduced';f.step(time+=50,50);expect(f.emitters.filter(e=>e.active)).toHaveLength(0);motion='full';f.step(time+=50,50);expect(f.emitters.filter(e=>e.active).every(e=>e.getData('ignition')===false)).toBe(true);Object.assign(document,{hidden:true});f.step(time+=16);expect(f.emitters.filter(e=>e.active)).toHaveLength(0);Object.assign(document,{hidden:false});f.step(time+=50,50);expect(f.emitters.filter(e=>e.active).every(e=>e.getData('ignition')===false)).toBe(true);
 }finally{layer.destroy();f.root.destroy();f.step(time+16);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
it.each(specs.filter(s=>s.renderer===2))('transformed eight-target local material capacity stays bounded and clears at $width',spec=>{
 const f=nativeHeroRuntime(spec),l=layout({width:spec.width,height:spec.height},{top:0,right:0,bottom:0,left:0},spec.width<600?'portrait':'desktop',{count:8}),cards=new Map<string,Phaser.GameObjects.Container>();f.root.setPosition(8,4).setScale(.94).setAngle(.5);for(let i=0;i<8;i++){const id='capacity-only/'+i,c=f.card(id,l.cards[i].visual).setAngle(i%2?2:-2);cards.set(id,c);}
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>undefined,motion:()=> 'full',blocked:()=>false}),ids=[...cards.keys()];layer.preview({key:'synthetic-capacity-contract',targetId:ids[0],targetIds:ids,sourceTargetIds:[],kind:'candidate',label:'已留',releaseReason:'laohuan.refill',confirmed:true});
 try{for(let time=0;time<4200;time+=16){f.step(time);const live=nativeMaterials(f.root);expect(live).toHaveLength(8);expect(live.reduce((sum,g)=>sum+g.commandBuffer.length,0)).toBeLessThan(16000);}expect(f.emitters).toHaveLength(0);f.root.setVisible(false);f.step(4250,50);expect(nativeMaterials(f.root)).toHaveLength(0);}finally{layer.destroy();f.root.destroy();f.step(4300,50);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});

it('Liu legacy single-target contract uses only a saved ordinary-points transfer',async()=>{
 const {saved,failNext,restore}=await savedFixture('erxiang',true),f=nativeHeroRuntime(),cards=new Map<string,Phaser.GameObjects.Container>(),before=saved.state,l=layout({width:1280,height:720},{top:0,right:0,bottom:0,left:0},'desktop',{count:before.handOrder.length});for(const [i,id]of before.handOrder.entries())cards.set(id,f.card(id,l.cards[i].visual));
 const pair=before.handOrder.map(id=>before.deckInstances.find(c=>c.id===id)!).map(c=>before.handOrder.filter(id=>before.deckInstances.find(p=>p.id===id)!.rank===c.rank)).find(ids=>ids.length>=2)!.slice(0,2),id=pair[0],layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:target=>{const container=cards.get(target);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>({x:60,y:100}),motion:()=> 'full',blocked:()=>false}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 try{
  layer.preview({key:'Liu/single/'+before.commandSeq,targetId:id});f.step(16);expect(f.emitters).toHaveLength(0);failNext();
  const failed=await saved.dispatch({type:'PlayHand',selectedIds:pair,erxiangTargetId:id});expect(failed).toMatchObject({ok:false,code:'save-failed'});expect(saved.state).toEqual(before);expect(f.emitters).toHaveLength(0);
  const result=await saved.retry();if(!result.ok)throw Error(result.code);const cue=savedHeroAttachment(saved.state.lastTrace!,'erxiang')!;expect(cue.targetIds).toEqual([id]);expect(cue.event.operation).toBe('add-multiplier');expect(saved.state.lastTrace!.events.filter(e=>e.reasonKey==='erxiang.handoff')).toHaveLength(1);expect(saved.state.stage!.erxiangHandoffUses).toBe(1);
  layer.retainTargets(cue.targetIds!);layer.commit(cue.event.eventId,context);for(let t=32;t<400;t+=16)f.step(t);expect(new Set(nativeMaterials(f.root).map(g=>g.getData('targetCardId')))).toEqual(new Set([id]));const material=nativeMaterials(f.root)[0];expect(material.getData('energyStage')).toBe('committed');layer.commit(cue.event.eventId,context);expect(nativeMaterials(f.root)[0]).toBe(material);
  layer.release({...cue.event,targetCardId:'not/saved'},context);expect(cards.get(id)!.list.find(o=>o.name==='hero/target-edge')!.getData('phase')).toBe('committed');layer.release(cue.event,context);for(let t=400;t<800;t+=16)f.step(t);expect(f.emitters.every(e=>!e.active)).toBe(true);expect(restore().state).toEqual(saved.state);
 }finally{abort.abort();layer.destroy();f.root.destroy();f.step(900);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);}
});
