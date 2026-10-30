import {afterEach,expect,it,vi} from 'vitest';
import {mountLiueSkillPayoff,LIUE_PAYOFF_INK} from '../src/game/LiueSkillPayoff';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {liueSkillPayoffFixture} from '../harness/fixtures/liue-skill-payoff';
import {applyCommand} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
afterEach(()=>vi.unstubAllGlobals());
const beat={windup:220,flight:180,impact:300,rest:80,strength:'role' as const};
async function receipt(points:8|10=8,special=false){const f=await liueSkillPayoffFixture(points,special);expect(readCheckpoint(makeCheckpoint(f.state,[])).ok).toBe(true);const r=applyCommand(f.state,{runId:f.state.runId,commandId:f.state.runId+'/'+f.state.commandSeq,expectedSeq:f.state.commandSeq,action:{type:'PlayHand',selectedIds:f.selectedIds,erxiangTargetId:f.targetId}});if(!r.ok)throw Error(r.code);const trace=r.state.lastTrace!,event=trace.events.find(e=>e.reasonKey==='erxiang.handoff')!;return {...f,trace,event};}
function runtime(){const f=nativeHeroRuntime(),text=f.scene.add.text.bind(f.scene.add);f.scene.add.text=((x:number,y:number,s:string)=>{const t=text(x,y,s) as any;t.style={color:'#123456'};t.setAlpha=(a:number)=>{t.alpha=a;return t;};t.setColor=(c:string)=>{t.style.color=c;return t;};return t;}) as any;
 const label=f.scene.add.text(110,500,'听政'),status=f.scene.add.text(110,525,'计分中'),button=new f.Zone(f.scene,110,500,180,48).setData('label',label).setData('skillStatus',status);f.root.add([label,status,button]);const card=f.card('spades-8',{x:300,y:240,width:72,height:100});return {...f,label:label as any,status:status as any,button:button as any,card};}
