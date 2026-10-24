import {it,expect} from 'vitest';
import {jokerScoreStrikeCue,jokerStrikeBeat,strikeFlightPoint,strikeReturnFraction,createStrikeReadoutRecoil,prepareJokerScoreStrike,STRIKE_RETURN_LANDING} from '../src/game/JokerScoreStrike';
import {scoreSourceProcessFixture} from '../harness/fixtures/score-source-process';
import {energySend} from '../harness/fixtures/score-energy';
import {scoreBeat} from '../src/game/scorePresentation';
const fixture=scoreSourceProcessFixture('chain'),trace=energySend(fixture.state,{type:'PlayHand',selectedIds:fixture.selectedIds}).lastTrace!;
it('an already cancelled generation allocates no visual or texture',()=>{const abort=new AbortController();abort.abort();expect(prepareJokerScoreStrike({} as any,{} as any,{} as any,{} as any,{context:{generation:1,signal:abort.signal}} as any)).toBeUndefined();});
it('only exact saved positive joker contributions attack their actual H/M, never total or resource receipts',()=>{
 const saved=JSON.stringify(trace),cues=trace.events.map(e=>jokerScoreStrikeCue(trace,e)).filter(Boolean);expect(cues.some(c=>c!.contributions.some(x=>x.target==='H'))).toBe(true);expect(cues.some(c=>c!.contributions.some(x=>x.target==='M'&&x.kind==='multiply'))).toBe(true);
 for(const cue of cues)expect(cue!.contributions.every(c=>['H','M'].includes(c.target))).toBe(true);
 const event=trace.events.find(e=>jokerScoreStrikeCue(trace,e))!;expect(jokerScoreStrikeCue(trace,{...event,after:event.before})).toBeUndefined();expect(jokerScoreStrikeCue(trace,{...event,eventId:'forged'})).toBeUndefined();expect(JSON.stringify(trace)).toBe(saved);
 const poly=structuredClone(trace),source=poly.sourceJokers.find(j=>j.instanceId===event.sourceInstanceId)!;source.edition='polychrome';expect(jokerScoreStrikeCue(poly,poly.events.find(e=>e.eventId===event.eventId)!)!.edition).toBe('polychrome');expect(JSON.stringify(trace)).toBe(saved);
});
it('flight projection advances source to destination, not backwards, for all source quadrants',()=>{
 for(const from of [{x:100,y:30},{x:800,y:30},{x:90,y:600}]){const to={x:420,y:300},dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;let last=-1;
  expect(strikeFlightPoint(from,to,0)).toEqual(from);expect(strikeFlightPoint(from,to,1).x).toBeCloseTo(to.x);expect(strikeFlightPoint(from,to,1).y).toBeCloseTo(to.y);
  for(let i=0;i<=100;i++){const p=strikeFlightPoint(from,to,i/100),projection=((p.x-from.x)*dx+(p.y-from.y)*dy)/length;expect(projection).toBeGreaterThanOrEqual(last-1e-9);last=projection;}
 }
});
it('impact holds and spring returns share one beat, including distinguishable double impacts at 4x',()=>{
 const event=trace.events.find(e=>jokerScoreStrikeCue(trace,e))!,base={...scoreBeat(event),phrase:{role:'accent' as const,pulse:3,paired:true,accentWeight:1,start:0,arrival:0,end:0}};
 for(const speed of [1,2,4]){const beat=jokerStrikeBeat(base,true,speed);expect(beat.strike!.hold/speed).toBeGreaterThanOrEqual(35);expect(beat.flight/speed).toBeGreaterThanOrEqual(60);expect((beat.strike!.hold+beat.strike!.recovery*STRIKE_RETURN_LANDING)/speed).toBeGreaterThanOrEqual(50);expect(beat.impact).toBe(beat.strike!.hold+beat.strike!.recovery);}
 const plain=jokerStrikeBeat({...base,phrase:{...base.phrase,role:'run'}},false);expect(jokerStrikeBeat(base,true).windup).toBeGreaterThan(plain.windup);
 for(let i=Math.ceil(STRIKE_RETURN_LANDING*100);i<=100;i++)expect(Math.abs(strikeReturnFraction(i/100,900)*900)).toBeLessThanOrEqual(8);expect(strikeReturnFraction(1,900)).toBe(0);
});
it('shows the actual number peak on its first visible frame at 1/2/4x and coarse frame steps, within the original impact slot',()=>{
 for(const speed of [1,2,4])for(const frameMs of [1000/60,1000/30,1000/15]){
  const hold=40*speed,recovery=50*speed,end=hold+recovery,amplitude=.18*.58,recoil=createStrikeReadoutRecoil(hold,recovery,amplitude);
  expect(recoil(hold-1)).toBeUndefined();let first:number|undefined;
  for(let elapsed=frameMs*speed;elapsed<=end+frameMs*speed;elapsed+=frameMs*speed){const value=recoil(elapsed);if(!value)continue;if(first===undefined){first=elapsed;expect(value.scale).toBeCloseTo(1+amplitude);expect(value.lift).toBe(-3);}expect(value.scale).toBeLessThanOrEqual(1+amplitude);}
  expect(first).toBeDefined();expect(recoil(Math.max(end,first!+1))).toEqual({scale:1,lift:-0});
 }
});
it('each event owns its reveal peak, with true multiplier weight and the existing hold still hiding numbers',()=>{
 const a=createStrikeReadoutRecoil(160,200,.44*.4),b=createStrikeReadoutRecoil(220,420,.44);
 expect(a(133)).toBeUndefined();expect(a(200)!.scale).toBeCloseTo(1.176);expect(a(360)!.scale).toBe(1);
 expect(b(200)).toBeUndefined();expect(b(266)!.scale).toBeCloseTo(1.44);expect(b(640)!.scale).toBe(1);
});
