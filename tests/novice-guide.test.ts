import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import type {Checkpoint} from '../src/application/checkpoint';
import {createRun,type Action} from '../src/domain/run';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {cardDisplayName} from '../src/game/tangsongCardNames';
import {clearPendingNoviceStart,dismissNoviceGuide,enrollNoviceGuide,liveNoviceGuide,markNoviceStart,mayResumeNoviceOpening,noviceGuide,noviceGuideDisabled,noviceGuideEnrolled,novicePairResultCue,NOVICE_GUIDE_KEY,NOVICE_GUIDE_PENDING_PREFIX,restoreNoviceGuide,stopNoviceGuide,suppressImportedNovice} from '../src/game/NoviceGuide';

class Store implements SaveStore {
 slots:SaveSlots={revision:0,current:null,previous:null};fail=false;
 async read(){return structuredClone(this.slots);}
 async commit(revision:number,current:Checkpoint,previous:Checkpoint|null){
  if(this.fail)throw Error('storage-error');if(revision!==this.slots.revision)throw Error('write-conflict');
  this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return revision+1;
 }
}
let values:Map<string,string>;
beforeEach(()=>{
 values=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
});
afterEach(()=>vi.unstubAllGlobals());
async function start(id='test'){
 const suffix=Array.from(id).map(char=>char.charCodeAt(0).toString(16)).join('').slice(0,12).padEnd(12,'0');
 const store=new Store(),state=createRun({seed:'r2/tutorial/core-v1',runId:guidedTutorialRunId(`00000000-0000-4000-8000-${suffix}`),
  characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group',
  modeConfig:{mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false}});
 markNoviceStart(state.runId);
 const run=await SavedRun.start(store,state,await store.read());enrollNoviceGuide(run.state);return {run,store};
}
async function send(run:SavedRun,action:Action){const r=await run.dispatch(action);if(!r.ok)throw Error(r.code);return r;}
const guide=(run:SavedRun)=>noviceGuide(run.state,run.journal);
async function enter(run:SavedRun){await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});}
async function pairAndDiscard(run:SavedRun){
 await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
 await send(run,{type:'DiscardHand',selectedIds:['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']});
}
async function clearFirst(run:SavedRun){
 await pairAndDiscard(run);
 const hearts=run.state.handOrder.filter(id=>id.startsWith('hearts-'));
 expect(hearts.length).toBeGreaterThanOrEqual(5);
 await send(run,{type:'PlayHand',selectedIds:hearts.slice(0,5)});
 expect(run.state.phase).toBe('stage-cleared');
}
async function findPairWithRealDiscards(run:SavedRun):Promise<string[]> {
 for(let attempt=0;attempt<4;attempt++){
  const groups=new Map<number,string[]>();
  for(const id of run.state.handOrder){const rank=run.state.deckInstances.find(c=>c.id===id)!.rank;groups.set(rank,[...(groups.get(rank)??[]),id]);}
  const pair=[...groups.values()].find(ids=>ids.length>=2);if(pair)return pair.slice(0,2);
  expect(run.state.stage!.discardsLeft).toBeGreaterThan(0);
  await send(run,{type:'DiscardHand',selectedIds:run.state.handOrder.slice(0,5)});
 }
 throw Error('controlled tutorial did not produce a pair after actual discards');
}

