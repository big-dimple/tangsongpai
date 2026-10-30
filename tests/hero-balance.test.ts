import {r2HouseBase} from '../src/domain/r2GroupUpgrade';
import {R2_HERO_FREQUENCY_VERSION,R2_HERO_FREQUENCY_HASH} from '../src/domain/r2GroupUpgrade';
import {R2_AMO_BALANCE_VERSION,R2_AMO_BALANCE_HASH,R2_XIEMU_BALANCE_VERSION,R2_XIEMU_BALANCE_HASH} from '../src/domain/r2GroupUpgrade';
// Prior v2 contract remains a save compatibility regression; current v3 is covered in hero-economy-revision.
import textSpec from '../src/content/hero-text-spec.json';
import {expect,it} from 'vitest';
import {createRun,applyCommand,type Action,type Command,type R2RunState} from '../src/domain/run';
import {r2CreateJoker,r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {R2_AMO_EXILE_VERSION,R2_AMO_EXILE_HASH,R2_S04_FINISH_VERSION,R2_S04_FINISH_HASH} from '../src/domain/r2GroupUpgrade';
import {scoreR2Hand,previewR2Hand} from '../src/domain/scoreR2';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {characterForRun,characterForNewRun} from '../src/game/CharacterRunCopy';
import {savedAmoExileFormula} from '../src/game/AmoExileCopy';
import {xiemuChoice} from '../src/game/XiemuBurnCopy';
import {heroAbilityCue} from '../src/game/HeroAbilityCue';
import {heroSkillGuide} from '../src/game/HeroSkillGuide';
import {aiScoreContext} from '../src/game/AiHandCandidates';
import {stableHash} from '../src/domain/hash';

const main=['hearts-2','hearts-5','hearts-8','hearts-11','hearts-13'],side=['spades-9','clubs-9','clubs-3'];
const oldAmo={contentVersion:R2_AMO_EXILE_VERSION,contentHash:R2_AMO_EXILE_HASH},oldOther={contentVersion:R2_S04_FINISH_VERSION,contentHash:R2_S04_FINISH_HASH};
function command(s:R2RunState,action:Action):Command{return {runId:s.runId,commandId:s.runId+'/'+s.commandSeq,expectedSeq:s.commandSeq,action};}
function send(s:R2RunState,action:Action){const r=applyCommand(s,command(s,action));if(!r.ok)throw Error(r.code);return r.state;}
function ready(hero:'amo'|'xiemu',legacy=false,gold=20){
 let s=createRun({rulesVersion:'r2',characterId:hero,seed:'hero-balance',runId:'balance/'+hero,r2Identity:legacy?(hero==='amo'?oldAmo:oldOther):hero==='amo'?{contentVersion:R2_AMO_BALANCE_VERSION,contentHash:R2_AMO_BALANCE_HASH}:{contentVersion:R2_XIEMU_BALANCE_VERSION,contentHash:R2_XIEMU_BALANCE_HASH},openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});s=structuredClone(s);s.gold=gold;s.handOrder=[...main,...side];s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!s.handOrder.includes(id));return s;
}
function input(s:R2RunState){const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);return {rulesVersion:'r2' as const,runId:s.runId,rootId:s.runId+'/direct',hand,selectedIds:main,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,...r2ScoreContext(s,hand,main)};}
const readable=(s:R2RunState)=>expect(readCheckpoint(makeCheckpoint(s,[]))).toMatchObject({ok:true});

