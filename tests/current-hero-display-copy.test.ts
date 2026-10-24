import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import {CHARACTER_IDS} from '../src/domain/characters';
import {createRun,applyCommand,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {characterForNewRun} from '../src/game/CharacterRunCopy';
import {SELECTION_PRESENTATION} from '../src/game/SelectionPresentation';
import {heroExplanationCopy} from '../src/game/HeroExplanation';
import {heroSignature} from '../src/game/HeroSignature';
import {heroPlaySample} from '../src/game/OpeningPlaySample';
import {xiemuTiersFor,xiemuBurnStep} from '../src/domain/r2XiemuBurn';
import {isR2XiemuBalance,isR2XiemuFrequent} from '../src/domain/r2GroupUpgrade';
import {amoExileCopy} from '../src/game/AmoExileCopy';
import {HERO_OPENING} from '../src/game/HeroOpeningCopy';
import {GameScene} from '../src/game/GameScene';
import type {ScoreEvent} from '../src/domain/scoreR2';
const send=(state:R2RunState,action:Parameters<typeof applyCommand>[1]['action'])=>{const r=applyCommand(state,{runId:state.runId,commandId:'copy/'+state.commandSeq,expectedSeq:state.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;};
const stage=(id:'amo'|'xiemu')=>send(send(createRun({rulesVersion:'r2',seed:'current-copy',runId:'copy/'+id,characterId:id,r2Identity:newRunIdentity(id,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}}),{type:'LeaveShop'}),{type:'EnterStage'});
const symbols={spades:'♠',hearts:'♥',clubs:'♣',diamonds:'♦'};
function exampleHand(run:R2RunState,labels:string[]):R2RunState {
 const ids=labels.map(label=>run.deckInstances.find(c=>(c.rank===11?'J':c.rank===12?'Q':c.rank===13?'K':c.rank===14?'A':String(c.rank))+symbols[c.suit]===label)!.id);
 return {...run,handOrder:ids,drawPile:run.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id)),playedPile:[],discardPile:[]};
}
it.each(CHARACTER_IDS)('%s selection summary and explanation use the same actual new-run effect',id=>{
 const hero=characterForNewRun(id),selection=SELECTION_PRESENTATION[id],explanation=heroExplanationCopy(id);
 expect(selection.hook).toBe(hero.quickEffect);expect(selection.tag).toBe(hero.passiveName);expect(explanation.effect).toBe(hero.quickEffect);expect(explanation.when).toBe(selection.when);expect(heroSignature(id).ability.quickEffect).toBe(hero.quickEffect);expect(heroPlaySample(id).tag).toBe(hero.passiveName);
});
it('Su story and both sample surfaces describe the actual K-gated threefold play',()=>{
 const signature=heroSignature('amo'),sample=heroPlaySample('amo'),selection=SELECTION_PRESENTATION.amo;
 expect(characterForNewRun('amo').buildTip).toContain('余牌含K');expect(selection.hook).toContain('余牌含K');expect(selection.hook).toContain('×3');expect(selection.when).toContain('主手里的K不算');expect(HERO_OPENING.amo.story).not.toContain('同点牌来相助');
 let run=exampleHand(stage('amo'),[...signature.beats[0].cards,...signature.beats[1].cards]);run=send(run,{type:'PlayHand',selectedIds:run.handOrder.slice(0,signature.beats[0].cards.length),amoExile:true});
 const trace=run.lastTrace!,factor=trace.events.find(e=>e.reasonKey==='amo.exile')!.value.n;
 expect(factor).toBe('3');expect(signature.beats[2].result).toContain('×'+factor);expect(sample.result).toContain('×'+factor);expect(sample.cost).toContain('余牌须含K');expect(BigInt(trace.amoExile!.afterScore!)).toBe(BigInt(trace.amoExile!.beforeScore!)*3n);
});
it('Flower selection, conditions and example use current real payment tiers',()=>{
 const identity=newRunIdentity('xiemu','group'),tiers=xiemuTiersFor(identity),signature=heroSignature('xiemu'),sample=heroPlaySample('xiemu');
 expect(tiers.map(t=>[t.cost,t.multiplier])).toEqual([[3,1.5],[6,2],[10,3]]);expect(SELECTION_PRESENTATION.xiemu.cost).toContain('3／6／10');expect(heroExplanationCopy('xiemu').when).toContain('至少留有3金');
 const paid=xiemuBurnStep('two-pair',{cost:tiers[0].cost,goldBefore:tiers[0].cost,beforeUsed:false},true,isR2XiemuBalance(identity),isR2XiemuFrequent(identity));
 expect(paid.goldAfter).toBe(0);expect(signature.beats[0].result).toBe('先留'+paid.cost+'金');expect(signature.beats[1].result).toBe('扣'+paid.cost+'金');expect(signature.beats[2].result).toBe('角色 ×'+paid.multiplier);expect(sample.result).toContain('×'+paid.multiplier);expect(sample.after.label).toContain('扣'+paid.cost+'金');
});
it('Su choice puts a short K/score rule and actual discarded cards before collapsed details',()=>{
 const signature=heroSignature('amo'),run=exampleHand(stage('amo'),[...signature.beats[0].cards,...signature.beats[1].cards]),open=vi.fn().mockReturnValue({classList:{add:vi.fn()},querySelector:()=>null}),scene={ready:true,presentation:undefined,run,selectedIds:new Set(run.handOrder.slice(0,5)),hand:run.handOrder.map(id=>run.deckInstances.find(c=>c.id===id)!),amoExile:false,dialog:{open,close:vi.fn()},refreshSelection:vi.fn()};
 (GameScene.prototype as unknown as {inspectAmoExile():void}).inspectAmoExile.call(scene as unknown as GameScene);
 const [_title,details,actions,options]=open.mock.calls[0];expect(options.summaryBody).toBe('弃掉剩余手牌（须含K），本次出牌最终得分 ×3，仅当次、本关一次。');expect(options.summaryBody.length).toBeLessThan(55);expect(options.effectBody).toContain('K♠');expect(options.effectBody).toContain('9♣');expect(options.effectBody).toContain('3♣');expect(options.collapseRules).toBe(true);expect(options.rulesLabel).toBe('技能详情');expect(actions[0].disabled).toBe(false);expect(details).toBe(amoExileCopy(run).details);expect(details).not.toContain('没有额外金币、弃牌次数或过关奖励惩罚');
});
it('Su event caption reads the real event factor',()=>{
 const operation=(GameScene.prototype as unknown as {operationText(event:ScoreEvent):string}).operationText;
 expect(operation.call({} as GameScene,{reasonKey:'amo.exile',value:{n:'3',d:'1'}} as ScoreEvent)).toBe('贬谪：本手得分×3');
});
