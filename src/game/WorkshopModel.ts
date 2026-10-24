import type {R2RunState} from '../domain/run';
import {getR2Tool} from '../content/r2Tools';
import type {Rank,Suit} from '../cards/types';
import {rankLabel,SUIT_SYMBOL} from '../cards/types';
import {straightWorkshopAdvice} from './StraightWorkshopAdvice';
import {readR2Modifiers} from '../content/r2Schema';
import {r2JokerDefinitionsFor} from '../domain/r2ContentProfiles';
import type {R2Offer} from '../domain/r2Shop';
import {basicChoiceRows} from './BasicToolChoice';
import {toolCardMatches,toolCardTargetStatus} from './ToolTargetDirectory';
import {toolCardChange} from './ToolChangePreview';

export type WorkshopTab='upgrade'|'modify'|'dyes';
export interface WorkshopFilter {rank?:Rank;suit?:Suit}
export interface WorkshopIntent {definitionId:string;filter:WorkshopFilter;label:string}
export const WORKSHOP_GOALS:readonly {id:WorkshopTab;title:string;description:string}[]=[
  {id:'upgrade',title:'升级牌型',description:'强化一种已发现的牌型；确认费用后当场升1级。'},
  {id:'modify',title:'调整点数',description:'把牌升或降1点，向想凑的点数靠近。先定原点数可减少选牌范围，也可直接选牌。'},
  {id:'dyes',title:'改变花色',description:'先选想统一的花色，点数保持。可限定原花色，再自己挑选目标牌。'},
];

/** Project real tools and public deck targets; never quote a fabricated rank or change a selection. */
export function workshopChoices(run:R2RunState){
  return basicChoiceRows(run).map(row=>{
    const tool=getR2Tool(row.id),group=tool.operation.kind==='shift-rank'?'modify':tool.operation.kind==='set-suit'?'dyes':'other';
    return {...row,tool,group};
  });
}
export function workshopIntent(run:R2RunState,definitionId:string,filter:WorkshopFilter={}):{intent:WorkshopIntent;count:number;reason?:string} {
  const tool=getR2Tool(definitionId),op=tool.operation;
  const cards=run.deckInstances.filter(card=>!run.destroyedIds.includes(card.id)&&toolCardMatches(card,filter.rank?String(filter.rank):'',filter.suit??'')&&toolCardTargetStatus(tool,card,'target').changes);
  let label=op.kind==='shift-rank'?`点数${op.delta>0?'+':'−'}${Math.abs(op.delta)}`:op.kind==='set-suit'?`改成${SUIT_SYMBOL[op.suit]}`:'';
  if(op.kind==='shift-rank'&&filter.rank){
    const before=run.deckInstances.find(card=>card.rank===filter.rank),change=before&&toolCardChange(tool,before);
    label=rankLabel(filter.rank)+' → '+(change?.after?rankLabel(change.after.rank):rankLabel(filter.rank));
  }
  if(op.kind==='set-suit'&&filter.suit)label=SUIT_SYMBOL[filter.suit]+' → '+SUIT_SYMBOL[op.suit];
  const reason=cards.length?undefined:op.kind==='shift-rank'?'该点数已达边界，当前目标不会变化。':op.kind==='set-suit'?'这个范围没有可改变花色的牌。':'当前范围没有可用目标。';
  return {intent:{definitionId,filter:{...filter},label},count:cards.length,reason};
}

/** Read the exact existing DIY/stock quotes; this projection never purchases or selects a target. */
export function workshopStraightAdvice(run:R2RunState,purchaseReason:(offer:R2Offer)=>string|undefined){
 const quotes=workshopChoices(run).filter(row=>row.tool.operation.kind==='shift-rank').map(row=>{
  const reason=row.duplicate?(row.duplicate.consumed?'已售':purchaseReason(row.duplicate)):row.reason;
  return {quoteId:row.duplicate?.offerId??'basic-choice/'+run.shop?.basicChoice?.shopSeq+'/'+row.id,definitionId:row.id,paidPrice:row.price,available:!reason&&workshopIntent(run,row.id).count>0,quotaCost:row.duplicate?0 as const:1 as const};
 });
 return straightWorkshopAdvice({deck:run.deckInstances,destroyedIds:run.destroyedIds,fourStraight:readR2Modifiers(run.jokers,r2JokerDefinitionsFor(run)).fourStraight,quotes,gold:run.gold,diyUsesLeft:run.shop?.basicChoice?.purchase?0:1});
}