it('keeps current hero launch profiles and exact saved Su Shi/Flower retries',()=>{
 for(const hero of ['amo','xiemu'] as const){const old=ready(hero,true);expect(r2HouseBase(newRunIdentity(hero))).not.toEqual(hero==='amo'?oldAmo:oldOther);expect(launchIdentity(hero,{kind:'retry',run:old})).toEqual(hero==='amo'?oldAmo:oldOther);readable(old);}
 for(const hero of ['touye','azao'] as const)expect(r2HouseBase(newRunIdentity(hero))).toEqual(oldOther);
 for(const hero of ['laohuan','erxiang'] as const)expect(r2HouseBase(newRunIdentity(hero))).toEqual({contentVersion:R2_HERO_FREQUENCY_VERSION,contentHash:R2_HERO_FREQUENCY_HASH});
});
it('new exile uses integer score times3 while the old saved identity still uses4, including previews and AI context',()=>{
 for(const legacy of [false,true]){const s=ready('amo',legacy),i=input(s),normal=scoreR2Hand(i),selected={...i,amoExile:{use:true,beforeUsed:false}},t=scoreR2Hand(selected),factor=legacy?4n:3n;
  expect(normal.finalScore).toBe('700');expect(t.finalScore).toBe((BigInt(normal.finalScore)*factor).toString());expect(previewR2Hand(selected).scoreRange).toEqual({minimum:t.finalScore,maximum:t.finalScore});expect(aiScoreContext(i,{amoExile:true}).heroBalance).toBe(legacy?undefined:true);
  const after=send(s,{type:'PlayHand',selectedIds:main,amoExile:true});expect(after.lastTrace!.finalScore).toBe(t.finalScore);expect(savedAmoExileFormula(t)).toContain('×'+factor);expect(t.sets.discardedIds).toEqual(side);readable(after);
 }
});
it('new Flower commits each real tier once and serializes the fractional1.5 event exactly',()=>{
 for(const [cost,multiplier,score] of [[5,1.5,'1050'],[10,2,'1400'],[20,3,'2100']] as const){const s=ready('xiemu'),c=command(s,{type:'PlayHand',selectedIds:main,xiemuBurn:cost}),r=applyCommand(s,c);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.code);const t=r.state.lastTrace!;
  expect(t.finalScore).toBe(score);expect(t.xiemuBurn).toMatchObject({cost,goldBefore:20,goldAfter:20-cost,multiplier,afterUsed:true});expect(t.events.find(e=>e.reasonKey==='xiemu.multiply-multiplier')!.value).toEqual(multiplier===1.5?{n:'3',d:'2'}:{n:String(multiplier),d:'1'});expect(applyCommand(r.state,c)).toMatchObject({ok:true,duplicate:true,state:r.state});readable(r.state);
  const paid=structuredClone(s);paid.gold-=cost;const i={...input(paid),xiemuBurn:{cost,goldBefore:s.gold,beforeUsed:false}};expect(previewR2Hand(i).scoreRange).toEqual({minimum:score,maximum:score});
 }
});
it('old Flower tiers remain exact; new and old identities reject each others exclusive prices',()=>{
 for(const cost of [10,20,30] as const){const s=ready('xiemu',true,40),after=send(s,{type:'PlayHand',selectedIds:main,xiemuBurn:cost});expect(after.lastTrace!.finalScore).toBe(String(700*(cost/10+1)));readable(after);}
 for(const [legacy,cost] of [[false,15],[false,30],[true,5],[true,15]] as const){const s=ready('xiemu',legacy,40);expect(applyCommand(s,command(s,{type:'PlayHand',selectedIds:main,xiemuBurn:cost as 10}))).toMatchObject({ok:false,code:'invalid-xiemu-burn',state:s});}
});
it('insufficient money, low main and reused ability reject without spending; a failed burst still permits ordinary rescue hands',()=>{
 const s=ready('xiemu',false,4);expect(applyCommand(s,command(s,{type:'PlayHand',selectedIds:main,xiemuBurn:5}))).toMatchObject({ok:false,code:'insufficient-gold',state:s});
 const x=ready('xiemu');expect(applyCommand(x,command(x,{type:'PlayHand',selectedIds:[main[0]],xiemuBurn:5}))).toMatchObject({ok:false,code:'score-diagnostic',state:x});
 const a=ready('amo'),after=send(a,{type:'PlayHand',selectedIds:[side[2]],amoExile:true});expect(after.phase).toBe('await-input');expect(after.stage!.handsLeft).toBe(3);expect(after.stage!.discardsLeft).toBe(3);expect(applyCommand(after,command(after,{type:'PlayHand',selectedIds:[after.handOrder[0]],amoExile:true}))).toMatchObject({ok:false,code:'amo-exile-already-used'});expect(()=>send(after,{type:'PlayHand',selectedIds:[after.handOrder[0]]})).not.toThrow();readable(after);
});
it('new paid balance still controls cash hooks and interest; new and old copy state their own costs/factors',()=>{
 const s=ready('xiemu',false,20);s.jokers=[r2CreateJoker('e08','gate/e08',8,'none',s)];s.stage!.initialJokerIds=s.jokers.map(j=>j.instanceId);const after=send(s,{type:'PlayHand',selectedIds:main,xiemuBurn:5});expect(after.lastTrace!.events.some(e=>e.sourceDefinitionId==='e08')).toBe(false);expect(after.lastTrace!.xiemuBurn!.goldAfter).toBe(15);readable(after);
 expect(xiemuChoice(s,'flush').choices.map(t=>[t.cost,t.multiplier])).toEqual([[5,1.5],[10,2],[20,3]]);expect(characterForNewRun('amo').detailRules).toContain('×3');expect(characterForRun(ready('amo',true)).detailRules).toContain('×4');expect(characterForRun(ready('xiemu')).detailRules).toContain('5／10／20');expect(characterForRun(ready('xiemu',true)).detailRules).toMatch(/10[／/]20[／/]30/);expect(heroAbilityCue(ready('xiemu',false,6),undefined,main)?.detail).not.toContain('不足10');expect(heroSkillGuide(ready('amo'),undefined,main,false,{amoExile:true}).step).toContain('×3');
});
it('save failure keeps publication/cash unchanged and retries one exact balanced candidate',async()=>{
 const s=ready('xiemu'),writes:string[]=[];let slots:SaveSlots={revision:1,current:makeCheckpoint(s,[]),previous:null},fail=true;const store:SaveStore={read:async()=>slots,commit:async(rev,cp,previous)=>{writes.push(JSON.stringify(cp));if(fail)throw Error('quota');slots={revision:rev+1,current:cp,previous};return slots.revision;}};
 const saved=SavedRun.restore(store,slots);expect((await saved.dispatch({type:'PlayHand',selectedIds:main,xiemuBurn:5})).ok).toBe(false);expect(saved.state).toEqual(s);fail=false;expect((await saved.retry()).ok).toBe(true);expect(writes[0]).toBe(writes[1]);expect(saved.state.lastTrace!.xiemuBurn!.cost).toBe(5);expect(SavedRun.restore(store,slots).state).toEqual(saved.state);expect((await saved.retry()).ok).toBe(false);
});
it('a repaired checksum cannot reinterpret an old/new score source or fractional paid factor',()=>{
 for(const hero of ['amo','xiemu'] as const){const s=send(ready(hero),{type:'PlayHand',selectedIds:main,...(hero==='amo'?{amoExile:true}:{xiemuBurn:5 as const})}),cp=structuredClone(makeCheckpoint(s,[]));cp.state.lastTrace!.events.find(e=>e.sourceType==='character'&&e.operation==='multiply-multiplier')!.value={n:'4',d:'1'};const {checksum,...body}=cp;expect(readCheckpoint({...body,checksum:stableHash(body)}).ok).toBe(false);}
});
it('B08 still blocks both active skills and Q01 keeps both disabled under their new identities',()=>{
 for(const hero of ['amo','xiemu'] as const){const i=input(ready(hero)),use=hero==='amo'?{amoExile:{use:true,beforeUsed:false}}:{gold:15,xiemuBurn:{cost:5 as const,goldBefore:20,beforeUsed:false}};
  expect(()=>scoreR2Hand({...i,...use,boss:{definitionId:'B08',disabledSuit:null}})).toThrow(hero==='amo'?'amo-exile-unavailable':'xiemu-disabled');
  let q=createRun({rulesVersion:'r2',characterId:hero,seed:'challenge/q01/0',runId:'balance/q/'+hero,r2Identity:newRunIdentity(hero),openingRoute:'group',modeConfig:{mode:'challenge',difficulty:0,challengeId:'Q01',programsEnabled:false}});q=send(send(q,{type:'LeaveShop'}),{type:'EnterStage'});q.gold=20;
  expect(applyCommand(q,command(q,{type:'PlayHand',selectedIds:[q.handOrder[0]],...(hero==='amo'?{amoExile:true}:{xiemuBurn:2 as const})}))).toMatchObject({ok:false,code:hero==='amo'?'amo-exile-disabled':'xiemu-disabled',state:q});readable(q);
 }
});
it('bare, five-Joker, holographic and polychrome boundaries retain invested build power with the lower hero ceiling',()=>{
 for(const [edition,ids,ordinary,newSu,newFlower] of [['none',[],700,2100,2100],['none',['f06','f09','e08','c06','e03'],5076,15228,13932],['foil',['f06','f09','e08','c06','e03'],7776,23328,22032],['holographic',['f06','f09','e08','c06','e03'],8601,25803,23607],['polychrome',['f06','f09','e08','c06','e03'],38545,115635,105796]] as const){
  for(const hero of ['amo','xiemu'] as const){const s=ready(hero,false,40);s.jokers=ids.map(id=>r2CreateJoker(id,id,8,edition,s));const i=input(s);expect(scoreR2Hand(i).finalScore).toBe(String(ordinary));
   const active=hero==='amo'?{...i,amoExile:{use:true,beforeUsed:false}}:{...i,gold:20,xiemuBurn:{cost:20 as const,goldBefore:40,beforeUsed:false}};expect(scoreR2Hand(active).finalScore).toBe(String(hero==='amo'?newSu:newFlower));
  }
 }
});