it.each([8,10] as const)('a real +%s packet floats from its saved card, travels once, and lands in 听政 without hiding the card',async points=>{
 const r=await receipt(points),f=runtime(),before=JSON.stringify(r.trace),cardState=[f.card.x,f.card.y,f.card.alpha,f.card.visible,f.card.scaleX,f.card.scaleY],options={context:{generation:1,signal:new AbortController().signal},beat,reduced:false,root:f.root,cards:[{id:r.targetId,container:f.card}]},job=mountLiueSkillPayoff(f.scene,f.button,r.trace,r.event.eventId,options)!;
 expect(mountLiueSkillPayoff(f.scene,f.button,r.trace,r.event.eventId,options)).toBeUndefined();job.charge(.5);const flight=f.root.getByName('hero/liue-skill-flight') as any,packet=flight.getByName('hero/liue-skill-packet');expect(packet.text).toBe('+'+points+' 倍率');expect(flight.getData('targetId')).toBe(r.targetId);expect(f.label.text).toBe('听政');const start={x:packet.x,y:packet.y};job.step(beat.windup+beat.flight/2);expect({x:packet.x,y:packet.y}).not.toEqual(start);expect(flight.getData('phase')).toBe('flight');
 job.arrive();job.arrive();job.step(beat.windup+beat.flight+100);expect(f.label.text).toBe('听政 +'+points+'倍率');expect(f.label.style.color).toBe(LIUE_PAYOFF_INK);expect(packet.visible).toBe(false);expect(f.status.text).toBe('本次已转入');expect([f.card.x,f.card.y,f.card.alpha,f.card.visible,f.card.scaleX,f.card.scaleY]).toEqual(cardState);expect(flight.list.map((o:any)=>o.name)).not.toContain('hero/sushi-cost-king-shard');
 job.finishAnimation();job.refresh();expect(f.label.text).toContain('+'+points);job.dispose();job.arrive();job.refresh();expect(f.label.text).toBe('听政');expect(f.status.text).toBe('计分中');expect(f.button.getData('liueSkillPayoff')).toBeUndefined();expect(f.root.getByName('hero/liue-skill-flight')).toBeNull();expect(JSON.stringify(r.trace)).toBe(before);f.root.destroy();
});
it('enhancement/foil remain separate and every saved group conversion, including retriggers, can mount',async()=>{
 const r=await receipt(8,true),f=runtime(),options={context:{generation:1,signal:new AbortController().signal},beat,reduced:false,root:f.root,cards:r.selectedIds.map(id=>({id,container:f.card}))};expect(r.trace.events.filter(e=>e.reasonKey==='erxiang.handoff')).toHaveLength(5);expect(r.trace.events.some(e=>e.retriggerDepth===1)).toBe(true);expect(r.trace.events.some(e=>e.reasonKey.startsWith('edition.'))).toBe(true);
 for(const e of r.trace.events){const job=mountLiueSkillPayoff(f.scene,f.button,r.trace,e.eventId,options);expect(!!job).toBe(e.reasonKey==='erxiang.handoff');job?.dispose();}f.root.destroy();
});
it('labels only the saved retrigger transfers as retriggers, including in reduced motion',async()=>{
 const r=await receipt(8,true),f=runtime(),events=r.trace.events.filter(e=>e.reasonKey==='erxiang.handoff'),cards=r.selectedIds.map(id=>({id,container:f.card}));
 expect(events.some(e=>e.retriggerDepth===0)).toBe(true);expect(events.some(e=>e.retriggerDepth===1)).toBe(true);
 for(const e of events)for(const reduced of [false,true]){const job=mountLiueSkillPayoff(f.scene,f.button,r.trace,e.eventId,{context:{generation:1,signal:new AbortController().signal},beat,reduced,root:f.root,cards})!;
  job.charge(1);const flight=f.root.getByName('hero/liue-skill-flight') as any;if(!reduced)expect(flight.getByName('hero/liue-skill-packet').text).toBe((e.retriggerDepth?'重触 ':'')+'+8 倍率');else expect(flight).toBeNull();
  job.arrive();expect(f.status.text).toBe(e.retriggerDepth?'重触已转入':'本次已转入');expect(f.label.text).toBe('听政 +8倍率');job.dispose();
 }f.root.destroy();
});
it.each(['abort','hidden','blur','shutdown','destroy','button','card','root'] as const)('%s clears all transient ink and cannot revive the receipt',async end=>{
 const r=await receipt(),f=runtime(),abort=new AbortController(),doc=new Map<string,()=>void>(),win=new Map<string,()=>void>();document.addEventListener=((n:string,fn:()=>void)=>doc.set(n,fn)) as any;window.addEventListener=((n:string,fn:()=>void)=>win.set(n,fn)) as any;
 const job=mountLiueSkillPayoff(f.scene,f.button,r.trace,r.event.eventId,{context:{generation:1,signal:abort.signal},beat,reduced:false,root:f.root,cards:[{id:r.targetId,container:f.card}]})!;job.charge(1);job.arrive();
 if(end==='abort')abort.abort();else if(end==='hidden'){Object.defineProperty(document,'hidden',{value:true});doc.get('visibilitychange')!();}else if(end==='blur')win.get('blur')!();else if(end==='button')f.button.destroy();else if(end==='card')f.card.destroy();else if(end==='root')f.root.destroy();else f.scene.events.emit(end);
 job.step(900);job.arrive();job.refresh();if(f.label.active)expect(f.label.text).toBe('听政');expect(f.root.active?f.root.getByName('hero/liue-skill-flight'):null).toBeNull();if(f.root.active)f.root.destroy();
});
it('reduced motion shows only the saved landing; absent/preview/ordinary events show no conversion',async()=>{
 const r=await receipt(),f=runtime(),options={context:{generation:1,signal:new AbortController().signal},beat,reduced:true,root:f.root,cards:[{id:r.targetId,container:f.card}]};expect(mountLiueSkillPayoff(f.scene,f.button,r.trace,'preview',options)).toBeUndefined();const job=mountLiueSkillPayoff(f.scene,f.button,r.trace,r.event.eventId,options)!;job.charge(1);job.step(100);expect(f.root.getByName('hero/liue-skill-flight')).toBeNull();expect(f.label.text).toBe('听政');job.arrive();expect(f.label.text).toBe('听政 +8倍率');job.dispose();f.root.destroy();
});
