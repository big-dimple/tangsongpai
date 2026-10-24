import {it,expect,vi} from 'vitest';
import type Phaser from 'phaser';
import {sushiLocalSlash,sushiDiscardFadeTiming,SushiDiscardCardPresentation,type SushiDiscardCard} from '../src/game/SushiDiscardCardPresentation';
import {heroAttachmentIntensityFixture} from '../harness/fixtures/hero-attachment-intensity';
import {energySend} from '../harness/fixtures/score-energy';
const fixture=heroAttachmentIntensityFixture('amo'),trace=energySend(fixture.state,fixture.action).lastTrace!;
it('each blade stays in one local card and cannot span a middle non-target between non-contiguous sources',()=>{
 for(const width of [38,64,112])for(const height of [70,100,150])for(const progress of [0,.2,.5,.8,1])for(const p of sushiLocalSlash(width,height,progress)){expect(Math.abs(p.x)+3.5).toBeLessThan(width/2);expect(Math.abs(p.y)+3.5).toBeLessThan(height/2);}
 const middle={left:90,right:170};for(const center of [20,240])for(const p of sushiLocalSlash(60,100,.7)){const world=center+p.x;expect(world<middle.left||world>middle.right).toBe(true);}
});
it('binds one layer to each real discarded ID, refuses a main-card cut, and cancellation destroys only its own layers',()=>{
 let created=0,destroyed=0;const root={active:true,add:()=>undefined},container=()=>({active:true,visible:true,setName(){return this;},setData(){return this;},add(){return this;},destroy(){this.active=false;destroyed++;}}),ink={};
 const scene={add:{container:()=>{created++;return container();},graphics:()=>ink}},sources=new Map<string,SushiDiscardCard>();for(const id of [...trace.sets.playedIds,...trace.amoExile!.discardedIds])sources.set(id,{id,container:{active:true,visible:true,x:77,y:88,alpha:1} as unknown as Phaser.GameObjects.Container,width:60,height:100});
 const layer=new SushiDiscardCardPresentation(scene as unknown as Phaser.Scene,()=>root as unknown as Phaser.GameObjects.Container,id=>sources.get(id),()=>false);layer.preview(trace.amoExile!.discardedIds);expect(created).toBe(trace.amoExile!.discardedIds.length);const step=vi.spyOn(layer,'step').mockImplementation(()=>undefined),abort=new AbortController();expect(layer.bindSaved(trace,{generation:1,signal:abort.signal})).toBe(true);expect(layer.cut(trace.amoExile!.discardedIds[0],.5)).toBe(true);expect(layer.cut(trace.sets.playedIds[0],.5)).toBe(false);abort.abort();expect(layer.active).toBe(false);expect(destroyed).toBe(created);for(const card of sources.values())expect([card.container.x,card.container.y,card.container.alpha]).toEqual([77,88,1]);step.mockRestore();
});
it('wrong saved traces cannot bind an old main-only intent into a discard effect',()=>{
 const empty=new SushiDiscardCardPresentation({} as Phaser.Scene,()=>undefined,()=>undefined,()=>false),wrong=structuredClone(trace);wrong.amoExile!.discardedIds=[trace.sets.playedIds[0]];expect(empty.bindSaved(wrong,{generation:1,signal:new AbortController().signal})).toBe(false);expect(empty.active).toBe(false);
});
function rebindFixture(){
 const holders:{active:boolean;visible:boolean;destroy:()=>void}[]=[],sources=new Map<string,SushiDiscardCard>(),root={active:true,add:()=>undefined};
 const scene={game:{},scale:{width:780,height:1688,zoom:.5},add:{container:()=>{const holder={active:true,visible:true,setName(){return this;},setData(){return this;},setVisible(value:boolean){this.visible=value;return this;},add(){return this;},destroy(){this.active=false;}};holders.push(holder);return holder;},graphics:()=>({clear:vi.fn()})}};
 const card=(id:string)=>({id,container:{active:true,visible:true} as unknown as Phaser.GameObjects.Container,width:60,height:100});
 const layer=new SushiDiscardCardPresentation(scene as unknown as Phaser.Scene,()=>root as unknown as Phaser.GameObjects.Container,id=>sources.get(id),()=>false);return{layer,sources,holders,card,root};
}
it('rebinds the same discard ID to the current card container after hand rebuild, and removes missing sources',()=>{
 const f=rebindFixture(),id=trace.amoExile!.discardedIds[0],old=f.card(id);f.sources.set(id,old);f.layer.preview([id]);old.container.active=false;f.sources.set(id,f.card(id));f.layer.preview([id]);expect(f.holders).toHaveLength(2);expect(f.holders[0].active).toBe(false);expect(f.holders[1].active).toBe(true);
 f.holders[1].active=false;f.layer.preview([id]);expect(f.holders).toHaveLength(3);expect(f.holders[2].active).toBe(true);f.sources.delete(id);f.layer.preview([id]);expect(f.layer.active).toBe(false);expect(f.holders[2].active).toBe(false);
});
it('keeps the visible-origin cap when the same oversized discard set is reordered and clears on root destruction',()=>{
 const f=rebindFixture(),ids=Array.from({length:10},(_,i)=>'actual/'+i);for(const id of ids)f.sources.set(id,f.card(id));f.layer.preview(ids);expect(f.holders.filter(h=>h.active)).toHaveLength(8);f.layer.preview([...ids].reverse());expect(f.holders.filter(h=>h.active)).toHaveLength(8);f.root.active=false;f.layer.preview(ids);expect(f.layer.active).toBe(false);expect(f.holders.every(h=>!h.active)).toBe(true);
});
it.each([true,false])('skips preview drawing for an offscreen/hidden real source (visible=%s), without removing its intent',visible=>{
 const f=rebindFixture(),id=trace.amoExile!.discardedIds[0],card=f.card(id);Object.assign(card.container,{visible,getBounds:()=>({x:450,y:100,right:510,bottom:200})});f.sources.set(id,card);f.layer.preview([id]);const row=(f.layer as any).rows.get(id);row.captured=true;const sync=vi.spyOn(f.layer as any,'sync').mockImplementation(()=>undefined),occluders=vi.spyOn(f.layer as any,'occluders');f.layer.step(50,true);expect(f.holders[0].visible).toBe(false);expect(occluders).not.toHaveBeenCalled();expect(f.layer.active).toBe(true);sync.mockRestore();
});
it('lets the actual saved K receive fire before its existing fade, while reduced motion and replay keep their old timing',()=>{
 expect(sushiDiscardFadeTiming(0,false)).toEqual({delay:260,duration:180});expect(sushiDiscardFadeTiming(2,false)).toEqual({delay:320,duration:180});expect(sushiDiscardFadeTiming(2,true)).toEqual({delay:0,duration:0});expect(sushiDiscardFadeTiming(2,false,true)).toEqual({delay:60,duration:180});
});
