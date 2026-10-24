import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import {GameScene} from '../src/game/GameScene';
import {SUITS,type PlayingCard} from '../src/cards/types';
const path='src/game/GameScene.ts',current=readFileSync(path,'utf8');
const method=(source:string)=>source.slice(source.indexOf("  private async sortHand(mode:'rank'|'suit'):Promise<void> {"),source.indexOf('  private readonly stopHandHint'));
const oldMethod=readFileSync(new URL('./fixtures/hand-sort-9abedd01.txt',import.meta.url),'utf8'),restored=method(current);
const reference=new Function('SUITS','return '+ts.transpileModule('('+oldMethod.trim().replace('private async sortHand','async function sortHand')+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(SUITS) as (this:ReturnType<typeof scene>,mode:'rank'|'suit')=>Promise<void>;
const actual=(GameScene.prototype as unknown as {sortHand:typeof reference}).sortHand;
const cards:PlayingCard[]=[{id:'s9',suit:'spades',rank:9},{id:'hK',suit:'hearts',rank:13,enhancement:'glass-paper'},{id:'dK',suit:'diamonds',rank:13},{id:'h9',suit:'hearts',rank:9},{id:'c5',suit:'clubs',rank:5},{id:'d5',suit:'diamonds',rank:5},{id:'h5',suit:'hearts',rank:5},{id:'old-clubs-2',suit:'diamonds',rank:2,edition:'polychrome'}];
function scene(hand:PlayingCard[]){
 const s={ready:true,presentation:undefined,run:{phase:'await-input'},hand:[...hand],selectedIds:new Set<string>(),assistIds:[] as string[],aiCursor:undefined as unknown,candidateGhost:undefined as unknown,candidateUndo:undefined as unknown,statusMessage:'',handInput:{cancel:vi.fn()},view:{cancelInteraction:vi.fn()},refreshSelection:vi.fn(),handPositions:()=>new Map(),command:vi.fn(async(action:{type:string;ids:string[]})=>{s.hand=action.ids.map(id=>s.hand.find(c=>c.id===id)!);return true;}),slideHandFrom:vi.fn(),updateControls:vi.fn(),showHandHint:vi.fn()};return s;
}
it('restores the complete sorting method byte for byte from the requested stable version',()=>{expect(createHash('sha256').update(oldMethod).digest('hex')).toBe('b1b1533234d8f31cb325a6b6688ada15650461b17951b20d7eb675d05677cd59');expect(restored).toBe(oldMethod);expect(current).not.toContain("from './HandSuitSort'");expect(current).not.toContain('suitSortTarget');expect(current).not.toContain('suitSortRunId');});
it.each([false,true])('rank/suit alternation matches the stable implementation, with prior selection=%s',async selected=>{
 const a=scene(cards),b=scene(cards),before=structuredClone(cards);
 for(const mode of ['suit','rank','suit','rank','suit'] as const){
  for(const s of [a,b]){s.selectedIds=new Set(selected?['hK','dK','c5','d5','h5']:[]);s.aiCursor={index:2,selection:'old'};s.candidateUndo={ids:['hK']};s.candidateGhost={key:'old'};}
  await reference.call(a,mode);await actual.call(b,mode);
  expect(b.hand).toEqual(a.hand);expect(b.command.mock.calls.at(-1)).toEqual(a.command.mock.calls.at(-1));expect([...b.selectedIds]).toEqual([]);expect(b.aiCursor).toBeUndefined();expect(b.candidateUndo).toBeUndefined();expect(b.candidateGhost).toBeUndefined();expect(b.refreshSelection).toHaveBeenCalled();expect(new Set(b.hand)).toEqual(new Set(cards));
  if(mode==='suit'){const blocks=b.hand.map(c=>c.suit).filter((v,i,all)=>!i||v!==all[i-1]);expect(blocks.length).toBe(new Set(blocks).size);}
 }
 expect(cards).toEqual(before);
});
