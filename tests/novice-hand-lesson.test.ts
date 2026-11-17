import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {PlayingCard} from '../src/cards/types';
import {stableHash} from '../src/domain/hash';
import type {Command} from '../src/domain/run';
import type {HandSelectionUpdate} from '../src/game/HandSelectionGesture';
import {handControlHint,noviceSwipePath,NoviceHandLesson} from '../src/game/NoviceHandLesson';

const id='tutorial-run-a',enter:Command={runId:id,commandId:id+'/2',expectedSeq:1,action:{type:'EnterStage'}};
const sort:Command={runId:id,commandId:id+'/3',expectedSeq:2,action:{type:'ReorderHand',ids:['a','b','c','d']}};
const later:Command={...sort,commandId:id+'/4',expectedSeq:3,action:{type:'ReorderHand',ids:['d','c','b','a']}};
const update=(values:Partial<HandSelectionUpdate>={}):HandSelectionUpdate=>({
 phase:'committed',pointerId:1,mode:'select',selectedIds:['c','d'],visitedIds:['c','d'],limitReached:false,...values,
});
const values=new Map<string,string>();
beforeEach(()=>{values.clear();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});});
afterEach(()=>vi.unstubAllGlobals());

describe('player-led sorting and swiping',()=>{
 it('credits a free swipe before sorting, a later sort, and each checkpoint independently on reload',()=>{
  const lesson=new NoviceHandLesson(id);
  expect(lesson.recordSweep(update(),[],[enter])).toBe(true);
  expect(lesson.swept([enter])).toBe(true);expect(lesson.sortMode([enter])).toBeUndefined();
  lesson.recordSort('rank',sort,[enter,sort]);lesson.recordSort('suit',later,[enter,sort,later]);
  const restored=new NoviceHandLesson(id);
  expect(restored.swept([enter,sort,later])).toBe(true);expect(restored.sortMode([enter,sort,later])).toBe('suit');
  expect(restored.swept([enter])).toBe(true);expect(restored.sortMode([enter])).toBeUndefined();
  expect(restored.swept([])).toBe(false);expect(new NoviceHandLesson('different-run').swept([enter,sort])).toBe(false);
 });
 it('rejects a foreign, missing or changed source command, even when the ID is reused',()=>{
  const lesson=new NoviceHandLesson(id),foreign={...sort,runId:'other'};
  lesson.recordSort('suit',foreign,[foreign]);lesson.recordSort('rank',enter,[enter]);expect(lesson.sortMode([foreign,enter])).toBeUndefined();
  expect(lesson.recordSweep(update(),[],[foreign])).toBe(false);expect(lesson.recordSweep(update(),[],[])).toBe(false);
  lesson.recordSort('rank',sort,[sort]);lesson.recordSweep(update(),[],[sort]);
  for(const receipt of [foreign,{...sort,expectedSeq:1},{...sort,action:later.action},{...sort,action:enter.action}]){
   expect(lesson.sortMode([receipt])).toBeUndefined();expect(lesson.swept([receipt])).toBe(false);
  }
 });
 it('recognizes a real select or deselect across two changed cards, including a reverse sweep of the player’s own cards',()=>{
  const lesson=new NoviceHandLesson(id);
  expect(lesson.recordSweep(update({visitedIds:['d','c']}),[],[enter])).toBe(true);
  expect(lesson.recordSweep(update({mode:'deselect',selectedIds:['a'],visitedIds:['d','c']}),['a','c','d'],[enter])).toBe(true);
  expect(lesson.swept([enter])).toBe(true);
 });
 it('ignores taps, repeated visits, clipped gestures, and cancelled or interrupted swipes',()=>{
  const lesson=new NoviceHandLesson(id);
  for(const phase of ['pending','sweeping','interrupted','cancelled'] as const)expect(lesson.recordSweep(update({phase}),[],[enter])).toBe(false);
  for(const attempt of [update({visitedIds:['c']}),update({visitedIds:['c','c']}),update({limitReached:true}),update({mode:'deselect',selectedIds:[]})])
   expect(lesson.recordSweep(attempt,[],[enter])).toBe(false);
  expect(lesson.recordSweep(update(),['c'],[enter])).toBe(false);expect(lesson.swept([enter])).toBe(false);
  expect(lesson.recordSweep(update(),[],[enter])).toBe(true);
 });
 it('restores old suit-sort and swipe receipts without confusing a flush sort with a swipe',()=>{
  const key='tangsongpai-novice-hand-interaction-v1:'+id;
  for(const swept of [true,false]){
   values.set(key,JSON.stringify({sortId:sort.commandId,sortHash:stableHash(sort),swept,flushIntroSeen:true,flushSortedSeen:true}));
   const lesson=new NoviceHandLesson(id);
   expect(lesson.sortMode([sort])).toBe('suit');expect(lesson.flushPlan()).toBe('draw');expect(lesson.swept([sort])).toBe(swept);
   expect(lesson.flushSortedSeen([sort])).toBe(true);lesson.recordSort('rank',later,[sort,later]);
   expect(lesson.flushSortedSeen([sort,later])).toBe(true);expect(lesson.flushSortedSeen([])).toBe(false);
   expect(lesson.swept([later])).toBe(false);
  }
 });
 it('remains usable in memory when preference storage is unavailable',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
  const lesson=new NoviceHandLesson(id);lesson.recordSort('suit',sort,[sort]);lesson.recordSweep(update(),[],[sort]);
  expect(lesson.sortMode([sort])).toBe('suit');expect(lesson.swept([sort])).toBe(true);
 });
});

