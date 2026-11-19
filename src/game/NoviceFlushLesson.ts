import {rankLabel,type PlayingCard} from '../cards/types';
import type {NoviceGuideHint} from './NoviceGuide';
import type {FlushPlan} from './NoviceHandLesson';

/** Describe the real refill from cards the player can see. */
export function flushRefillHint(hand:readonly PlayingCard[]):{body:string;heartIds:string[]} {
 const heartIds=hand.filter(card=>card.suit==='hearts').map(card=>card.id),count=heartIds.length;
 return {heartIds,body:count>=5?`补牌后有${count}张红桃，任选5张出同花。`:`补牌后有${count}张红桃，还差${5-count}张同花色。`};
}

/** Point to the page containing an off-screen target; visible columns follow hand order. */
export function noviceHandPageFocus(hand:readonly PlayingCard[],ids:readonly string[],visibleIds:readonly string[]):NoviceGuideHint['focus'] {
 const visible=new Set(visibleIds),indices=hand.flatMap((card,index)=>visible.has(card.id)?[index]:[]);
 const missing=ids.flatMap(id=>{const index=hand.findIndex(card=>card.id===id);return index>=0&&!visible.has(id)?[index]:[];});
 if(!indices.length||!missing.length)return 'hand';
 return missing.some(index=>index<Math.min(...indices))?'hand-previous':'hand-next';
}

interface FlushOptions {
 plan?:FlushPlan;
 sorted:boolean;
 coarse:boolean;
 refilled?:boolean;
 visibleIds?:readonly string[];
 /** A swipe cannot cross a row break, held heart, already selected card or hidden column. */
 rowById?:ReadonlyMap<string,number>;
}

/** Gold outlines always invite a real input. Separate quiet seals identify what stays on the table. */
export function flushDiscardHint(base:NoviceGuideHint,hand:readonly PlayingCard[],selectedIds:readonly string[],options:FlushOptions):NoviceGuideHint|undefined {
 const {heartIds:hearts,body:refill}=flushRefillHint(hand),count=hearts.length;
 const selected=new Set(selectedIds),visibleIds=options.visibleIds??hand.map(card=>card.id),visible=new Set(visibleIds);
 const onPage=(ids:readonly string[])=>ids.filter(id=>visible.has(id));
 const pointTo=(ids:string[])=>({recommendedCardIds:onPage(ids),focus:onPage(ids).length?undefined:noviceHandPageFocus(hand,ids,visibleIds)});
 const hint={...base,keepCardIds:undefined,focus:undefined,gesture:undefined,gestureCardIds:undefined};
 if(count>=5){
  const extra=selectedIds.filter(id=>!hearts.includes(id));
  if(extra.length)return {...hint,cue:'先收回其他花色',body:'再点一次已选的杂牌，留下五张红桃出同花。',...pointTo(extra)};
  if(selected.size===5)return {...hint,cue:'五张同花，出牌',body:'点「出牌」，让这五张红桃一起计分。',recommendedCardIds:[],focus:'play'};
  const rest=hearts.filter(id=>!selected.has(id)),shown=onPage(rest);
  return {...hint,cue:selected.size?`再选${5-selected.size}张红桃`:'红桃已经成花',
   body:!shown.length?'翻页找红桃，已选的牌会保留。':selected.size?`已选${selected.size}张，任选亮起的红桃补齐五张。`:options.refilled?refill:`手里有${count}张红桃，任选5张出同花。`,...pointTo(rest)};
 }
 if(hand.length!==8||(count!==3&&count!==4))return;
 const first=hand.find(card=>hand.some(other=>other.id!==card.id&&other.rank===card.rank));
 const pair=first?hand.filter(card=>card.rank===first.rank).slice(0,2):[];
 const choices=[{id:'flush-draw',label:options.plan==='score'?'试试换牌':'教我理牌',cardIds:[]},
  {id:'flush-score',label:first?'改打对子':'自己出牌',cardIds:[]}];
 if(options.plan==='score'){
  const missing=pair.filter(card=>!selected.has(card.id)).map(card=>card.id);
  if(first&&selectedIds.every(id=>pair.some(card=>card.id===id))){
   if(!missing.length)return {...hint,cue:'对子选好了',body:'点「出牌」，把这对牌的分数收入本场。',recommendedCardIds:[],focus:'play'};
   return {...hint,cue:'先拿手里的分',body:`点两张 ${rankLabel(first.rank)} 凑对子。`,...pointTo(missing),choices:selected.size?undefined:choices};
  }
  return {...hint,cue:'这手由你定',body:'选1–5张出牌。',recommendedCardIds:[],focus:selected.size?'play':'hand',choices:selected.size?undefined:choices};
 }
 const held={...hint,beat:selected.size||options.sorted||options.plan?undefined:hint.beat,keepCardIds:hearts};
 const wrong=hearts.filter(id=>selected.has(id));
 if(wrong.length)return {...held,cue:onPage(wrong).length?'红桃先留在手里':'翻页收回红桃',
  body:onPage(wrong).length?'再点升起的红桃，取消选中。已选的杂牌仍在待换区。':'翻到亮起的那一页，再点升起的红桃。',...pointTo(wrong)};
 if(options.plan==='draw'&&!options.sorted&&!options.refilled&&!selected.size){
  return {...held,cue:'让同花色排在一起',body:'点下方「花色」，待换的杂牌会排到红桃两侧。',recommendedCardIds:[],focus:'sort-suit'};
 }
 const remaining=hand.filter(card=>card.suit!=='hearts'&&!selected.has(card.id)).map(card=>card.id);
 if(!remaining.length)return {...held,cue:'选好了，试试换牌',body:`点「弃牌」换${selected.size}张，只用1次弃牌。${count}张红桃留手。`,recommendedCardIds:[],focus:'discard'};
 const next=remaining.find(id=>visible.has(id));
 if(!next)return {...held,cue:'翻页找待换的牌',body:'点亮起的翻页箭头，继续选择杂牌。',recommendedCardIds:[],focus:noviceHandPageFocus(hand,remaining,visibleIds)};
 const start=hand.findIndex(card=>card.id===next),row=options.rowById?.get(next),run:string[]=[];
 for(const card of hand.slice(start)){
  if(!remaining.includes(card.id)||!visible.has(card.id)||options.rowById?.get(card.id)!==row)break;
  run.push(card.id);
 }
 const firstHeart=hand.findIndex(card=>card.suit==='hearts'),lastHeart=hand.length-1-[...hand].reverse().findIndex(card=>card.suit==='hearts');
 const side=start<firstHeart?'左侧':start>lastHeart?'右侧':'';
 const how=run.length===1?'点亮框里的牌。':options.coarse?'沿亮线滑选，也可逐张点。':'沿亮线拖选，也可逐张点。';
 const initial=!selected.size&&!options.sorted&&!options.plan&&!options.refilled;
 const cue=initial?'留红桃，选杂牌':side?`选${side}其他花色`:'选亮起的杂牌';
 const body=initial?`${count}张红桃留手，还差${5-count}张。点亮框里的杂牌，换牌有机会补齐。`:
  !selected.size&&options.refilled?refill+'点亮牌再换。':selected.size?`已选${selected.size}张待换。${how}`:`红桃留手。${how}`;
 return {...held,cue,body,recommendedCardIds:run,choices:initial?choices:undefined,
  ...(run.length>1?{gesture:'sweep' as const,gestureCardIds:run}:{})};
}
