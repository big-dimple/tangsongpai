import {describe,expect,it,vi} from 'vitest';
import {createRun} from '../src/domain/run';
import {R2_HAND_TYPES} from '../src/domain/evaluateR2';
import {BUILD_FOCUS,chooseBuildFocus} from '../src/game/BuildJourney';
import type {DetailDialog} from '../src/game/DetailDialog';
import {handTypeRuleCards} from '../src/game/HandRuleReference';
import {OPENING_ROUTES} from '../src/game/HeroOpeningCopy';
import {openingRuleBriefing,showOpeningRuleBriefing} from '../src/game/OpeningRuleBriefing';

const run=()=>createRun({seed:'opening-rules-17',runId:'opening-rules',characterId:'amo',rulesVersion:'r2',r2Profile:'group-upgrade-v1'});

describe('opening rule briefing',()=>{
 it.each(BUILD_FOCUS)('uses the selected %s route and all twelve live hand references without mutating the run',focus=>{
  const state=run();chooseBuildFocus(state,focus);const before=JSON.stringify(state),model=openingRuleBriefing(state);
  expect(model.effectBody).toContain(OPENING_ROUTES[focus].title);expect(model.effectBody).toContain('仍可改玩其他牌型');
  expect(model.body).toContain('1–5张');expect(model.body).toContain('初始商店');
  expect(model.cards).toHaveLength(R2_HAND_TYPES.length);expect(model.cards).toEqual(handTypeRuleCards(state.handLevels));
  expect(JSON.stringify(state)).toBe(before);
 });

 it('routes the primary action and later duplicate close events through one shop transition',()=>{
  const state=run();chooseBuildFocus(state,'straight');
  let actions:Parameters<DetailDialog['open']>[2]=[],options:Parameters<DetailDialog['open']>[3];
  const element={classList:{add:vi.fn()}} as unknown as HTMLDialogElement;
  const open=vi.fn((...args:Parameters<DetailDialog['open']>)=>{actions=args[2];options=args[3];return element;});
  const close=vi.fn(()=>options?.onClose?.()),enter=vi.fn(),dialog={open,close} as unknown as DetailDialog;
  expect(showOpeningRuleBriefing(dialog,state,enter)).toBe(element);
  expect(options?.cards).toHaveLength(12);expect(options?.guideSteps).toEqual({labels:['选择路线','规则说明','初始商店'],current:1});
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
