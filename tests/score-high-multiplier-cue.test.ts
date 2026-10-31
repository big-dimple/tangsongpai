import {describe,expect,it} from 'vitest';
import {R2_JOKERS} from '../src/content/r2Schema';
import {R2_ROUTE_GROWTH_JOKERS} from '../src/content/r2RouteGrowthJokers';
import {r2CreateJoker} from '../src/domain/r2Run';
import {previewR2Hand,scoreR2Hand,type ScoreEvent,type ScoreInput,type ScoreTrace} from '../src/domain/scoreR2';
import {firstScoreHighMultiplierCue,scoreHighMultiplierCue} from '../src/game/ScoreHighMultiplierCue';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';

const hand=([9,10,11,12,13] as const).map(rank=>({id:`spades-${rank}`,suit:'spades' as const,rank}));
const input:ScoreInput={rulesVersion:'r2',runId:'aura-test',rootId:'aura-test/hand',characterId:'neutral',hand,
  selectedIds:hand.map(card=>card.id),disabledIds:[],jokers:[r2CreateJoker('huimaqiang','owned/huimaqiang',4)],
  definitions:R2_JOKERS,handLevels:{'straight-flush':2},playIndex:3,handsBeforePlay:4,previousHandType:null,
  wager:false,rng:{algorithm:'fnv1a-mulberry32-v1',state:17}};
const committed=scoreR2Hand(input);
const multiply=committed.events.find(event=>event.sourceDefinitionId==='huimaqiang'&&event.operation==='multiply-multiplier')!;
const f=(n:string|number|bigint,d:string|number|bigint=1)=>({n:String(n),d:String(d)});

/** Boundary cases use a real trace/event shape with controlled accumulator values. */
function scenario(beforeM:ReturnType<typeof f>,afterM:ReturnType<typeof f>,options:{
  beforeH?:ReturnType<typeof f>;afterH?:ReturnType<typeof f>;operation?:string;phase?:ScoreEvent['phase'];reasonKey?:string;
}={}){
  const event:ScoreEvent={...multiply,phase:options.phase??'jokerScore',operation:options.operation??'multiply-multiplier',
    reasonKey:options.reasonKey??multiply.reasonKey,before:{H:options.beforeH??f(10),M:beforeM},after:{H:options.afterH??options.beforeH??f(10),M:afterM}};
  const trace=structuredClone(committed);trace.events=[event];return {trace,event};
}
const cue=(trace:ScoreTrace,event:ScoreEvent,replay=false)=>scoreHighMultiplierCue(trace,event.eventId,replay);

