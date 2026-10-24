import {describe,expect,it,vi} from 'vitest';
import {createRun} from '../src/domain/run';
import {BUILD_FOCUS,chooseBuildFocus} from '../src/game/BuildJourney';
import type {DetailDialog} from '../src/game/DetailDialog';
import {OPENING_BASE_HAND_TYPES,openingRuleBriefing,showOpeningRuleBriefing} from '../src/game/OpeningRuleBriefing';

const run=(runId='opening-rules')=>createRun({seed:'opening-rules-17',runId,characterId:'amo',rulesVersion:'r2',r2Profile:'group-upgrade-v1'});
const names=(cards:ReturnType<typeof openingRuleBriefing>['cards'])=>cards.map(card=>card.title);

describe('opening rule briefing',()=>{
 it.each(BUILD_FOCUS)('shows eight visual poker examples in strength order and highlights only the selected %s route',focus=>{
  const state=run();chooseBuildFocus(state,focus);const before=JSON.stringify(state),model=openingRuleBriefing(state);
  expect(model.title).toBe('牌型示例');expect(model.body).toBe('');expect(model.primaryLabel).toBe('进入商店');
  expect(OPENING_BASE_HAND_TYPES).toEqual(['straight-flush','four-kind','full-house','flush','straight','three-kind','two-pair','pair']);
  expect(names(model.cards)).toEqual(['同花顺','四条','葫芦','同花','顺子','三条','两对','对子']);
  expect(names(model.cards)).not.toContain('高牌');
  expect(model.cards.every(card=>card.example.length===5&&card.example.every(label=>/^(?:10|[2-9AJQK])[♠♥♣♦]$/.test(label)))).toBe(true);
  expect(model.cards[0].example).toEqual(['10♠','J♠','Q♠','K♠','A♠']);
  expect(names(model.cards.filter(card=>card.selected))).toEqual(focus==='group'?['三条','两对','对子']:focus==='straight'?['顺子']:['同花']);
  expect(model.cards.map(card=>card.rank)).toEqual([1,2,3,4,5,6,7,8]);
  expect(model.cards.map(card=>card.rankText)).toEqual(['壹','贰','叁','肆','伍','陆','柒','捌']);
  expect(model.cards.map(card=>card.baseScore)).toEqual([4050,2240,1050,560,500,270,130,70]);
  expect(JSON.stringify(state)).toBe(before);
 });

 it('keeps the visual briefing usable when an older run has no saved opening route',()=>{
  const model=openingRuleBriefing(run('older-run-no-route'));
  expect(names(model.cards.filter(card=>card.selected))).toEqual(['三条','两对','对子']);
 });

 it('offers one visible shop action and routes duplicate close events through one transition',()=>{
  const state=run();chooseBuildFocus(state,'straight');
  let actions:Parameters<DetailDialog['open']>[2]=[],options:Parameters<DetailDialog['open']>[3];
  const closeButton={hidden:false},primary={focus:vi.fn()};
  const element={classList:{add:vi.fn()},querySelector:vi.fn((selector:string)=>selector==='.dialog-close'?closeButton:selector==='.dialog-primary'?primary:null),querySelectorAll:vi.fn(()=>[])} as unknown as HTMLDialogElement;
  const open=vi.fn((...args:Parameters<DetailDialog['open']>)=>{actions=args[2];options=args[3];return element;});
  const close=vi.fn(()=>options?.onClose?.()),enter=vi.fn(),dialog={open,close} as unknown as DetailDialog;
  expect(showOpeningRuleBriefing(dialog,state,enter)).toBe(element);
  expect(actions).toHaveLength(1);expect(options?.cards).toHaveLength(8);expect(options?.guideSteps).toBeUndefined();expect(options?.closeLabel).toBeUndefined();
  expect(closeButton.hidden).toBe(true);expect(primary.focus).toHaveBeenCalledWith({preventScroll:true});
  actions[0].run();options?.onClose?.();
  expect(close).toHaveBeenCalledOnce();expect(enter).toHaveBeenCalledOnce();expect(element.classList.add).toHaveBeenCalledWith('opening-rule-briefing');
 });

 it('treats cancel or Escape as the same single continuation instead of trapping the player',()=>{
  const state=run();chooseBuildFocus(state,'flush');let options:Parameters<DetailDialog['open']>[3];
  const element={classList:{add:vi.fn()},querySelector:vi.fn(()=>null),querySelectorAll:vi.fn(()=>[])} as unknown as HTMLDialogElement;
  const open=vi.fn((...args:Parameters<DetailDialog['open']>)=>{options=args[3];return element;});
  const enter=vi.fn(),dialog={open,close:vi.fn()} as unknown as DetailDialog;
  showOpeningRuleBriefing(dialog,state,enter);options?.onClose?.();options?.onClose?.();
  expect(enter).toHaveBeenCalledOnce();
 });
});
