import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import type {Checkpoint} from '../src/application/checkpoint';
import {createRun,type Action} from '../src/domain/run';
import {r2PurchasePrice} from '../src/domain/r2Shop';
import {ownedJokerDropIndex} from '../src/game/JokerReorder';
import {shopLayout} from '../src/game/ShopLayout';
import {intersects} from '../src/game/layout';
import {placeNoviceGuide} from '../src/game/NoviceGuideView';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {dismissNoviceGuide,enrollNoviceGuide,markNoviceStart,noviceGuide} from '../src/game/NoviceGuide';
import {advanceNoviceSecondOffer,armNoviceOwnedLesson,attemptNoviceOwnedReorder,closeNoviceOwnedLesson,noviceOwnedLesson,noviceOwnedLessonPcAvoid,openNoviceOwnedLesson,presentNoviceOwnedLesson} from '../src/game/NoviceOwnedLesson';

class Store implements SaveStore {
 slots:SaveSlots={revision:0,current:null,previous:null};fail=false;
 async read(){return structuredClone(this.slots);}
 async commit(revision:number,current:Checkpoint,previous:Checkpoint|null){
  if(this.fail)throw Error('storage-error');if(revision!==this.slots.revision)throw Error('write-conflict');
  this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return revision+1;
 }
}
let values:Map<string,string>;
beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});});
afterEach(()=>vi.unstubAllGlobals());
async function send(run:SavedRun,action:Action){const result=await run.dispatch(action);if(!result.ok)throw Error(JSON.stringify({code:result.code,diagnostic:'diagnostic' in result?result.diagnostic:undefined}));return result;}
const guide=(run:SavedRun)=>noviceGuide(run.state,run.journal);
const lesson=(run:SavedRun)=>noviceOwnedLesson(run.state,run.journal,guide(run));
async function firstShop(suffix:string){
 const store=new Store(),state=createRun({seed:'r2/tutorial/core-v1',runId:guidedTutorialRunId(`00000000-0000-4000-8000-${suffix.padStart(12,'0')}`),
  characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group',
  modeConfig:{mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false}});
 markNoviceStart(state.runId);const run=await SavedRun.start(store,state,await store.read());enrollNoviceGuide(run.state);
 await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});
 await send(run,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
 await send(run,{type:'DiscardHand',selectedIds:['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']});
 await send(run,{type:'PlayHand',selectedIds:run.state.handOrder.filter(id=>id.startsWith('hearts-')).slice(0,5)});
 await send(run,{type:'OpenShop'});expect(guide(run)?.step).toBe('shop');
 return {run,store};
}
async function purchaseFirst(run:SavedRun){
 const offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
 armNoviceOwnedLesson(run.state,guide(run),offer.offerId);
 await send(run,{type:'BuyOffer',offerId:offer.offerId});return offer;
}

