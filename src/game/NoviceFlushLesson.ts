import {SUITS,rankLabel,type PlayingCard} from '../cards/types';
import type {NoviceGuideHint} from './NoviceGuide';
import type {FlushPlan} from './NoviceHandLesson';

/** Only teach this example when the current public hand really has the required cards. */
export function flushLessonGroups(hand:readonly PlayingCard[]) {
 const hearts=hand.filter(card=>card.suit==='hearts').map(card=>card.id);
 if(hand.length!==8||(hearts.length!==3&&hearts.length!==4))return;
 const first=hand.findIndex(card=>card.suit==='hearts'),last=hand.length-1-[...hand].reverse().findIndex(card=>card.suit==='hearts');
 return {hearts,left:hand.slice(0,first).map(card=>card.id),right:hand.slice(last+1).map(card=>card.id),grouped:last-first===hearts.length-1&&hand.every((card,index)=>index===0||SUITS.indexOf(hand[index-1].suit)<=SUITS.indexOf(card.suit))};
}

/** The outcome comes only from the visible hand after replacement, never from the future deck. */
export function flushRefillHint(hand:readonly PlayingCard[]):{body:string;heartIds:string[]} {
 const heartIds=hand.filter(card=>card.suit==='hearts').map(card=>card.id);
 return {heartIds,body:heartIds.length>=5?`现在有${heartIds.length}张红桃，任选5张试着出同花；也可选择其他牌型。`:
  `补牌后有${heartIds.length}张红桃，同花需要5张；也可选择其他牌型。`};
}

/** Point to the page containing an off-screen target; visible columns follow hand order. */
export function noviceHandPageFocus(hand:readonly PlayingCard[],ids:readonly string[],visibleIds:readonly string[]):NoviceGuideHint['focus'] {
 const visible=new Set(visibleIds),indices=hand.flatMap((card,index)=>visible.has(card.id)?[index]:[]);
 const missing=ids.flatMap(id=>{const index=hand.findIndex(card=>card.id===id);return index>=0&&!visible.has(id)?[index]:[];});
 if(!indices.length||!missing.length)return 'hand';
 return missing.some(index=>index<Math.min(...indices))?'hand-previous':'hand-next';
}

