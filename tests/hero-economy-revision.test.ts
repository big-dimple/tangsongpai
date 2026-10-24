import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';
import {expect,it} from 'vitest';
import {applyCommand,type R2RunState} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {stableHash} from '../src/domain/hash';
import {R2_AMO_BALANCE_VERSION,R2_AMO_BALANCE_HASH,R2_XIEMU_BALANCE_VERSION,R2_XIEMU_BALANCE_HASH} from '../src/domain/r2GroupUpgrade';
import {amoExileChoice} from '../src/domain/r2AmoExile';
import {scoreR2Hand,previewR2Hand} from '../src/domain/scoreR2';
import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {xiemuChoice} from '../src/game/XiemuBurnCopy';
import {amoExileCopy} from '../src/game/AmoExileCopy';
import {aiScoreContext,rankAiHandCandidates} from '../src/game/AiHandCandidates';
import {characterForNewRun} from '../src/game/CharacterRunCopy';
import {heroAbilityCue} from '../src/game/HeroAbilityCue';
import {heroSkillGuide} from '../src/game/HeroSkillGuide';
import {retainChosenHeroDraft} from '../src/game/HeroSkillDraftLifecycle';
import {economySend as send,economyStart,economyHand,threeStageBudget} from './fixtures/hero-economy-budget';

