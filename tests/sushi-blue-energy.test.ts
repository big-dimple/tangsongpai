import {afterEach,expect,it,vi} from 'vitest';
import {SushiKingEnergy,sushiKingInkSurface} from '../src/game/SushiKingEnergy';
import {SushiDiscardCardPresentation} from '../src/game/SushiDiscardCardPresentation';
import {bindSushiKingCharge} from '../src/game/SushiKingCharge';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {createRun,applyCommand,type Action,type R2RunState} from '../src/domain/run';
import {R2_AMO_EXILE_VERSION,R2_AMO_EXILE_HASH} from '../src/domain/r2GroupUpgrade';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';

afterEach(()=>vi.unstubAllGlobals());
it('draws the retained dashes immediately, reuses a bounded pool and adds no core in reduced motion',()=>{
 const f=nativeHeroRuntime(),g=f.scene.add.graphics(),energy=new SushiKingEnergy();
 energy.draw(g,72,100,0,false);const first=[...g.commandBuffer];expect(first).toContain(0x245653);expect(first).toContain(0x9b4939);expect(first).toContain(0xf7edd9);
 let peak=0;for(let i=0;i<400;i++){g.clear();energy.draw(g,72,100,i*50,false);peak=Math.max(peak,g.commandBuffer.length);}expect(peak).toBeLessThan(2600);expect(f.emitters).toHaveLength(0);
 g.clear();energy.draw(g,72,100,0,true);const still=[...g.commandBuffer];g.clear();energy.draw(g,72,100,8000,true);expect(g.commandBuffer).toEqual(still);expect(still).toHaveLength(0);
 g.clear();energy.draw(g,72,100,800,false,1);expect(g.commandBuffer).toHaveLength(0);g.destroy();f.root.destroy();
});
it('keeps every tapered nib on the exposed paper, clear of foreground faces and printed indices',()=>{
 const f=nativeHeroRuntime(),g=f.scene.add.graphics() as any,boxes=[{x:-9,y:-70,width:96,height:140},{x:-44,y:-62,width:22,height:65}],polygons:{x:number;y:number}[][]=[];
 const fill=g.fillPoints.bind(g);g.fillPoints=(points:any,...rest:any[])=>{polygons.push(points.map((p:any)=>({...p})));return fill(points,...rest);};
 const surface=sushiKingInkSurface(96,134,boxes)!;expect(surface.width).toBeGreaterThan(20);expect(surface.height).toBeGreaterThan(30);
 for(const clock of [0,260,840,1700]){polygons.length=0;new SushiKingEnergy().draw(g,96,134,clock,false,0,boxes);expect(polygons).toHaveLength(24);for(const polygon of polygons){expect(polygon).toHaveLength(18);for(const p of polygon){expect(p.x).toBeGreaterThanOrEqual(surface.x);expect(p.x).toBeLessThanOrEqual(surface.x+surface.width);expect(p.y).toBeGreaterThanOrEqual(surface.y);expect(p.y).toBeLessThanOrEqual(surface.y+surface.height);}}}
 expect(sushiKingInkSurface(96,134,[{x:-50,y:-70,width:100,height:140}])).toBeUndefined();g.destroy();f.root.destroy();
});
it('reduced preparation keeps one true hand multiplier across both cost kings without restoring a core',()=>{
 const f=nativeHeroRuntime(),cards=new Map(['cost-a','cost-b'].map((id,i)=>[id,{id,rank:13,container:f.card(id,{x:180+i*120,y:400,width:72,height:100}),width:72,height:100}])),layer=new SushiDiscardCardPresentation(f.scene,()=>f.root,id=>cards.get(id),()=>true);
 layer.prepareKings([...cards.keys()],3);layer.step(0,true);const holders=f.root.list.filter(o=>o.name.startsWith('hero/sushi-discard/')) as any[],badges=holders.flatMap(o=>o.list.filter((c:any)=>c.name==='hero/sushi-king-badge'));
 expect(holders).toHaveLength(2);expect(badges.map(b=>b.text)).toEqual(['本次得分 ×3']);expect(holders.every(o=>o.getData('motion')==='static'&&!o.list[0].commandBuffer.includes(0x245653))).toBe(true);layer.clear();f.root.destroy();
});
it('repeated exact-K preparation reuses its objects; cancellation cannot leave a blue pool on another K',()=>{
 const f=nativeHeroRuntime(),cards=new Map(['cost-K','main-K','eight'].map((id,i)=>[id,{id,container:f.card(id,{x:80+i*100,y:400,width:72,height:100}),width:72,height:100,rank:id==='eight'?8:13}])),layer=new SushiDiscardCardPresentation(f.scene,()=>f.root,id=>cards.get(id),()=>false);
 layer.prepareKings(['cost-K','eight'],3);layer.step(0,true);const holder=f.root.list.find(o=>o.name==='hero/sushi-discard/cost-K') as any,ink=holder.list[0];expect(ink.commandBuffer).toContain(0x245653);expect(f.root.list.some(o=>o.name==='hero/sushi-discard/main-K')).toBe(false);
 for(let i=0;i<80;i++){layer.prepareKings(['cost-K','eight'],3);layer.step(50,true);expect(f.root.list.find(o=>o.name===holder.name)).toBe(holder);expect(holder.list[0]).toBe(ink);expect(holder.list).toHaveLength(2);}
 layer.prepareKings([],3);expect(holder.active).toBe(false);expect(ink.active).toBe(false);layer.clear();f.root.destroy();
});
it('a replaced saved charge restores the original pose and releases its blue ink before the real K fracture',async()=>{
 const r=await currentHeroReceipt('amo'),f=nativeHeroRuntime(),container=f.card('spades-13',{x:100,y:400,width:72,height:100}),cards=[{id:'spades-13',container,width:72,height:100}],beat={windup:240,flight:180,impact:300,rest:80,strength:'multiply' as const},abort=new AbortController(),options={context:{generation:1,signal:abort.signal},beat},rest={x:container.x,y:container.y,sx:container.scaleX,sy:container.scaleY,angle:container.angle};
 const old=bindSushiKingCharge(f.scene,r.trace,r.eventId,cards,options)!;old.step(50);const oldInk=container.list.find(o=>o.name==='hero/sushi-king-charge')!;
 const job=bindSushiKingCharge(f.scene,r.trace,r.eventId,cards,options)!;expect(oldInk.active).toBe(false);expect(container.list.filter(o=>o.name==='hero/sushi-king-charge')).toHaveLength(1);job.step(100);old.dispose();expect(container.scaleY).not.toBe(rest.sy);
 job.step(beat.windup*.62);expect(container.list.some(o=>o.name==='hero/sushi-king-charge')).toBe(false);expect(container.active).toBe(true);expect(container.alpha).toBe(1);expect({x:container.x,y:container.y,sx:container.scaleX,sy:container.scaleY,angle:container.angle}).toEqual(rest);abort.abort();job.step(0);f.root.destroy();
});
it.each(['hidden','blur','shutdown','destroy'])('%s removes the saved blue charge and detaches every lifecycle listener',async end=>{
 const r=await currentHeroReceipt('amo'),f=nativeHeroRuntime(),container=f.card('spades-13',{x:100,y:400,width:72,height:100}),listeners=new Map<string,()=>void>();
 const add=(name:string,fn:()=>void)=>listeners.set(name,fn),remove=(name:string,fn:()=>void)=>{if(listeners.get(name)===fn)listeners.delete(name);};
 vi.stubGlobal('document',{hidden:false,addEventListener:add,removeEventListener:remove});vi.stubGlobal('window',{addEventListener:add,removeEventListener:remove});
 const abort=new AbortController(),job=bindSushiKingCharge(f.scene,r.trace,r.eventId,[{id:'spades-13',container,width:72,height:100}],{context:{generation:1,signal:abort.signal},beat:{windup:240,flight:180,impact:300,rest:80,strength:'multiply'}})!;
 job.step(50);const ink=container.list.find(o=>o.name==='hero/sushi-king-charge')!;
 if(end==='hidden'){Object.defineProperty(document,'hidden',{value:true});listeners.get('visibilitychange')!();}else if(end==='blur')listeners.get('blur')!();else if(end==='shutdown')f.scene.events.emit('shutdown');else container.destroy();
 expect(ink.active).toBe(false);expect(listeners.size).toBe(0);if(end!=='destroy'){expect(container.active).toBe(true);expect(container.scaleX).toBe(1);expect(container.alpha).toBe(1);}job.step(0);abort.abort();f.root.destroy();
});
it.each(['3','4'])('the prepared exact faces persist through saved factor %s and hand off without a second overlay or early source destruction',async factor=>{
 const r=await currentHeroReceipt('amo'),f=nativeHeroRuntime();let trace=r.trace;
 if(factor==='4'){
  let state=createRun({seed:'sushi-blue-legacy',runId:'sushi-blue/legacy',characterId:'amo',rulesVersion:'r2',openingRoute:'group',r2Identity:{contentVersion:R2_AMO_EXILE_VERSION,contentHash:R2_AMO_EXILE_HASH},modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
  const send=(action:Action)=>{const result=applyCommand(state,{runId:state.runId,commandId:state.runId+'/'+state.commandSeq,expectedSeq:state.commandSeq,action});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.code);state=result.state as R2RunState;};
  send({type:'LeaveShop'});send({type:'EnterStage'});state.handOrder=[...r.before.handOrder];state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!state.handOrder.includes(id));expect(readCheckpoint(makeCheckpoint(state,[])).ok).toBe(true);send({type:'PlayHand',selectedIds:['spades-8','hearts-8'],amoExile:true});trace=state.lastTrace!;expect(trace.finalScore).toBe('408');
 }
 const eventId=trace.events.find(e=>e.reasonKey==='amo.exile')!.eventId;expect(trace.events.find(e=>e.eventId===eventId)!.value).toEqual({n:factor,d:'1'});
 const cards=new Map(trace.cards.map((c,i)=>[c.id,{id:c.id,rank:c.rank,container:f.card(c.id,{x:80+i*90,y:400,width:72,height:100}),width:72,height:100}])),layer=new SushiDiscardCardPresentation(f.scene,()=>f.root,id=>cards.get(id),()=>false),abort=new AbortController(),context={generation:1,signal:abort.signal};
 layer.prepareKings(trace.amoExile!.discardedIds,3);layer.step(0,true);const holders=f.root.list.filter(o=>o.name.startsWith('hero/sushi-discard/'));expect(holders).toHaveLength(2);
 expect(layer.bindSaved(trace,context)).toBe(true);layer.step(50,true);expect(f.root.list.filter(o=>o.name.startsWith('hero/sushi-discard/'))).toEqual(holders);expect(holders.flatMap((o:any)=>o.list).filter((o:any)=>o.name==='hero/sushi-king-badge').map((o:any)=>o.text)).toEqual(['本次得分 ×'+factor]);expect(f.root.list.some(o=>o.name==='hero/live-smoke')).toBe(false);
 const charge=bindSushiKingCharge(f.scene,trace,eventId,[...cards.values()],{context,beat:{windup:240,flight:180,impact:300,rest:80,strength:'multiply'}})!;
 expect(holders.every(o=>!o.active)).toBe(true);for(const id of charge.ids){expect(cards.get(id)!.container.active).toBe(true);expect(cards.get(id)!.container.alpha).toBe(1);}abort.abort();expect([...cards.values()].every(c=>c.container.active)).toBe(true);layer.clear();f.root.destroy();
});
