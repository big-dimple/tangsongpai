import {EventEmitter} from 'node:events';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import type {Checkpoint} from '../src/application/checkpoint';
import {createRun,type Action} from '../src/domain/run';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {dismissNoviceGuide,enrollNoviceGuide,liveNoviceGuide,markNoviceStart,noviceGuide,restoreNoviceGuide,stopNoviceGuide} from '../src/game/NoviceGuide';
import {needsGuidedPractice} from '../src/game/GuidedTutorial';
import type {NoviceGuideHandle,NoviceGuideOptions,NoviceGuideStep} from '../src/game/NoviceGuideView';

vi.mock('../src/game/session',()=>({gameSession:()=>session}));
vi.mock('../src/game/NoviceGuideView',()=>({mountNoviceGuideView:(options:NoviceGuideOptions)=>{
 const item:FakeView={options,step:options.step,closed:false,removed:false,refreshes:0,updates:0,
  update(step){item.step=step;item.updates++;},refresh(){item.refreshes++;},
  close(){if(!item.closed){item.closed=true;options.onClose?.();}},
  reopen(){if(item.closed){item.closed=false;options.onReopen?.();}},
  unmount(){item.removed=true;},
 };
 views.push(item);return item;
}}));
import {bindNoviceGuide} from '../src/game/NoviceGuideBinding';

interface FakeView extends NoviceGuideHandle {options:NoviceGuideOptions;step:NoviceGuideStep;closed:boolean;removed:boolean;refreshes:number;updates:number}
interface FakeSession {run?:SavedRun;reducedMotion:boolean;listeners:Set<()=>void>;subscribe:(listener:()=>void)=>()=>void;emit:()=>void}
let session:FakeSession,views:FakeView[],values:Map<string,string>,nonce=0;
class Store implements SaveStore {
 slots:SaveSlots={revision:0,current:null,previous:null};fail=false;
 async read(){return structuredClone(this.slots);}
 async commit(revision:number,current:Checkpoint,previous:Checkpoint|null){
  if(this.fail)throw Error('storage-error');if(revision!==this.slots.revision)throw Error('write-conflict');
  this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return revision+1;
 }
}
function scene(run?:SavedRun){
 const events=new EventEmitter(),registryEvents=new EventEmitter();let current=run;
 return {events,registryEvents,setRun:(next:SavedRun|undefined)=>{current=next;registryEvents.emit('changedata');},
  value:{events,registry:{events:registryEvents,get:(key:string)=>key==='runController'?current:undefined}} as unknown as Phaser.Scene};
}
const latest=()=>views.filter(v=>!v.removed).at(-1);
async function start(_id:string,enroll=true){
 const runId=guidedTutorialRunId(`00000000-0000-4000-8000-${(++nonce).toString(16).padStart(12,'0')}`);
 const store=new Store(),state=createRun({seed:'r2/tutorial/core-v1',runId,
  characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group',
  modeConfig:{mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false}});
 const run=await SavedRun.start(store,state,await store.read());if(enroll){markNoviceStart(runId);enrollNoviceGuide(run.state);}
 run.onChange=()=>session.emit();return {run,store};
}
async function send(run:SavedRun,action:Action){const result=await run.dispatch(action);if(!result.ok)throw Error(result.code);}
async function enter(run:SavedRun){await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});}
async function findPair(run:SavedRun){
 for(let attempt=0;attempt<4;attempt++){
  const groups=new Map<number,string[]>();for(const id of run.state.handOrder){const rank=run.state.deckInstances.find(c=>c.id===id)!.rank;groups.set(rank,[...(groups.get(rank)??[]),id]);}
  const pair=[...groups.values()].find(ids=>ids.length>=2);if(pair)return pair.slice(0,2);
  expect(run.state.stage!.discardsLeft).toBeGreaterThan(0);await send(run,{type:'DiscardHand',selectedIds:run.state.handOrder.slice(0,5)});
 }
 throw Error('controlled tutorial did not produce a pair');
}
const geometry=()=>({highlights:[],avoid:[]});
beforeEach(()=>{
 views=[];values=new Map();
 vi.stubGlobal('window',new EventTarget());
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
 const listeners=new Set<()=>void>();session={reducedMotion:false,listeners,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},emit(){for(const listener of [...listeners])listener();}};
});
afterEach(()=>vi.unstubAllGlobals());

