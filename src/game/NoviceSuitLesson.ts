import type {PlayingCard} from '../cards/types';
import {HAND_LABELS} from '../content/handLabels';
import {evaluateR2Hand,type HandRules} from '../domain/evaluateR2';

/** Describe only the cards actually selected and the active hand rules. */
export function noviceSameSuitFeedback(hand:readonly PlayingCard[],ids:readonly string[],rules:HandRules):string|undefined {
 if(ids.length<2||ids.length>5||new Set(ids).size!==ids.length)return;
 const cards=ids.map(id=>hand.find(card=>card.id===id));
 if(!cards.every((card):card is PlayingCard=>!!card)||!cards.every(card=>card.suit===cards[0].suit))return;
 const required=rules.fourFlush?4:5;
 const type=evaluateR2Hand(cards,rules).type;
 if(cards.length<required)return type==='high-card'
  ?`同花还差${required-cards.length}张；高牌看最高点。`
  :`同花要${required}张同花色，还差${required-cards.length}张。`;
 return `${cards.length}张同花色，牌型是${HAND_LABELS[type]}。`;
}

/** A chosen example can already be selected; its definition must still be shown. */
export function noviceHandDefinition(type:string,rules:HandRules):string|undefined {
 const definitions:Record<string,string>={
  'high-card':'高牌：最大点数计分。',
  'pair':'对子：两张点数相同。',
  'two-pair':'两对：两组点数相同。',
  'three-kind':'三条：三张点数相同。',
  'straight':rules.fourStraight?'顺子：4张或5张点数连续。':'顺子：5张点数连续。',
  'flush':rules.fourFlush?'同花：4张或5张花色相同。':'同花：5张花色相同。',
 };
 return definitions[type];
}
