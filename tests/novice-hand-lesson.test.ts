import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {PlayingCard,Suit} from '../src/cards/types';
import type {Command} from '../src/domain/run';
import type {HandSelectionUpdate} from '../src/game/HandSelectionGesture';
import {consecutiveSuitCards,NoviceHandLesson} from '../src/game/NoviceHandLesson';

let storage:Map<string,string>;
beforeEach(()=>{
  storage=new Map();
  vi.stubGlobal('localStorage',{
    getItem:(key:string)=>storage.get(key)??null,
    setItem:(key:string,value:string)=>storage.set(key,value),
    removeItem:(key:string)=>storage.delete(key),
  });
});
afterEach(()=>vi.unstubAllGlobals());

const runId='tutorial-run-a';
const sort:Command={runId,commandId:`${runId}/command/6`,expectedSeq:5,action:{type:'ReorderHand',ids:['a','b','c','d']}};
const next:Command={runId,commandId:`${runId}/command/7`,expectedSeq:6,action:{type:'DiscardHand',selectedIds:['d']}};
const update=(values:Partial<HandSelectionUpdate>={}):HandSelectionUpdate=>({
  phase:'committed',pointerId:1,mode:'select',selectedIds:['a','b'],visitedIds:['a','b'],limitReached:false,...values,
});
const lesson=()=>{const value=new NoviceHandLesson(runId);value.recordSort(sort);return value;};
const card=(id:string,suit:Suit,rank:PlayingCard['rank']=2):PlayingCard=>({id,suit,rank});

describe('tutorial hand lesson evidence',()=>{
  it('requires the recorded sort in the published journal and restores it after refresh',()=>{
    const current=new NoviceHandLesson(runId);
    expect(current.sorted([])).toBe(false);
    expect(current.swept([])).toBe(false);
    current.recordSort(sort);
    expect(current.sorted([sort])).toBe(true);
    expect(current.recordSweep(update(),['a','b'],[])).toBe(true);
    expect(current.swept([sort,next])).toBe(true);

    const refreshed=new NoviceHandLesson(runId);
    expect(refreshed.sorted([structuredClone(sort),next])).toBe(true);
    expect(refreshed.swept([structuredClone(sort),next])).toBe(true);
    // Restoring an earlier checkpoint must not borrow the later UI preference.
    expect(refreshed.sorted([])).toBe(false);
    expect(refreshed.swept([])).toBe(false);
  });

  it('does not accept a reused command ID with different command contents or another run',()=>{
    const changedOrder:Command={...sort,action:{type:'ReorderHand',ids:['b','a','c','d']}};
    const changedAction:Command={...sort,action:{type:'DiscardHand',selectedIds:['a']}};
    const changedSequence:Command={...sort,expectedSeq:4};
    const changedRun:Command={...sort,runId:'tutorial-run-b'};
    for(const command of [changedOrder,changedAction,changedSequence,changedRun]){
      const current=lesson();
      expect(current.recordSweep(update(),['a','b'],[])).toBe(true);
      expect(current.sorted([command])).toBe(false);
      expect(current.swept([command])).toBe(false);
    }
    const other=new NoviceHandLesson('tutorial-run-b');
    expect(other.sorted([sort])).toBe(false);
    expect(other.swept([sort])).toBe(false);
  });

  it('does not record a foreign run or a non-hand-reorder as the sorting action',()=>{
    const foreign=new NoviceHandLesson('tutorial-run-b');
    foreign.recordSort(sort);
    expect(foreign.sorted([sort])).toBe(false);
    const current=new NoviceHandLesson(runId);
    const wrong:Command={...sort,action:{type:'ReorderJokers',ids:['a','b']}};
    current.recordSort(wrong);
    expect(current.sorted([wrong])).toBe(false);
  });

  it('keeps two runs independent when their local lesson records both exist',()=>{
    const first=lesson();
    expect(first.recordSweep(update(),['a','b'],[])).toBe(true);
    const otherId='tutorial-run-b';
    const otherSort:Command={...sort,runId:otherId,commandId:`${otherId}/command/6`};
    const other=new NoviceHandLesson(otherId);
    other.recordSort(otherSort);
    expect(other.sorted([otherSort])).toBe(true);
    expect(other.swept([otherSort])).toBe(false);
    const restoredFirst=new NoviceHandLesson(runId);
    expect(restoredFirst.sorted([sort])).toBe(true);
    expect(restoredFirst.swept([sort])).toBe(true);
  });

  it('keeps a repeated sort receipt idempotent but does not attach an old sweep to a different sort',()=>{
    const current=lesson();
    expect(current.recordSweep(update(),['a','b'],[])).toBe(true);
    current.recordSort(structuredClone(sort));
    expect(current.swept([sort])).toBe(true);
    const later:Command={runId,commandId:`${runId}/command/7`,expectedSeq:6,action:{type:'ReorderHand',ids:['d','c','b','a']}};
    current.recordSort(later);
    expect(current.sorted([sort,later])).toBe(true);
    expect(current.swept([sort,later])).toBe(false);
  });

  it.each(['pending','sweeping','interrupted','cancelled'] as const)('does not finish on a %s update',phase=>{
    const current=lesson();
    expect(current.recordSweep(update({phase}),['a','b'],[])).toBe(false);
    expect(current.swept([sort])).toBe(false);
  });

  it('requires a committed select gesture covering every target and two newly selected target cards',()=>{
    const attempts:{update:HandSelectionUpdate;target:string[];initial:string[]}[]=[
      {update:update({mode:'deselect',selectedIds:[]}),target:['a','b'],initial:['a','b']},
      {update:update({visitedIds:['a'],selectedIds:['a']}),target:['a','b'],initial:[]},
      {update:update({visitedIds:['a','a'],selectedIds:['a']}),target:['a','b'],initial:[]},
      {update:update(),target:['a','b'],initial:['a']},
      // New unrelated cards cannot count in place of a new target card.
      {update:update({visitedIds:['a','b','c'],selectedIds:['a','b','c']}),target:['a','b'],initial:['a']},
      // A visited card beyond the five-card limit was never selected.
      {update:update({visitedIds:['a','b','c'],selectedIds:['a','b','x','y','z'],limitReached:true}),target:['a','b','c'],initial:['x','y','z']},
    ];
    for(const attempt of attempts){
      const current=lesson();
      expect(current.recordSweep(attempt.update,attempt.target,attempt.initial)).toBe(false);
      expect(current.swept([sort])).toBe(false);
    }
    const current=lesson();
    expect(current.recordSweep(update({visitedIds:['c','b','a'],selectedIds:['a','b','c']}),['a','b','c'],['a'])).toBe(true);
    expect(current.swept([sort])).toBe(true);
  });

  it('does not let a failed attempt prevent retrying with a new gesture',()=>{
    const current=lesson();
    expect(current.recordSweep(update({phase:'interrupted',selectedIds:['a'],visitedIds:['a']}),['a','b'],[])).toBe(false);
    // The interrupted choice remains in the UI: deselect it before trying again.
    expect(current.recordSweep(update({mode:'deselect',selectedIds:[],visitedIds:['a']}),['a','b'],['a'])).toBe(false);
    expect(current.recordSweep(update(),['a','b'],[])).toBe(true);
    expect(current.swept([sort])).toBe(true);
  });

  it('remains usable for this session if browser preference storage is unavailable',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>{throw Error('unavailable');},setItem:()=>{throw Error('unavailable');}});
    const current=lesson();
    expect(current.sorted([sort])).toBe(true);
    expect(current.recordSweep(update(),['a','b'],[])).toBe(true);
    expect(current.swept([sort])).toBe(true);
  });
});

