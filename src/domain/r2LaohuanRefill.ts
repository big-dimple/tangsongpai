import {isR2LaohuanRefill,isR2HeroFrequency} from './r2GroupUpgrade';
export interface PendingRefill {discardCommandId:string;candidateIds:string[];required:number;gap:number}
export function usesLaohuanRefill(s:{characterId?:unknown;contentVersion?:unknown;contentHash?:unknown}):boolean{return s.characterId==='laohuan'&&isR2LaohuanRefill(s);}

export const laohuanRefillRepeats=(s:{characterId?:unknown;contentVersion?:unknown;contentHash?:unknown})=>s.characterId==='laohuan'&&isR2HeroFrequency(s);
export const laohuanRefillUsed=(s:{characterId?:unknown;contentVersion?:unknown;contentHash?:unknown;stage?:{laohuanTrickUsed?:boolean}|null})=>!laohuanRefillRepeats(s)&&s.stage?.laohuanTrickUsed===true;
