import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import type {Checkpoint} from '../src/application/checkpoint';
import {createRun,type Action} from '../src/domain/run';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {flushDiscardHint,flushRefillHint} from '../src/game/NoviceFlushLesson';
import {NoviceHandLesson} from '../src/game/NoviceHandLesson';
import type {NoviceGuideHint} from '../src/game/NoviceGuide';

let values:Map<string,string>;
beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});});
afterEach(()=>vi.unstubAllGlobals());
const hint:NoviceGuideHint={step:'discard',cue:'换牌',body:''};
const make=(id:string,suit:PlayingCard['suit'],rank:PlayingCard['rank']):PlayingCard=>({id,suit,rank});
const unsorted=[make('clubs-4','clubs',4),make('spades-14','spades',14),make('diamonds-4','diamonds',4),make('clubs-7','clubs',7),make('spades-11','spades',11),make('hearts-10','hearts',10),make('hearts-3','hearts',3),make('hearts-6','hearts',6)];
const sorted=[unsorted[1],unsorted[4],unsorted[5],unsorted[7],unsorted[6],unsorted[3],unsorted[0],unsorted[2]];
const flags:Parameters<typeof flushDiscardHint>[3]={sorted:false,coarse:false};
const view=(hand:PlayingCard[],selected:string[]=[],opts:Parameters<typeof flushDiscardHint>[3]=flags)=>flushDiscardHint(hint,hand,selected,opts)!;

describe('goal-directed first discard',()=>{
 it('separates held hearts from tap targets on the default route and keeps the alternative pair playable',()=>{
  const intro=view(unsorted),hearts=unsorted.slice(5).map(c=>c.id),others=unsorted.slice(0,5).map(c=>c.id);
  expect(intro).toMatchObject({cue:'留红桃，选杂牌',keepCardIds:hearts,recommendedCardIds:others,choices:[{id:'flush-draw'},{id:'flush-score'}]});
  expect(intro.body).toMatch(/还差2张.*有机会/);
  expect(view(unsorted,[others[0]]).recommendedCardIds).toEqual(others.slice(1));
  const wrong=view(unsorted,[...hearts,others[0]]);
  expect(wrong.recommendedCardIds).toEqual(hearts);expect(wrong.focus).toBeUndefined();expect(wrong.body).toContain('取消');
  expect(view(unsorted,others)).toMatchObject({focus:'discard',recommendedCardIds:[],keepCardIds:hearts});
  expect(view(unsorted,[],{...flags,plan:'score'}).recommendedCardIds).toEqual(['clubs-4','diamonds-4']);
  expect(view(unsorted,['clubs-4'],{...flags,plan:'score'}).recommendedCardIds).toEqual(['diamonds-4']);
  expect(view(unsorted,['clubs-4','diamonds-4'],{...flags,plan:'score'})).toMatchObject({focus:'play',keepCardIds:undefined});
  expect(view(unsorted,[],{...flags,plan:'draw'}).focus).toBe('sort-suit');
  expect(flushDiscardHint(hint,unsorted.slice(0,7),[],flags)).toBeUndefined();
 });
 it('guides both sides and never sweeps through selected cards, hearts, row breaks or page edges',()=>{
  const active={...flags,sorted:true,coarse:true},left=['spades-14','spades-11'],right=['clubs-7','clubs-4','diamonds-4'];
  expect(view(sorted,[],active)).toMatchObject({cue:'选左侧其他花色',gestureCardIds:left});
  expect(view(sorted,left,active)).toMatchObject({cue:'选右侧其他花色',gestureCardIds:right});
  expect(view(sorted,[...left,right[1]],active)).toMatchObject({recommendedCardIds:[right[0]]});
  expect(view(sorted,[...left,right[1]],active).gesture).toBeUndefined();
  expect(view(sorted,left,{...active,rowById:new Map(right.map((id,i)=>[id,i<2?12:50]))}).gestureCardIds).toEqual(right.slice(0,2));
  const firstPage=sorted.slice(0,4).map(card=>card.id),lastPage=sorted.slice(4).map(card=>card.id);
  expect(view(sorted,left,{...active,visibleIds:firstPage})).toMatchObject({focus:'hand-next',recommendedCardIds:[]});
  expect(view(sorted,right,{...active,visibleIds:lastPage})).toMatchObject({focus:'hand-previous',recommendedCardIds:[]});
  expect(view(sorted,[],{...active,visibleIds:lastPage})).toMatchObject({cue:'选右侧其他花色',recommendedCardIds:right});
  expect(view(sorted,['hearts-10'],{...active,visibleIds:lastPage})).toMatchObject({focus:'hand-previous',recommendedCardIds:[]});
  const split=[unsorted[0],unsorted[5],unsorted[1],unsorted[6],unsorted[2],unsorted[7],unsorted[3],unsorted[4]];
  expect(view(split).recommendedCardIds).toEqual([unsorted[0].id]);
  expect(view(split,[unsorted[0].id]).recommendedCardIds).toEqual([unsorted[1].id]);
 });
 it('uses the current refill, including a miss and a six-heart hand from which any five may score',()=>{
  const four=[...sorted.slice(0,-1),make('hearts-11','hearts',11)],refilled={...flags,refilled:true};
  expect(view(sorted,[],refilled).body).toContain('补牌后有3张红桃，还差2张');
  expect(view(four,[],refilled).body).toContain('补牌后有4张红桃，还差1张');
  expect(flushRefillHint(unsorted.filter(card=>card.suit!=='hearts')).body).toContain('有0张红桃，还差5张');
  const six=[sorted[0],sorted[1],...sorted.slice(2,5),make('hearts-11','hearts',11),make('hearts-7','hearts',7),make('hearts-12','hearts',12)];
  const hearts=six.slice(2).map(c=>c.id);
  expect(view(six,[],refilled)).toMatchObject({cue:'红桃已经成花',body:expect.stringContaining('有6张红桃，任选5张'),recommendedCardIds:hearts,keepCardIds:undefined});
  expect(view(six,hearts.slice(0,2),{...refilled,visibleIds:six.slice(0,4).map(c=>c.id)})).toMatchObject({focus:'hand-next',recommendedCardIds:[]});
  expect(view(six,[six[0].id,...hearts.slice(1,3)],refilled)).toMatchObject({recommendedCardIds:[six[0].id],focus:undefined});
  expect(view(six,hearts.slice(1),refilled)).toMatchObject({focus:'play',recommendedCardIds:[]});
 });
 it('restores a chosen alternative without making the lesson depend on having sorted',()=>{
  const id='flush-run';
  values.set('tangsongpai-novice-hand-interaction-v1:'+id,JSON.stringify({swept:false,flushIntroSeen:true}));
  const lesson=new NoviceHandLesson(id);expect(lesson.flushPlan()).toBe('draw');
  lesson.chooseFlushPlan('score');expect(new NoviceHandLesson(id).flushPlan()).toBe('score');
 });
});

