import type {PlayingCard,Suit} from '../cards/types';
import type {R2BossPlan} from './r2Chapter';
import {r2DisabledCards} from './r2Chapter';
import {r2HouseProfile} from './r2GroupUpgrade';
import {stableHash} from './hash';
import type {Action} from './run';
import type {R2RunState} from './r2Run';

export {BOSS_SUIT_RESCUE_PRICE,withBossSuitRescueIdentity} from './r2BossSuitRescueIdentity';
export const usesBossSuitRescue=(s:{contentVersion?:unknown;contentHash?:unknown})=>!!r2HouseProfile(s)?.rescueBase;
export interface BossSuitRescue {
  entry:{commandId:string;seq:number;token:string|null;cards:{id:string;suit:Suit}[]};
  status:'unbought'|'pending'|'used';
  purchase:{commandId:string;seq:number;playIndex:number}|null;
  play:{commandId:string;seq:number}|null;
}
export const bossSuitRescueEntryToken=(cards:readonly PlayingCard[],destroyed:readonly string[])=>stableHash(cards.filter(c=>!destroyed.includes(c.id)).map(({id,suit})=>({id,suit})));
/** The application fills public facts before assigning the command fingerprint. Explicit facts are never overwritten. */
export function prepareBossSuitRescueAction(run:R2RunState,action:Action):Action {
  if(!usesBossSuitRescue(run))return action;
  if(action.type==='EnterStage')return {...action,bossSuitRescueEntryToken:action.bossSuitRescueEntryToken??bossSuitRescueEntryToken(run.deckInstances,run.destroyedIds)};
  if(action.type==='BuyBossSuitRescue')return {...action,entryToken:action.entryToken??run.stage?.bossSuitRescue?.entry.token??'',purchasePlayIndex:action.purchasePlayIndex??run.stage?.playIndex??0};
  return action;
}
export function bossSuitRescueEntry(cards:readonly PlayingCard[],destroyed:readonly string[],commandId:string,seq:number,token:string|null=bossSuitRescueEntryToken(cards,destroyed)):BossSuitRescue {
  return {entry:{commandId,seq,token,cards:cards.filter(c=>!destroyed.includes(c.id)).map(({id,suit})=>({id,suit}))},status:'unbought',purchase:null,play:null};
}
export function bossSuitRescueQualified(boss:R2BossPlan|null,rescue:BossSuitRescue|undefined):boolean {
  return boss?.definitionId==='B03'&&!!rescue?.entry.token&&rescue.entry.token===stableHash(rescue.entry.cards)&&!!rescue.entry.cards.length&&rescue.entry.cards.every(c=>c.suit===boss.disabledSuit);
}
export function bossSuitRescueActive(stage:Pick<NonNullable<R2RunState['stage']>,'boss'|'bossSuitRescue'>|null):boolean {
  return stage?.bossSuitRescue?.status==='pending'&&bossSuitRescueQualified(stage.boss,stage.bossSuitRescue);
}
/** Only B03's card invalidation is waived; preserve the actual Boss for all other rules. */
export function bossSuitDisabledCards(boss:R2BossPlan|null,index:number,cards:readonly PlayingCard[],exempt=false):string[] {
  return boss&&!(exempt&&boss.definitionId==='B03')?r2DisabledCards(boss,index,cards):[];
}
export function bossSuitRescueAvailability(run:R2RunState):{available:boolean;reason:string} {
  if(!usesBossSuitRescue(run))return {available:false,reason:'旧规则对局不提供应急解封；新开一局可用'};
  const s=run.stage,r=s?.bossSuitRescue;
  if(!s||!bossSuitRescueQualified(s.boss,r))return {available:false,reason:'仅入场整副都被单色灯封住时可用'};
  if(r!.status!=='unbought')return {available:false,reason:r!.status==='pending'?'待下次出牌 · 本手解封':'本场已用'};
  if(run.phase!=='await-input'||s.handsLeft<=0)return {available:false,reason:'当前不能购买'};
  if(s.touyeWager?.resolution==='pending')return {available:false,reason:'先完成已押注的出牌'};
  return {available:run.gold>=5,reason:run.gold>=5?'5金 · 下一次出牌解封':'金币不足 · 需要5金'};
}
