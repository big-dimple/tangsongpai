import {afterEach,expect,it,vi} from 'vitest';
import {bindSushiKingCharge} from '../src/game/SushiKingCharge';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {heroScoreAction,heroImpactBeat,heroImpactDetail} from '../src/game/HeroScoreAction';
import {scorePhrase} from '../src/game/ScorePhrase';
afterEach(()=>vi.unstubAllGlobals());
it('only the saved cost kings charge, release before discard and never replay after cancellation',async()=>{
 const r=await currentHeroReceipt('amo'),f=nativeHeroRuntime(),ids=r.before.handOrder,cards=ids.map((id,i)=>({id,container:f.card(id,{x:20+i*90,y:430,width:72,height:100}),width:72,height:100})),rest=cards.map(row=>({x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle})),abort=new AbortController(),context={generation:1,signal:abort.signal},beat=scorePhrase(r.trace.events,'100',1,r.trace).get(r.eventId)!,raw=JSON.stringify(r.saved.state);
 const charge=bindSushiKingCharge(f.scene,r.trace,r.eventId,cards,{context,beat})!;expect(charge.ids).toEqual(['spades-13','hearts-13']);charge.step(beat.windup*.4);
 for(const [i,c]of cards.entries()){const changed=c.container.scaleY!==rest[i].sy;expect(changed).toBe(charge.ids.includes(c.id));}expect(f.emitters).toHaveLength(0);charge.release();cards.forEach((c,i)=>expect({x:c.container.x,y:c.container.y,sx:c.container.scaleX,sy:c.container.scaleY,angle:c.container.angle}).toEqual(rest[i]));cards[4].container.y+=40;charge.dispose();charge.step(0);expect(cards[4].container.y).toBe(rest[4].y+40);expect(JSON.stringify(r.saved.state)).toBe(raw);f.root.destroy();
});
it('an ordinary K or forged event cannot get a skill charge; abort restores genuine poses',async()=>{
 const r=await currentHeroReceipt('amo'),f=nativeHeroRuntime(),card=f.card('spades-13',{x:300,y:430,width:72,height:100}),cards=[{id:'spades-13',container:card,width:72,height:100}],abort=new AbortController(),context={generation:2,signal:abort.signal},beat={windup:180,flight:100,impact:250,rest:50,strength:'role' as const},rest={x:card.x,y:card.y,sx:card.scaleX,sy:card.scaleY,angle:card.angle};
 expect(bindSushiKingCharge(f.scene,r.trace,'ordinary-K',cards,{context,beat})).toBeUndefined();const job=bindSushiKingCharge(f.scene,r.trace,r.eventId,cards,{context,beat})!;job.step(100);abort.abort();job.step(170);expect({x:card.x,y:card.y,sx:card.scaleX,sy:card.scaleY,angle:card.angle}).toEqual(rest);expect(card.list.some(o=>o.name==='hero/sushi-king-charge')).toBe(false);f.root.destroy();
});
it('one hero accent has a bounded charge/contact at every speed, while retained-card runs keep their pace',async()=>{
 const r=await currentHeroReceipt('xiemu'),action=heroScoreAction(r.trace,r.cue!.event)!,base={windup:30,flight:30,impact:120,rest:10,strength:'role' as const,strike:{hold:40,recovery:80}};for(const speed of [1,2,4]){const beat=heroImpactBeat(action,base,speed);expect(beat.windup/speed).toBeGreaterThanOrEqual(55);expect(beat.flight/speed).toBeGreaterThanOrEqual(60);expect(beat.strike!.hold/speed).toBeGreaterThanOrEqual(45);expect((beat.windup+beat.flight+beat.impact+beat.rest)/speed).toBeLessThan(1000);expect(heroImpactBeat({...action,kind:'retained-card'},base,speed)).toBe(base);}expect(heroImpactDetail(action)).toBe('扣3金（40→37）');
});
