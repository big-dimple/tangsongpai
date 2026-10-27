import type {ScoreTrace} from '../domain/scoreR2';
import {rankLabel,SUIT_SYMBOL} from '../cards/types';
import type {SceneView} from './SceneView';
import {PAPER_CSS as C} from './theme';

/** Preserve the saved play order, including cards that did not score. */
export function settlementHandCards(trace:ScoreTrace){
 const active=new Set(trace.sets.activeScoringIds);
 return trace.sets.playedIds.flatMap(id=>{
  const card=trace.cards.find(c=>c.id===id);
  return card?[{id,rank:card.rank,suit:card.suit,active:active.has(id)}]:[];
 });
}

export function settlementSuitInk(suit:ScoreTrace['cards'][number]['suit']):string {
 return suit==='hearts'||suit==='diamonds'?'#a8372d':C.ink;
}

/** Measure each complete card token before wrapping, so a suit never separates from its rank. */
export function drawSettlementHand(view:SceneView,trace:ScoreTrace,x:number,y:number,width:number,size:number){
 const cards=settlementHandCards(trace),prefix=view.text(x,y,'使用组合 · ',size,C.jade).setColor(C.jade).setName('result/hand-combo');
 prefix.setData('fullText','使用组合 · '+cards.map(c=>rankLabel(c.rank)+SUIT_SYMBOL[c.suit]+(c.active?'':'（未计分）')).join('  '));
 let cursor=x+prefix.width,lineY=y,lineHeight=prefix.height;
 for(const card of cards){
  const label=view.text(0,0,rankLabel(card.rank)+SUIT_SYMBOL[card.suit],size).setColor(settlementSuitInk(card.suit)).setName('result/hand-card').setData('cardId',card.id).setData('scoring',card.active).setData('suit',card.suit);
  const note=card.active?undefined:view.text(0,0,'（未计分）',size,C.jade).setColor(C.jade).setName('result/hand-card-note').setData('cardId',card.id);
  const tokenWidth=label.width+(note?.width??0),gap=cursor===x?0:size*.5;
  if(cursor>x&&cursor+gap+tokenWidth>x+width){lineY+=lineHeight;cursor=x;lineHeight=0;}
  else cursor+=gap;
  label.setPosition(cursor,lineY);cursor+=label.width;
  if(note){note.setPosition(cursor,lineY);cursor+=note.width;}
  lineHeight=Math.max(lineHeight,label.height,note?.height??0);
 }
 return {bottom:lineY+lineHeight};
}
