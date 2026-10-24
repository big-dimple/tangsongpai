import {SeededRng,type RngSnapshot} from '../core/SeededRng';
import {stableHash} from './hash';
import {r2HouseProfile} from './r2GroupUpgrade';
import type {Command,DomainEvent} from './run';
import type {R2RunState} from './r2Run';
import {POKER_ENCOUNTER_PRICE} from './r2PokerEncounterIdentity';
export {POKER_ENCOUNTER_PRICE,withPokerEncounterIdentity} from './r2PokerEncounterIdentity';
export const usesPokerEncounter=(s:{contentVersion?:unknown;contentHash?:unknown})=>!!r2HouseProfile(s)?.pokerBase;
export interface PokerOpportunity {
  id:string;clearAt:number;stageIndex:number;source:Command;
  shopSeq:number|null;status:'pending'|'offered'|'purchased'|'skipped';
  decision:Command|null;goldBefore:number|null;
}
export interface PokerEncounter {nextAt:number;rng:RngSnapshot;opportunities:PokerOpportunity[]}
const stream=(seed:string)=>new SeededRng(`${seed}/r2/poker-encounter/0`);
export function freshPokerEncounter(seed:string):PokerEncounter {const rng=stream(seed);return {nextAt:rng.integer(7,9),rng:rng.snapshot(),opportunities:[]};}
const enabled=(s:R2RunState)=>usesPokerEncounter(s)&&s.mode==='standard'&&s.tourMode==='normal';
export const currentPokerOpportunity=(s:R2RunState)=>s.pokerEncounter?.opportunities.at(-1);
export function pokerEncounterOnClear(s:R2RunState,command:Command,events:DomainEvent[]):void {
  if(!enabled(s)||s.stageIndex>=23)return;
  const p=s.pokerEncounter!,count=s.routeGrowth!.settlements.filter(x=>x.stageIndex<23).length;
  if(count!==p.nextAt)return;
  const o:PokerOpportunity={id:`${s.runId}/poker-encounter/${count}/${s.stageIndex}`,clearAt:count,stageIndex:s.stageIndex,source:structuredClone(command),shopSeq:null,status:'pending',decision:null,goldBefore:null};
  p.opportunities.push(o);const rng=SeededRng.restore(p.rng);p.nextAt+=rng.integer(7,9);p.rng=rng.snapshot();
  events.push({type:'poker-encounter',kind:'appeared',opportunityId:o.id});
}
export function pokerEncounterOpenShop(s:R2RunState):void {const o=currentPokerOpportunity(s);if(enabled(s)&&o?.status==='pending'){o.status='offered';o.shopSeq=s.commandSeq+1;}}
export function pokerEncounterClose(s:R2RunState,command:Command,events:DomainEvent[]):void {
 const o=currentPokerOpportunity(s);if(!usesPokerEncounter(s)||!o||!['offered','pending'].includes(o.status))return;
 o.status='skipped';o.decision=structuredClone(command);events.push({type:'poker-encounter',kind:'skipped',opportunityId:o.id});
}
function pokerEncounterIssue(s:R2RunState,targetId?:string):{code:string;text:string}|undefined {
 const o=currentPokerOpportunity(s);
 if(!enabled(s)||s.phase!=='shop'||!s.shop||o?.status!=='offered'||o.shopSeq!==s.shop.basicChoice?.shopSeq)return {code:'poker-encounter-unavailable',text:'本店没有可用奇遇'};
 if(s.shop.basicChoice.purchase)return {code:'basic-choice-consumed',text:'本店培养／改牌机会已用'};
 if(targetId!==undefined){const c=s.deckInstances.find(c=>c.id===targetId&&!s.destroyedIds.includes(c.id));if(!c)return {code:'poker-target-unavailable',text:'请选择一张仍在牌组里的扑克'};if((c.edition??'none')!=='none')return {code:'poker-ordinary-only',text:'已有版次的扑克不能再次赋予'};}
 if(!s.deckInstances.some(c=>!s.destroyedIds.includes(c.id)&&(c.edition??'none')==='none'))return {code:'poker-target-unavailable',text:'没有普通版扑克可选'};
 if(s.gold<POKER_ENCOUNTER_PRICE)return {code:'not-enough-gold',text:'金币不足 · 需要18金'};
 return;
}
export const pokerEncounterReason=(s:R2RunState,targetId?:string)=>pokerEncounterIssue(s,targetId)?.text;
export function buyPokerEncounter(s:R2RunState,command:Command,events:DomainEvent[]):string|undefined {
 const a=command.action;if(a.type!=='BuyPokerPolychrome')return 'invalid-command';
 const issue=pokerEncounterIssue(s,a.targetId);if(issue)return issue.code;
 const o=currentPokerOpportunity(s)!;if(a.opportunityId!==o.id||a.shopSeq!==o.shopSeq)return 'stale-shop';
 const card=s.deckInstances.find(c=>c.id===a.targetId)!;o.goldBefore=s.gold;s.gold-=POKER_ENCOUNTER_PRICE;card.edition='polychrome';
 s.shop!.purchases++;s.shop!.basicChoice!.purchase={definitionId:'poker-polychrome',commandId:command.commandId,seq:s.commandSeq+1,paidPrice:POKER_ENCOUNTER_PRICE};
 o.status='purchased';o.decision=structuredClone(command);events.push({type:'poker-encounter',kind:'purchased',opportunityId:o.id});
}
const exact=(v:unknown,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const natural=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
function receipt(s:R2RunState,c:Command):boolean {return exact(c,['runId','commandId','expectedSeq','action'])&&c.runId===s.runId&&typeof c.commandId==='string'&&!!c.commandId&&natural(c.expectedSeq)&&s.receipts.some(r=>r.commandId===c.commandId&&r.seq===c.expectedSeq+1&&r.fingerprint===stableHash(c));}
const purchaseCache=new Map<string,string|null>();
/** Find a purchase even if a corrupted save erased its presentation status or its bounded journal. */
export function pokerPurchaseReceipt(s:R2RunState,o:PokerOpportunity):{commandId:string;seq:number;targetId:string}|undefined {
 if(o.shopSeq===null)return;
 const ids=s.deckInstances.map(c=>c.id),idsKey=stableHash(ids);
 for(const r of s.receipts){if(r.seq<=o.shopSeq)continue;const key=JSON.stringify([s.runId,o.id,o.shopSeq,r.commandId,r.seq,r.fingerprint,idsKey]);let target=purchaseCache.get(key);
  if(target===undefined){target=ids.find(targetId=>r.fingerprint===stableHash({runId:s.runId,commandId:r.commandId,expectedSeq:r.seq-1,action:{type:'BuyPokerPolychrome',opportunityId:o.id,shopSeq:o.shopSeq!,targetId}}))??null;if(purchaseCache.size>=2048)purchaseCache.clear();purchaseCache.set(key,target);}
  if(target!==null)return {commandId:r.commandId,seq:r.seq,targetId:target};
 }
}
export function assertPokerEncounter(s:R2RunState):void {
 const check=(ok:unknown)=>{if(!ok)throw Error('invalid-poker-encounter');};
 if(!usesPokerEncounter(s)){check(!Object.hasOwn(s,'pokerEncounter'));return;}
 const p=s.pokerEncounter;check(exact(p,['nextAt','rng','opportunities'])&&Array.isArray(p!.opportunities)&&p!.opportunities.length<=3);if(!p)return;
 const stages=s.mode==='standard'?s.routeGrowth!.settlements.filter(x=>x.stageIndex<23):[];
 const rng=stream(s.seed);let due=rng.integer(7,9),index=0;
 while(due<=stages.length){const o=p.opportunities[index++];check(o&&exact(o,['id','clearAt','stageIndex','source','shopSeq','status','decision','goldBefore']));if(!o)return;
  check(o.clearAt===due&&o.stageIndex===stages[due-1].stageIndex&&o.id===`${s.runId}/poker-encounter/${due}/${o.stageIndex}`&&receipt(s,o.source)&&['PlayHand','PlayAssistedHand'].includes(o.source.action.type));
  if(s.stage?.index===o.stageIndex)check(s.stage.clearId===`${s.runId}/clear/${o.stageIndex}`&&stableHash(s.stage.routeGrowth?.sources.at(-1)?.command)===stableHash(o.source));
  if(o.shopSeq!==null)check(natural(o.shopSeq)&&o.shopSeq>o.source.expectedSeq+1&&s.receipts.some(r=>r.seq===o.shopSeq&&r.fingerprint===stableHash({runId:s.runId,commandId:r.commandId,expectedSeq:r.seq-1,action:{type:'OpenShop'}})));
  const bought=pokerPurchaseReceipt(s,o);
  if(o.status==='pending'||o.status==='offered'){
   check(!o.decision&&o.goldBefore===null&&!bought&&index===p.opportunities.length&&s.stageIndex===o.stageIndex+1);
   check(o.status==='pending'?o.shopSeq===null&&s.phase==='stage-cleared':s.phase==='shop'&&o.shopSeq===s.shop?.basicChoice?.shopSeq);
  }else{
   check(o.decision&&receipt(s,o.decision)&&o.decision.expectedSeq>o.source.expectedSeq);if(!o.decision)return;
   const a=o.decision.action;
   if(o.status==='purchased')check(a.type==='BuyPokerPolychrome'&&a.opportunityId===o.id&&a.shopSeq===o.shopSeq&&natural(o.goldBefore)&&o.goldBefore>=18&&bought?.commandId===o.decision.commandId&&bought.targetId===a.targetId);
   else check(o.status==='skipped'&&o.goldBefore===null&&!bought&&(a.type==='LeaveShop'||a.type==='SkipStage'||a.type==='AbandonRun'||a.type==='SkipPokerEncounter'&&a.opportunityId===o.id&&a.shopSeq===o.shopSeq));
  }
  due+=rng.integer(7,9);
 }
 check(index===p.opportunities.length&&p.nextAt===due&&exact(p.rng,['algorithm','state'])&&stableHash(p.rng)===stableHash(rng.snapshot()));
}
