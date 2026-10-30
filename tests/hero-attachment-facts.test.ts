import {it,expect} from 'vitest';
import {heroAttachmentFixture} from '../harness/fixtures/hero-attachments';
import {energySend} from '../harness/fixtures/score-energy';
import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {HeroTargetAttachmentState} from '../src/game/HeroTargetAttachmentState';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {heroScoreAction} from '../src/game/HeroScoreAction';

it.each(['amo','erxiang','azao','xiemu','touye','laohuan'] as const)('%s projects only its actual saved target identity',hero=>{
  const f=heroAttachmentFixture(hero);expect(readCheckpoint(makeCheckpoint(f.state,[])).ok).toBe(true);
  const after=energySend(f.state,f.action),before=JSON.stringify(after);
  if(hero==='laohuan'){expect(after.handOrder.filter(id=>!f.state.handOrder.includes(id))).toEqual(f.selectedIds);expect(after.lastTrace).toEqual(f.state.lastTrace);return;}
  const trace=after.lastTrace!,cue=savedHeroAttachment(trace,hero)!;expect(cue).toBeDefined();
  if(hero==='amo'||hero==='erxiang')expect(cue.targetIds).toEqual(f.targetIds);
  if(hero==='azao'||hero==='xiemu')expect(cue.targetIds).toEqual(trace.sets.activeScoringIds);
  if(hero==='touye'){expect(cue.targetIds).toEqual(trace.touyeWager!.core!.activeNewIds);expect(cue.targetIds).toEqual(['clubs-8']);expect(cue.targetIds).not.toEqual(f.targetIds);}
  expect(savedHeroAttachment(trace,hero==='amo'?'erxiang':'amo')).toBeUndefined();expect(JSON.stringify(after)).toBe(before);
});
it('a losing wager fades pending ownership without inventing credited new cards or a positive receipt',()=>{
  const f=heroAttachmentFixture('touye'),after=energySend(f.state,{type:'PlayHand',selectedIds:['diamonds-6']}),trace=after.lastTrace!,cue=savedHeroAttachment(trace,'touye')!;
  expect(trace.touyeWager!.outcome).toBe('lost');expect(cue.targetIds).toBeUndefined();expect(cue.event.reasonKey).toContain('touye.lost.');
  const state=new HeroTargetAttachmentState(),ctx={generation:1,signal:new AbortController().signal};state.preview({key:'saved-bet',targetId:f.targetIds[0],targetIds:f.targetIds,kind:'wager',releaseReason:'touye.'});state.consume(f.targetIds[0],cue.event.eventId,ctx);expect(state.release(cue.event,ctx)).toBe(true);expect(state.value).toMatchObject({failed:true,resolvedLabel:'未成'});
});

it.each(['azao','xiemu'] as const)('%s keeps the saved multiplier but does not mark B03-disabled cards as beneficiaries',hero=>{
 const f=heroAttachmentFixture(hero),s=f.state,ids=['hearts-2','hearts-5','hearts-8','hearts-11','hearts-13'],hand=ids.map(id=>s.deckInstances.find(c=>c.id===id)!);
 const context=r2ScoreContext(s,hand,ids),trace=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:s.runId+'/b03-display',hand,selectedIds:ids,disabledIds:ids,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,...context,boss:{definitionId:'B03',disabledSuit:'hearts'},...(hero==='azao'?{azaoCharge:{before:s.stage!.azaoCharge!,release:true}}:{gold:s.gold-10,xiemuBurn:{cost:10 as const,goldBefore:s.gold,beforeUsed:false}})});
 expect(trace.sets.playedIds).toEqual(ids);expect(trace.sets.activeScoringIds).toEqual([]);
 const saved=savedHeroAttachment(trace,hero)!;expect(saved.targetIds).toEqual([]);
 expect(heroScoreAction(trace,saved.event)).toMatchObject({kind:'release',targetIds:[]});
});
