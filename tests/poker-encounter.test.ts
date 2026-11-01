import {describe,it,expect} from 'vitest';
import {applyCommand,createRun,type Command,type Action,type R2RunState} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint,MAX_JOURNAL,type Checkpoint} from '../src/application/checkpoint';
import {SavedRun,type SaveStore,type SaveSlots} from '../src/application/SavedRun';
import {stableHash} from '../src/domain/hash';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {r2HouseProfile} from '../src/domain/r2GroupUpgrade';
import {usesBossSuitRescue} from '../src/domain/r2BossSuitRescue';
import {currentPokerOpportunity,usesPokerEncounter} from '../src/domain/r2PokerEncounter';
import {pokerEncounterView} from '../src/game/PokerEncounterView';
import {r2ConsumableCapacity} from '../src/domain/r2Resources';
import {shopC2Score} from '../harness/fixtures/shop-c2-align';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {qiyuHeroProfile,buildQiyuAnimationTimeline,QIYU_HERO_PROFILES} from '../src/domain/qiyuEvent';
import {pokerEncounterFixture,pokerEncounterStart,pokerStep,pokerPublicAction} from './fixtures/poker-encounter';

const buy=(s:R2RunState,targetId='hearts-14'):Extract<Action,{type:'BuyPokerPolychrome'}>=>({type:'BuyPokerPolychrome',opportunityId:currentPokerOpportunity(s)!.id,shopSeq:s.shop!.basicChoice!.shopSeq,targetId});
class Store implements SaveStore {slots:SaveSlots={revision:0,current:null,previous:null};fail=false;writes=0;hold?:()=>Promise<void>;async read(){return structuredClone(this.slots);}async commit(revision:number,current:Checkpoint,previous:Checkpoint|null){this.writes++;await this.hold?.();if(this.fail)throw Error('injected-write-failure');if(revision!==this.slots.revision)throw Error('stale-revision');this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return this.slots.revision;}}
const rechecksum=(c:ReturnType<typeof makeCheckpoint>)=>{const{checksum,...p}=c;return {...p,checksum:stableHash(p)};};
describe('normal-run poker polychrome encounter',()=>{
 it('new identities inherit rescue and retain original bases; old saved identities have no encounter or migration',()=>{
  for(const hero of ['amo','laohuan','erxiang','xiemu','touye','azao'] as const){const identity=newRunIdentity(hero,'group');expect(usesPokerEncounter(identity)).toBe(true);expect(usesBossSuitRescue(identity)).toBe(true);const old=r2HouseProfile(identity)!.pokerBase!;const s=createRun({seed:'old-poker-boundary',runId:'old/'+hero,characterId:hero,rulesVersion:'r2',r2Identity:old,openingRoute:'group'});expect(s).not.toHaveProperty('pokerEncounter');expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);expect(launchIdentity(hero,{kind:'retry',run:s})).toEqual(old);const forged={...s,pokerEncounter:pokerEncounterStart().pokerEncounter};expect(()=>makeCheckpoint(forged,[])).toThrow();}
 });
 it('first and later intervals use their own saved stream; skip and reroll do not advance or change other RNG',()=>{
  const s=pokerEncounterStart(),start=structuredClone(s.pokerEncounter);expect(start!.nextAt).toBeGreaterThanOrEqual(7);expect(start!.nextAt).toBeLessThanOrEqual(9);
  const skip=pokerStep(s,{type:'SkipStage'}).state;expect(skip.pokerEncounter).toEqual(start);
  const reroll=pokerStep(s,{type:'RerollShop'}).state;expect(reroll.pokerEncounter).toEqual(start);
  const f=pokerEncounterFixture();expect(currentPokerOpportunity(f.state)!.clearAt).toBe(start!.nextAt);expect(f.state.pokerEncounter!.nextAt-currentPokerOpportunity(f.state)!.clearAt).toBeGreaterThanOrEqual(7);expect(f.state.pokerEncounter!.nextAt-currentPokerOpportunity(f.state)!.clearAt).toBeLessThanOrEqual(9);expect(readCheckpoint(makeCheckpoint(f.state,f.journal)).ok).toBe(true);
 },30000);
 it('atomically pays exactly18 and changes one edition, preserves enhancement and all native RNG streams/coupons',()=>{
  const f=pokerEncounterFixture(),s=f.state;s.deckInstances.find(c=>c.id==='hearts-14')!.enhancement='glass-paper';s.purchaseCoupons=1;const r=pokerStep(s,buy(s));
  expect(r.state.gold).toBe(14);expect(r.state.purchaseCoupons).toBe(1);expect(r.state.rng).toEqual(s.rng);expect(r.state.pokerEncounter!.rng).toEqual(s.pokerEncounter!.rng);expect(r.state.shop!.purchases).toBe(s.shop!.purchases+1);expect(r.state.deckInstances.find(c=>c.id==='hearts-14')).toMatchObject({edition:'polychrome',enhancement:'glass-paper'});expect(r.state.deckInstances.filter(c=>c.edition==='polychrome')).toHaveLength(1);expect(readCheckpoint(makeCheckpoint(r.state,[...f.journal,r.command])).ok).toBe(true);
 });
 it('rejects insufficient funds, stale opportunity/shop and existing editions without mutation',()=>{
  const f=pokerEncounterFixture();for(const kind of ['poor','stale','shop','foil','holographic','polychrome','joker'] as const){const s=structuredClone(f.state),a=buy(s);if(kind==='poor')s.gold=17;else if(kind==='stale')a.opportunityId='old';else if(kind==='shop')a.shopSeq=1;else if(kind==='joker')a.targetId=s.jokers[0].instanceId;else s.deckInstances.find(c=>c.id===a.targetId)!.edition=kind;
   const before=JSON.stringify(s),r=applyCommand(s,{runId:s.runId,commandId:'refused/'+kind,expectedSeq:s.commandSeq,action:a});expect(r.ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  }
 });
 it('shares the actual shop quota in both directions; a refresh cannot reopen it or the opportunity',()=>{
  const s=pokerEncounterFixture().state,paid=pokerStep(s,buy(s)).state;expect(()=>pokerStep(paid,{type:'PracticeHand',handType:'pair',expectedLevel:4,shopSeq:s.shop!.basicChoice!.shopSeq})).toThrow('basic-choice-consumed');
  const practiced=pokerStep(s,{type:'PracticeHand',handType:'pair',expectedLevel:4,shopSeq:s.shop!.basicChoice!.shopSeq}).state;expect(()=>pokerStep(practiced,buy(practiced))).toThrow();
  const again=pokerStep(paid,{type:'RerollShop'}).state;expect(()=>pokerStep(again,buy(again))).toThrow();expect(currentPokerOpportunity(again)!.status).toBe('purchased');
 });
 it('requires no free tool slot; native copy and repeated scoring preserve/read the existing edition without a second grant',()=>{
  const f=pokerEncounterFixture(),s=f.state,id='hearts-13';s.deckInstances.find(c=>c.id===id)!.enhancement='encore-paper';
  s.consumables=Array.from({length:r2ConsumableCapacity(s)},(_,i)=>({instanceId:'controlled/copy/'+i,definitionId:'T07'}));
  const paid=pokerStep(s,buy(s,id)),copied=pokerStep(paid.state,{type:'UseConsumable',instanceId:s.consumables[0].instanceId,targetIds:[id]});
  const clone=copied.state.deckInstances.at(-1)!;expect(clone).toMatchObject({rank:13,suit:'hearts',enhancement:'encore-paper',edition:'polychrome'});expect(copied.state.deckInstances.filter(c=>c.edition==='polychrome')).toHaveLength(2);expect(copied.state.gold).toBe(14);expect(copied.state.pokerEncounter).toEqual(paid.state.pokerEncounter);expect(readCheckpoint(makeCheckpoint(copied.state,[...f.journal,paid.command,copied.command])).ok).toBe(true);
  const input=shopC2Score(copied.state,[id,clone.id]).input,trace=scoreR2Hand({...input,jokers:[]});
  expect(trace.sets.activeScoringIds).toEqual([id,clone.id]);expect(trace.events.filter(e=>e.reasonKey==='edition.polychrome.multiply-multiplier')).toHaveLength(4);
  const held=scoreR2Hand({...input,jokers:[],selectedIds:[id]});expect(held.events.filter(e=>e.sourceInstanceId===clone.id&&e.operation==='multiply-multiplier')).toHaveLength(0);
 });
 it('explicit skip and leaving expire the offer without payment; cancel is no command; duplicate buy never charges again',()=>{
  const f=pokerEncounterFixture(),s=f.state,view=pokerEncounterView(s);expect(pokerEncounterView(s)).toEqual(view);
  const paid=pokerStep(s,buy(s)),duplicate=applyCommand(paid.state,paid.command);expect(duplicate.ok&&duplicate.duplicate).toBe(true);expect(duplicate.state.gold).toBe(14);
  for(const action of [{type:'LeaveShop'} as const,{type:'SkipPokerEncounter',opportunityId:currentPokerOpportunity(s)!.id,shopSeq:s.shop!.basicChoice!.shopSeq} as const]){const r=pokerStep(s,action);expect(r.state.gold).toBe(32);expect(currentPokerOpportunity(r.state)!.status).toBe('skipped');expect(r.state.pokerEncounter!.nextAt).toBe(s.pokerEncounter!.nextAt);expect(readCheckpoint(makeCheckpoint(r.state,[...f.journal,r.command])).ok).toBe(true);}
 });
 it('save failure and double confirmation publish nothing; exact retry pays once and cold restore retains receipt',async()=>{
  const f=pokerEncounterFixture(),store=new Store();store.slots={revision:1,current:makeCheckpoint(f.state,f.journal),previous:null};let run=SavedRun.restore(store,store.slots),release!:()=>void;store.hold=()=>new Promise<void>(resolve=>release=resolve);store.fail=true;
  const first=run.dispatch(buy(run.state));expect((await run.dispatch(buy(run.state))).ok).toBe(false);expect(run.state.gold).toBe(32);release();expect((await first).ok).toBe(false);expect(run.state.gold).toBe(32);expect(currentPokerOpportunity(run.state)!.status).toBe('offered');
  store.hold=undefined;store.fail=false;expect((await run.retry()).ok).toBe(true);expect(run.state.gold).toBe(14);run=SavedRun.restore(store,await store.read());expect(currentPokerOpportunity(run.state)!.status).toBe('purchased');expect(pokerEncounterView(run.state)!.receipt).toMatchObject({paidPrice:18,goldBefore:32,goldAfter:14,targetId:'hearts-14'});expect(run.journal.filter(c=>c.action.type==='BuyPokerPolychrome')).toHaveLength(1);
 });
 it('receipt/clock validation rejects erased purchase, rearmed opportunity and forged interval even after journal truncation',()=>{
  const f=pokerEncounterFixture(),paid=pokerStep(f.state,buy(f.state));let s=paid.state,journal=[...f.journal,paid.command];for(let i=0;i<MAX_JOURNAL+1;i++){const r=pokerStep(s,{type:'ReorderJokers',ids:s.jokers.map(j=>j.instanceId)});s=r.state;journal.push(r.command);}
  const cp=makeCheckpoint(s,journal);expect(cp.journalBaseSeq).toBeGreaterThan(paid.command.expectedSeq+1);expect(readCheckpoint(cp).ok).toBe(true);
  for(const mutation of ['clock','rearm','erase','source-id','source-only'] as const){const c=structuredClone(cp),o=c.state.pokerEncounter!.opportunities[0];if(mutation==='clock')c.state.pokerEncounter!.nextAt++;else{o.status='offered';o.decision=null;o.goldBefore=null;if(mutation!=='rearm')c.state.shop!.basicChoice!.purchase=null;if(mutation==='source-id'||mutation==='source-only'){o.source=structuredClone(f.journal.find(cmd=>cmd.action.type==='PlayHand'&&cmd.commandId!==o.source.commandId)!);if(mutation==='source-id')o.id=`${s.runId}/poker-encounter/${o.source.commandId}`;}}expect(readCheckpoint(rechecksum(c)).ok).toBe(false);c.journal=[];c.journalBaseSeq=c.state.commandSeq;expect(readCheckpoint(rechecksum(c)).ok).toBe(false);}
 },30000);
 it('has immutable public presentation facts without future clocks/RNG and never repeats a grant on restore',()=>{
  const s=pokerEncounterFixture().state,v=pokerEncounterView(s)!;expect(Object.isFrozen(v)).toBe(true);expect(Object.isFrozen(v.targets[0])).toBe(true);expect(JSON.stringify(v)).not.toMatch(/nextAt|rng|drawPile/);const paid=pokerStep(s,buy(s)).state;expect(pokerEncounterView(paid)!.status).toBe('purchased');expect(pokerEncounterView(structuredClone(paid))).toEqual(pokerEncounterView(paid));
 });
 it('maps all 6 Tang-Song heroes to cultural allusions and builds the 4-stage polychrome ceremony timeline',()=>{
  for(const hero of ['amo','laohuan','erxiang','azao','xiemu','touye'] as const){
   const profile=qiyuHeroProfile(hero);
   expect(profile).toEqual(QIYU_HERO_PROFILES[hero]);
   expect(profile.name.length).toBeGreaterThan(0);
   expect(profile.title.length).toBeGreaterThan(0);
   expect(profile.sceneTitle.length).toBeGreaterThan(0);
   expect(profile.allusion.length).toBeGreaterThan(0);
   expect(profile.encounterLine.length).toBeGreaterThan(0);
   expect(profile.confirmLine.length).toBeGreaterThan(0);
   expect(profile.settledLine.length).toBeGreaterThan(0);
   expect(profile.skippedLine.length).toBeGreaterThan(0);
   expect(profile.sealText.length).toBeGreaterThan(0);
  }
  const timeline=buildQiyuAnimationTimeline({
   eventId:'opp-1',
   choiceId:'hearts-14',
   cardLabel:'♥A',
   paidGold:18,
   goldBefore:32,
   goldAfter:14,
   resultKey:'赋予多彩（×1.5）',
   characterId:'amo',
  });
  expect(timeline.map(s=>s.phase)).toEqual(['charge','strike','impact','impact','settled','settled']);
  expect(timeline.map(s=>s.audioCue)).toEqual(['spectral','play','multiply-reveal','none','score-settle','none']);
  expect(timeline.reduce((acc,s)=>acc+s.durationMs,0)).toBe(1160);
 });
 it('completes the fixed normal campaign with intervals7-9, no terminal opportunity, and no new endless supply',()=>{
  let s=pokerEncounterStart();for(let i=0;i<150&&s.phase!=='run-won';i++)s=pokerStep(s,pokerPublicAction(s)).state;expect(s.phase).toBe('run-won');expect(s.pokerEncounter!.opportunities.every(o=>o.stageIndex<23&&o.status==='skipped')).toBe(true);expect(s.pokerEncounter!.opportunities.length).toBeGreaterThanOrEqual(2);expect(s.pokerEncounter!.opportunities.length).toBeLessThanOrEqual(3);const before=structuredClone(s.pokerEncounter);s=pokerStep(s,{type:'ContinueEndless'}).state;expect(s.pokerEncounter).toEqual(before);expect(pokerEncounterView(s)).toBeUndefined();expect(readCheckpoint(makeCheckpoint(s,[])).ok).toBe(true);
 },120000);
});