it('the machine text contract declares both exact new identities and retains legacy mappings',()=>{
 expect(textSpec.currentIdentityOverrides.amo.identityScope).toMatchObject(r2HouseBase(newRunIdentity('amo')));expect(textSpec.currentIdentityOverrides.xiemu.identityScope).toMatchObject(newRunIdentity('xiemu'));
 const previousVersion='quality-r2-xiemu-burn-v3-a11-house-v1-b03-rescue-v1-poker-encounter-v1-xiemu-revision-v1-joker-value-v1-dynamic-endless-v1-targeted-value-v1-purchase-value-v1' as const;
 const previous=textSpec.legacyIdentityOverrides[previousVersion];expect(previous.identityScope).toEqual({contentVersion:previousVersion,contentHash:'json-fnv-v1:a9081e58cd37cb3c',role:'legacy-purchase-value-v1'});expect(previous.mechanics.goldCosts).toEqual([2,4,6,8]);expect(previous.mechanics.multipliers).toEqual([1.5,2,3,4]);
 expect(textSpec.currentIdentityOverrides.amo.mechanics.normalIntegerScoreMultiplier).toBe(3);expect(textSpec.currentIdentityOverrides.xiemu.mechanics.goldCosts).toEqual([2,4,6,8]);expect(textSpec.currentIdentityOverrides.xiemu.mechanics.multipliers).toEqual([1.5,2,3,4]);expect(textSpec.legacyIdentityOverrides['quality-r2-xiemu-burn-v3'].mechanics.goldCosts).toEqual([3,6,10]);
 expect(textSpec.legacyIdentityOverrides['quality-r2-amo-exile-v1'].mechanics.normalIntegerScoreMultiplier).toBe(4);expect(textSpec.heroes.find(h=>h.id==='xiemu')!.mechanics.goldCosts).toEqual([10,20,30]);
});