function ready(hero:'amo'|'xiemu',cash=20){return economyHand(send(send(economyStart(hero,cash),{type:'LeaveShop'}),{type:'EnterStage'}));}
function input(s:R2RunState,ids:string[]){const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);return {rulesVersion:'r2' as const,runId:s.runId,rootId:s.runId+'/preview',hand,selectedIds:ids,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,...r2ScoreContext(s,hand,ids)};}
function replaceHand(s:R2RunState,ids:string[]){s=structuredClone(s);s.handOrder=ids;s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id)&&!s.playedPile.includes(id)&&!s.discardPile.includes(id));return s;}
it('requires a real rankK in the discarded remainder; a K in the main alone is insufficient and rejection spends nothing',()=>{
 const f=ready('amo'),mainKing=f.main.find(id=>f.state.deckInstances.find(c=>c.id===id)!.rank===13)!;
 const s=replaceHand(f.state,[...f.main,'clubs-3','spades-7','diamonds-9']),before=structuredClone(s),choice=amoExileChoice(s,f.main);expect(s.handOrder).toContain(mainKing);expect(choice).toMatchObject({requiresKing:true,hasKing:false,available:false});
 expect(applyCommand(s,{runId:s.runId,commandId:'no-side-king',expectedSeq:s.commandSeq,action:{type:'PlayHand',selectedIds:f.main,amoExile:true}})).toMatchObject({ok:false,code:'amo-exile-needs-discarded-king',state:s});expect(s).toEqual(before);
 expect(()=>scoreR2Hand({...input(s,f.main),amoExile:{use:true,beforeUsed:false}})).toThrow('amo-exile-needs-discarded-king');expect(heroAbilityCue(s,undefined,f.main)?.detail).toBe('余牌中需有K');expect(heroSkillGuide(s,undefined,f.main).step).toBe('余牌中需有K');
});
it('a side K permits the same integer score times3 without gold, discard-opportunity or clear-reward penalties',()=>{
 const f=ready('amo',0),before=structuredClone(f.state),normal=scoreR2Hand(input(before,f.main)),action={type:'PlayHand' as const,selectedIds:f.main,amoExile:true},command={runId:before.runId,commandId:'king-burst',expectedSeq:before.commandSeq,action},r=applyCommand(before,command);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.code);
 const t=r.state.lastTrace!;expect(t.finalScore).toBe((BigInt(normal.finalScore)*3n).toString());expect(t.amoExile!.discardedIds.some(id=>t.cards.find(c=>c.id===id)!.rank===13)).toBe(true);expect(t.sets.discardedIds).toEqual(before.handOrder.filter(id=>!f.main.includes(id)));expect(r.state.stage).toMatchObject({handsLeft:3,discardsLeft:3,discardsUsed:0,goldEarned:7});expect(r.state.gold).toBe(7);expect(applyCommand(r.state,command)).toMatchObject({ok:true,duplicate:true,state:r.state});expect(readCheckpoint(makeCheckpoint(r.state,[])).ok).toBe(true);expect(before).toEqual(f.state);
 const king=t.amoExile!.discardedIds.find(id=>t.cards.find(c=>c.id===id)!.rank===13)!,single=scoreR2Hand({...input(before,f.main),hand:t.cards.filter(c=>f.main.includes(c.id)||c.id===king),amoExile:{use:true,beforeUsed:false}});expect(single.sets.discardedIds).toEqual([king]);expect(savedHeroAttachment(single,'amo')?.targetIds).toEqual([king]);
});
it('the gate reads the current card rank instead of inferring it from an ID, and moving the sole K into the main cancels the draft',()=>{
 const f=ready('amo'),sideKing=amoExileChoice(f.state,f.main).discardedIds.find(id=>f.state.deckInstances.find(c=>c.id===id)!.rank===13)!;
 const changed=structuredClone(f.state);changed.deckInstances.find(c=>c.id===sideKing)!.rank=12;expect(amoExileChoice(changed,f.main).available).toBe(false);changed.deckInstances.find(c=>c.id==='diamonds-9')!.rank=13;expect(amoExileChoice(changed,f.main).available).toBe(true);
 const one=replaceHand(f.state,[...f.main,'clubs-3','spades-7','diamonds-9']),facts=r2SelectionFacts(input(one,f.main)),before=JSON.stringify(one);expect(retainChosenHeroDraft(one,facts,{amoExile:true,erxiangTargetId:null,azaoRelease:false,xiemuBurn:0}).amoExile).toBe(false);expect(JSON.stringify(one)).toBe(before);
});
it('v2 development saves keep free x3 and5/10/20 prices without receiving the new K condition',()=>{
 const f=economyHand(send(send(economyStart('amo',20,{contentVersion:R2_AMO_BALANCE_VERSION,contentHash:R2_AMO_BALANCE_HASH}),{type:'LeaveShop'}),{type:'EnterStage'})),a=replaceHand(f.state,[...f.main,'clubs-3','spades-7','diamonds-9']);expect(amoExileChoice(a,f.main).available).toBe(true);const after=send(a,{type:'PlayHand',selectedIds:f.main,amoExile:true});expect(readCheckpoint(makeCheckpoint(after,[])).ok).toBe(true);
 const x=economyHand(send(send(economyStart('xiemu',20,{contentVersion:R2_XIEMU_BALANCE_VERSION,contentHash:R2_XIEMU_BALANCE_HASH}),{type:'LeaveShop'}),{type:'EnterStage'})).state;expect(xiemuChoice(x,'flush').choices.map(c=>c.cost)).toEqual([5,10,20]);
});
it('new prices, public previews and AI use3/6/10, and canceled score drafts cannot spend',()=>{
 const f=ready('xiemu',10),s=f.state,before=structuredClone(s);expect(xiemuChoice(s,'straight-flush').choices.map(c=>[c.cost,c.multiplier])).toEqual([[3,1.5],[6,2],[10,3]]);
 for(const cost of [3,6,10] as const){const paid={...s,gold:s.gold-cost},i={...input(paid,f.main),xiemuBurn:{cost,goldBefore:s.gold,beforeUsed:false}},preview=previewR2Hand(i),actual=send(s,{type:'PlayHand',selectedIds:f.main,xiemuBurn:cost});expect(preview.scoreRange).toEqual({minimum:actual.lastTrace!.finalScore,maximum:actual.lastTrace!.finalScore});expect(aiScoreContext(i).xiemuFrequent).toBe(true);expect(readCheckpoint(makeCheckpoint(actual,[])).ok).toBe(true);}
 expect(s).toEqual(before);expect(characterForNewRun('xiemu').quickEffect).toContain('3／6／10');expect(amoExileCopy(ready('amo').state).details).toContain('主手里的K不算');
});
it('AI skips main selections which consume every K instead of losing all recommendations or applying an obsolete factor',()=>{
 const f=ready('amo'),s=f.state,i=input(s,f.main),score=aiScoreContext(i,{amoExile:true}),before=JSON.stringify(s);expect(score.amoExileKing).toBe(true);expect(score.heroBalance).toBe(true);
 const ranked=rankAiHandCandidates({hand:i.hand,jokers:[],definitions:i.definitions,disabledIds:[],ordinaryPointsSuppressedIds:[],boss:null,stageIndex:0,sealedJokerIds:[],challengeDisabledJokerId:null,resources:{gold:s.gold,handsLeft:4,playIndex:0,discardsUsed:0,stageHeat:'0',target:'400'},contentVersion:s.contentVersion,score});expect(ranked.status).toBe('ready');expect(ranked.ordered.length).toBeGreaterThan(0);for(const facts of ranked.ordered)expect(amoExileChoice(s,facts.playedIds).available).toBe(true);expect(JSON.stringify(s)).toBe(before);
});
it('a repaired checksum cannot fake a used K-gated trace with no discarded K',()=>{
 const f=ready('amo'),s=send(f.state,{type:'PlayHand',selectedIds:f.main,amoExile:true}),cp=structuredClone(makeCheckpoint(s,[]));for(const card of cp.state.lastTrace!.cards)if(cp.state.lastTrace!.sets.discardedIds!.includes(card.id)&&card.rank===13)card.rank=12;const {checksum,...body}=cp;expect(readCheckpoint({...body,checksum:stableHash(body)}).ok).toBe(false);
});
it('three consecutive real clear commands expose purchase opportunity costs and do not promise every peak is affordable',()=>{
 const low=threeStageBudget({hero:'xiemu',cash:6,purchasePrice:4,burn:3}),mid=threeStageBudget({hero:'xiemu',cash:6,purchasePrice:4,burn:6}),high=threeStageBudget({hero:'xiemu',cash:6,purchasePrice:4,burn:10});expect(low.rows.map(r=>r.end)).toEqual([8,8,10]);expect([low.uses,mid.uses,high.uses]).toEqual([2,1,0]);expect([low.purchases,mid.purchases,high.purchases]).toEqual([3,3,3]);
 const costly=threeStageBudget({hero:'xiemu',cash:6,purchasePrice:6,burn:3});expect([costly.uses,costly.purchases]).toEqual([0,3]);const funded=threeStageBudget({hero:'xiemu',cash:20,purchasePrice:4,burn:10});expect(funded.rows.map(r=>r.end)).toEqual([14,7,12]);expect(funded.uses).toBe(2);
});
it('the other four heroes retain zero skill fees under the same fixed two-hand/purchase budget',()=>{
 const reports=(['touye','laohuan','erxiang','azao'] as const).map(hero=>threeStageBudget({hero,cash:6,purchasePrice:4}));expect(reports.every(r=>r.rows.every(s=>s.paid===0&&s.characterGoldDebits===0))).toBe(true);expect(new Set(reports.map(r=>JSON.stringify(r.rows.map(s=>s.end)))).size).toBe(1);
});