describe('on-table gesture instructions',()=>{
 const card=(id:string,rank:PlayingCard['rank'],suit:PlayingCard['suit']):PlayingCard=>({id,rank,suit});
 const cards=[card('h5',5,'hearts'),card('c5',5,'clubs'),card('c4',4,'clubs'),card('d4',4,'diamonds')];
 const seats=(...rows:number[])=>rows.map(y=>({visible:y>=0,hit:{y}}));
 it('anchors a rank-sorted pair or suit group only on contiguous playable cards in the same visible row',()=>{
  const first=['h5','c5'];
  expect(noviceSwipePath(cards,seats(0,0,0,0),'rank',first)).toEqual(first);
  expect(noviceSwipePath(cards,seats(0,0,0,0),'suit')).toEqual(['c5','c4']);
  expect(noviceSwipePath(cards,seats(0,50,50,50),'rank',first)).toEqual([]);
  expect(noviceSwipePath(cards,seats(0,-1,0,0),'rank',first)).toEqual([]);
  expect(noviceSwipePath(cards,seats(0,0,0,0),'rank',first,['c5'])).toEqual([]);
  expect(noviceSwipePath([cards[0],cards[2],cards[1]],seats(0,0,0),'rank',first)).toEqual([]);
 });
 it('lets the player practise on neighbors if no pair is present and caps a group at five cards',()=>{
  expect(noviceSwipePath([cards[0],cards[2]],seats(0,0),'rank')).toEqual(['h5','c4']);
  const six=Array.from({length:6},(_,i)=>card('h'+i,5,'hearts'));
  expect(noviceSwipePath(six,seats(0,0,0,0,0,0),'suit')).toEqual(six.slice(0,5).map(c=>c.id));
 });
 it('points to the chosen sorting control, then the live cards, without taking away the score or strategy choices',()=>{
  const hint={step:'discard' as const,cue:'对子',beat:'对子入账 +90 分',body:'',choices:[{id:'flush-score',label:'打手里的对子',cardIds:[]}]};
  const settings={mode:'rank' as const,needsSort:true,path:['h5','c5'],coarse:true};
  expect(handControlHint(hint,settings)).toMatchObject({cue:'先去理牌区',focus:'sort-rank',choices:hint.choices,beat:hint.beat});
  expect(handControlHint(hint,{...settings,mode:'suit'}).focus).toBe('sort-suit');
  expect(handControlHint(hint,{...settings,needsSort:false})).toMatchObject({gesture:'sweep',gestureCardIds:settings.path,recommendedCardIds:settings.path,choices:hint.choices});
  expect(handControlHint(hint,{...settings,needsSort:false,path:[]})).toEqual(hint);
 });
});
