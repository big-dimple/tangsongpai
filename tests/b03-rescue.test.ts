import {describe,it,expect} from 'vitest';
import {applyCommand,stateHash,type Command,type R2RunState} from '../src/domain/run';
import {b03RescueFixture,rescueStep} from './fixtures/b03-rescue';
import {bossSuitRescueEntry,bossSuitRescueQualified,bossSuitRescueAvailability,usesBossSuitRescue} from '../src/domain/r2BossSuitRescue';
import {r2ScoreContext,r2CreateJoker} from '../src/domain/r2Run';
import {previewR2Hand,scoreR2Hand} from '../src/domain/scoreR2';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {SavedRun,type SaveStore,type SaveSlots} from '../src/application/SavedRun';
import {makeCheckpoint,readCheckpoint,MAX_JOURNAL,type Checkpoint} from '../src/application/checkpoint';
import {stableHash} from '../src/domain/hash';
import {launchIdentity,newRunIdentity} from '../src/game/RunLaunch';
import {bossCardPressure} from '../src/game/BossPressure';

class Store implements SaveStore {
  slots:SaveSlots={revision:0,current:null,previous:null};fail=false;writes=0;hold?:()=>Promise<void>;
  async read(){return structuredClone(this.slots);}
  async commit(revision:number,current:ReturnType<typeof makeCheckpoint>,previous:ReturnType<typeof makeCheckpoint>|null){this.writes++;await this.hold?.();if(this.fail)throw Error('test-save-failed');if(revision!==this.slots.revision)throw Error('write-conflict');this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return revision+1;}
}
const command=(s:R2RunState,selectedIds:string[]):Command=>({runId:s.runId,commandId:'invalid',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds}});
const rechecksum=(checkpoint:Checkpoint)=>{const {checksum,...payload}=checkpoint;return {...payload,checksum:stableHash(payload)};};
const selected=(s:R2RunState)=>{const ranks=new Set();return s.handOrder.filter(id=>{const r=s.deckInstances.find(c=>c.id===id)!.rank;if(ranks.has(r))return false;ranks.add(r);return true;}).slice(0,5);};
const preview=(s:R2RunState,ids=selected(s))=>previewR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'preview',hand:s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),selectedIds:ids,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:s.stage!.playIndex+1,handsBeforePlay:s.stage!.handsLeft,previousHandType:s.stage!.previousHandType,wager:false,...r2ScoreContext(s,s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),ids)});
describe('B03 entry-qualified one-hand emergency',()=>{
  it('qualifies only nonempty living whole-deck snapshot and never rechecks visible cards',()=>{
    const {state:s}=b03RescueFixture(),{state:m}=b03RescueFixture({mixed:true});
    expect(bossSuitRescueAvailability(s).available).toBe(true);expect(bossSuitRescueAvailability(m).available).toBe(false);
    m.deckInstances.forEach(c=>c.suit='hearts');expect(m.handOrder.every(id=>m.deckInstances.find(c=>c.id===id)!.suit==='hearts')).toBe(true);expect(bossSuitRescueAvailability(m).available).toBe(false);
    expect(bossSuitRescueQualified(s.boss,bossSuitRescueEntry([],[],'e',1))).toBe(false);
    const cards=[{id:'living',rank:2 as const,suit:'hearts' as const},{id:'dead',rank:3 as const,suit:'spades' as const}];expect(bossSuitRescueQualified(s.boss,bossSuitRescueEntry(cards,['dead'],'e',1))).toBe(true);
    expect(bossSuitRescueAvailability(b03RescueFixture({boss:{definitionId:'B04',disabledSuit:null}}).state).available).toBe(false);
  });
  it('only new launch identities opt in; legacy restores and retries without extra fields or changed hash',()=>{
    const {state,journal}=b03RescueFixture({legacy:true}),before=stateHash(state);expect(usesBossSuitRescue(state)).toBe(false);expect(state.stage).not.toHaveProperty('bossSuitRescue');expect(readCheckpoint(makeCheckpoint(state,journal)).ok).toBe(true);
    expect(applyCommand(state,{...command(state,[]),action:{type:'BuyBossSuitRescue'}}).ok).toBe(false);expect(stateHash(state)).toBe(before);expect(launchIdentity('azao',{kind:'retry',run:state})).toEqual({contentVersion:state.contentVersion,contentHash:state.contentHash});
    for(const hero of ['amo','erxiang','laohuan','xiemu','touye','azao'] as const)expect(usesBossSuitRescue(newRunIdentity(hero))).toBe(true);
  });
  it('requires 5 gold, allows purchase after a play, keeps discard/hand budgets and forbids repurchase',()=>{
    const poor=b03RescueFixture({gold:4}).state;expect(bossSuitRescueAvailability(poor).available).toBe(false);expect(applyCommand(poor,{...command(poor,[]),action:{type:'BuyBossSuitRescue'}}).ok).toBe(false);const exact=rescueStep(b03RescueFixture({gold:5}).state,{type:'BuyBossSuitRescue'}).state;expect(exact.gold).toBe(0);
    let {state:s}=b03RescueFixture();s=rescueStep(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]}).state;const budget=[s.stage!.handsLeft,s.stage!.discardsLeft],before=s.gold;
    s=rescueStep(s,{type:'BuyBossSuitRescue'}).state;expect(s.gold).toBe(before-5);expect([s.stage!.handsLeft,s.stage!.discardsLeft]).toEqual(budget);expect(s.stage!.bossSuitRescue!.status).toBe('pending');
    expect(applyCommand(s,{...command(s,[]),action:{type:'BuyBossSuitRescue'}}).ok).toBe(false);
    s=rescueStep(s,{type:'DiscardHand',selectedIds:[s.handOrder[0]]}).state;expect(s.stage!.bossSuitRescue!.status).toBe('pending');expect(s.stage!.disabledIds).toEqual([]);
  });
  it('using an owned tool after purchase preserves pending exemption and the immutable entry snapshot',()=>{
    let s=b03RescueFixture().state;s.consumables=[{instanceId:'dye',definitionId:'T04'}];s=rescueStep(s,{type:'BuyBossSuitRescue'}).state;const snapshot=structuredClone(s.stage!.bossSuitRescue!.entry);s=rescueStep(s,{type:'UseConsumable',instanceId:'dye',targetIds:[s.handOrder[0]]}).state;expect(s.stage!.bossSuitRescue!.status).toBe('pending');expect(s.stage!.disabledIds).toEqual([]);expect(s.stage!.bossSuitRescue!.entry).toEqual(snapshot);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
  });
  it('previews and scores the original heart cards with enhancements/editions/synergy, then restores B03',()=>{
    let {state:s,journal}=b03RescueFixture({specials:true});s.jokers=[r2CreateJoker('c02','heart-joker',4,undefined,s)];s.stage!.initialJokerIds=['heart-joker'];
    const beforeCards=structuredClone(s.deckInstances),blocked=preview(s,selected(s).slice(0,1));const buy=rescueStep(s,{type:'BuyBossSuitRescue'});s=buy.state;journal.push(buy.command);
    const ids=selected(s).slice(0,1),p=preview(s,ids);expect(p.scoreRange.minimum).not.toBe(blocked.scoreRange.minimum);
    const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),ctx=r2ScoreContext(s,hand,ids);const reference=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:'ref',hand,selectedIds:ids,disabledIds:[],jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:s.stage!.playIndex+1,handsBeforePlay:s.stage!.handsLeft,previousHandType:s.stage!.previousHandType,wager:false,rng:s.rng.rule,...ctx,boss:null});
    const play=rescueStep(s,{type:'PlayHand',selectedIds:ids});s=play.state;journal.push(play.command);expect(s.lastTrace!.finalScore).toBe(reference.finalScore);expect(s.lastTrace!.events.some(e=>e.sourceDefinitionId==='c02')).toBe(true);expect(s.lastTrace!.events.some(e=>e.reasonKey.includes('heat-paper'))).toBe(true);expect(s.lastTrace!.events.some(e=>e.reasonKey.includes('foil'))).toBe(true);expect(s.lastTrace!.bossContext.boss?.definitionId).toBe('B03');expect(s.lastTrace!.bossSuitRescue).toBe(buy.command.commandId);expect(s.deckInstances).toEqual(beforeCards);expect(s.stage!.bossSuitRescue!.status).toBe('used');expect(s.phase).toBe('await-input');expect(BigInt(s.stage!.heat)).toBeLessThan(BigInt(s.stage!.targetHeat));expect(s.stage!.disabledIds).toEqual(s.handOrder);expect(readCheckpoint(makeCheckpoint(s,journal)).ok).toBe(true);
    const next=rescueStep(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]}).state;expect(next.lastTrace).not.toHaveProperty('bossSuitRescue');expect(next.lastTrace!.sets.activeScoringIds).toEqual([]);
  });
  it('invalid plays and previews preserve pending opportunity and RNG; pressure uses the same narrow exemption',()=>{
    const s=rescueStep(b03RescueFixture().state,{type:'BuyBossSuitRescue'}).state,before=stateHash(s);for(const ids of [[],['missing'],[s.handOrder[0],s.handOrder[0]]])expect(applyCommand(s,command(s,ids)).ok).toBe(false);preview(s);expect(stateHash(s)).toBe(before);
    const input={boss:s.stage!.boss,stageIndex:2,hand:s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!),selectedIds:[],jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),sealedJokerIds:[]};expect(bossCardPressure(input,s.handOrder[0])).toBeDefined();expect(bossCardPressure({...input,bossSuitRescue:true},s.handOrder[0])).toBeUndefined();
  });
  it('save failure at purchase and play publishes nothing; retries exact candidate once; cold restore preserves all three states',async()=>{
    const fixture=b03RescueFixture(),store=new Store();store.slots={revision:1,current:makeCheckpoint(fixture.state,fixture.journal),previous:null};let run=SavedRun.restore(store,await store.read());expect(run.state.stage!.bossSuitRescue!.status).toBe('unbought');const before=run.state;
    store.fail=true;expect((await run.dispatch({type:'BuyBossSuitRescue'})).ok).toBe(false);expect(run.state).toBe(before);expect(run.state.gold).toBe(6);store.fail=false;expect((await run.retry()).ok).toBe(true);expect(run.state.gold).toBe(1);
    run=SavedRun.restore(store,await store.read());expect(run.state.stage!.bossSuitRescue!.status).toBe('pending');const pending=run.state;store.fail=true;expect((await run.dispatch({type:'PlayHand',selectedIds:selected(run.state)})).ok).toBe(false);expect(run.state).toBe(pending);store.fail=false;expect((await run.retry()).ok).toBe(true);
    run=SavedRun.restore(store,await store.read());expect(run.state.stage!.bossSuitRescue!.status).toBe('used');expect(run.state.stage!.disabledIds).toEqual(run.state.handOrder);
  });
  it('double submission while purchase is persisting charges exactly once',async()=>{
    const {state,journal}=b03RescueFixture(),store=new Store();store.slots={revision:1,current:makeCheckpoint(state,journal),previous:null};const run=SavedRun.restore(store,await store.read());let release!:()=>void;store.hold=()=>new Promise<void>(resolve=>release=resolve);const first=run.dispatch({type:'BuyBossSuitRescue'}),second=await run.dispatch({type:'BuyBossSuitRescue'});expect(second.ok).toBe(false);expect(run.state.gold).toBe(6);release();expect((await first).ok).toBe(true);expect(run.state.gold).toBe(1);expect(store.writes).toBe(1);
  });
  it('a clear consumes the opportunity, restores the seal and carries no usable rescue to the next stage',()=>{
    let {state:s,journal}=b03RescueFixture();s=rescueStep(s,{type:'BuyBossSuitRescue'}).state;s.stage!.heat=(BigInt(s.stage!.targetHeat)-1n).toString();const result=rescueStep(s,{type:'PlayHand',selectedIds:selected(s)});s=result.state;expect(s.phase).toBe('stage-cleared');expect(s.stage!.bossSuitRescue!.status).toBe('used');expect(s.stage!.disabledIds).toEqual(s.handOrder);expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
    s=rescueStep(s,{type:'OpenShop'}).state;s=rescueStep(s,{type:'LeaveShop'}).state;s=rescueStep(s,{type:'EnterStage'}).state;expect(s.stage!.bossSuitRescue!.status).toBe('unbought');expect(bossSuitRescueAvailability(s).available).toBe(false);
  });
  it('real SavedRun dispatch commits entry facts and purchase clock, rejects explicit stale facts, and restores without a journal',async()=>{
    const f=b03RescueFixture(),store=new Store();f.ready.shop=null;store.slots={revision:1,current:makeCheckpoint(f.ready,f.readyJournal),previous:null};const run=SavedRun.restore(store,await store.read()),before=run.state;
    expect((await run.dispatch({type:'EnterStage',bossSuitRescueEntryToken:'wrong'})).ok).toBe(false);expect(run.state).toBe(before);expect((await run.dispatch({type:'EnterStage'})).ok).toBe(true);
    const entry=run.state.stage!.bossSuitRescue!.entry;expect(entry.token).toBe(stableHash(entry.cards));expect(run.journal.at(-1)!.action).toEqual({type:'EnterStage',bossSuitRescueEntryToken:entry.token});expect(bossSuitRescueAvailability(run.state).available).toBe(true);
    expect((await run.dispatch({type:'BuyBossSuitRescue',purchasePlayIndex:1})).ok).toBe(false);expect(run.state.gold).toBe(6);expect((await run.dispatch({type:'BuyBossSuitRescue'})).ok).toBe(true);expect(run.state.stage!.bossSuitRescue!.purchase!.playIndex).toBe(0);expect(readCheckpoint(makeCheckpoint(run.state,[])).ok).toBe(true);
  });
  it('rejects incomplete or recolored entry snapshots even with an empty journal and a recomputed token/checksum',()=>{
    const {state}=b03RescueFixture({mixed:true}),original=makeCheckpoint(state,[]);
    for(const edit of ['drop','recolor'] as const)for(const updateToken of [false,true]){
      const cp=structuredClone(original),entry=cp.state.stage!.bossSuitRescue!.entry;
      if(edit==='drop')entry.cards=entry.cards.filter(c=>c.suit==='hearts').slice(0,1);else entry.cards.forEach(c=>c.suit='hearts');
      if(updateToken)entry.token=stableHash(entry.cards);
      expect(cp.state.receipts).toEqual(original.state.receipts);
      expect(readCheckpoint(rechecksum(cp))).toMatchObject({ok:false,code:'invalid-save-boss-rescue-entry-proof'});
    }
    const unbound=structuredClone(original);unbound.state.stage!.bossSuitRescue!.entry.token=null;
    expect(readCheckpoint(rechecksum(unbound))).toMatchObject({ok:false,code:'invalid-save-boss-rescue-entry-proof'});
  });
  it('rejects used-to-pending after a later ordinary hand with empty or truncated journal, and binds the purchase clock',()=>{
    const fixture=b03RescueFixture();let s=fixture.state;const journal=[...fixture.journal];
    for(const action of [{type:'BuyBossSuitRescue'} as const,{type:'PlayHand',selectedIds:[s.handOrder[0]]} as const]){const next=rescueStep(s,action);s=next.state;journal.push(next.command);}
    const ordinary=rescueStep(s,{type:'PlayHand',selectedIds:[s.handOrder[0]]});s=ordinary.state;journal.push(ordinary.command);expect(s.lastTrace).not.toHaveProperty('bossSuitRescue');
    const empty=makeCheckpoint(s,[]);
    for(let i=0;i<MAX_JOURNAL+2;i++){const next=rescueStep(s,{type:'ReorderHand',ids:s.handOrder});s=next.state;journal.push(next.command);}
    const truncated=makeCheckpoint(s,journal);expect(truncated.journalBaseSeq).toBeGreaterThan(s.stage!.bossSuitRescue!.purchase!.seq);
    for(const original of [empty,truncated]){expect(readCheckpoint(original).ok).toBe(true);
      const erased=structuredClone(original);erased.state.stage!.bossSuitRescue!.status='unbought';erased.state.stage!.bossSuitRescue!.purchase=null;erased.state.stage!.bossSuitRescue!.play=null;
      expect(erased.state.receipts).toEqual(original.state.receipts);expect(readCheckpoint(rechecksum(erased))).toMatchObject({ok:false,code:'invalid-save-boss-rescue-erased-purchase'});
      for(const changeClock of [false,true]){
      const cp=structuredClone(original),r=cp.state.stage!.bossSuitRescue!;r.status='pending';r.play=null;cp.state.stage!.disabledIds=[];
      if(changeClock)r.purchase!.playIndex=cp.state.stage!.playIndex;
      expect(cp.state.receipts).toEqual(original.state.receipts);expect(readCheckpoint(rechecksum(cp))).toMatchObject({ok:false,code:changeClock?'invalid-save-boss-rescue-purchase':'Run invariant: boss rescue purchase clock'});
    }}
  });
});
