import {HAND_LABELS} from '../content/handLabels';
import {rankLabel,type Rank} from '../cards/types';
import {previewR2Hand} from '../domain/scoreR2';
import {aiHandKey,aiHandScoreInput,type AiHandInput,type AiHandResult} from './AiHandCandidates';
import type {NoviceGuideHint} from './NoviceGuide';
import {noviceHandPageFocus} from './NoviceFlushLesson';

type OpeningPair={rank:string;ids:string[];score:string};
export interface OpeningDeal {pairs:OpeningPair[];both:string}
const rangeText=({minimum,maximum}:{minimum:string;maximum:string})=>minimum===maximum?minimum:minimum+'–'+maximum;

/** Compare only the two pairs visible in this deal, using the table's public score rules. */
export function openingDeal(input:AiHandInput,preferred:readonly string[]):OpeningDeal|undefined {
 const groups=new Map<Rank,string[]>();
 for(const card of input.hand){
  if(input.disabledIds.includes(card.id))continue;
  const ids=groups.get(card.rank)??[];ids.push(card.id);groups.set(card.rank,ids);
 }
 const groupsWithPair=[...groups].filter(([,ids])=>ids.length===2)
  .sort(([,a],[,b])=>Number(b.includes(preferred[0]))-Number(a.includes(preferred[0]))).slice(0,2);
 if(groupsWithPair.length!==2)return;
 try {
  const score=(ids:string[])=>rangeText(previewR2Hand(aiHandScoreInput(input,ids)).scoreRange);
  const pairs=groupsWithPair.map(([rank,ids])=>({rank:rankLabel(rank),ids,score:score(ids)}));
  return {pairs,both:score(pairs.flatMap(pair=>pair.ids))};
 }catch{return;} // A different active skill can make a hypothetical selection illegal.
}

export function openingDealHint(hint:NoviceGuideHint,deal:OpeningDeal,hand:AiHandInput['hand'],selected:readonly string[],visible:string[],draftScore?:string):NoviceGuideHint|undefined {
 const [first,other]=deal.pairs;
 const chosen=new Set(selected);
 if(selected.some(id=>!deal.pairs.some(pair=>pair.ids.includes(id))))return;
 const picked=(pair:OpeningPair)=>pair.ids.filter(id=>chosen.has(id)).length;
 const [main,side]=picked(other)>picked(first)?[other,first]:[first,other];
 const mainCount=picked(main),sideCount=picked(side);
 const pointTo=(ids:string[],alsoPlay=false):Pick<NoviceGuideHint,'focus'|'recommendedCardIds'>=>{
  const shown=ids.filter(id=>visible.includes(id));
  return {recommendedCardIds:shown,focus:ids.length&&!shown.length?noviceHandPageFocus(hand,ids,visible):alsoPlay?'play':undefined};
 };
 if(!selected.length)return {...hint,body:'先点一张 '+main.rank+'，再找同点数的牌。花色可以不同。',...pointTo(main.ids)};
 if(mainCount===2&&sideCount===2)return {...hint,cue:'两对都齐了',beat:'两对预计 '+deal.both+' 分',body:'这四张一起出。想留一对，就点那两张收回。',...pointTo([],true)};
 if(mainCount===2&&sideCount===0)return {...hint,cue:'对子选好了',beat:'对子 '+main.score+' 分 → 两对 '+deal.both+' 分',body:'现在出牌能留下两张 '+side.rank+'；也可以把它们一起打。',...pointTo(side.ids,true)};
 if(mainCount===2)return {...hint,cue:'再添一张就是两对',beat:'两对预计 '+deal.both+' 分',body:'再点另一张 '+side.rank+'，两对都能计分。',...pointTo(side.ids.filter(id=>!chosen.has(id)))};
 const missing=main.ids.filter(id=>!chosen.has(id));
 return {...hint,cue:sideCount?'两边各差一张':'再选另一张',beat:!sideCount&&draftScore?'单张 '+draftScore+' 分 → 对子 '+main.score+' 分':undefined,
  body:sideCount?'先凑齐一对，再决定要不要打两对。':'再点一张 '+main.rank+'，看看倍率怎么变。',...pointTo(missing)};
}

export interface FirstStageOption {
 id:string;
 label:string;
 cardIds:string[];
 minimum:string;
 maximum:string;
 canClear:boolean;
}

/** Public current-hand examples only; this never reads the draw pile or chooses cards. */
export function firstStageOptions(input:AiHandInput,result:AiHandResult|undefined):FirstStageOption[] {
 if(result?.status!=='ready'||result.key!==aiHandKey(input))return [];
 const options:FirstStageOption[]=[];
 for(const facts of result.ordered){
  try {
   const preview=previewR2Hand(aiHandScoreInput(input,facts.playedIds));
   const minimum=preview.scoreRange.minimum,maximum=preview.scoreRange.maximum;
   const canClear=BigInt(input.resources.stageHeat)+BigInt(minimum)>=BigInt(input.resources.target);
   const score=rangeText(preview.scoreRange);
   options.push({id:facts.type,label:HAND_LABELS[facts.type]+' · 预计'+score+'分',cardIds:[...facts.playedIds],minimum,maximum,canClear});
  } catch { /* A changed public skill intent may make this example unavailable. */ }
 }
 // A final-hand example which cannot reach the target would invite an avoidable
 // loss. If none can clear, leave the options available and explain that fact.
 const clearing=options.filter(option=>option.canClear);
 if(input.resources.handsLeft===1){
  if(clearing.length)return clearing.slice(0,2);
  return [...options].sort((a,b)=>BigInt(a.minimum)>BigInt(b.minimum)?-1:BigInt(a.minimum)<BigInt(b.minimum)?1:0).slice(0,1);
 }
 return options.slice(0,2);
}
