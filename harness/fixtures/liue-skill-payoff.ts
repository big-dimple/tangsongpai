import {currentHeroReceipt} from '../../tests/fixtures/current-hero-receipt';
import {r2CreateJoker} from '../../src/domain/r2Run';

/** Controlled current-identity checkpoints; normal selection/save/score paths
 * remain real. These do not establish natural acquisition or balance. */
export async function liueSkillPayoffFixture(points:2|8|10=8,special=false){
 const state=structuredClone((await currentHeroReceipt('erxiang')).before),selectedIds=points===10?['spades-13','hearts-13']:['spades-'+points,'hearts-'+points];
 if(points===2){state.handOrder=[...selectedIds,...state.handOrder.filter(id=>!selectedIds.includes(id)).slice(0,6)];state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!state.handOrder.includes(id));}
 if(special){const card=state.deckInstances.find(c=>c.id===selectedIds[0])!;card.enhancement='encore-paper';card.edition='foil';state.jokers=[r2CreateJoker('b06',state.runId+'/repeat',6,'none',state)];state.stage!.initialJokerIds=state.jokers.map(j=>j.instanceId);}
 return {state,selectedIds,targetId:selectedIds[0],points};
}
