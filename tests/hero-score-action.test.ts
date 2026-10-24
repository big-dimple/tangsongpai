import {it,expect} from 'vitest';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {heroScoreAction,savedHeroCharge} from '../src/game/HeroScoreAction';
import {scorePhrase} from '../src/game/ScorePhrase';
import {scorePerformanceCue} from '../src/game/ScorePerformance';
import {applyCommand} from '../src/domain/run';
import {actualMultiplier} from '../src/domain/openingShow';

it.each(['amo','erxiang','azao','xiemu','touye','laohuan'] as const)('%s uses actual saved beneficiaries, separate costs and correct H/M channel',async hero=>{
 const f=await currentHeroReceipt(hero);let trace=f.trace,event=f.cue?.event;
 if(hero==='laohuan'){const result=await f.saved.dispatch({type:'PlayHand',selectedIds:[f.targetIds[0]]});expect(result.ok).toBe(true);trace=f.saved.state.lastTrace!;event=trace.events.find(e=>e.sourceType==='card'&&e.targetCardId===f.targetIds[0]&&e.operation==='add-heat');}
 const saved=JSON.stringify(trace),action=heroScoreAction(trace,event!,f.targetIds)!;expect(action?.positive).toBe(true);expect(action.contributions).toHaveLength(1);
 if(hero==='amo'){expect(action.targetIds).toEqual(trace.sets.activeScoringIds);expect(action.costIds).toEqual(trace.amoExile!.discardedIds);expect(action.costIds.some(id=>trace.cards.find(c=>c.id===id)?.rank===13)).toBe(true);expect(action.targetIds.every(id=>!action.costIds.includes(id))).toBe(true);}
 else {expect(action.costIds).toEqual([]);expect(action.targetIds).toEqual(f.targetIds);}
 expect(action.contributions[0].target).toBe(hero==='laohuan'?'H':'M');expect(action.contributions[0].kind).toBe(hero==='erxiang'?'add':hero==='laohuan'?'heat':'multiply');expect(!!actualMultiplier(event!)).toBe(!['erxiang','laohuan'].includes(hero));
 if(hero==='xiemu')expect(action.cost).toEqual({kind:'gold',before:40,after:37});if(hero==='azao')expect(action.cost).toEqual({kind:'charge',before:1,after:0});
 for(const speed of [1,2,4] as const){const beat=scorePhrase(trace.events,'100',speed,trace,f.targetIds).get(event!.eventId)!;expect(beat.strike).toBeDefined();expect(beat.phrase?.paired).toBe(true);const cue=scorePerformanceCue({state:f.after,score:trace,replay:false},event!,{generation:2,signal:new AbortController().signal},beat,speed,'impact')!;expect(cue.targetIds).toEqual(action.targetIds);expect(cue.sourceId).toBe(event!.sourceInstanceId);}
 expect(heroScoreAction(trace,{...event!,eventId:'not-saved'},f.targetIds)).toBeUndefined();expect(heroScoreAction({...trace,rootId:'wrong'},event!,f.targetIds)).toBeUndefined();expect(JSON.stringify(trace)).toBe(saved);
});

it('a failed Qin promise keeps pending new-card identities and a readable quiet slot, without a win packet or paired audio',async()=>{
 const f=await currentHeroReceipt('touye',true),event=f.cue!.event,action=heroScoreAction(f.trace,event)!;expect(action).toMatchObject({kind:'wager-lost',positive:false,targetIds:f.trace.touyeWager!.commit!.refill!.refilledIds,costIds:[]});
 expect(action.contributions[0].kind).toBe('multiply');expect(actualMultiplier(event)).toBeUndefined();for(const speed of [1,2,4]){const beat=scorePhrase(f.trace.events,'100',speed,f.trace).get(event.eventId)!;expect(beat.strike).toBeUndefined();expect(beat.phrase?.paired).toBe(false);expect(beat.impact/speed).toBeGreaterThanOrEqual(95);}
});

it('Wencheng charge is a real successful receipt after an actual qualified hand; release, failed/duplicate or unchanged charge is not a new charge',async()=>{
 const f=await currentHeroReceipt('azao'),before=structuredClone(f.before);before.handOrder=before.handOrder.map(id=>id==='clubs-2'?'clubs-8':id);before.drawPile=before.drawPile.map(id=>id==='clubs-8'?'clubs-2':id);const command={runId:before.runId,commandId:before.runId+'/next-charge',expectedSeq:before.commandSeq,action:{type:'PlayHand' as const,selectedIds:['spades-8','hearts-8','clubs-8']}};
 const result=applyCommand(before,command);if(!result.ok)throw Error(result.code);const snapshot=JSON.stringify(result),cue=savedHeroCharge(before,result)!;
 expect(cue).toMatchObject({eventId:command.commandId+'/azao-charge',sourceInstanceId:before.runId+'/character',before:1,after:2,gained:true,targetIds:['spades-8','hearts-8','clubs-8']});expect(result.state.lastTrace!.events.some(e=>e.eventId===cue.eventId)).toBe(false);
 expect(savedHeroCharge(before,{...result,duplicate:true})).toBeUndefined();expect(savedHeroCharge(before,{ok:false,state:before,code:'save-failed'})).toBeUndefined();expect(savedHeroCharge({...before,runId:'other'},result)).toBeUndefined();expect(savedHeroCharge(before,{...result,events:[]})).toBeUndefined();
 const released=applyCommand(before,{...command,commandId:before.runId+'/release',action:{...command.action,azaoRelease:true}});expect(released.ok).toBe(true);expect(savedHeroCharge(before,released)).toBeUndefined();expect(JSON.stringify(result)).toBe(snapshot);
 const same=applyCommand(before,{...command,commandId:before.runId+'/reset',action:{type:'PlayHand',selectedIds:['spades-8','hearts-8','clubs-7','diamonds-7']}});expect(savedHeroCharge(before,same)).toMatchObject({before:1,after:0,gained:false});
});
