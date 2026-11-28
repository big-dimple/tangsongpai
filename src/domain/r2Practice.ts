import {R2_HAND_TYPES,type R2HandType} from './evaluateR2';
import {isR2CoreBuild,isR2TightBalance,R2_CORE_BUILD_CONTRACT} from './r2GroupUpgrade';
import {r2PurchasePrice} from './r2Shop';
import type {R2RunState} from './r2Run';

export function r2PracticeBasePriceFor(level:number,identity?:{contentVersion?:unknown;contentHash?:unknown}):number {
 if(!Number.isSafeInteger(level)||level<1||level>=R2_CORE_BUILD_CONTRACT.practice.maximumLevel)throw Error('invalid-practice-level');
 const p=R2_CORE_BUILD_CONTRACT.practice,step=identity&&isR2TightBalance(identity)?2:p.levelsPerStep;
 return p.basePrice+p.stepPrice*Math.floor((level-1)/step);
}
export function r2PracticeBasePrice(level:number):number {return r2PracticeBasePriceFor(level);}
export interface R2PracticeQuote {handType:R2HandType;levelBefore:number;levelAfter:number;basePrice:number;price:number;goldAfter:number;shopSeq:number;expectedSeq:number;available:boolean;reason:'not-enough-gold'|null}
/** Read-only rows; cancellation and inspection have no domain action. */
export function r2PracticeQuotes(state:R2RunState):R2PracticeQuote[] {
 if(!isR2CoreBuild(state)||state.phase!=='shop'||!state.shop?.basicChoice||state.shop.basicChoice.purchase)return [];
 return R2_HAND_TYPES.filter(type=>Object.hasOwn(state.handLevels,type)&&state.handLevels[type]!<R2_CORE_BUILD_CONTRACT.practice.maximumLevel).map(handType=>{
  const levelBefore=state.handLevels[handType]!,basePrice=r2PracticeBasePriceFor(levelBefore,state),price=r2PurchasePrice(state,{offerId:'',definitionId:'T01',price:basePrice,consumed:false});
  return {handType,levelBefore,levelAfter:levelBefore+1,basePrice,price,goldAfter:state.gold-price,shopSeq:state.shop!.basicChoice!.shopSeq,expectedSeq:state.commandSeq,available:state.gold>=price,reason:state.gold>=price?null:'not-enough-gold'};
 });
}
