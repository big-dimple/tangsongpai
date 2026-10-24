import {currentHeroReceipt} from '../../tests/fixtures/current-hero-receipt';
/** Disclosed deck ordering only: after the real skill, two complete visible hands have no K. */
export async function sushiSkillLocationFixture(){
 const receipt=await currentHeroReceipt('amo'),state=structuredClone(receipt.before),rank=(id:string)=>state.deckInstances.find(c=>c.id===id)!.rank,planned=state.drawPile.filter(id=>rank(id)>=2&&rank(id)<=6).sort((a,b)=>rank(a)-rank(b)).slice(0,10);
 state.drawPile=[...state.drawPile.filter(id=>!planned.includes(id)),...planned.reverse()];return {state,selectedIds:['spades-8','hearts-8']};
}
