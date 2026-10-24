import type {R2RunState} from '../domain/r2Run';
import {currentPokerOpportunity,pokerEncounterReason,usesPokerEncounter} from '../domain/r2PokerEncounter';
import type {PlayingCard} from '../cards/types';
export interface PokerEncounterView {
 readonly id:string;readonly status:'offered'|'purchased'|'skipped';readonly shopSeq:number;readonly price:18;readonly gold:number;
 readonly unavailable:string|undefined;readonly targets:readonly Readonly<PlayingCard>[];
 readonly receipt:Readonly<{id:string;targetId:string;paidPrice:18;goldBefore:number;goldAfter:number}>|null;
}
export type PokerEncounterVisualEvent=Readonly<{type:'EncounterEntered'|'SelectionChanged'|'PurchaseCommitted'|'GrantPresented'|'Skipped'|'Exited'|'Restored'|'ReducedMotion';id:string;opportunityId:string;view:PokerEncounterView;targetId?:string;reducedMotion?:boolean}>;
/** Public, immutable projection. It deliberately omits the future interval and RNG state. */
export function pokerEncounterView(s:R2RunState):PokerEncounterView|undefined {
 const o=currentPokerOpportunity(s);if(!usesPokerEncounter(s)||s.mode!=='standard'||s.tourMode!=='normal'||s.phase!=='shop'||!o||o.shopSeq!==s.shop?.basicChoice?.shopSeq||o.status==='pending')return;
 const a=o.decision?.action;
 const receipt=o.status==='purchased'&&a?.type==='BuyPokerPolychrome'?Object.freeze({id:o.decision!.commandId,targetId:a.targetId,paidPrice:18 as const,goldBefore:o.goldBefore!,goldAfter:o.goldBefore!-18}):null;
 const targets=Object.freeze(s.deckInstances.filter(c=>!s.destroyedIds.includes(c.id)).map(c=>Object.freeze({...c})));
 return Object.freeze({id:o.id,status:o.status,shopSeq:o.shopSeq!,price:18,gold:s.gold,unavailable:pokerEncounterReason(s),targets,receipt});
}
/** Presentation only: listeners never receive a dispatcher, mutable run, private draw order, or RNG. */
export function pokerEncounterVisualEvent(type:PokerEncounterVisualEvent['type'],view:PokerEncounterView,details:{targetId?:string;reducedMotion?:boolean}={}):PokerEncounterVisualEvent {
 return Object.freeze({type,id:`${view.receipt?.id??view.id}/view/${type}${details.targetId?'/'+details.targetId:''}`,opportunityId:view.id,view,...details});
}