/** Presentation only: every action remains available and only the player's real selection changes. */
export function flushDiscardHint(hint:NoviceGuideHint,hand:readonly PlayingCard[],selectedIds:readonly string[],options:{plan?:FlushPlan;sorted:boolean;coarse:boolean;visibleIds?:readonly string[]}):NoviceGuideHint|undefined {
 const selected=new Set(selectedIds),visible=new Set(options.visibleIds??hand.map(card=>card.id));
 const onPage=(ids:readonly string[])=>ids.filter(id=>visible.has(id));
 const pageFocus=(ids:readonly string[])=>noviceHandPageFocus(hand,ids,[...visible]);
 const heldHearts=hand.filter(card=>card.suit==='hearts').map(card=>card.id);
 if(heldHearts.length>=5){
  const offSuit=selectedIds.filter(id=>!heldHearts.includes(id));
  if(offSuit.length)return {...hint,cue:'你手里还有同花',body:'想打同花，可收回其他花色；也能照常出牌。',recommendedCardIds:onPage(offSuit),focus:'play-or-discard'};
  if(selected.size===5)return {...hint,cue:'五张同花，出牌',body:'这五张红桃都计分，点「出牌」收分。',recommendedCardIds:[],focus:'play'};
  const remaining=heldHearts.filter(id=>!selected.has(id)),shown=onPage(remaining);
  return {...hint,cue:'红桃已经成花',body:shown.length?(selected.size?'再点'+(5-selected.size)+'张红桃。':'这手已有'+heldHearts.length+'张红桃，选5张就能打同花。'):'翻页选剩下的红桃，已选的牌会保留。',
   recommendedCardIds:shown,focus:shown.length?undefined:pageFocus(remaining)};
 }
 const groups=flushLessonGroups(hand);if(!groups)return;
 const {hearts,left,right,grouped}=groups;
 const heartsOnPage=onPage(hearts),heartsSplit=heartsOnPage.length<hearts.length;
 const first=hand.find(card=>hand.some(other=>other.id!==card.id&&other.rank===card.rank));
 const pair=first?hand.filter(card=>card.rank===first.rank).slice(0,2):[];
 const choices=[{id:'flush-score',label:first?'打手里的对子':'先打手牌',cardIds:[],selected:options.plan==='score'},
  {id:'flush-draw',label:'留红桃追同花',cardIds:[],selected:options.plan==='draw'}];
 if(!options.plan&&!selected.size)return {...hint,cue:'下一手，你来拿主意',
  body:'已有'+hearts.length+'张红桃。5张同花色成花，还差'+(5-hearts.length)+'张，换牌可能落空。',recommendedCardIds:heartsOnPage,...(heartsSplit?{focus:pageFocus(hearts)}:{}),choices};
 if(options.plan==='score'||!options.plan){
  const missing=pair.filter(card=>!selected.has(card.id)).map(card=>card.id),shown=onPage(missing);
  if(options.plan==='score'&&missing.length&&selectedIds.every(id=>pair.some(card=>card.id===id)))return {...hint,cue:'先拿手里的分',
   body:shown.length?'点两张 '+rankLabel(first!.rank)+' 凑对子，再点「出牌」。':'翻页找另一张同点数的牌。',recommendedCardIds:shown,
   focus:shown.length?undefined:pageFocus(missing),choices:selected.size?undefined:choices};
  return {...hint,cue:selected.size?'这手由你定':'先拿手里的分',body:selected.size?'出牌收分，也可以弃掉已选牌换新牌。':'选1–5张出牌，或换一条打法。',
   recommendedCardIds:[],focus:selected.size?'play-or-discard':'hand',choices:selected.size?undefined:choices};
 }
 if(!options.sorted||!grouped)return {...hint,cue:'让同花色排在一起',body:selected.size?'点「花色」理牌；理牌会清空已选。':'点理牌区的「花色」，把相同花色排在一起。',recommendedCardIds:[],focus:'sort-suit'};
 const selectedHearts=hearts.filter(id=>selected.has(id)),selectedHeartsOnPage=onPage(selectedHearts);
 if(selectedHearts.length){
  if(!selectedHeartsOnPage.length)return {...hint,cue:'翻页查看已选红桃',body:'想尝试同花，可翻页取消已选红桃；也可自行出牌或换牌。',recommendedCardIds:[],focus:pageFocus(selectedHearts)};
  return {...hint,cue:'红桃先留在手里',body:'若想尝试同花，点已选红桃取消；也可以按自己的想法出牌或换牌。',recommendedCardIds:selectedHeartsOnPage,focus:'play-or-discard'};
 }
 const leftRemaining=left.filter(id=>!selected.has(id)),rightRemaining=right.filter(id=>!selected.has(id));
 const side=leftRemaining.length?leftRemaining:rightRemaining;
 if(side.length){
  const place=leftRemaining.length?'左侧':'右侧',visibleSide=onPage(side);
  if(!visibleSide.length)return {...hint,cue:`翻页找${place}其他花色`,body:'点亮起的手牌翻页箭头，找到想换的牌；也可自行出牌或换牌。',recommendedCardIds:[],focus:pageFocus(side)};
  const how=visibleSide.length===1?'点亮牌，也可自由选择。':options.coarse?'按住亮牌滑到另一张再松手，也可逐张点选。':'按住鼠标左键从一张亮牌拖到另一张，也可逐张点选。';
  return {...hint,cue:`选${place}其他花色`,body:`先保留红桃。${how}`,recommendedCardIds:visibleSide.length===1?visibleSide:[visibleSide[0],visibleSide[visibleSide.length-1]],
   ...(visibleSide.length>1?{gesture:'sweep' as const,gestureCardIds:visibleSide}:{})};
 }
 return {...hint,cue:'选好了，试试换牌',body:'点「弃牌」换掉已选的'+selected.size+'张，只用一次弃牌额度。也可直接出牌。',recommendedCardIds:[],focus:'discard'};
}
