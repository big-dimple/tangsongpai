import type {R2RunState} from '../domain/r2Run';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {readR2Modifiers} from '../content/r2Schema';
import type {R2HandType} from '../domain/evaluateR2';
import {currentBuildFocus} from './BuildJourney';
import type {DetailDialog} from './DetailDialog';
import {handTypeRuleCards} from './HandRuleReference';
import './OpeningRuleBriefing.css';

export interface OpeningRuleCard {
 title:string;
 body:string;
 example:readonly string[];
 selected:boolean;
}

export const OPENING_BASE_HAND_TYPES:readonly R2HandType[]=[
 'straight-flush','four-kind','full-house','flush','straight','three-kind','two-pair','pair',
];
const ROUTE_HAND_TYPES={
 group:['pair','two-pair','three-kind'],
 straight:['straight'],
 flush:['flush'],
} as const;
const EXAMPLES:Record<typeof OPENING_BASE_HAND_TYPES[number],readonly string[]>={
 'straight-flush':['10♠','J♠','Q♠','K♠','A♠'],
 'four-kind':['9♠','9♥','9♣','9♦','4♠'],
 'full-house':['8♠','8♥','8♣','K♦','K♠'],
 flush:['2♥','6♥','9♥','J♥','A♥'],
 straight:['5♠','6♥','7♣','8♦','9♠'],
 'three-kind':['7♠','7♥','7♣','K♦','2♠'],
 'two-pair':['J♠','J♥','4♣','4♦','9♠'],
 pair:['Q♠','Q♥','8♣','5♦','2♠'],
};

/** Eight visual examples only; no scoring, random or run-state changes. */
export function openingRuleBriefing(run:R2RunState){
 const focus=currentBuildFocus(run,run.openingRoute)??'group';
 const rules=readR2Modifiers(run.jokers,r2JokerDefinitionsFor(run));
 const selected=new Set<R2HandType>(ROUTE_HAND_TYPES[focus]);
 const cards:OpeningRuleCard[]=handTypeRuleCards(run.handLevels,rules,OPENING_BASE_HAND_TYPES).map((card,index)=>{
  const type=OPENING_BASE_HAND_TYPES[index];
  return {title:card.title,body:'',example:EXAMPLES[type],selected:selected.has(type)};
 });
 return {title:'牌型示例',body:'',cards,primaryLabel:'进入商店'};
}

/** One visible action; native cancel follows the same guarded shop transition. */
export function showOpeningRuleBriefing(dialog:DetailDialog,run:R2RunState,onEnterShop:()=>void):HTMLDialogElement{
 const model=openingRuleBriefing(run);let finished=false;
 const finish=()=>{if(finished)return;finished=true;dialog.close();onEnterShop();};
 const element=dialog.open(model.title,model.body,[{label:model.primaryLabel,primary:true,run:finish}],{
  cards:model.cards,
  onClose:()=>{if(finished)return;finished=true;onEnterShop();},
 });
 element.classList.add('opening-rule-briefing');
 const close=element.querySelector<HTMLButtonElement>('.dialog-close');if(close)close.hidden=true;
 element.querySelector('.experience-cards')?.setAttribute('aria-label','牌型示例，按强度从高到低');
 const items=[...element.querySelectorAll<HTMLElement>('.experience-card')];
 for(const [index,item] of items.entries()){
  const card=model.cards[index];if(!card)continue;
  item.querySelector('p')?.remove();item.querySelector('.experience-card-stat')?.remove();
  if(card.selected)item.dataset.routeSelected='true';
  item.setAttribute('aria-label',card.title+'：'+card.example.join(' '));
  const example=document.createElement('div');example.className='opening-hand-example';example.setAttribute('aria-hidden','true');
  for(const label of card.example){
   const face=document.createElement('span'),rank=document.createElement('span'),suit=document.createElement('span');
   face.className='opening-playing-card';face.dataset.red=String(label.endsWith('♥')||label.endsWith('♦'));face.dataset.suit=label.slice(-1);
   rank.className='opening-playing-rank';rank.textContent=label.slice(0,-1);
   suit.className='opening-playing-suit';suit.textContent=label.slice(-1);
   face.append(rank,suit);example.append(face);
  }
  item.append(example);
 }
 element.querySelector<HTMLButtonElement>('.dialog-primary')?.focus({preventScroll:true});
 return element;
}
