import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {SushiDiscardCardPresentation} from '../src/game/SushiDiscardCardPresentation';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {savedSushiDiscardReceipt} from '../src/game/SushiDiscardOrigin';

afterEach(()=>vi.unstubAllGlobals());
function fixture(width=1280){
 const f=nativeHeroRuntime({width,height:844,density:width<600?2:1,renderer:1}),cards=new Map(['main','king-a','normal','king-b'].map((id,i)=>{const container=f.card(id,{x:40+i*76,y:500,width:72,height:100});return[id,{id,container,width:72,height:100,rank:Number(id.startsWith('king')?13:8)}] as const;})),layer=new SushiDiscardCardPresentation(f.scene,()=>f.root,id=>cards.get(id),()=>false);
 const holders=()=>f.root.list.filter(o=>o.active&&o.name.startsWith('hero/sushi-discard/')) as Phaser.GameObjects.Container[],badges=()=>holders().flatMap(o=>o.list.filter(o=>o.name==='hero/sushi-king-badge')) as Phaser.GameObjects.Text[];
 return{...f,cards,layer,holders,badges};
}
it.each([1280,390])('%i: only real pending kings own a quiet preparation and a rule-sourced label, without smoke or score writes',width=>{
 const f=fixture(width);try{
  f.layer.prepareKings(['king-a','normal','king-b'],3);f.layer.step(0,true);expect(f.holders().map(o=>o.getData('sourceInstanceId'))).toEqual(['king-a','king-b']);expect(f.badges().map(o=>o.text)).toEqual(['本次得分 ×3']);expect(f.badges()[0].getData('sourceInstanceId')).toBe('king-a');
  const positions=f.badges().map(o=>({x:o.x,y:o.y}));for(let i=0;i<20;i++)f.layer.step(50,true);expect(f.badges().map(o=>({x:o.x,y:o.y}))).toEqual(positions);expect(f.emitters).toHaveLength(0);expect(f.holders().every(h=>h.list.every(o=>o.name!=='hero/live-smoke'&&o.name!=='hero/prepared-material'))).toBe(true);
  const old=f.holders()[0];f.layer.prepareKings(['king-b'],4);f.layer.step(0,true);expect(old.active).toBe(false);expect(f.badges().map(o=>o.text)).toEqual(['本次得分 ×4']);
  f.layer.prepareKings(['normal'],3);f.layer.step(0,true);expect(f.holders()).toHaveLength(0);expect(f.badges()).toHaveLength(0);
 }finally{f.layer.clear();f.root.destroy();}
});
it('cancel, hidden source, body destruction and owner clearing remove both preparation and label',()=>{
 const f=fixture();try{
  f.layer.prepareKings(['king-a'],3);f.layer.step(0,true);const first=f.badges()[0];f.layer.prepareKings([],3);expect(first.active).toBe(false);
  f.layer.prepareKings(['king-a'],3);f.layer.step(0,true);const holder=f.holders()[0];f.cards.get('king-a')!.container.setVisible(false);f.layer.step(50,true);expect(holder.visible).toBe(false);f.cards.get('king-a')!.container.setVisible(true);f.layer.step(50,true);expect(holder.visible).toBe(true);
  f.layer.suspend();expect(holder.visible).toBe(false);f.layer.step(50,true);expect(holder.visible).toBe(true);f.cards.get('king-a')!.container.destroy();expect(holder.active).toBe(false);expect(f.badges()).toHaveLength(0);
  f.layer.prepareKings(['king-b'],3);f.layer.step(0,true);const badge=f.badges()[0];f.layer.clear();expect(badge.active).toBe(false);expect(f.holders()).toHaveLength(0);
 }finally{f.layer.clear();f.root.destroy();}
});
it('one hand label transfers only to another actual pending K when its owner hides or is destroyed',()=>{
 const f=fixture(),visible=()=>f.badges().filter(b=>b.visible&&b.parentContainer?.visible);try{
  f.layer.prepareKings(['king-a','king-b'],3);f.layer.step(0,true);expect(visible().map(b=>b.getData('sourceInstanceId'))).toEqual(['king-a']);
  f.cards.get('king-a')!.container.setVisible(false);f.layer.step(50,true);expect(visible().map(b=>b.getData('sourceInstanceId'))).toEqual(['king-b']);
  f.cards.get('king-a')!.container.setVisible(true);f.layer.step(50,true);expect(visible().map(b=>b.getData('sourceInstanceId'))).toEqual(['king-a']);
  f.cards.get('king-a')!.container.destroy();f.layer.step(50,true);expect(visible().map(b=>b.getData('sourceInstanceId'))).toEqual(['king-b']);expect(f.holders()).toHaveLength(1);
 }finally{f.layer.clear();f.root.destroy();}
});
it('saved activation uses the actual event factor and still owns every real discard through cut and abort',async()=>{
 const r=await currentHeroReceipt('amo'),f=fixture(),ids=r.trace.amoExile!.discardedIds,abort=new AbortController();
 ids.forEach((id,i)=>{const container=f.card(id,{x:40+i*76,y:500,width:72,height:100});f.cards.set(id,{id,container,width:72,height:100,rank:r.trace.cards.find(c=>c.id===id)!.rank});});
 try{
  expect(f.layer.bindSaved(r.trace,{generation:1,signal:abort.signal})).toBe(true);expect(new Set(f.holders().map(o=>o.getData('sourceInstanceId')))).toEqual(new Set(ids));const event=r.trace.events.find(e=>e.reasonKey==='amo.exile')!;expect(f.badges().map(o=>o.text)).toEqual(['本次得分 ×'+event.value.n]);expect(savedSushiDiscardReceipt(r.trace,event.eventId)?.multiplier).toBe(event.value.n);
  const king=ids.find(id=>r.trace.cards.find(c=>c.id===id)!.rank===13)!;expect(f.layer.cut(king,.1)).toBe(true);f.layer.step(50,true);expect(f.badges().some(b=>b.getData('sourceInstanceId')===king)).toBe(false);expect(f.layer.cut(r.trace.sets.playedIds[0],.2)).toBe(false);abort.abort();expect(f.holders()).toHaveLength(0);expect(r.restore().state).toEqual(r.saved.state);
 }finally{abort.abort();f.layer.clear();f.root.destroy();}
});

it('overlapped cost kings retain visible ink: a back face cannot erase the exposed strip',()=>{
 const f=fixture();try{
  const a=f.cards.get('king-a')!,b=f.cards.get('king-b')!;f.cards.get('normal')!.container.setPosition(900,500);a.container.setPosition(200,550);b.container.setPosition(230,550);
  f.layer.prepareKings(['king-a','king-b'],3);f.layer.step(50,true);
  for(const holder of f.holders()){const ink=holder.list[0] as Phaser.GameObjects.Graphics;expect(ink.commandBuffer).toContain(0x245653);}
 }finally{f.layer.clear();f.root.destroy();}
});
