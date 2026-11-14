import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import type {Checkpoint} from '../src/application/checkpoint';
import {createRun,type Action} from '../src/domain/run';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {flushDiscardHint,flushLessonGroups,flushRefillHint} from '../src/game/NoviceFlushLesson';
import {NoviceHandLesson} from '../src/game/NoviceHandLesson';
import type {NoviceGuideHint} from '../src/game/NoviceGuide';

let values:Map<string,string>;
beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});});
afterEach(()=>vi.unstubAllGlobals());
const hint:NoviceGuideHint={step:'discard',cue:'换牌',body:''};
const make=(id:string,suit:PlayingCard['suit'],rank:PlayingCard['rank']):PlayingCard=>({id,suit,rank});
const unsorted=[make('clubs-4','clubs',4),make('spades-14','spades',14),make('diamonds-4','diamonds',4),make('clubs-7','clubs',7),make('spades-11','spades',11),make('hearts-10','hearts',10),make('hearts-3','hearts',3),make('hearts-6','hearts',6)];
const sorted=[unsorted[1],unsorted[4],unsorted[5],unsorted[7],unsorted[6],unsorted[3],unsorted[0],unsorted[2]];
const flags={introSeen:false,sorted:false,sortedSeen:false,coarse:false};
const view=(hand:PlayingCard[],selected:string[]=[],opts=flags)=>flushDiscardHint(hint,hand,selected,opts)!;

describe('goal-directed first discard',()=>{
 it('shows and waits for the real three hearts before requesting suit sort',()=>{
  expect(flushLessonGroups(unsorted)?.hearts).toEqual(['hearts-10','hearts-3','hearts-6']);
  expect(view(unsorted)).toMatchObject({cue:'先看看三张红桃',recommendedCardIds:['hearts-10','hearts-3','hearts-6'],choices:[{id:'flush-intro'}]});
  expect(view(unsorted).body).toContain('未必');
  expect(view(unsorted,[],{...flags,introSeen:true})).toMatchObject({focus:'sort-suit',cue:'让同花色排在一起'});
  expect(flushDiscardHint(hint,unsorted.slice(0,7),[],flags)).toBeUndefined();
 });
 it('shows the sorted hearts, then recommends two independent mouse or touch sweeps',()=>{
  expect(flushLessonGroups(sorted)).toEqual({hearts:['hearts-10','hearts-6','hearts-3'],left:['spades-14','spades-11'],right:['clubs-7','clubs-4','diamonds-4'],grouped:true});
  const reviewed={...flags,introSeen:true,sorted:true};
  expect(view(sorted,[],reviewed)).toMatchObject({cue:'三张红桃排在一起了',recommendedCardIds:['hearts-10','hearts-6','hearts-3'],choices:[{id:'flush-sorted'}]});
  const active={...reviewed,sortedSeen:true};
  expect(view(sorted,[],active)).toMatchObject({cue:'选左侧其他花色',gesture:'sweep',gestureCardIds:['spades-14','spades-11']});
  expect(view(sorted,['spades-14'],active)).toMatchObject({recommendedCardIds:['spades-11']});
  expect(view(sorted,['spades-14','spades-11'],{...active,coarse:true})).toMatchObject({cue:'选右侧其他花色',gesture:'sweep',gestureCardIds:['clubs-7','clubs-4','diamonds-4']});
  expect(view(sorted,['spades-14','spades-11','clubs-7','clubs-4','diamonds-4'],active)).toMatchObject({cue:'选好了，试试换牌',focus:'discard'});
  expect(view(sorted,['hearts-10'],active)).toMatchObject({cue:'红桃先留在手里',focus:'play-or-discard',recommendedCardIds:['hearts-10']});
  expect(view(sorted,['clubs-7','clubs-4','diamonds-4'],active).cue).toBe('选左侧其他花色');
  expect(view(unsorted,[],active)).toMatchObject({focus:'sort-suit'});
 });
 it('describes the actual refill count without promising a completed flush',()=>{
  expect(flushRefillHint(unsorted.filter(card=>card.suit!=='hearts')).body).toContain('有0张红桃');
  expect(flushRefillHint([...unsorted,make('hearts-11','hearts',11)]).body).toContain('有4张红桃，同花需要5张');
  const six=[...unsorted,make('hearts-11','hearts',11),make('hearts-7','hearts',7),make('hearts-12','hearts',12)];
  expect(flushRefillHint(six)).toMatchObject({body:expect.stringContaining('有6张红桃，任选5张'),heartIds:expect.arrayContaining(['hearts-11','hearts-7','hearts-12'])});
 });
 it('keeps acknowledgement locally but ties sorted review to an actual saved sorting command',()=>{
  const id='flush-run',command={runId:id,commandId:id+'/6',expectedSeq:5,action:{type:'ReorderHand' as const,ids:sorted.map(card=>card.id)}};
  const lesson=new NoviceHandLesson(id);lesson.acknowledgeFlushIntro();lesson.acknowledgeFlushSorted([]);
  expect(new NoviceHandLesson(id).flushIntroSeen()).toBe(true);expect(lesson.flushSortedSeen([])).toBe(false);
  lesson.recordSort(command);lesson.acknowledgeFlushSorted([command]);
  const restored=new NoviceHandLesson(id);expect(restored.flushSortedSeen([command])).toBe(true);
  expect(restored.flushSortedSeen([])).toBe(false);expect(restored.flushIntroSeen()).toBe(true);
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