describe('committed high multiplier cue',()=>{
  it('recognizes a real ×2 event when the multiplier is already ten',()=>{
    expect(multiply.before.M).toEqual(f(10));expect(multiply.after.M).toEqual(f(20));
    const snapshot=JSON.stringify(committed);
    expect(cue(committed,multiply)).toEqual({rootId:committed.rootId,eventId:multiply.eventId,kind:'doubled-at-ten'});
    expect(cue(committed,multiply)).toEqual(cue(committed,multiply));
    expect(JSON.stringify(committed)).toBe(snapshot);
  });

  it('recognizes the actual saved Liu E handoff crossing ten and ignores replay',async()=>{
    const receipt=await currentHeroReceipt('erxiang'),event=receipt.cue!.event;
    expect(event.reasonKey).toBe('erxiang.handoff');
    expect(event.before.M).toEqual(f(2));expect(event.after.M).toEqual(f(10));
    expect(cue(receipt.trace,event)).toEqual({rootId:receipt.trace.rootId,eventId:event.eventId,kind:'crossed-ten'});
    expect(cue(receipt.trace,event,true)).toBeUndefined();
  });

  it('keeps early-game multipliers and a real failed Qin wager quiet',async()=>{
    for(const [before,after] of [[1,2],[2,4],[4,8]]){
      const {trace,event}=scenario(f(before),f(after));expect(cue(trace,event)).toBeUndefined();
    }
    const loss=await currentHeroReceipt('touye',true),event=loss.cue!.event;
    expect(event.reasonKey).toMatch(/^touye\.lost\./);expect(cue(loss.trace,event)).toBeUndefined();
  });

  it('accepts a real route factor and rejects a small factor or additive gain once already above ten',()=>{
    const route=scoreR2Hand({...input,definitions:R2_ROUTE_GROWTH_JOKERS,jokers:[],routeGrowth:{clears:6,G:0,S:6,F:0}});
    const routeEvent=route.events.find(event=>event.operation==='route-factor'&&event.routeFamily==='S')!;
    expect(routeEvent.before.M).toEqual(f(10));expect(routeEvent.value).toEqual(f(343,125));
    expect(cue(route,routeEvent)?.kind).toBe('doubled-at-ten');
    for(const operation of ['multiply-multiplier','read-coefficient','rescue-multiplier','route-factor']){
      const eligible=scenario(f(10),f(20),{operation});expect(cue(eligible.trace,eligible.event)?.kind).toBe('doubled-at-ten');
    }
    const small=scenario(f(10),f(19),{operation:'multiply-multiplier'});
    const additive=scenario(f(10),f(20),{operation:'add-multiplier'});
    expect(cue(small.trace,small.event)).toBeUndefined();expect(cue(additive.trace,additive.event)).toBeUndefined();
    const crossing=scenario(f(9),f(10),{operation:'read-growth'});
    expect(cue(crossing.trace,crossing.event)?.kind).toBe('crossed-ten');
  });

  it('compares fractional boundaries exactly even far beyond Number precision',()=>{
    const d=10n**200n,h=f(d);
    const below=scenario(f(10n*d-1n,d),f(10),{beforeH:h,operation:'add-multiplier'});
    expect(cue(below.trace,below.event)?.kind).toBe('crossed-ten');
    const notQuite=scenario(f(10),f(20n*d-1n,d),{beforeH:h});
    const exactly=scenario(f(10),f(20),{beforeH:h});
    expect(cue(notQuite.trace,notQuite.event)).toBeUndefined();
    expect(cue(exactly.trace,exactly.event)?.kind).toBe('doubled-at-ten');
  });

  it('requires a positive integer score gain, not just a bigger multiplier',()=>{
    for(const test of [
      scenario(f(10),f(10)),scenario(f(10),f(5)),
      scenario(f(10),f(20),{beforeH:f(0)}),
      scenario(f(9),f(10),{beforeH:f(1,100)}),
      scenario(f(10),f(20),{beforeH:f(10),afterH:f(1)}),
      scenario(f(-10),f(20)),scenario(f(10),f(20),{beforeH:f(-1)}),
    ])expect(cue(test.trace,test.event)).toBeUndefined();
  });

  it('uses the saved Su Shi exile integer scores, including floor-before-multiply',()=>{
    const exile=scoreR2Hand({...input,characterId:'amo',jokers:[],hand:[...hand,{id:'hearts-13',suit:'hearts',rank:13}],
      amoScoreTiming:'exile-v1',amoExile:{use:true,beforeUsed:false},amoExileKing:true,heroBalance:true});
    const exileEvent=exile.events.find(event=>event.reasonKey==='amo.exile')!;
    expect(exileEvent.before.M).toEqual(f(10));expect(exileEvent.after.M).toEqual(f(30));
    expect(cue(exile,exileEvent)?.kind).toBe('doubled-at-ten');
    const test=scenario(f(10),f(30),{beforeH:f(1,20),reasonKey:'amo.exile'});
    test.trace.amoExile={use:true,beforeUsed:false,afterUsed:true,discardedIds:['king'],beforeScore:'0',afterScore:'0'};
    // floor(30/20) is 1, but exile actually computes floor(10/20) * 3 = 0.
    expect(cue(test.trace,test.event)).toBeUndefined();
    test.trace.amoExile={...test.trace.amoExile,beforeScore:'1',afterScore:'3'};
    test.event.before.H=f(1,10);test.event.after.H=f(1,10);
    expect(cue(test.trace,test.event)?.kind).toBe('doubled-at-ten');
    test.trace.amoExile={...test.trace.amoExile,afterScore:null};
    expect(cue(test.trace,test.event)).toBeUndefined();
  });

  it('ignores preview, unrelated or wrong-root events and non-scoring bookkeeping',()=>{
    const {rng,...publicInput}=input;void rng;
    const preview=previewR2Hand(publicInput);
    const projected=preview.breakdown.events.find(event=>event.operation==='multiply-multiplier'&&event.sourceDefinitionId==='huimaqiang')!;
    expect(projected.after.M).toEqual(f(20));
    expect(scoreHighMultiplierCue(preview as unknown as ScoreTrace,projected.eventId,false)).toBeUndefined();
    expect(scoreHighMultiplierCue({...preview,rulesVersion:'r2',rootId:input.rootId,events:preview.breakdown.events} as unknown as ScoreTrace,projected.eventId,false)).toBeUndefined();
    expect(scoreHighMultiplierCue(committed,'missing',false)).toBeUndefined();
    const wrongRoot=structuredClone(committed);wrongRoot.rootId='another-hand';expect(cue(wrongRoot,multiply)).toBeUndefined();
    for(const phase of ['base','finalScore','afterHand','beforeFailure','onStageClear'] as const){
      const test=scenario(f(10),f(20),{phase});expect(cue(test.trace,test.event)).toBeUndefined();
    }
  });

  it('selects the first eligible trace event in order and agrees with the single-event API',()=>{
    expect(firstScoreHighMultiplierCue(committed,false)).toEqual(cue(committed,multiply));
    const low=scenario(f(2),f(4)).event;
    const foreign={...scenario(f(9),f(10)).event,rootId:'another-hand'};
    const zero=scenario(f(9),f(10),{beforeH:f(0)}).event;
    const crossing={...scenario(f(9),f(10),{operation:'add-multiplier'}).event,eventId:'first'};
    const doubled={...scenario(f(10),f(20)).event,eventId:'second'};
    const trace=structuredClone(committed);trace.events=[low,foreign,zero,crossing,doubled];
    const snapshot=JSON.stringify(trace);
    expect(firstScoreHighMultiplierCue(trace,false)).toEqual(cue(trace,crossing));
    expect(firstScoreHighMultiplierCue(trace,false)?.eventId).toBe('first');
    expect(JSON.stringify(trace)).toBe(snapshot);
    trace.events=[doubled,crossing,zero,foreign,low];
    expect(firstScoreHighMultiplierCue(trace,false)).toEqual(cue(trace,doubled));
  });

  it('does not select empty, replayed, preview, or entirely ineligible traces',()=>{
    const empty=structuredClone(committed);empty.events=[];
    expect(firstScoreHighMultiplierCue(undefined,false)).toBeUndefined();
    expect(firstScoreHighMultiplierCue(null,false)).toBeUndefined();
    expect(firstScoreHighMultiplierCue(empty,false)).toBeUndefined();
    expect(firstScoreHighMultiplierCue(committed,true)).toBeUndefined();
    const ineligible=scenario(f(2),f(4));
    expect(firstScoreHighMultiplierCue(ineligible.trace,false)).toBeUndefined();
    const {rng,...publicInput}=input;void rng;
    expect(firstScoreHighMultiplierCue(previewR2Hand(publicInput) as unknown as ScoreTrace,false)).toBeUndefined();
  });

  it('continues past an exile with zero saved gain but selects one with a real saved gain',()=>{
    const exile=scenario(f(10),f(30),{beforeH:f(1,20),reasonKey:'amo.exile'});
    const later={...scenario(f(9),f(10)).event,eventId:'later'};
    exile.trace.events=[exile.event,later];
    exile.trace.amoExile={use:true,beforeUsed:false,afterUsed:true,discardedIds:['king'],beforeScore:'0',afterScore:'0'};
    expect(firstScoreHighMultiplierCue(exile.trace,false)).toEqual(cue(exile.trace,later));
    exile.trace.amoExile={...exile.trace.amoExile,beforeScore:'1',afterScore:'3'};
    exile.event.before.H=f(1,10);exile.event.after.H=f(1,10);
    expect(firstScoreHighMultiplierCue(exile.trace,false)).toEqual(cue(exile.trace,exile.event));
  });

  it('selects through a long trace with linear event identity reads',()=>{
    const count=180,trace=structuredClone(committed);let identityReads=0;
    trace.events=Array.from({length:count},(_,i)=>{
      const event=scenario(f(i===count-1?10:2),f(i===count-1?20:4)).event;
      Object.defineProperty(event,'eventId',{enumerable:true,get:()=>{identityReads++;return `event/${i}`;}});
      return event;
    });
    expect(firstScoreHighMultiplierCue(trace,false)?.eventId).toBe(`event/${count-1}`);
    expect(identityReads).toBeLessThan(count*4);
  });
});
