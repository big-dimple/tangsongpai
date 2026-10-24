import type {R2RunState} from '../domain/r2Run';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {readR2Modifiers} from '../content/r2Schema';
import type {R2HandType} from '../domain/evaluateR2';
import {currentBuildFocus} from './BuildJourney';
import type {DetailDialog} from './DetailDialog';
import {handTypeRuleCards} from './HandRuleReference';
import {OPENING_ROUTES} from './HeroOpeningCopy';
import {openingRouteDemo} from './OpeningRouteDemo';

export interface OpeningRuleCard {
 title: string;
 body: string;
 stat?: string;
}

export const OPENING_BASE_HAND_TYPES:readonly R2HandType[]=[
 'straight-flush','four-kind','full-house','flush','straight','three-kind','two-pair','pair',
];
const ROUTE_HAND_TYPES={
 group:['pair','two-pair','three-kind'],
 straight:['straight'],
 flush:['flush'],
} as const;

/** Read-only new-run context: eight primary types first; three extension types stay supplementary. */
export function openingRuleBriefing(run:R2RunState){
 const focus=currentBuildFocus(run,run.openingRoute)??'group',route=OPENING_ROUTES[focus],demo=openingRouteDemo(focus,run.characterId);
 const rules=readR2Modifiers(run.jokers,r2JokerDefinitionsFor(run));
 const selected=new Set<R2HandType>(ROUTE_HAND_TYPES[focus]);
 const cards:OpeningRuleCard[]=handTypeRuleCards(run.handLevels,rules,OPENING_BASE_HAND_TYPES).map((card,index)=>selected.has(OPENING_BASE_HAND_TYPES[index])
  ?{...card,title:'已选路线 · '+card.title,stat:'当前路线：'+route.title}
  :{...card,stat:undefined});
 return {
  title:'开局规则 · 8种主要牌型',
  body:'每场选择1–5张牌打出，同一次只按一种牌型结算。下面按基础牌型由强到弱排列；实际得分还会受牌型等级和加成影响。牌型提供基础热度与倍率，有效计分牌再加入点数和强化，最后按热度×倍率得分；达到本场目标即可继续。\n\n确认后进入初始商店。可以购买路线起手唐宋牌或工具，也可以保留金币直接入场。',
  effectBody:'你选择了「'+route.title+'」：'+demo.shape.join(' ')+'。'+demo.method+'。下方带「已选路线」标记的牌型就是你的起手方向，之后仍可改玩其他牌型。',
  summaryBody:'普通点数：2–10按牌面，J／Q／K为10，A为11。\n\n扩展牌型（之后遇到再看）：五条＝5张同点；同花葫芦＝同花色的葫芦；同花五条＝同花色且同点。',
  cards,
  primaryLabel:'明白了，进入初始商店',
  closeLabel:'跳过说明，进入商店',
 };
}

/** Every exit continues to the same first shop; repeated close events cannot navigate twice. */
export function showOpeningRuleBriefing(dialog:DetailDialog,run:R2RunState,onEnterShop:()=>void):HTMLDialogElement{
 const model=openingRuleBriefing(run);let finished=false;
 const finish=()=>{
  if(finished)return;finished=true;dialog.close();onEnterShop();
 };
 const element=dialog.open(model.title,model.body,[{label:model.primaryLabel,primary:true,run:()=>finish()}],{
  effectBody:model.effectBody,summaryBody:model.summaryBody,cards:model.cards,
  closeLabel:model.closeLabel,guideSteps:{labels:['选择路线','规则说明','初始商店'],current:1},
  onClose:()=>{if(finished)return;finished=true;onEnterShop();},
 });
 element.classList.add('opening-rule-briefing');
 return element;
}
