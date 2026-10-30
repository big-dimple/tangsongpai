import {afterEach,expect,it,vi} from 'vitest';
import {mountSushiSkillPayoff,SUSHI_PAYOFF_GOLD} from '../src/game/SushiSkillPayoff';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {sushiSkillLocationFixture} from '../harness/fixtures/sushi-skill-location';
import {applyCommand,createRun,type Action,type R2RunState} from '../src/domain/run';
import {R2_AMO_EXILE_VERSION,R2_AMO_EXILE_HASH} from '../src/domain/r2GroupUpgrade';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
afterEach(()=>vi.unstubAllGlobals());
function setup(){
 const f=nativeHeroRuntime(),original=f.scene.add.text.bind(f.scene.add),draw=vi.fn(),remove=vi.fn();
 f.scene.add.text=((x:number,y:number,value:string)=>{const t=original(x,y,value) as any;t.style={color:'#123456'};t.setAlpha=(a:number)=>{t.alpha=a;return t;};t.setColor=(c:string)=>{t.style.color=c;return t;};return t;}) as any;
 (f.scene.textures as any).addDynamicTexture=vi.fn(()=>({draw}));(f.scene.textures as any).remove=remove;
 const label=f.scene.add.text(100,80,'余音袅袅'),status=f.scene.add.text(100,100,'计分中'),button=new f.Zone(f.scene,100,80,100,48).setData('label',label).setData('skillStatus',status);f.root.add([button,label,status]);
 return{...f,label:label as any,status:status as any,button:button as any,draw,remove};
}
const beat={windup:240,flight:180,impact:300,rest:80,strength:'multiply' as const};
it.each(['3','4'])('real cost kings fracture, one intact factor %s lands in the skill control, then resets',async factor=>{
 const r=await currentHeroReceipt('amo'),trace=structuredClone(r.trace),event=trace.events.find(e=>e.eventId===r.eventId)!;event.value={n:factor,d:'1'};
 const f=setup(),cards=r.before.handOrder.map((id,i)=>({id,container:f.card(id,{x:20+i*78,y:420,width:72,height:100})})),raw=JSON.stringify(trace),release=vi.fn(),job=mountSushiSkillPayoff(f.scene,f.button,trace,r.eventId,{context:{generation:1,signal:new AbortController().signal},beat,reduced:false,root:f.root,cards,releaseKings:release})!;
 job.step(100);expect(f.draw).not.toHaveBeenCalled();job.step(200);expect(release).toHaveBeenCalledOnce();expect(f.draw.mock.calls.map(c=>c[0].getData('cardId'))).toEqual(['spades-13','hearts-13']);
 const flight=f.root.list.find(o=>o.name==='hero/sushi-skill-flight') as any,shards=flight.list.filter((o:any)=>o.name==='hero/sushi-cost-king-shard');expect(shards).toHaveLength(8);expect(new Set(shards.map((s:any)=>s.getData('targetId')))).toEqual(new Set(['spades-13','hearts-13']));expect(flight.list.filter((o:any)=>o.name==='hero/sushi-skill-packet')).toHaveLength(1);
 for(const c of cards)expect(c.container.alpha).toBe(['spades-13','hearts-13'].includes(c.id)?0:1);
 job.step(300);const packet=flight.list.find((o:any)=>o.name==='hero/sushi-skill-packet');expect(packet.text).toBe('×'+factor);expect(packet.visible).toBe(true);expect(f.label.text).toBe('余音袅袅');
 job.arrive();expect(f.label.text).toBe('本次得分 ×'+factor);expect(f.label.style.color).toBe(SUSHI_PAYOFF_GOLD);expect(f.label.active).toBe(true);expect(packet.active).toBe(true);expect(flight.list.some((o:any)=>o.name==='hero/sushi-skill-shard')).toBe(false);
 job.step(beat.windup+beat.flight+240);expect(flight.active).toBe(false);expect(f.remove).toHaveBeenCalledTimes(2);expect(f.label.text).toBe('本次得分 ×'+factor);job.refresh();job.dispose();expect(f.label.text).toBe('余音袅袅');expect(f.label.style.color).toBe('#123456');expect(f.status.text).toBe('计分中');expect(f.button.active).toBe(true);expect(f.button.getData('sushiSkillPayoff')).toBeUndefined();expect(JSON.stringify(trace)).toBe(raw);f.root.destroy();
});
it('abort/hidden/shutdown restore paid-cost faces and cannot revive a gold cue; ordinary events create nothing',async()=>{
 const r=await currentHeroReceipt('amo');for(const end of ['abort','hidden','shutdown']){const f=setup(),listeners=new Map<string,()=>void>(),abort=new AbortController(),card=f.card('spades-13',{x:300,y:420,width:72,height:100});(document.addEventListener as any)=(name:string,callback:()=>void)=>listeners.set(name,callback);const job=mountSushiSkillPayoff(f.scene,f.button,r.trace,r.eventId,{context:{generation:1,signal:abort.signal},beat,reduced:false,root:f.root,cards:[{id:'spades-13',container:card}]})!;
 job.step(200);expect(card.alpha).toBe(0);job.arrive();if(end==='abort')abort.abort();else if(end==='shutdown')f.scene.events.emit('shutdown');else{Object.defineProperty(document,'hidden',{value:true});listeners.get('visibilitychange')!();}job.step(300);job.arrive();expect(card.alpha).toBe(1);expect(f.label.text).toBe('余音袅袅');expect(f.root.list.some(o=>o.name==='hero/sushi-skill-flight')).toBe(false);expect(mountSushiSkillPayoff(f.scene,f.button,r.trace,'ordinary-K',{context:{generation:2,signal:new AbortController().signal},beat,reduced:false,root:f.root,cards:[]})).toBeUndefined();f.root.destroy();}
});
it('reduced motion delivers only the true result, without fracture or permanent gold',async()=>{
 const r=await currentHeroReceipt('amo'),f=setup(),job=mountSushiSkillPayoff(f.scene,f.button,r.trace,r.eventId,{context:{generation:1,signal:new AbortController().signal},beat,reduced:true,root:f.root,cards:[]})!;job.step(200);expect(f.draw).not.toHaveBeenCalled();job.arrive();expect(f.label.text).toBe('本次得分 ×3');job.dispose();expect(f.label.text).toBe('余音袅袅');f.root.destroy();
});
it('a saved legacy no-K cost sends the factor from a real discarded card without inventing a fracture',()=>{
 let state=createRun({seed:'legacy-exile-payoff',runId:'legacy-exile-payoff',characterId:'amo',rulesVersion:'r2',openingRoute:'group',r2Identity:{contentVersion:R2_AMO_EXILE_VERSION,contentHash:R2_AMO_EXILE_HASH},modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 const send=(action:Action)=>{const result=applyCommand(state,{runId:state.runId,commandId:state.runId+'/'+state.commandSeq,expectedSeq:state.commandSeq,action});if(!result.ok)throw Error(result.code);state=result.state;};
 send({type:'LeaveShop'});send({type:'EnterStage'});const ids=['spades-8','hearts-8','clubs-7','diamonds-7','spades-2','hearts-2','clubs-3','diamonds-4'];state.handOrder=ids;state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id));
 expect(readCheckpoint(makeCheckpoint(state,[])).ok).toBe(true);send({type:'PlayHand',selectedIds:ids.slice(0,2),amoExile:true});const trace=state.lastTrace!,event=trace.events.find(e=>e.reasonKey==='amo.exile')!;
 expect(trace.amoExile?.discardedIds).toEqual(ids.slice(2));expect(event.value).toEqual({n:'4',d:'1'});
 const f=setup(),cards=ids.map((id,i)=>({id,container:f.card(id,{x:20+i*78,y:420,width:72,height:100})})),release=vi.fn(),job=mountSushiSkillPayoff(f.scene,f.button,trace,event.eventId,{context:{generation:1,signal:new AbortController().signal},beat,reduced:false,root:f.root,cards,releaseKings:release})!;
 job.step(300);const flight=f.root.getByName('hero/sushi-skill-flight') as any,packet=flight.getByName('hero/sushi-skill-packet');expect(flight.getData('originId')).toBe('clubs-7');expect(flight.getData('sourceIds')).toEqual(['clubs-7']);expect(packet.text).toBe('×4');expect(packet.visible).toBe(true);expect(flight.list.some((o:any)=>o.name==='hero/sushi-cost-king-shard')).toBe(false);expect(f.draw).not.toHaveBeenCalled();expect(release).not.toHaveBeenCalled();expect(cards.every(c=>c.container.alpha===1)).toBe(true);
 job.arrive();expect(f.label.text).toBe('本次得分 ×4');job.dispose();f.root.destroy();
});
it('skill use then two complete hands without K scores 306/22/22: CD is usage only, never an ongoing buff',async()=>{
 const fixture=await sushiSkillLocationFixture();let state=fixture.state;expect(readCheckpoint(makeCheckpoint(state,[])).ok).toBe(true);
 const send=(action:Action)=>{const result=applyCommand(state,{runId:state.runId,commandId:state.runId+'/'+state.commandSeq,expectedSeq:state.commandSeq,action});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.code);state=result.state as R2RunState;return state.lastTrace!;};
 const first=send({type:'PlayHand',selectedIds:fixture.selectedIds,amoExile:true});expect(first.finalScore).toBe('306');expect(first.amoExile?.use).toBe(true);expect(first.events.filter(e=>e.reasonKey==='amo.exile').map(e=>e.value)).toEqual([{n:'3',d:'1'}]);
 for(const id of ['spades-2','hearts-2']){expect(state.handOrder.every(id=>state.deckInstances.find(c=>c.id===id)!.rank!==13)).toBe(true);const trace=send({type:'PlayHand',selectedIds:[id]});expect(trace.finalScore).toBe('22');expect(trace.amoExile).toMatchObject({use:false,beforeUsed:true,afterUsed:true});expect(trace.events.some(e=>e.reasonKey==='amo.exile')).toBe(false);expect(state.stage?.amoExileUsed).toBe(true);}
});