describe('guided first match from saved commands',()=>{
 it('never prints an untrue equality when the committed score was rounded down',()=>{
  const accumulator={H:{n:'5',d:'2'},M:{n:'1',d:'1'}};
  expect(novicePairResultCue({accumulator,finalScore:'2'})).toBe('对子得 2 分');
  expect(novicePairResultCue({accumulator:{...accumulator,M:{n:'2',d:'1'}},finalScore:'5'})).toBe('5/2 筹码 × 2 倍率 = 5 分');
 });
 it('follows a real pair, replacement, independent play, purchase and positive contribution, surviving restoration',async()=>{
  const {run,store}=await start();await enter(run);
  expect(guide(run)).toMatchObject({step:'pair',recommendedCardIds:['clubs-5','hearts-5']});
  expect(guide(run)!.body).toContain('花色');
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
  expect(guide(run)).toMatchObject({step:'discard',fact:{pairScore:'90'}});
  expect(guide(run)!.cue).toBe('45 筹码 × 2 倍率 = 90 分');expect(guide(run)!.body).toContain('弃牌');
  await send(run,{type:'DiscardHand',selectedIds:['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']});
  expect(guide(run)?.step).toBe('independent');
  expect(guide(run)!.cue).toContain('400');expect(guide(run)!.body).toContain('自己选牌');
  const restored=SavedRun.restore(store,await store.read());expect(guide(restored)?.step).toBe('independent');
  await send(restored,{type:'PlayHand',selectedIds:restored.state.handOrder.filter(id=>id.startsWith('hearts-')).slice(0,5)});
  expect(restored.state.phase).toBe('stage-cleared');expect(guide(restored)?.step).toBe('shop');
  await send(restored,{type:'OpenShop'});
  const offer=restored.state.shop!.offers.find(o=>o.definitionId==='b02')!;
  expect(offer).toBeDefined();expect(guide(restored)?.offerIds?.[0]).toBe(offer.offerId);
  expect(guide(restored)?.body).toContain(cardDisplayName('b02'));expect(guide(restored)?.body).not.toContain('对上眼');
  await send(restored,{type:'BuyOffer',offerId:offer.offerId});
  const bought=restored.state.jokers.find(j=>j.definitionId==='b02')!;
  expect(guide(restored)).toMatchObject({step:'payoff',fact:{purchaseInstanceId:bought.instanceId}});
  await send(restored,{type:'LeaveShop'});await send(restored,{type:'EnterStage'});
  expect(guide(restored)?.step).toBe('payoff');
  expect(restored.state.handOrder).toEqual(expect.arrayContaining(['clubs-6','spades-6']));
  await send(restored,{type:'PlayHand',selectedIds:['clubs-6','spades-6']});
  const event=restored.state.lastTrace!.events.find(e=>e.sourceType==='joker'&&e.sourceInstanceId===bought.instanceId&&e.operation==='add-multiplier')!;
  expect(event).toBeDefined();expect(guide(restored)).toMatchObject({step:'skill',fact:{eventId:event.eventId,purchaseInstanceId:bought.instanceId}});
  expect(guide(restored)!.fact?.contribution).toBe('让2张计分牌各加 0.25 倍率');
  expect(guide(restored)!.cue).toContain('倍率 +0.5');
  const again=SavedRun.restore(store,await store.read());expect(guide(again)).toMatchObject({step:'skill',fact:{eventId:event.eventId}});
  const pair=await findPairWithRealDiscards(again);
  const invalid=await again.dispatch({type:'PlayHand',selectedIds:pair,erxiangTargetId:'not-in-hand'});expect(invalid.ok).toBe(false);expect(guide(again)?.step).toBe('skill');
  await send(again,{type:'PlayHand',selectedIds:pair,erxiangTargetId:pair[0]});
  const skill=again.state.lastTrace!.events.find(e=>e.reasonKey==='erxiang.handoff');expect(skill).toBeDefined();
  expect(guide(again)).toMatchObject({step:'skill-practice',fact:{eventId:event.eventId,skillEventId:skill!.eventId}});
  const restoredSkill=SavedRun.restore(store,await store.read());expect(guide(restoredSkill)?.step).toBe('skill-practice');
  if(restoredSkill.state.phase==='stage-cleared'){await send(restoredSkill,{type:'OpenShop'});await send(restoredSkill,{type:'LeaveShop'});await send(restoredSkill,{type:'EnterStage'});}
  await send(restoredSkill,{type:'PlayHand',selectedIds:[restoredSkill.state.handOrder[0]]});
  expect(guide(restoredSkill)).toMatchObject({step:'complete',fact:{eventId:event.eventId,skillEventId:skill!.eventId}});
 });

 it('keeps errors and a duplicate from becoming successful lessons',async()=>{
  const {run}=await start();await enter(run);
  const bad=await run.dispatch({type:'PlayHand',selectedIds:[]});expect(bad.ok).toBe(false);expect(guide(run)?.step).toBe('pair');
  await send(run,{type:'PlayHand',selectedIds:['clubs-7']});expect(guide(run)?.step).toBe('pair');
  expect(guide(run)?.cue).toBe('再找一对');
  const command=run.journal.at(-1)!;const repeat=await run.submit(command);
  expect(repeat).toMatchObject({ok:true,duplicate:true});expect(guide(run)?.step).toBe('pair');
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});expect(guide(run)?.step).toBe('discard');
 });

 it('requires a purchased instance to contribute, not just be owned or used on an unrelated hand',async()=>{
  const {run}=await start();await enter(run);await clearFirst(run);await send(run,{type:'OpenShop'});
  const offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
  await send(run,{type:'BuyOffer',offerId:offer.offerId});const bought=run.state.jokers.find(j=>j.definitionId==='b02')!;
  await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});
  const nonPair=run.state.handOrder.find(id=>!['clubs-6','spades-6'].includes(id))!;
  await send(run,{type:'PlayHand',selectedIds:[nonPair]});
  expect(run.state.lastTrace!.events.some(e=>e.sourceType==='joker'&&e.sourceInstanceId===bought.instanceId)).toBe(false);
  expect(guide(run)?.step).toBe('payoff');
  await send(run,{type:'PlayHand',selectedIds:['clubs-6','spades-6']});
  expect(guide(run)?.step).toBe('skill');
 });

 it('updates prompts from live selections without treating them as saved progress',async()=>{
  const {run}=await start('live');await enter(run);const hint=guide(run)!;
  const skill={available:false,chosen:false,enabled:true,canDiscard:true};
  expect(liveNoviceGuide(hint,[],skill).cue).toBe('先找一对');
  expect(liveNoviceGuide(hint,['clubs-5'],skill).cue).toBe('再选另一张');
  expect(liveNoviceGuide(hint,['clubs-5','hearts-5'],skill)).toMatchObject({cue:'对子选好了',focus:'play'});
  expect(liveNoviceGuide(hint,['clubs-5','clubs-4'],skill).cue).toBe('再找一对');
  expect(guide(run)?.step).toBe('pair');expect(run.state.stage!.playIndex).toBe(0);
  const skillHint={step:'skill' as const,cue:'练习技能',body:'选对子',recommendedCardIds:['a','b']};
  expect(liveNoviceGuide(skillHint,['a','b'],{...skill,available:true}).focus).toBe('hero');
  expect(liveNoviceGuide(skillHint,['a','b'],{...skill,available:true,chosen:true}).focus).toBe('play');
  expect(liveNoviceGuide({...skillHint,recommendedCardIds:[]},['a'],skill).focus).toBe('discard');
  expect(liveNoviceGuide(skillHint,[],{...skill,enabled:false}).body).toContain('技能不可用');
 });

 it.each([false,true])('offers a replay after losing the second stage with purchase=%s and no contribution',async purchase=>{
  const {run,store}=await start();await enter(run);await clearFirst(run);await send(run,{type:'OpenShop'});
  let instanceId:string|undefined;
  if(purchase){
   const offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
   await send(run,{type:'BuyOffer',offerId:offer.offerId});instanceId=run.state.jokers.find(j=>j.definitionId==='b02')!.instanceId;
  }
  expect(guide(run)?.step).toBe(purchase?'payoff':'shop');
  await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});
  while(run.state.phase==='await-input'){
   const selectedId=run.state.handOrder.reduce((lowest,id)=>{
    const rank=(cardId:string)=>run.state.deckInstances.find(card=>card.id===cardId)!.rank;
    return rank(id)<rank(lowest)?id:lowest;
   });
   await send(run,{type:'PlayHand',selectedIds:[selectedId]});
   if(instanceId)expect(run.state.lastTrace!.events.some(e=>e.sourceType==='joker'&&e.sourceInstanceId===instanceId)).toBe(false);
  }
  expect(run.state.phase).toBe('run-lost');expect(run.state.outcome?.reason).toBe('hands-exhausted');
  expect(guide(run)?.step).toBe('replay');expect(guide(run)!.fact?.purchaseInstanceId).toBe(instanceId);
  expect(guide(run)!.fact?.eventId).toBeUndefined();expect(guide(run)!.body).toContain('重新练习');
  const restored=SavedRun.restore(store,await store.read());expect(guide(restored)?.step).toBe('replay');
 });

 it('never advances an unsaved candidate; retry publishes the exact command once',async()=>{
  const {run,store}=await start();await enter(run);store.fail=true;
  const failed=await run.dispatch({type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
  expect(failed).toMatchObject({ok:false,code:'save-failed'});expect(guide(run)?.step).toBe('pair');
  const recovered=SavedRun.restore(store,await store.read());expect(guide(recovered)?.step).toBe('pair');
  store.fail=false;const retry=await run.retry();expect(retry.ok).toBe(true);expect(guide(run)?.step).toBe('discard');
  expect(run.state.stage!.playIndex).toBe(1);
 });

 it('allows early victory or loss to be retried without claiming a lesson was completed',async()=>{
  const {run}=await start();await enter(run);
  await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.slice(0,5)});
  while(run.state.phase==='await-input')await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.slice(0,5)});
  expect(['stage-cleared','run-lost']).toContain(run.state.phase);expect(guide(run)?.step).toBe('replay');
 });

 it('offers a retry immediately when the optional hero skill clears the first hand',async()=>{
  const {run,store}=await start('hero-early-clear');await enter(run);
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5'],erxiangTargetId:'hearts-5'});
  expect(run.state.lastTrace?.finalScore).toBe('420');expect(run.state.phase).toBe('stage-cleared');
  expect(guide(run)?.step).toBe('replay');
  const restored=SavedRun.restore(store,await store.read());expect(guide(restored)?.step).toBe('replay');
 });

 it('does not infer completed lessons from missing, truncated or tampered journal data',async()=>{
  const {run}=await start();await enter(run);await clearFirst(run);
  expect(noviceGuide(run.state)?.step).toBe('replay');
  expect(noviceGuide(run.state,run.journal.slice(1))?.step).toBe('replay');
  const tampered=structuredClone(run.journal);tampered[2].action={type:'PlayHand',selectedIds:['spades-14']};
  expect(noviceGuide(run.state,tampered)?.step).toBe('replay');
 });

 it('ignores forged preference progress and rolls back with the authoritative saved checkpoint',async()=>{
  const {run,store}=await start();await enter(run);const before=SavedRun.restore(store,await store.read());
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});expect(guide(run)?.step).toBe('discard');
  const raw=JSON.parse(values.get(NOVICE_GUIDE_KEY)!);raw.step='complete';raw.score='99999';values.set(NOVICE_GUIDE_KEY,JSON.stringify(raw));
  expect(guide(before)?.step).toBe('pair');expect(guide(run)?.step).toBe('discard');
 });

 it('only enrolls explicitly started unique tutorial runs; skip, close and restore do not change gameplay',async()=>{
  const {run}=await start();await enter(run);const before=JSON.stringify(run.state);
  dismissNoviceGuide(run.state,'step',run.journal);expect(guide(run)).toBeUndefined();
  restoreNoviceGuide();expect(guide(run)?.step).toBe('pair');
  dismissNoviceGuide(run.state,'run');expect(guide(run)).toBeUndefined();expect(noviceGuideEnrolled(run.state)).toBe(true);restoreNoviceGuide();expect(guide(run)?.step).toBe('pair');
  dismissNoviceGuide(run.state,'forever');expect(noviceGuideDisabled()).toBe(true);expect(noviceGuideEnrolled(run.state)).toBe(false);expect(guide(run)).toBeUndefined();
  restoreNoviceGuide();expect(noviceGuideDisabled()).toBe(false);expect(guide(run)?.step).toBe('pair');
  expect(JSON.stringify(run.state)).toBe(before);
  const other=await start('another');expect(guide(run)).toBeUndefined();expect(guide(other.run)?.step).toBe('pair');
  stopNoviceGuide();expect(guide(other.run)).toBeUndefined();
  const old={...other.run.state,runId:'run/r2/tutorial/core-v1/erxiang'};
  enrollNoviceGuide(old);expect(noviceGuide(old,other.run.journal)).toBeUndefined();
  expect(values.has(NOVICE_GUIDE_KEY)).toBe(true);
 });

 it('retains the current lesson in memory if optional preferences cannot be written',async()=>{
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('blocked');}});
  const {run}=await start('blocked');await enter(run);expect(guide(run)?.step).toBe('pair');
  dismissNoviceGuide(run.state,'run');expect(guide(run)).toBeUndefined();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
  restoreNoviceGuide();expect(guide(run)?.step).toBe('pair');
 });

 it('records local start intent separately, and does not resume an explicitly imported run',async()=>{
  const {run}=await start();expect(mayResumeNoviceOpening(run.state)).toBe(true);
  suppressImportedNovice(run.state);expect(mayResumeNoviceOpening(run.state)).toBe(false);
  enrollNoviceGuide(run.state);expect(mayResumeNoviceOpening(run.state)).toBe(false);expect(guide(run)).toBeUndefined();
  const id=guidedTutorialRunId('00000000-0000-4000-8000-000000000042');
  values.clear();markNoviceStart(id);expect(values.get(NOVICE_GUIDE_PENDING_PREFIX+id)).toBe('1');
  clearPendingNoviceStart(id);expect(values.has(NOVICE_GUIDE_PENDING_PREFIX+id)).toBe(false);expect(values.has(NOVICE_GUIDE_KEY)).toBe(false);
 });

 it('repairs an enrolled opening after a saved setup command but never from a mismatched receipt',async()=>{
  const {run}=await start();await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});
  const id=run.state.runId;stopNoviceGuide();markNoviceStart(id);
  enrollNoviceGuide({...run.state,receipts:run.state.receipts.filter(r=>r.seq!==3)});
  expect(guide(run)).toBeUndefined();enrollNoviceGuide(run.state);expect(guide(run)?.step).toBe('pair');
 });
});
