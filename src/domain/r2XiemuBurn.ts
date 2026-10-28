import {isR2XiemuBurn,isR2XiemuBalance,R2_XIEMU_BALANCE_TIERS,isR2XiemuFrequent,R2_XIEMU_FREQUENT_TIERS,isR2XiemuRevision,R2_XIEMU_REVISION_TIERS} from './r2GroupUpgrade';
import {AMO_ASSIST_TYPES} from './r2QualifiedHands';
import type {R2HandType} from './evaluateR2';
export type XiemuBurnCost=0|2|3|4|5|6|8|10|20|30;
export interface XiemuBurnIntent {cost:XiemuBurnCost;goldBefore:number;beforeUsed:boolean}
export interface XiemuBurnTrace extends XiemuBurnIntent {goldAfter:number;afterUsed:boolean;multiplier:1.5|2|3|4|null}
export function usesXiemuBurn(s:{characterId?:unknown;contentVersion?:unknown;contentHash?:unknown}):boolean{return s.characterId==='xiemu'&&isR2XiemuBurn(s);}
export const xiemuInterest=(gold:number)=>Math.min(2,Math.floor(gold/5));
export const xiemuBurnTiers=(balanced=false,frequent=false,revised=false)=>revised?R2_XIEMU_REVISION_TIERS:frequent?R2_XIEMU_FREQUENT_TIERS:balanced?R2_XIEMU_BALANCE_TIERS:([{cost:10,multiplier:2},{cost:20,multiplier:3},{cost:30,multiplier:4}] as const);
export const xiemuTiersFor=(s:{contentVersion?:unknown;contentHash?:unknown})=>xiemuBurnTiers(isR2XiemuBalance(s),isR2XiemuFrequent(s),isR2XiemuRevision(s));
export function xiemuBurnStep(type:R2HandType,intent:XiemuBurnIntent,enabled:boolean,balanced=false,frequent=false,revised=false):XiemuBurnTrace {
 const tier=xiemuBurnTiers(balanced,frequent,revised).find(t=>t.cost===intent.cost);
 if(intent.cost!==0&&!tier||!Number.isSafeInteger(intent.goldBefore)||intent.goldBefore<0||typeof intent.beforeUsed!=='boolean')throw Error('invalid-xiemu-burn');
 if(intent.cost){if(!enabled)throw Error('xiemu-disabled');if(intent.beforeUsed)throw Error('xiemu-already-used');if(!AMO_ASSIST_TYPES.includes(type))throw Error('xiemu-unqualified');if(intent.goldBefore<intent.cost)throw Error('insufficient-gold');}
 return {...intent,goldAfter:intent.goldBefore-intent.cost,afterUsed:intent.beforeUsed||intent.cost>0,multiplier:tier?.multiplier??null};
}