describe('novice guide scene binding',()=>{
 it('does not attach tutorial listeners to ordinary runs',async()=>{
  const store=new Store(),state=createRun({seed:'ordinary',runId:'run/ordinary/erxiang',
   characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group'});
  const run=await SavedRun.start(store,state,await store.read());session.run=run;
  const owner=scene(run),subscribe=vi.spyOn(session,'subscribe');
  const unmount=bindNoviceGuide(owner.value,{kind:'intermission',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true});
  expect(subscribe).not.toHaveBeenCalled();expect(views).toHaveLength(0);
  unmount.refresh();unmount();expect(session.listeners.size).toBe(0);
 });
 it('requires explicit enrollment and advances only after a successful save or retry',async()=>{
  const {run,store}=await start('committed',false);session.run=run;const owner=scene(run);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true});
  await enter(run);expect(latest()).toBeUndefined();
  unmount();
  const next=await start('enrolled');session.run=next.run;owner.setRun(next.run);
  const dispose=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true});
  await enter(next.run);expect(latest()?.step.id).toBe('pair');
  next.store.fail=true;
  expect((await next.run.dispatch({type:'PlayHand',selectedIds:['hearts-5','clubs-5']})).ok).toBe(false);
  expect(latest()?.step.id).toBe('pair');expect(next.run.status).toBe('paused');
  next.store.fail=false;expect((await next.run.retry()).ok).toBe(true);expect(latest()?.step.id).toBe('discard');
  expect(next.run.state.stage?.playIndex).toBe(1);dispose();expect(session.listeners.size).toBe(0);
  expect(store.slots.current).not.toBeNull();
 });

 it('follows the scene, pauses for presentations and discards obsolete bindings on run changes',async()=>{
  const {run}=await start('scene');session.run=run;await enter(run);let visible=true;
  const owner=scene(run),other=scene(run),onReplay=vi.fn(()=>true),onSkip=vi.fn(()=>true),onComplete=vi.fn(()=>true);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay,onSkip,onComplete,visible:()=>visible});
  const offShop=bindNoviceGuide(other.value,{kind:'shop',getGeometry:geometry,onReplay,onSkip,onComplete});
  expect(views.filter(v=>!v.removed).map(v=>v.step.id)).toEqual(['pair']);
  visible=false;owner.events.emit('postupdate');expect(latest()).toBeUndefined();
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});expect(latest()).toBeUndefined();
  visible=true;owner.events.emit('postupdate');expect(latest()?.step.id).toBe('discard');
  owner.events.emit('pause');expect(latest()).toBeUndefined();
  owner.events.emit('resume');expect(latest()?.step.id).toBe('discard');
  const obsolete=latest()!,replacement=await start('replacement');session.run=replacement.run;session.emit();
  expect(latest()).toBeUndefined();obsolete.options.onSkip?.();expect(onSkip).not.toHaveBeenCalled();
  owner.setRun(replacement.run);await enter(replacement.run);expect(latest()?.step.id).toBe('pair');
  owner.events.emit('shutdown');unmount();offShop();expect(session.listeners.size).toBe(0);
 });

 it('reopens an explicitly restored guide after the menu closes',async()=>{
  const {run}=await start('restore');session.run=run;await enter(run);const owner=scene(run);
  let menuOpen=false;const before=JSON.stringify(run.state);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true,visible:()=>!menuOpen});
  expect(latest()?.step.id).toBe('pair');latest()!.close();expect(latest()?.closed).toBe(true);
  menuOpen=true;owner.events.emit('postupdate');expect(latest()).toBeUndefined();
  // Merely opening and closing the menu preserves a deliberate collapse.
  menuOpen=false;owner.events.emit('postupdate');expect(latest()?.closed).toBe(true);
  menuOpen=true;owner.events.emit('postupdate');
  dismissNoviceGuide(run.state,'forever',run.journal);expect(noviceGuide(run.state,run.journal)).toBeUndefined();
  restoreNoviceGuide();expect(noviceGuide(run.state,run.journal)?.step).toBe('pair');expect(latest()).toBeUndefined();
  menuOpen=false;owner.events.emit('postupdate');expect(latest()?.step.id).toBe('pair');expect(latest()?.closed).toBe(false);
  expect(JSON.stringify(run.state)).toBe(before);unmount();
 });

 it('does not show an explicitly imported run even when local enrollment remains',async()=>{
  const {run,store}=await start('imported');session.run=run;await enter(run);const owner=scene(run);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true});
  expect(latest()?.step.id).toBe('pair');
  const slots=await store.read(),imported=SavedRun.restore(store,{...slots,guidedOpeningSuppressedRunIds:[run.state.runId]});
  expect(imported.guidedOpeningSuppressed).toBe(true);
  expect(noviceGuide(imported.state,imported.journal)?.step).toBe('pair'); // Stale local preference alone is insufficient.
  session.run=imported;owner.setRun(imported);expect(latest()).toBeUndefined();
  restoreNoviceGuide();owner.events.emit('postupdate');expect(latest()).toBeUndefined();
  unmount();
 });

 it('executes replay, exits on skip and can restore after a failed exit',async()=>{
  const {run}=await start('replay');session.run=run;await enter(run);const owner=scene(run),onReplay=vi.fn(()=>true).mockReturnValueOnce(false),onSkip=vi.fn(()=>false);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay,onSkip,onComplete:()=>true});
  await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.slice(0,5)});
  while(run.state.phase==='await-input')await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.slice(0,5)});
  expect(latest()?.step.id).toBe('replay');
  latest()!.step.action!.run();latest()!.step.action!.run();expect(onReplay).toHaveBeenCalledOnce();await Promise.resolve();
  expect(latest()?.step.body).toContain('操作尚未完成');latest()!.step.action!.run();expect(onReplay).toHaveBeenCalledTimes(2);await Promise.resolve();
  const active=latest()!;active.close();active.options.onSkip?.();expect(onSkip).toHaveBeenCalledOnce();
  expect(noviceGuide(run.state,run.journal)?.step).toBe('replay');expect(latest()?.closed).toBe(true);
  await Promise.resolve();expect(latest()?.closed).toBe(false);expect(latest()?.step.body).toContain('操作尚未完成');
  onSkip.mockImplementationOnce(()=>{dismissNoviceGuide(run.state,'run',run.journal);return true;});
  latest()!.close();latest()!.options.onSkip?.();await Promise.resolve();expect(latest()).toBeUndefined();
  restoreNoviceGuide();expect(latest()?.step.id).toBe('replay');
  stopNoviceGuide();expect(latest()).toBeUndefined();restoreNoviceGuide();expect(latest()).toBeUndefined();
  unmount();
 });

 it('refreshes moving anchors without replaying saved commands on every frame',async()=>{
  const {run}=await start('geometry');session.run=run;await enter(run);const owner=scene(run);
  let now=0,x=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>now),getGeometry=vi.fn(()=>({highlights:[{x,y:0,width:50,height:50}]}));
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true});
  const active=latest()!;expect(getGeometry).toHaveBeenCalledTimes(1);
  x=10;now=8;owner.events.emit('postupdate');expect(getGeometry).toHaveBeenCalledTimes(1);expect(active.refreshes).toBe(0);
  now=17;owner.events.emit('postupdate');expect(active.refreshes).toBe(1);expect(active.options.getGeometry().highlights?.[0].x).toBe(10);
  x=20;unmount.refresh();expect(active.updates).toBe(0);expect(active.options.getGeometry().highlights?.[0].x).toBe(20);
  unmount();clock.mockRestore();
 });

 it('updates a prompt when the unsaved card selection changes',async()=>{
  const {run}=await start('live');session.run=run;await enter(run);const owner=scene(run);let selected:string[]=[];
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip:()=>true,onComplete:()=>true,
   presentHint:hint=>liveNoviceGuide(hint,selected,{available:false,chosen:false,enabled:true,canDiscard:true})});
  const before=JSON.stringify(run.state);expect(latest()?.step.title).toBe('先找一对');
  selected=['clubs-5'];owner.events.emit('postupdate');expect(latest()?.step.title).toBe('再选另一张');
  selected=['clubs-5','hearts-5'];owner.events.emit('postupdate');expect(latest()?.step.title).toBe('对子选好了');
  selected=['clubs-5'];owner.events.emit('postupdate');expect(latest()?.step.title).toBe('再选另一张');
  expect(JSON.stringify(run.state)).toBe(before);unmount();
 });

 it('waits for the real score presentation and finishes without recording a skip',async()=>{
  const {run}=await start('complete');session.run=run;await enter(run);const owner=scene(run);
  let scoreActive=false;const onSkip=vi.fn(()=>true),onComplete=vi.fn(()=>true).mockReturnValueOnce(false);
  const unmount=bindNoviceGuide(owner.value,{kind:'game',getGeometry:geometry,onReplay:()=>true,onSkip,onComplete,
   visible:()=>!scoreActive});
  await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
  await send(run,{type:'DiscardHand',selectedIds:['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']});
  await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.filter(id=>id.startsWith('hearts-')).slice(0,5)});
  expect(needsGuidedPractice(run)).toBe(false); // The first real shop must remain visible.
  await send(run,{type:'OpenShop'});const offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
  await send(run,{type:'BuyOffer',offerId:offer.offerId});expect(needsGuidedPractice(run)).toBe(true);
  expect(needsGuidedPractice({state:run.state,journal:run.journal,guidedOpeningSuppressed:true})).toBe(false);
  await send(run,{type:'LeaveShop'});expect(needsGuidedPractice(run)).toBe(true);await send(run,{type:'EnterStage'});
  expect(latest()?.step.id).toBe('payoff');scoreActive=true;
  await send(run,{type:'PlayHand',selectedIds:['clubs-6','spades-6']});
  expect(noviceGuide(run.state,run.journal)?.step).toBe('skill');expect(latest()).toBeUndefined();
  scoreActive=false;owner.events.emit('postupdate');expect(latest()?.step.id).toBe('skill');
  const pair=await findPair(run);await send(run,{type:'PlayHand',selectedIds:pair,erxiangTargetId:pair[0]});
  expect(noviceGuide(run.state,run.journal)?.step).toBe('skill-practice');
  if(run.state.phase==='stage-cleared'){await send(run,{type:'OpenShop'});await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});}
  await send(run,{type:'PlayHand',selectedIds:[run.state.handOrder[0]]});
  expect(noviceGuide(run.state,run.journal)?.step).toBe('complete');expect(needsGuidedPractice(run)).toBe(false);expect(latest()?.step.id).toBe('complete');
  latest()!.step.action!.run();expect(onComplete).toHaveBeenCalledOnce();await Promise.resolve();expect(latest()?.step.body).toContain('操作尚未完成');
  latest()!.step.action!.run();expect(onComplete).toHaveBeenCalledTimes(2);expect(onSkip).not.toHaveBeenCalled();expect(noviceGuide(run.state,run.journal)?.step).toBe('complete');
  unmount();
 });
});
