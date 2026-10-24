import {it,expect} from 'vitest';
import type Phaser from 'phaser';
import {heroAttachmentIntensityFixture} from '../harness/fixtures/hero-attachment-intensity';
import {energySend} from '../harness/fixtures/score-energy';
import {savedSushiDiscardReceipt,drawSushiDiscardOrigin} from '../src/game/SushiDiscardOrigin';
const fixture=heroAttachmentIntensityFixture('amo'),trace=energySend(fixture.state,fixture.action).lastTrace!,event=trace.events.find(e=>e.reasonKey==='amo.exile')!,receipt=savedSushiDiscardReceipt(trace,event.eventId)!;
const graphics=()=>{const g=new Proxy({},{get:()=>()=>g}) as unknown as Phaser.GameObjects.Graphics;return g;};
it('uses the actual saved discarded instances and scores, never the played/main group or a new count formula',()=>{
 const before=JSON.stringify(trace);expect(receipt.discardedIds).toEqual(trace.amoExile!.discardedIds);expect(receipt.discardedIds.every(id=>!trace.sets.playedIds.includes(id))).toBe(true);expect(receipt.beforeScore).toBe(trace.amoExile!.beforeScore);expect(receipt.afterScore).toBe(trace.amoExile!.afterScore);expect(Object.isFrozen(receipt.discardedIds)).toBe(true);expect(JSON.stringify(trace)).toBe(before);
});
it('rejects another event and never substitutes a played-card pose for a missing discarded pose',()=>{
 expect(savedSushiDiscardReceipt(trace,'not-the-saved-event')).toBeUndefined();const missing=structuredClone(trace);missing.sets.discardedIds=undefined;expect(savedSushiDiscardReceipt(missing,event.eventId)).toBeUndefined();const context={generation:1,signal:new AbortController().signal},result=drawSushiDiscardOrigin(graphics(),{phase:'transfer',receipt,eventId:receipt.eventId,context,poses:[{id:trace.sets.playedIds[0],box:{x:20,y:300,width:60,height:90}}],sink:{x:400,y:100},progress:.5,reducedMotion:false,protectedPrint:[]});expect(result.sourceIds).toEqual([]);expect(result.fragments).toBe(0);
});
it('transfers only actual available discard sources to the supplied score sink and abort clears the frame',()=>{
 const abort=new AbortController(),frame={phase:'transfer' as const,receipt,eventId:receipt.eventId,context:{generation:1,signal:abort.signal},poses:receipt.discardedIds.slice(0,2).map((id,i)=>({id,box:{x:40+i*70,y:300,width:60,height:90}})),sink:{x:400,y:100},progress:.5,reducedMotion:false,protectedPrint:[]};expect(drawSushiDiscardOrigin(graphics(),frame).sourceIds).toEqual(receipt.discardedIds.slice(0,2));abort.abort();expect(drawSushiDiscardOrigin(graphics(),frame).sourceIds).toEqual([]);
});
it('reduced motion stays at the discarded origins and does not manufacture a flight',()=>{
 const result=drawSushiDiscardOrigin(graphics(),{phase:'mark-cost',selectedDiscardIds:receipt.discardedIds,signal:new AbortController().signal,poses:receipt.discardedIds.map((id,i)=>({id,box:{x:40+i*70,y:300,width:60,height:90}})),progress:.8,reducedMotion:true,protectedPrint:[]});expect(result.sourceIds).toEqual(receipt.discardedIds);expect(result.fragments).toBe(0);expect(result.eventId).toBeUndefined();
});