describe('owned-card lesson follows saved, real actions',()=>{
 it('waits for the purchase, survives retry and refresh, and requires an actual expansion',async()=>{
  const {run,store}=await firstShop('101'),offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
  const before=SavedRun.restore(store,await store.read());armNoviceOwnedLesson(run.state,guide(run),offer.offerId);
  expect(lesson(run)).toBeUndefined();
  store.fail=true;expect(await run.dispatch({type:'BuyOffer',offerId:offer.offerId})).toMatchObject({ok:false,code:'save-failed'});
  expect(lesson(run)).toBeUndefined();store.fail=false;expect((await run.retry()).ok).toBe(true);
  expect(lesson(run)).toEqual({opened:false,expanded:false,reordered:false});expect(lesson(before)).toBeUndefined();
  let restored=SavedRun.restore(store,await store.read());expect(lesson(restored)).toEqual({opened:false,expanded:false,reordered:false});
  const folded=shopLayout(390,740,12,0,3,true,false,0,0,1,undefined,true);
  const expanded=shopLayout(390,740,12,0,3,true,false,0,0,1,undefined,false);
  expect(folded.inventoryCollapsed).toBe(true);expect(expanded.inventoryCollapsed).toBe(false);expect(expanded.slots).toHaveLength(5);
  expect(presentNoviceOwnedLesson(guide(restored)!,lesson(restored),{collapsed:true,canExpand:true,count:1})).toMatchObject({focus:'toggle',hint:{cue:'展开已拥有牌'}});
  // The presentation itself cannot mark an expansion; the real toggle calls this only after revealing the rail.
  expect(lesson(restored)?.opened).toBe(false);openNoviceOwnedLesson(restored.state,restored.journal,guide(restored));
  restored=SavedRun.restore(store,await store.read());expect(lesson(restored)).toMatchObject({opened:true,expanded:true});
  const shown=presentNoviceOwnedLesson(guide(restored)!,lesson(restored),{collapsed:false,canExpand:true,count:1});
  expect(shown).toMatchObject({focus:'slots',hint:{cue:'这里有五个槽'}});
  expect(shown.hint.body).toContain('最多放五张');expect(shown.hint.body).toContain('通常从左到右触发');
  expect(shown.hint.body).toContain('继续买');expect(shown.hint.body).toContain('进入牌桌');
  expect(shown.hint.body).not.toMatch(/第 2 张|拖|按住/);expect(shown.hint.gesture).toBeUndefined();
  expect(ownedJokerDropIndex(expanded.slots,1,expanded.slots[1].x+1,expanded.slots[1].y+1)).toBe(-1);
  closeNoviceOwnedLesson(restored.state,restored.journal,guide(restored));
  restored=SavedRun.restore(store,await store.read());expect(lesson(restored)).toMatchObject({opened:true,expanded:false});
 });

 it('bridges the saved first purchase to a real affordable second offer without requiring it',async()=>{
  const {run,store}=await firstShop('108');
  advanceNoviceSecondOffer(run.state,run.journal,guide(run));expect(lesson(run)).toBeUndefined();
  await purchaseFirst(run);openNoviceOwnedLesson(run.state,run.journal,guide(run));
  const before=JSON.stringify(run.state),first=presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:false,canExpand:true,count:1});
  expect(first.focus).toBe('slots');expect(first.hint.choices).toEqual([{id:'novice-second-card',label:'看看第二张',cardIds:[]}]);
  advanceNoviceSecondOffer(run.state,run.journal,guide(run));
  const restored=SavedRun.restore(store,await store.read()),continued=lesson(restored);
  expect(continued?.secondPrompt).toBe(true);expect(JSON.stringify(run.state)).toBe(before);
  const offer=run.state.shop!.offers.find(o=>!o.consumed&&r2PurchasePrice(run.state,o)<=run.state.gold&&!run.state.jokers.some(j=>j.definitionId===o.definitionId))!;
  expect(offer).toBeDefined();
  const suggested=presentNoviceOwnedLesson(guide(restored)!,continued,{collapsed:false,canExpand:true,count:1,secondOffer:{id:offer.offerId,name:'示例牌'}});
  expect(suggested).toMatchObject({focus:'offer',hint:{cue:'再看看一张牌',offerIds:[offer.offerId]}});
  expect(suggested.hint.body).toContain('可选别的或进入牌桌');expect(suggested.hint.choices).toBeUndefined();
  expect(presentNoviceOwnedLesson(guide(restored)!,continued,{collapsed:false,canExpand:true,count:1,secondLocation:'tab'}).focus).toBe('tab');
  expect(presentNoviceOwnedLesson(guide(restored)!,continued,{collapsed:false,canExpand:true,count:1,secondLocation:'more'}).focus).toBe('shelf');
  const noOffer=presentNoviceOwnedLesson(guide(restored)!,continued,{collapsed:false,canExpand:true,count:1,secondLocation:'none'});
  expect(noOffer.focus).toBe('play');expect(noOffer.hint.body).toContain('没有可买的第二张');
  await send(run,{type:'BuyOffer',offerId:offer.offerId});expect(run.state.jokers).toHaveLength(2);
  openNoviceOwnedLesson(run.state,run.journal,guide(run));
  expect(presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:false,canExpand:true,count:2}).hint.cue).toBe('试试调整顺序');
 });

 it('recognizes a second-card drag only after its exact command saves, including retry and rollback',async()=>{
  const {run,store}=await firstShop('102');await purchaseFirst(run);openNoviceOwnedLesson(run.state,run.journal,guide(run));
  const offer=run.state.shop!.offers.find(o=>!o.consumed&&r2PurchasePrice(run.state,o)<=run.state.gold)!;
  expect(offer).toBeDefined();store.fail=true;
  expect(await run.dispatch({type:'BuyOffer',offerId:offer.offerId})).toMatchObject({ok:false,code:'save-failed'});
  expect(lesson(run)?.expanded).toBe(true);store.fail=false;expect((await run.retry()).ok).toBe(true);expect(run.state.jokers).toHaveLength(2);
  expect(lesson(run)?.expanded).toBe(false);openNoviceOwnedLesson(run.state,run.journal,guide(run));expect(lesson(run)?.expanded).toBe(true);
  const before=SavedRun.restore(store,await store.read()),ids=run.state.jokers.map(j=>j.instanceId).reverse();
  const shown=presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:false,canExpand:true,count:2});
  expect(shown).toMatchObject({focus:'slots',hint:{cue:'试试调整顺序'}});
  expect(shown.hint.body).toMatch(/按住第 1 张.*浮起.*拖到第 2 张.*松手/);
  const mouse=presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:false,canExpand:true,count:2,finePointer:true});
  expect(mouse.hint.body).toMatch(/第 1 张.*按住鼠标左键.*浮起.*拖到第 2 张.*松开/);expect(mouse.hint.gesture).toBe('hold-drag');
  attemptNoviceOwnedReorder(run.state,run.journal,guide(run),ids);expect(lesson(run)?.reordered).toBe(false);
  store.fail=true;expect(await run.dispatch({type:'ReorderJokers',ids})).toMatchObject({ok:false,code:'save-failed'});
  expect(lesson(run)?.reordered).toBe(false);store.fail=false;expect((await run.retry()).ok).toBe(true);
  expect(lesson(run)?.reordered).toBe(true);expect(lesson(before)?.reordered).toBe(false);
  const restored=SavedRun.restore(store,await store.read());expect(lesson(restored)?.reordered).toBe(true);
  expect(presentNoviceOwnedLesson(guide(restored)!,lesson(restored),{collapsed:false,canExpand:true,count:2}).hint.cue).toBe('顺序已保存');
 });

 it('does not infer the lesson from an old run, muted guide, missing journal, a different run or a sold first card',async()=>{
  const {run}=await firstShop('103'),offer=run.state.shop!.offers.find(o=>o.definitionId==='b02')!;
  await send(run,{type:'BuyOffer',offerId:offer.offerId});expect(guide(run)?.step).toBe('payoff');expect(lesson(run)).toBeUndefined();
  const later=await firstShop('104');await purchaseFirst(later.run);expect(lesson(later.run)).toBeDefined();
  expect(noviceOwnedLesson(later.run.state,later.run.journal.slice(1),noviceGuide(later.run.state,later.run.journal.slice(1)))).toBeUndefined();
  dismissNoviceGuide(later.run.state,'run');expect(lesson(later.run)).toBeUndefined();
  const other=await firstShop('105');await purchaseFirst(other.run);
  const id=other.run.state.jokers[0].instanceId;await send(other.run,{type:'SellJoker',instanceId:id});expect(lesson(other.run)).toBeUndefined();
 });

 it('does not ask for an impossible arrow action when the actual layout cannot reveal slots',async()=>{
  const {run}=await firstShop('106');await purchaseFirst(run);
  const result=presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:true,canExpand:false,count:1});
  expect(result.focus).toBe('none');expect(result.hint.body).toContain('调整窗口大小');expect(result.hint.body).not.toContain('点上箭头');
 });

 it('places the PC lesson outside the whole owned rail, merchandise and sidebar controls',()=>{
  for(const [width,height] of [[1366,768],[1920,1080]]){
   const p=shopLayout(width,height,8,0,3,true,false,0,0,1);expect(p.pc).toBeTruthy();
   const avoid=[p.play,p.tabs,...noviceOwnedLessonPcAvoid(p)],first=p.slots[0],last=p.slots[4];
   const rail={x:first.x,y:first.y,width:last.x+last.width-first.x,height:first.height};
   const bounds={x:8,y:8,width:width-16,height:height-16};
   const initial=placeNoviceGuide(bounds,[...avoid,rail],{width:320,height:100},rail);expect(initial).toBeDefined();
   const placed=placeNoviceGuide(bounds,[...avoid,rail],{width:initial!.width,height:120},rail);expect(placed).toBeDefined();
   expect(placed!.height).toBe(120);
   for(const box of [...avoid,rail])expect(intersects(placed!,box),`${width}x${height}`).toBe(false);
   expect(intersects(placed!,p.pc!.ownedRail)).toBe(false);
   expect(intersects(placed!,p.pc!.shopPanel)).toBe(false);
  }
 });

 it('resumes for a real second purchase in a later shop while the guide is still unfinished',async()=>{
  const {run}=await firstShop('107');await purchaseFirst(run);openNoviceOwnedLesson(run.state,run.journal,guide(run));
  await send(run,{type:'LeaveShop'});await send(run,{type:'EnterStage'});
  await send(run,{type:'PlayHand',selectedIds:['clubs-6','spades-6']});expect(guide(run)?.step).toBe('skill');
  if(run.state.phase==='await-input'){
   let pair:string[]|undefined;
   for(let attempt=0;attempt<4&&!pair;attempt++){
    const ranks=new Map<number,string[]>();
    for(const id of run.state.handOrder){const rank=run.state.deckInstances.find(c=>c.id===id)!.rank;ranks.set(rank,[...(ranks.get(rank)??[]),id]);}
    pair=[...ranks.values()].find(ids=>ids.length>=2)?.slice(0,2);
    if(!pair)await send(run,{type:'DiscardHand',selectedIds:run.state.handOrder.slice(0,5)});
   }
   expect(pair).toBeDefined();await send(run,{type:'PlayHand',selectedIds:pair!,erxiangTargetId:pair![0]});
  }
  expect(run.state.phase).toBe('stage-cleared');await send(run,{type:'OpenShop'});
  expect(['skill','skill-practice']).toContain(guide(run)?.step);expect(lesson(run)).toBeUndefined();
  const offer=run.state.shop!.offers.find(o=>!o.consumed&&r2PurchasePrice(run.state,o)<=run.state.gold&&!run.state.jokers.some(j=>j.definitionId===o.definitionId))!;
  expect(offer).toBeDefined();await send(run,{type:'BuyOffer',offerId:offer.offerId});expect(run.state.jokers).toHaveLength(2);
  expect(lesson(run)).toMatchObject({reordered:false});
  expect(presentNoviceOwnedLesson(guide(run)!,lesson(run),{collapsed:false,canExpand:true,count:2}).hint.cue).toBe('试试调整顺序');
  expect(noviceOwnedLesson(run.state,run.journal,{step:'complete',cue:'',body:''})).toBeUndefined();
 });
});
