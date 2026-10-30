import {cardDisplayName} from '../src/game/tangsongCardNames';
import {describe,it,expect} from 'vitest';
import {createRun,applyCommand,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2CreateJoker} from '../src/domain/r2Run';
import {xiemuChoice} from '../src/game/XiemuBurnCopy';
import {economyHand} from './fixtures/hero-economy-budget';
function fixture(gold:number,held=true){let s=createRun({seed:'group-natural-17',runId:'controlled/cash-choice',characterId:'xiemu',rulesVersion:'r2',r2Identity:newRunIdentity('xiemu','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}}) as R2RunState;for(const type of ['LeaveShop','EnterStage'] as const){const r=applyCommand(s,{runId:s.runId,commandId:s.runId+'/'+s.commandSeq,expectedSeq:s.commandSeq,action:{type}});if(!r.ok)throw Error(r.code);s=r.state;}s=structuredClone(s);s.gold=gold;if(held)s.jokers=[r2CreateJoker('e08','controlled/held/e08',8,'none',s)];return s;}
describe('burn choice names lost public held-card gold gates',()=>{
 it('warns for20 ->18 before the command and leaves saved data unchanged',()=>{const s=fixture(20),before=structuredClone(s);expect(xiemuChoice(s,'two-pair').choices[0].details).toContain((cardDisplayName('e08')+"：花后18金，需持有至少20金"));expect(s).toEqual(before);});
 it('keeps the inclusive20 boundary and warns only for tiers that cross it',()=>{const choices=xiemuChoice(fixture(23),'two-pair').choices;expect(choices[0].details).not.toContain((cardDisplayName('e08')));expect(choices[1].details).toContain((cardDisplayName('e08')));expect(choices[2].details).toContain((cardDisplayName('e08')));});
 it('does not invent ownership, a new loss for an already unmet gate or affordable payment',()=>{expect(xiemuChoice(fixture(20,false),'two-pair').choices[0].details).not.toContain((cardDisplayName('e08')));expect(xiemuChoice(fixture(19),'two-pair').choices[0].details).not.toContain((cardDisplayName('e08')));const c=xiemuChoice(fixture(1),'two-pair').choices[0];expect(c.available).toBe(false);expect(c.details).not.toContain((cardDisplayName('e08')));});
 it('shows a newly satisfied low-gold gate without promising an effect, matching actual paid scoring',()=>{
  const base=fixture(5,false);base.jokers=[r2CreateJoker('f04','controlled/held/f04',8,'none',base)];base.stage!.initialJokerIds=base.jokers.map(j=>j.instanceId);
  const {state:s,main}=economyHand(base),snapshot=structuredClone(s),choices=xiemuChoice(s,'straight-flush').choices;
  expect(choices[0].details).toContain(cardDisplayName('f04')+'：花后3金，满足持有不超过3金条件');expect(choices[0].details).toContain('仍需看本手与停用状态');
  const paid=applyCommand(s,{runId:s.runId,commandId:'paid',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds:main,xiemuBurn:2}}),held=applyCommand(s,{runId:s.runId,commandId:'held',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds:main}});
  expect(paid.ok&&paid.state.lastTrace!.events.some(e=>e.sourceDefinitionId==='f04')).toBe(true);expect(held.ok&&held.state.lastTrace!.events.some(e=>e.sourceDefinitionId==='f04')).toBe(false);expect(s).toEqual(snapshot);
  const already=structuredClone(s);already.gold=3;expect(xiemuChoice(already,'straight-flush').choices[0].details).not.toContain(cardDisplayName('f04'));expect(xiemuChoice(fixture(1,false),'two-pair').choices[0].details).not.toContain(cardDisplayName('f04'));
 });
});