class Store implements SaveStore {
 slots:SaveSlots={revision:0,current:null,previous:null};
 async read(){return structuredClone(this.slots);}
 async commit(revision:number,current:Checkpoint,previous:Checkpoint|null){if(revision!==this.slots.revision)throw Error('write-conflict');this.slots={revision:revision+1,current:structuredClone(current),previous:structuredClone(previous)};return revision+1;}
}
it('proves the actual fixed seed can sort, exchange five in one discard and score a flush',async()=>{
 const store=new Store(),id=guidedTutorialRunId('00000000-0000-4000-8000-000000000001');
 const initial=createRun({seed:'r2/tutorial/core-v1',runId:id,characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group',modeConfig:{mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false}});
 const run=await SavedRun.start(store,initial,await store.read());
 const send=async(action:Action)=>{const result=await run.dispatch(action);expect(result.ok).toBe(true);};
 await send({type:'LeaveShop'});await send({type:'EnterStage'});await send({type:'PlayHand',selectedIds:['clubs-5','hearts-5']});
 expect(run.state.stage).toMatchObject({heat:'90',targetHeat:'400',discardsLeft:3,handsLeft:3});
 expect(run.state.handOrder).toEqual(unsorted.map(card=>card.id));
 await send({type:'ReorderHand',ids:sorted.map(card=>card.id)});
 const discarded=['spades-14','spades-11','clubs-7','clubs-4','diamonds-4'];await send({type:'DiscardHand',selectedIds:discarded});
 expect(run.state.stage).toMatchObject({discardsLeft:2,handsLeft:3});
 const hearts=run.state.handOrder.filter(id=>id.startsWith('hearts-'));
 expect(hearts).toEqual(['hearts-10','hearts-6','hearts-3','hearts-11','hearts-7','hearts-12']);
 await send({type:'PlayHand',selectedIds:hearts.slice(0,5)});expect(run.state.lastTrace).toMatchObject({handType:'flush',finalScore:'704'});expect(run.state.phase).toBe('stage-cleared');
});
