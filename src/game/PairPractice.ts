import {SUIT_SYMBOL,type PlayingCard} from '../cards/types';
import {HAND_LABELS} from '../content/handLabels';
import type {R2JokerDefinition} from '../content/r2Schema';
import {SeededRng} from '../core/SeededRng';
import {Rational} from '../domain/rational';
import {scoreR2Hand} from '../domain/scoreR2';
import {AudioEngine} from '../audio/AudioEngine';
import {SUIT_TEXT_NAMES} from './SuitSymbols';
import {fractionText} from './scoreText';

const hand:readonly PlayingCard[]=[
  {id:'spades-5',suit:'spades',rank:5},{id:'hearts-5',suit:'hearts',rank:5},
  {id:'clubs-9',suit:'clubs',rank:9},{id:'diamonds-9',suit:'diamonds',rank:9},
];
const rng=new SeededRng('pair-practice').snapshot();

/** A neutral hand with one plain copy of the card. No run state enters the example. */
export function pairPracticeResult(definition:R2JokerDefinition,selectedIds:readonly string[]){
  if(!selectedIds.length)return {handName:'尚未选牌',gain:'0',matched:[] as string[]};
  const instanceId='practice/'+definition.id;
  const trace=scoreR2Hand({
    rulesVersion:'r2',runId:'practice',rootId:instanceId,characterId:'neutral',
    hand,selectedIds,disabledIds:[],handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng,
    definitions:[definition],jokers:[{definitionId:definition.id,instanceId,paidPrice:0,growth:{}}],
  });
  const events=trace.events.filter(event=>event.sourceInstanceId===instanceId&&event.operation==='add-multiplier');
  const total=events.reduce((sum,event)=>sum.add(Rational.fromJSON(event.value)),new Rational(0n));
  return {handName:HAND_LABELS[trace.handType],gain:fractionText(total.toJSON()),matched:events.flatMap(e=>e.targetCardId?[e.targetCardId]:[])};
}

export function pairPracticeView(definition:R2JokerDefinition):HTMLElement {
  const panel=document.createElement('section'),heading=document.createElement('h3'),cards=document.createElement('div');
  const result=document.createElement('output'),gain=document.createElement('strong'),explanation=document.createElement('span');
  panel.className='pair-practice';panel.setAttribute('aria-label','点牌试算');
  heading.textContent='点牌试算';cards.className='pair-practice-hand';
  result.setAttribute('aria-live','polite');result.setAttribute('aria-atomic','true');result.append(gain,explanation);
  const selected=new Set(hand.slice(0,2).map(card=>card.id));
  const buttons=hand.map(card=>{
    const button=document.createElement('button'),rank=document.createElement('b'),suit=document.createElement('span');
    button.type='button';button.dataset.suit=card.suit;button.setAttribute('aria-label',SUIT_TEXT_NAMES[card.suit]+' '+card.rank);
    rank.textContent=String(card.rank);suit.textContent=SUIT_SYMBOL[card.suit];button.append(rank,suit);cards.append(button);
    button.onclick=()=>{
      if(selected.has(card.id))selected.delete(card.id);else selected.add(card.id);
      AudioEngine.shared.select();render();
    };
    return button;
  });
  const render=()=>{
    const sample=pairPracticeResult(definition,hand.filter(c=>selected.has(c.id)).map(c=>c.id));
    buttons.forEach((button,i)=>{
      button.setAttribute('aria-pressed',String(selected.has(hand[i].id)));
      button.dataset.matched=String(sample.matched.includes(hand[i].id));
    });
    gain.textContent='倍率 +'+sample.gain;
    explanation.textContent=sample.handName+(selected.size?' · '+sample.matched.length+' 张获得加成':'');
  };
  const tip=document.createElement('p');tip.textContent='点选或收回示例牌，看看凑成两对的变化。';
  panel.append(heading,tip,cards,result);render();
  return panel;
}
