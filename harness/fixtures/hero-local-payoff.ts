import {currentHeroReceipt} from '../../tests/fixtures/current-hero-receipt';
import {createRun,applyCommand,type Action,type R2RunState} from '../../src/domain/run';
import {newRunIdentity} from '../../src/game/RunLaunch';
import type {CharacterId} from '../../src/domain/characters';

/** Legal controlled inputs, not natural acquisition or a balance sample. */
export async function localPayoffFixture(hero:CharacterId){
 const receipt=await currentHeroReceipt(hero);
 if(hero!=='laohuan')return {state:receipt.before,selectedIds:receipt.trace.sets.playedIds};
 let state=createRun({seed:'group-natural-17',runId:'controlled/q1/laohuan',characterId:hero,rulesVersion:'r2',r2Identity:newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 const send=(action:Action)=>{const result=applyCommand(state,{runId:state.runId,commandId:state.runId+'/'+state.commandSeq,expectedSeq:state.commandSeq,action});if(!result.ok)throw Error(result.code);state=result.state;};
 send({type:'LeaveShop'});send({type:'EnterStage'});
 state=structuredClone(state) as R2RunState;const hand=['spades-8','hearts-8','clubs-7','diamonds-7','spades-13','hearts-13','clubs-2','diamonds-4'];state.handOrder=hand;state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!hand.includes(id));
 return {state,selectedIds:[hand[0]]};
}
