import {createRun} from '../../src/domain/run';
import {newRunIdentity} from '../../src/game/RunLaunch';
import type {CharacterId} from '../../src/domain/characters';
import {heroAttachmentFixture} from './hero-attachments';
import {energySend} from './score-energy';
/** Current new-run identity for Su Shi; old assist fixtures stay frozen for old saves. */
export function heroAttachmentIntensityFixture(hero:CharacterId){
 if(hero!=='amo')return heroAttachmentFixture(hero);
 let state=createRun({seed:'group-natural-17',runId:'controlled/attachment/exile',characterId:'amo',rulesVersion:'r2',r2Identity:newRunIdentity('amo','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 state=energySend(energySend(state,{type:'LeaveShop'}),{type:'EnterStage'});state.handOrder=['spades-8','hearts-8','clubs-7','diamonds-7','spades-13','hearts-13','clubs-2','diamonds-4'];state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!state.handOrder.includes(id));state.gold=40;
 const selectedIds=state.handOrder.slice(0,2);return{state,selectedIds,targetIds:selectedIds,action:{type:'PlayHand' as const,selectedIds,amoExile:true}};
}
