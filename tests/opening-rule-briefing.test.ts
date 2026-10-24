import {describe,expect,it,vi} from 'vitest';
import {createRun} from '../src/domain/run';
import {BUILD_FOCUS,chooseBuildFocus} from '../src/game/BuildJourney';
import type {DetailDialog} from '../src/game/DetailDialog';
import {OPENING_ROUTES} from '../src/game/HeroOpeningCopy';
import {OPENING_BASE_HAND_TYPES,openingRuleBriefing,showOpeningRuleBriefing} from '../src/game/OpeningRuleBriefing';

const run=()=>createRun({seed:'opening-rules-17',runId:'opening-rules',characterId:'amo',rulesVersion:'r2',r2Profile:'group-upgrade-v1'});
const names=(cards:ReturnType<typeof openingRuleBriefing>['cards'])=>cards.map(card=>card.title.replace(/^已选路线 · /,'').split(' · ')[0]);

describe('opening rule briefing',()=>{
 it.each(BUILD_FOCUS)('teaches nine basic types in strength order and marks only the selected %s route',focus=>{
  const state=run();chooseBuildFocus(state,focus);const before=JSON.stringify(state),model=openingRuleBriefing(state);
  expect(model.effectBody).toContain(OPENING_ROUTES[focus].title);expect(model.effectBody).toContain('仍可改玩其他牌型');
  expect(model.body).toContain('1–5张');expect(model.body).toContain('初始商店');expect(model.title).toContain('9种基础牌型');
  expect(OPENING_BASE_HAND_TYPES).toEqual(['straight-flush','four-kind','full-house','flush','straight','three-kind','two-pair','pair','high-card']);
  expect(names(model.cards)).toEqual(['同花顺','四条','葫芦','同花','顺子','三条','两对','对子','高牌']);
  const expected=focus==='group'?['对子','两对','三条']:focus==='straight'?['顺子']:['同花'];
  expect(names(model.cards.filter(card=>card.stat))).toEqual(expected);
  expect(model.cards.filter(card=>card.stat).every(card=>card.title.startsWith('已选路线 · ')&&card.stat==='当前路线：'+OPENING_ROUTES[focus].title)).toBe(true);
  expect(model.summaryBody).toContain('五条');expect(model.summaryBody).toContain('同花葫芦');expect(model.summaryBody).toContain('同花五条');
  expect(JSON.stringify(state)).toBe(before);
 });

 it('keeps the briefing usable when an older run has no saved opening route',()=>{
  const model=openingRuleBriefing(run());
  expect(model.effectBody).toContain(OPENING_ROUTES.group.title);
  expect(names(model.cards.filter(card=>card.stat))).toEqual(['对子','两对','三条']);
 });

 it('routes the primary action and later duplicate close events through one shop transition',()=>{
  const state=run();chooseBuildFocus(state,'straight');
  let actions:Parameters<DetailDialog['open']>[2]=[],options:Parameters<DetailDialog['open']>[3];
  const element={classList:{add:vi.fn()}} as unknown as HTMLDialogElement;
  const open=vi.fn((...args:Parameters<DetailDialog['open']>)=>{actions=args[2];options=args[3];return element;});
  const close=vi.fn(()=>options?.onClose?.()),enter=vi.fn(),dialog={open,close} as unknown as DetailDialog;
  expect(showOpeningRuleBriefing(dialog,state,enter)).toBe(element);
  expect(options?.cards).toHaveLength(9);expect(options?.guideSteps).toEqual({labels:['选择路线','规则说明','初始商店'],current:1});
  actions[0].run();options?.onClose?.();
  expect(close).toHaveBeenCalledOnce();expect(enter).toHaveBeenCalledOnce();expect(element.classList.add).toHaveBeenCalledWith('opening-rule-briefing');
 });

 it('treats cancel or Escape as the same single continuation instead of trapping the player',()=>{
  const state=run();chooseBuildFocus(state,'flush');let options:Parameters<DetailDialog['open']>[3];
  const element={classList:{add:vi.fn()}} as unknown as HTMLDialogElement;
  const open=vi.fn((...args:Parameters<DetailDialog['open']>)=>{options=args[3];return element;});
  const enter=vi.fn(),dialog={open,close:vi.fn()} as unknown as DetailDialog;
  showOpeningRuleBriefing(dialog,state,enter);options?.onClose?.();options?.onClose?.();
  expect(enter).toHaveBeenCalledOnce();
 });
});