describe('consecutive same-suit targets',()=>{
  it('returns no target for an empty hand or cards of different suits',()=>{
    expect(consecutiveSuitCards([])).toEqual([]);
    expect(consecutiveSuitCards([card('s','spades'),card('h','hearts'),card('c','clubs')])).toEqual([]);
    // Repeated suits separated by another suit are not a consecutive group.
    expect(consecutiveSuitCards([card('h1','hearts'),card('s','spades'),card('h2','hearts')])).toEqual([]);
  });

  it('uses the longest actual contiguous suit run and limits it to five',()=>{
    const hand=[card('s1','spades'),card('s2','spades'),card('h1','hearts'),card('h2','hearts'),card('h3','hearts'),card('c','clubs')];
    expect(consecutiveSuitCards(hand)).toEqual(['h1','h2','h3']);
    const six=Array.from({length:6},(_,i)=>card('h'+i,'hearts'));
    const target=consecutiveSuitCards(six);
    expect(target).toHaveLength(5);
    expect(target).toEqual(six.slice(0,5).map(c=>c.id));
    expect(six).toHaveLength(6);
  });

  it('recomputes the group when the player changes the hand order',()=>{
    const hand=[card('h1','hearts'),card('s1','spades'),card('h2','hearts'),card('s2','spades')];
    expect(consecutiveSuitCards(hand)).toEqual([]);
    expect(consecutiveSuitCards([hand[1],hand[3],hand[0],hand[2],card('h3','hearts')])).toEqual(['h1','h2','h3']);
  });
});
