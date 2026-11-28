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

/** Boundary cases use a real trace/event shape with controlled accumulator and target values. */
function scenario(beforeH:ReturnType<typeof f>,beforeM:ReturnType<typeof f>,afterH:ReturnType<typeof f>,afterM:ReturnType<typeof f>,options:{
  operation?:string;phase?:ScoreEvent['phase'];reasonKey?:string;finalScore?:string;
}={}){
  const event:ScoreEvent={...multiply,phase:options.phase??'jokerScore',operation:options.operation??'multiply-multiplier',
    reasonKey:options.reasonKey??multiply.reasonKey,before:{H:beforeH,M:beforeM},after:{H:afterH,M:afterM}};
  const finalScore=options.finalScore??String((BigInt(afterH.n)*BigInt(afterM.n))/(BigInt(afterH.d)*BigInt(afterM.d)));
  const trace:ScoreTrace={...structuredClone(committed),finalScore,events:[event]};
  return {trace,event};
}
const cue=(trace:ScoreTrace,event:ScoreEvent,replay=false,targetHeat?:string)=>scoreHighMultiplierCue(trace,event.eventId,replay,targetHeat);

describe('committed single-hand one-shot aura cue',()=>{
  it('ignites tier 1 on exact >= targetHeat crossing and tier 2 on >= 2x targetHeat overkill',()=>{
    const snapshot=JSON.stringify(committed);
    expect(committed.finalScore).toBe('11280');
    expect(cue(committed,multiply,false,'11280')).toEqual({rootId:committed.rootId,eventId:multiply.eventId,kind:'one-shot',tier:1});
    expect(cue(committed,multiply,false,'5641')).toEqual({rootId:committed.rootId,eventId:multiply.eventId,kind:'one-shot',tier:1});
    expect(cue(committed,multiply,false,'11281')).toBeUndefined();
    const overkill=scenario(f(200),f(2),f(400),f(4),{finalScore:'1600'});
    expect(cue(overkill.trace,overkill.event,false,'800')).toEqual({rootId:overkill.trace.rootId,eventId:overkill.event.eventId,kind:'overkill-two-x',tier:2});
    expect(firstScoreHighMultiplierCue(committed,false,'5640')).toMatchObject({rootId:committed.rootId,kind:'overkill-two-x',tier:2});
    expect(JSON.stringify(committed)).toBe(snapshot);
  });

  it('stays quiet when finalScore < targetHeat even if M >= 10 or >= 20, and ignores replay',()=>{
    const highMult=scenario(f(10),f(10),f(10),f(30),{finalScore:'300'});
    expect(cue(highMult.trace,highMult.event,false,'400')).toBeUndefined();
    expect(firstScoreHighMultiplierCue(highMult.trace,false,'400')).toBeUndefined();
    expect(cue(committed,multiply,true,'3000')).toBeUndefined();
    expect(firstScoreHighMultiplierCue(committed,true,'3000')).toBeUndefined();
  });

  it('supports every scoring phase (including base, onCardScore, onHeldCard, characterScore, jokerScore, routeGrowth) on real and controlled traces',async()=>{
    const baseEvent=committed.events[0];
    expect(baseEvent.phase).toBe('base');
    const baseOnly={...structuredClone(committed),finalScore:'400',events:[baseEvent]};
    expect(cue(baseOnly,baseEvent,false,'200')).toEqual({rootId:committed.rootId,eventId:baseEvent.eventId,kind:'overkill-two-x',tier:2});
    expect(firstScoreHighMultiplierCue(baseOnly,false,'200')).toEqual({rootId:committed.rootId,eventId:baseEvent.eventId,kind:'overkill-two-x',tier:2});

    for(const phase of ['onCardScore','onHeldCard','characterScore','jokerScore','routeGrowth'] as const){
      const {trace,event}=scenario(f(100),f(2),f(100),f(5),{phase,finalScore:'500'});
      expect(cue(trace,event,false,'400')).toEqual({rootId:trace.rootId,eventId:event.eventId,kind:'one-shot',tier:1});
      expect(cue(trace,event,false,'250')).toEqual({rootId:trace.rootId,eventId:event.eventId,kind:'overkill-two-x',tier:2});
    }

    const receipt=await currentHeroReceipt('erxiang'),handoff=receipt.trace.events.filter(e=>e.reasonKey==='erxiang.handoff').at(-1)!;
    expect(firstScoreHighMultiplierCue(receipt.trace,false,receipt.trace.finalScore)).toEqual({rootId:receipt.trace.rootId,eventId:handoff.eventId,kind:'one-shot',tier:1});
    const loss=await currentHeroReceipt('touye',true);
    expect(cue(loss.trace,loss.cue!.event,false,'400')).toBeUndefined();

    const route=scoreR2Hand({...input,definitions:R2_ROUTE_GROWTH_JOKERS,jokers:[],routeGrowth:{clears:6,G:0,S:6,F:0}});
    const routeEvent=route.events.find(e=>e.operation==='route-factor'&&e.routeFamily==='S')!;
    expect(cue(route,routeEvent,false,route.finalScore)?.kind).toBe('one-shot');
  });

  it('compares exact BigInt scores far beyond Number precision and rejects zero/invalid/missing targets',()=>{
    const d=10n**200n;
    const huge=scenario(f(199n),f(1n),f(400n*d,d),f(1n),{finalScore:(400n*d/d).toString()});
    expect(cue(huge.trace,huge.event,false,'400')?.kind).toBe('one-shot');
    expect(cue(huge.trace,huge.event,false,'200')?.kind).toBe('overkill-two-x');
    expect(cue(huge.trace,huge.event,false,'401')).toBeUndefined();

    for(const badTarget of [undefined,'','0','-10','abc','10'.repeat(100)] as const){
      expect(cue(committed,multiply,false,badTarget)).toBeUndefined();
      expect(firstScoreHighMultiplierCue(committed,false,badTarget)).toBeUndefined();
    }
  });

  it('uses the saved Su Shi exile integer scores when crossing targetHeat',()=>{
    const exile=scoreR2Hand({...input,characterId:'amo',jokers:[],hand:[...hand,{id:'hearts-13',suit:'hearts',rank:13}],
      amoScoreTiming:'exile-v1',amoExile:{use:true,beforeUsed:false},amoExileKing:true,heroBalance:true});
    const exileEvent=exile.events.find(event=>event.reasonKey==='amo.exile')!;
    expect(cue(exile,exileEvent,false,exile.finalScore)).toMatchObject({kind:'one-shot',tier:1});

    const test=scenario(f(1,10),f(10),f(1,10),f(30),{reasonKey:'amo.exile',finalScore:'300'});
    test.trace.amoExile={use:true,beforeUsed:false,afterUsed:true,discardedIds:['king'],beforeScore:'299',afterScore:'300'};
    expect(cue(test.trace,test.event,false,'300')).toMatchObject({kind:'one-shot',tier:1});
    test.trace.amoExile={...test.trace.amoExile,beforeScore:'300',afterScore:'900'};
    expect(cue(test.trace,test.event,false,'300')).toBeUndefined();
    test.trace.amoExile={...test.trace.amoExile,beforeScore:'100',afterScore:null};
    expect(cue(test.trace,test.event,false,'300')).toBeUndefined();
  });

  it('ignores preview, wrong root, missing event, already-crossed non-base events, and non-scoring phases',()=>{
    const {rng,...publicInput}=input;void rng;
    const preview=previewR2Hand(publicInput);
    const projected=preview.breakdown.events.find(event=>event.operation==='multiply-multiplier'&&event.sourceDefinitionId==='huimaqiang')!;
    expect(scoreHighMultiplierCue(preview as unknown as ScoreTrace,projected.eventId,false,'100')).toBeUndefined();
    expect(scoreHighMultiplierCue({...preview,rulesVersion:'r2',rootId:input.rootId,events:preview.breakdown.events,finalScore:'9999'} as unknown as ScoreTrace,projected.eventId,false,'100')).toBeUndefined();
    expect(scoreHighMultiplierCue(committed,'missing',false,'100')).toBeUndefined();
    const wrongRoot=structuredClone(committed);wrongRoot.rootId='another-hand';expect(cue(wrongRoot,multiply,false,'100')).toBeUndefined();
    const alreadyPassed=scenario(f(500),f(1),f(800),f(1),{phase:'jokerScore',finalScore:'800'});
    expect(cue(alreadyPassed.trace,alreadyPassed.event,false,'400')).toBeUndefined();
    for(const phase of ['finalScore','afterHand','beforeFailure','onStageClear'] as const){
      const test=scenario(f(100),f(1),f(500),f(1),{phase,finalScore:'500'});expect(cue(test.trace,test.event,false,'400')).toBeUndefined();
    }
  });

  it('selects the first eligible event in order with linear event identity reads',()=>{
    expect(firstScoreHighMultiplierCue(committed,false,'11280')).toEqual(cue(committed,multiply,false,'11280'));
    const early={...scenario(f(100),f(1),f(200),f(1),{finalScore:'1000'}).event,eventId:'below'};
    const foreign={...scenario(f(100),f(1),f(600),f(1),{finalScore:'1000'}).event,rootId:'another-hand',eventId:'foreign'};
    const crossing={...scenario(f(200),f(1),f(500),f(1),{finalScore:'1000'}).event,eventId:'first'};
    const second={...scenario(f(500),f(1),f(1000),f(1),{finalScore:'1000'}).event,eventId:'second'};
    const trace={...structuredClone(committed),finalScore:'1000',events:[early,foreign,crossing,second]};
    const snapshot=JSON.stringify(trace);
    expect(firstScoreHighMultiplierCue(trace,false,'500')).toEqual({rootId:trace.rootId,eventId:'first',kind:'overkill-two-x',tier:2});
    expect(JSON.stringify(trace)).toBe(snapshot);

    const count=180,longTrace={...structuredClone(committed),finalScore:'500'};let identityReads=0;
    longTrace.events=Array.from({length:count},(_,i)=>{
      const event=scenario(f(i===count-1?100:50),f(1),f(i===count-1?500:100),f(1),{finalScore:'500'}).event;
      Object.defineProperty(event,'eventId',{enumerable:true,get:()=>{identityReads++;return `event/${i}`;}});
      return event;
    });
    expect(firstScoreHighMultiplierCue(longTrace,false,'500')?.eventId).toBe(`event/${count-1}`);
    expect(identityReads).toBeLessThan(count*4);
  });
});
