import {it,expect} from 'vitest';
import {scorePhrase} from '../src/game/ScorePhrase';
import {ownedJokerMotionDuration,OWNED_SOURCE_REBOUND} from '../src/game/OwnedJokerScoreMotion';
import {remainingScoreEvents} from '../src/game/OpponentFacts';
import {isNeutralScoreReceipt} from '../src/game/ScoreTableMotion';
import {scoreSourceProcessFixture} from '../harness/fixtures/score-source-process';
import {energySend} from '../harness/fixtures/score-energy';
import {actualMultiplier} from '../src/domain/openingShow';
import {STRIKE_RETURN_LANDING} from '../src/game/JokerScoreStrike';
const fixture=scoreSourceProcessFixture('chain'),trace=energySend(fixture.state,{type:'PlayHand',selectedIds:fixture.selectedIds}).lastTrace!;
const events=remainingScoreEvents(trace).filter(e=>!isNeutralScoreReceipt(e));
it('composes the committed order without mutating it; key accent must be a real largest multiplier',()=>{
 const saved=JSON.stringify(trace),plan=scorePhrase(events,'400');expect([...plan.keys()]).toEqual(events.map(e=>e.eventId));
 const accents=[...plan].filter(([,b])=>b.phrase!.role==='accent');expect(accents).toHaveLength(1);
 const event=events.find(e=>e.eventId===accents[0][0])!,factor=actualMultiplier(event)!;expect(factor).toBeDefined();
 for(const e of events){const f=actualMultiplier(e);if(f)expect(factor.compare(f)).toBeGreaterThanOrEqual(0);}
 expect(JSON.stringify(trace)).toBe(saved);
});
it('preserves density within comparable gestures and alternating weights without a later numeric override',()=>{
 const plan=scorePhrase(events,'400'),runs=[...plan.values()].filter(b=>b.phrase!.role==='run');
 expect(runs.length).toBeGreaterThan(5);for(const group of [runs.filter(b=>!b.strike),runs.filter(b=>b.strike&&b.strength!=='multiply')]){expect(group.length).toBeGreaterThanOrEqual(2);expect(group.at(-1)!.windup+group.at(-1)!.flight).toBeLessThan(group[0].windup+group[0].flight);}
 expect(new Set(runs.map(b=>b.phrase!.accentWeight)).size).toBeGreaterThan(3);expect(runs.some(b=>!b.phrase!.paired)).toBe(true);
 for(const beat of runs)expect(ownedJokerMotionDuration('multiply',beat,4)).toBe(beat.impact);
 const accent=[...plan.values()].find(b=>b.phrase!.role==='accent')!;expect(accent.windup).toBeGreaterThan(runs[0].windup);expect(accent.phrase!.accentWeight).toBe(1);
});
it('every real source activation owns one visible double beat while the full 4x run gains density',()=>{
 const plan=scorePhrase(events,'400',4);for(const b of plan.values())if(b.phrase!.paired)expect((b.strike?b.strike.hold+b.strike.recovery*STRIKE_RETURN_LANDING:b.impact*OWNED_SOURCE_REBOUND)/4).toBeGreaterThanOrEqual(50);
 for(const e of events.filter(e=>e.sourceType==='joker')){const b=plan.get(e.eventId)!;if(['opening','run','accent'].includes(b.phrase!.role))expect(b.phrase!.paired).toBe(true);}
 expect([...plan.values()].filter(b=>b.phrase!.paired).length).toBeLessThan([...plan.values()].filter(b=>['opening','run','accent'].includes(b.phrase!.role)).length);
 const normal=scorePhrase(events,'400');expect([...plan.values()].at(-1)!.phrase!.end/4).toBeLessThan([...normal.values()].at(-1)!.phrase!.end*.55);
 const runs=[...plan.values()].filter(b=>b.phrase!.role==='run'),duration=(b:typeof runs[number])=>(b.windup+b.flight+b.impact+b.rest)/4,mean=(a:typeof runs)=>a.reduce((n,b)=>n+duration(b),0)/a.length;
 const sources=events.filter(e=>e.sourceType==='joker'&&plan.get(e.eventId)!.phrase!.role==='run').map(e=>plan.get(e.eventId)!);const gaps=sources.slice(1).map((b,i)=>(b.phrase!.arrival-sources[i].phrase!.arrival)/4),average=(a:number[])=>a.reduce((n,x)=>n+x,0)/a.length;
 expect(average(gaps.slice(-4))).toBeLessThan(average(gaps.slice(0,4))*.9);
 const key=[...plan.values()].find(b=>b.phrase!.role==='accent')!;expect(duration(key)).toBeGreaterThan(mean(runs)*1.7);expect(key.windup/4).toBeGreaterThanOrEqual(85);
 const final=[...plan.values()].find(b=>b.phrase!.role==='settle')!;expect(final.windup/4).toBeGreaterThanOrEqual(90);expect(final.impact/4).toBeGreaterThanOrEqual(160);
 for(const b of [...plan.values()].filter(b=>b.phrase!.role==='receipt')){expect(b.phrase!.paired).toBe(false);expect(b.phrase!.accentWeight).toBeLessThan(.3);}
});
it('uses bounded pentatonic phrases and low-weight repeated multipliers, resolving on the tonic',()=>{
 const plan=scorePhrase(events,'400');const beats=[...plan.values()];expect(new Set(beats.map(b=>b.phrase!.notePulse))).toEqual(new Set([0,1,2,3,4]));
 expect(beats.every(b=>b.phrase!.notePulse!>=0&&b.phrase!.notePulse!<=4)).toBe(true);
 for(const e of events){const b=plan.get(e.eventId)!;if(actualMultiplier(e)&&b.phrase!.role==='run')expect(b.phrase!.accentWeight).toBeLessThan(.6);if(b.phrase!.role==='accent'||b.phrase!.role==='settle')expect(b.phrase!.notePulse).toBe(0);}
});
it('keeps actual post-result growth out of the score climax',()=>{
 const f=scoreSourceProcessFixture('billion'),t=energySend(f.state,{type:'PlayHand',selectedIds:f.selectedIds}).lastTrace!,plan=scorePhrase(t.events,'400',4);
 const growth=t.events.find(e=>e.sourceType==='joker'&&e.phase==='afterHand'&&e.operation==='add-growth')!;expect(growth).toBeDefined();
 const receipt=plan.get(growth.eventId)!;expect(receipt.phrase!.role).toBe('receipt');expect(receipt.phrase!.paired).toBe(false);expect(receipt.phrase!.accentWeight).toBeLessThan(.3);expect(receipt.strike).toBeUndefined();
});
