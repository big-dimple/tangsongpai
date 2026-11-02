import {describe,expect,it} from 'vitest';
import {createRun,applyCommand,type Action,type R2RunState} from '../src/domain/run';
import {r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {previewR2Hand} from '../src/domain/scoreR2';
import {guidedTutorialRunId,newRunIdentity} from '../src/game/RunLaunch';
import {aiHandScoreInput,aiScoreContext,rankAiHandCandidates,type AiHandInput} from '../src/game/AiHandCandidates';
import {firstStageOptions} from '../src/game/NoviceFirstStage';

function send(state:R2RunState,action:Action):R2RunState {
 const result=applyCommand(state,{runId:state.runId,commandId:`${state.runId}/command/${state.commandSeq+1}`,
  expectedSeq:state.commandSeq,action});
 if(!result.ok)throw Error(result.code);
 return result.state;
}

function afterPair():R2RunState {
 let state=createRun({seed:'r2/tutorial/core-v1',runId:guidedTutorialRunId('00000000-0000-4000-8000-000000000001'),
  characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang'),openingRoute:'group',
  modeConfig:{mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false}});
 state=send(state,{type:'LeaveShop'});state=send(state,{type:'EnterStage'});
 state=send(state,{type:'PlayHand',selectedIds:['clubs-5','hearts-5']});
 expect(state.stage?.heat).toBe('90');expect(state.stage?.targetHeat).toBe('400');
 return state;
}

// Match the scene's public preview boundary; there is no future pile or RNG in this input.
function inputFor(state:R2RunState):AiHandInput {
 const stage=state.stage!,hand=state.handOrder.map(id=>state.deckInstances.find(card=>card.id===id)!);
 const context=r2ScoreContext(state,hand,[]);
 return {hand,jokers:state.jokers,definitions:r2JokerDefinitionsFor(state),handRules:context.handRules,
  disabledIds:stage.disabledIds,ordinaryPointsSuppressedIds:[],boss:context.boss,stageIndex:stage.index,
  sealedJokerIds:stage.sealedJokerIds,challengeDisabledJokerId:stage.challengeDisabledJokerId,
  resources:{gold:state.gold,handsLeft:stage.handsLeft,playIndex:stage.playIndex,discardsUsed:stage.discardsUsed,
   stageHeat:stage.heat,target:stage.targetHeat},contentVersion:state.contentVersion+'/'+state.contentHash,
  score:aiScoreContext({...context,handLevels:state.handLevels,previousHandType:stage.previousHandType,wager:stage.wagerSelected})};
}

describe('first-stage choice feedback',()=>{
 it.each([
  {name:'one club',discard:['clubs-4']},
  {name:'one diamond',discard:['diamonds-4']},
  {name:'both fours',discard:['clubs-4','diamonds-4']},
 ])('keeps all displayed choices on a path to 400 after $name',({discard})=>{
  const replaced=send(afterPair(),{type:'DiscardHand',selectedIds:discard});
  let leaves=0;
  const walk=(state:R2RunState,depth:number)=>{
   if(state.phase==='stage-cleared'){
    expect(BigInt(state.stage!.heat)).toBeGreaterThanOrEqual(400n);leaves++;return;
   }
   expect(state.phase).toBe('await-input');expect(depth).toBeLessThan(3);
   const input=inputFor(state),inputBefore=structuredClone(input),result=rankAiHandCandidates(input);
   expect(result.status).toBe('ready');
   const resultBefore=structuredClone(result),choices=firstStageOptions(input,result);
   expect(input).toEqual(inputBefore);expect(result).toEqual(resultBefore);
   expect(choices.length).toBeGreaterThan(0);expect(choices.length).toBeLessThanOrEqual(2);
   expect(new Set(choices.map(choice=>choice.id)).size).toBe(choices.length);
   if(depth===0)expect(choices).toHaveLength(2);
   for(const choice of choices){
    expect(choice.cardIds.length).toBeGreaterThan(0);expect(choice.cardIds.length).toBeLessThanOrEqual(5);
    expect(choice.cardIds.every(id=>state.handOrder.includes(id))).toBe(true);
    const preview=previewR2Hand(aiHandScoreInput(input,choice.cardIds));
    expect({minimum:choice.minimum,maximum:choice.maximum}).toEqual(preview.scoreRange);
    expect(choice.canClear).toBe(BigInt(state.stage!.heat)+BigInt(choice.minimum)>=BigInt(state.stage!.targetHeat));
    if(state.stage!.handsLeft===1)expect(choice.canClear).toBe(true);
    const next=send(state,{type:'PlayHand',selectedIds:choice.cardIds});
    // The tutorial's fixed opening has deterministic scoring; the public preview
    // should match the saved score without ever using the future pile.
    expect(next.lastTrace?.finalScore).toBe(choice.minimum);
    expect(choice.minimum).toBe(choice.maximum);
    walk(next,depth+1);
   }
  };
  walk(replaced,0);expect(leaves).toBeGreaterThan(0);
 });

 it('does not invent a choice while candidates are unavailable and marks an impossible final hand',()=>{
  const replaced=send(afterPair(),{type:'DiscardHand',selectedIds:['clubs-4','diamonds-4']});
  const input=inputFor(replaced);
  expect(firstStageOptions(input,undefined)).toEqual([]);
  const current=rankAiHandCandidates(input);
  expect(firstStageOptions(input,{...current,key:'stale-hand'})).toEqual([]);
  const impossible:AiHandInput={...input,resources:{...input.resources,handsLeft:1,target:'999999'}};
  const result=rankAiHandCandidates(impossible),choices=firstStageOptions(impossible,result);
  expect(result.status).toBe('ready');expect(choices).toHaveLength(1);
  expect(choices[0].canClear).toBe(false);
  const best=result.ordered.reduce((highest,facts)=>{
   const score=BigInt(previewR2Hand(aiHandScoreInput(impossible,facts.playedIds)).scoreRange.minimum);
   return score>highest?score:highest;
  },0n);
  expect(BigInt(choices[0].minimum)).toBe(best);
 });
});
