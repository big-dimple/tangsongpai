import {SUITS,type PlayingCard} from '../cards/types';
import type {NoviceGuideHint} from './NoviceGuide';

/** Only teach this example when the current public hand really has the required cards. */
export function flushLessonGroups(hand:readonly PlayingCard[]) {
 const hearts=hand.filter(card=>card.suit==='hearts').map(card=>card.id);
 if(hand.length!==8||hearts.length!==3)return;
 const first=hand.findIndex(card=>card.suit==='hearts'),last=hand.length-1-[...hand].reverse().findIndex(card=>card.suit==='hearts');
 return {hearts,left:hand.slice(0,first).map(card=>card.id),right:hand.slice(last+1).map(card=>card.id),grouped:last-first===2&&hand.every((card,index)=>index===0||SUITS.indexOf(hand[index-1].suit)<=SUITS.indexOf(card.suit))};
}

/** The outcome comes only from the visible hand after replacement, never from the future deck. */
export function flushRefillHint(hand:readonly PlayingCard[]):{body:string;heartIds:string[]} {
 const heartIds=hand.filter(card=>card.suit==='hearts').map(card=>card.id);
 return {heartIds,body:heartIds.length>=5?`现在有${heartIds.length}张红桃，任选5张试着出同花；也可选择其他牌型。`:
  `补牌后有${heartIds.length}张红桃，同花需要5张；也可选择其他牌型。`};
}

/** Presentation only: every action remains available and only the player's real selection changes. */
export function flushDiscardHint(hint:NoviceGuideHint,hand:readonly PlayingCard[],selectedIds:readonly string[],options:{introSeen:boolean;sorted:boolean;sortedSeen:boolean;coarse:boolean}):NoviceGuideHint|undefined {
 const groups=flushLessonGroups(hand);if(!groups)return;
 const {hearts,left,right,grouped}=groups,selected=new Set(selectedIds);
 if(!options.introSeen)return {...hint,cue:'先看看三张红桃',body:'5张同花色可以组成同花。留住这3张红桃，试着换其他花色；补牌未必是红桃。',recommendedCardIds:hearts,
  choices:[{id:'flush-intro',label:'看到了',cardIds:[]}]};
 if(!options.sorted||!grouped)return {...hint,cue:'让同花色排在一起',body:selected.size?'点「花色」理牌；理牌会清空已选。':'点理牌区的「花色」，把相同花色排在一起。',recommendedCardIds:[],focus:'sort-suit'};
 if(!options.sortedSeen)return {...hint,cue:'三张红桃排在一起了',body:'留住中间的红桃，试着换掉两侧其他花色。一次最多换5张；新牌不保证是红桃。',recommendedCardIds:hearts,
  choices:[{id:'flush-sorted',label:'看到了',cardIds:[]}]};
 const selectedHearts=hearts.filter(id=>selected.has(id));
 if(selectedHearts.length)return {...hint,cue:'红桃先留在手里',body:'若想尝试同花，点已选红桃取消；也可以按自己的想法出牌或换牌。',recommendedCardIds:selectedHearts,focus:'play-or-discard'};
 const leftRemaining=left.filter(id=>!selected.has(id)),rightRemaining=right.filter(id=>!selected.has(id));
 const side=leftRemaining.length?leftRemaining:rightRemaining;
 if(side.length){
  const place=leftRemaining.length?'左侧':'右侧';
  const how=side.length===1?'点亮牌，也可自由选择。':options.coarse?'按住亮牌滑到另一张再松手，也可逐张点选。':'按住鼠标左键从一张亮牌拖到另一张，也可逐张点选。';
  return {...hint,cue:`选${place}其他花色`,body:`先保留红桃。${how}`,recommendedCardIds:side.length===1?side:[side[0],side[side.length-1]],
   ...(side.length>1?{gesture:'sweep' as const,gestureCardIds:side}:{})};
 }
 return {...hint,cue:'选好了，试试换牌',body:'点「弃牌」换掉已选的5张，消耗弃牌次数，不消耗出牌次数；也可直接出牌。',recommendedCardIds:[],focus:'discard'};
}
