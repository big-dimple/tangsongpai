import type {R2RunState} from '../domain/r2Run';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import {readR2Modifiers} from '../content/r2Schema';
import type {DetailDialog} from './DetailDialog';
import {handTypeRuleCards} from './HandRuleReference';
import {OPENING_ROUTES} from './HeroOpeningCopy';
import {openingRouteDemo} from './OpeningRouteDemo';

/** Read-only new-run context: the saved run remains the source of rule truth. */
export function openingRuleBriefing(run:R2RunState){
 const focus=run.openingRoute,route=OPENING_ROUTES[focus],demo=openingRouteDemo(focus,run.characterId);
 const rules=readR2Modifiers(run.jokers,r2JokerDefinitionsFor(run));
 return {
  title:'开局规则 · 12种牌型',
  body:'每场选择1–5张牌打出，同一次只按一种牌型结算。牌型提供基础热度与倍率，有效计分牌再加入点数和强化，最后按热度×倍率得分；达到本场目标即可继续。\n\n确认后进入初始商店。可以购买路线起手唐宋牌或工具，也可以保留金币直接入场。',
  effectBody:'你选择了「'+route.title+'」：'+demo.shape.join(' ')+'。'+demo.method+'。路线只是起手方向，之后仍可改玩其他牌型。',
  summaryBody:'普通点数：2–10按牌面，J／Q／K为10，A为11。牌型目录顺序不代表当前收益高低。',
  cards:handTypeRuleCards(run.handLevels,rules),
  primaryLabel:'明白了，进入初始商店',
  closeLabel:'跳过说明，进入商店',
 };
}

/** Every exit continues to the same first shop; repeated close events cannot navigate twice. */
export function showOpeningRuleBriefing(dialog:DetailDialog,run:R2RunState,onEnterShop:()=>void):HTMLDialogElement{
 const model=openingRuleBriefing(run);let finished=false;
 const finish=(owner:HTMLDialogElement)=>{
  if(finished)return;finished=true;owner.close();onEnterShop();
 };
 const element=dialog.open(model.title,model.body,[{label:model.primaryLabel,primary:true,run:()=>finish(element)}],{
  effectBody:model.effectBody,summaryBody:model.summaryBody,cards:model.cards,
  closeLabel:model.closeLabel,guideSteps:{labels:['选择路线','规则说明','初始商店'],current:1},
  onClose:()=>{if(finished)return;finished=true;onEnterShop();},
 });
 element.classList.add('opening-rule-briefing');
 return element;
}
