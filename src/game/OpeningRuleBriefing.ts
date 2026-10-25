import type {R2RunState} from '../domain/r2Run';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {readR2Modifiers} from '../content/r2Schema';
import type {R2HandType} from '../domain/evaluateR2';
import {R2_BASE_SCORES} from '../domain/scoreR2';
import {Rational} from '../domain/rational';
import {fractionText} from './scoreText';
import {currentBuildFocus} from './BuildJourney';
import type {DetailDialog} from './DetailDialog';
import {handTypeRuleCards} from './HandRuleReference';
import './OpeningRuleBriefing.css';

export interface OpeningRuleCard {
 title:string;
 body:string;
 example:readonly string[];
 selected:boolean;
 rank:number;
 rankText:string;
 heat:number;
 mult:string;
 baseScore:number;
}

export const OPENING_BASE_HAND_TYPES=[
 'straight-flush','four-kind','full-house','flush','straight','three-kind','two-pair','pair',
] as const;
const ROUTE_HAND_TYPES={
 group:['pair','two-pair','three-kind'],
 straight:['straight'],
 flush:['flush'],
} as const;
const RANK_TEXTS=['壹','贰','叁','肆','伍','陆','柒','捌'] as const;
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

/** Eight visual examples only with strength rank & base scores; no scoring, random or run-state changes. */
export function openingRuleBriefing(run:R2RunState){
 const focus=currentBuildFocus(run,run.openingRoute)??'group';
 const rules=readR2Modifiers(run.jokers,r2JokerDefinitionsFor(run));
 const selected=new Set<R2HandType>(ROUTE_HAND_TYPES[focus]);
 const cards:OpeningRuleCard[]=handTypeRuleCards(run.handLevels,rules,OPENING_BASE_HAND_TYPES).map((card,index)=>{
  const type=OPENING_BASE_HAND_TYPES[index];
  const [heat,mult,heatStep,multStep]=R2_BASE_SCORES[type];
  const level=run.handLevels[type]??1;
  const currentHeat=heat+(level-1)*heatStep;
  const currentMult=Rational.fromJSON(mult).add(Rational.fromJSON(multStep).multiply(new Rational(BigInt(level-1))));
  const multStr=fractionText(currentMult.toJSON());
  const multNum=Number(currentMult.n)/Number(currentMult.d);
  const baseScore=Math.floor(currentHeat*multNum);
  return {
   title:card.title.split(' · ')[0],
   body:`${baseScore.toLocaleString()} (${currentHeat} × ${multStr}倍)`,
   example:EXAMPLES[type],
   selected:selected.has(type),
   rank:index+1,
   rankText:RANK_TEXTS[index],
   heat:currentHeat,
   mult:multStr,
   baseScore,
  };
 });
 return {title:'主要牌型',body:'',cards,primaryLabel:'进入商店'};
}

/** Touch keeps native scrolling; mouse dragging also works over the poker examples. */
function enableHandScroll(scroll:HTMLElement):()=>void {
 scroll.tabIndex=0;
 scroll.setAttribute('role','region');
 scroll.setAttribute('aria-label','主要牌型，按强度从高到低');
 const controller=new AbortController(),options={signal:controller.signal};
 let drag:{id:number;y:number;top:number}|undefined;
 const stop=()=>{
  const id=drag?.id;drag=undefined;delete scroll.dataset.dragging;
  if(id!==undefined&&scroll.hasPointerCapture(id))scroll.releasePointerCapture(id);
 };
 scroll.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||event.button!==0||scroll.scrollHeight<=scroll.clientHeight)return;
  // Leave the native scrollbar thumb available for dragging too.
  if(event.clientX>=scroll.getBoundingClientRect().left+scroll.clientLeft+scroll.clientWidth)return;
  drag={id:event.pointerId,y:event.clientY,top:scroll.scrollTop};
  scroll.setPointerCapture(event.pointerId);scroll.dataset.dragging='true';
  scroll.focus({preventScroll:true});event.preventDefault();
 },options);
 scroll.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(!(event.buttons&1)){stop();return;}
  scroll.scrollTop=drag.top+drag.y-event.clientY;
 },options);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])scroll.addEventListener(type,stop,options);
 window.addEventListener('blur',stop,options);
 return ()=>{stop();controller.abort();};
}

/** One visible action; native cancel follows the same guarded shop transition. */
export function showOpeningRuleBriefing(dialog:DetailDialog,run:R2RunState,onEnterShop:()=>void):HTMLDialogElement{
 const model=openingRuleBriefing(run);let finished=false,stopScroll:(()=>void)|undefined;
 const finish=()=>{if(finished)return;finished=true;stopScroll?.();dialog.close();onEnterShop();};
 const element=dialog.open(model.title,model.body,[{label:model.primaryLabel,primary:true,run:finish}],{
  cards:model.cards,
  onClose:()=>{stopScroll?.();if(finished)return;finished=true;onEnterShop();},
 });
 element.classList.add('opening-rule-briefing');
 const close=element.querySelector<HTMLButtonElement>('.dialog-close');if(close)close.hidden=true;
 const scroll=element.querySelector<HTMLElement>('.dialog-scroll');
 if(scroll)stopScroll=enableHandScroll(scroll);
 element.querySelector('.experience-cards')?.setAttribute('aria-label','主要牌型，按强度从高到低');
 const items=[...element.querySelectorAll<HTMLElement>('.experience-card')];
 for(const [index,item] of items.entries()){
  const card=model.cards[index];if(!card)continue;
  if(card.selected)item.dataset.routeSelected='true';
  item.setAttribute('aria-label',`第${card.rank}顺位 ${card.title}，基准分${card.baseScore}：${card.example.join(' ')}`);

  const copy=item.querySelector<HTMLElement>('div');
  if(copy){
   copy.className='opening-hand-info';
   copy.replaceChildren();

   const titleRow=document.createElement('div');
   titleRow.className='opening-hand-title-row';

   const rankBadge=document.createElement('span');
   rankBadge.className='opening-hand-rank';
   rankBadge.dataset.rank=String(card.rank);
   rankBadge.textContent=card.rankText;
   rankBadge.title=`第${card.rank}顺位`;

   const h3=document.createElement('h3');
   h3.className='opening-hand-name';
   h3.textContent=card.title;

   titleRow.append(rankBadge,h3);

   if(card.selected){
    const routeTag=document.createElement('span');
    routeTag.className='opening-route-tag';
    routeTag.textContent='已选路线';
    titleRow.append(routeTag);
   }

   const scoreRow=document.createElement('div');
   scoreRow.className='opening-hand-score-row';

   const scoreNum=document.createElement('strong');
   scoreNum.className='opening-score-num';
   scoreNum.textContent=card.baseScore.toLocaleString();

   const formula=document.createElement('span');
   formula.className='opening-score-formula';
   formula.textContent=`(${card.heat} × ${card.mult}倍)`;

   scoreRow.append(scoreNum,formula);
   copy.append(titleRow,scoreRow);
  }

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
