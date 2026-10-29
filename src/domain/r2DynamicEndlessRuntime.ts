import type {Command,DomainEvent,Receipt} from './run';
import type {R2RunState} from './r2Run';
import {r2BossPlanValid,r2StageSpec,type R2BossPlan} from './r2Chapter';
import {dynamicEndlessAdvanceAnchor,dynamicEndlessInitialAnchor,dynamicEndlessStageTarget} from './r2DynamicEndless';
import {captureDynamicScore} from './r2DynamicEndlessCapture';
import {dynamicReceiptOutcome,dynamicReceiptParts,verifyDynamicClearChain,verifyDynamicHandEvidence,type DynamicHandEvidence,type DynamicStageSample,type DynamicEvidenceReceipt} from './r2DynamicEndlessEvidence';
import {isR2BoundedClear,isR2CoreBuild,isR2DynamicEndless} from './r2GroupUpgrade';
import {stableHash} from './hash';

export interface DynamicDeckSnapshot {live:number;disabled:number}
export interface DynamicStageRecord {index:number;target:string;boss:R2BossPlan;deck:DynamicDeckSnapshot;lock:Command;anchorBefore:string;previousBefore:DynamicStageSample|null;sample:DynamicStageSample|null;skip:Command|null;anchorAfter:string|null;previousAfter:DynamicStageSample|null}
export interface DynamicEndlessRuntime {
 version:'dynamic-endless-v1';origin:'start'|'choice';activation:Command;fromStage:number;
 status:'armed'|'pending'|'active';anchor:string|null;bootstrap:DynamicStageSample|null;previousNormal:DynamicStageSample|null;
 hands:DynamicHandEvidence[];frontier:DynamicStageRecord|null;records:DynamicStageRecord[];
}
const base=(s:R2RunState,index:number)=>{const spec=r2StageSpec(index,'endless',s.difficulty,isR2BoundedClear(s),isR2CoreBuild(s));if(!spec)throw Error('numeric-length-limit');return spec.targetHeat;};
const allDisabled=(r:Pick<DynamicStageRecord,'boss'|'deck'>)=>r.boss.definitionId==='B03'&&r.deck.live>0&&r.deck.live===r.deck.disabled;
const lockHash=(r:DynamicStageRecord)=>stableHash({index:r.index,target:r.target,boss:r.boss,deck:r.deck,lock:r.lock,anchorBefore:r.anchorBefore});
export function dynamicTarget(state:{dynamicEndless?:DynamicEndlessRuntime},index:number):string|undefined {
 return state.dynamicEndless?.status==='active'?state.dynamicEndless.records.find(r=>r.index===index)?.target:undefined;
}
/** Reconstruct the complete dynamic anchor from ordered receipt-bound clear inputs. */
export function assertDynamicEndless(state:R2RunState):void {
 const p=state.dynamicEndless,isNew=isR2DynamicEndless(state),check=(v:unknown)=>{if(!v)throw Error('invalid-dynamic-endless');};
 if(!p){check(!isNew||state.mode!=='standard');return;}
 check(p.version==='dynamic-endless-v1'&&['start','choice'].includes(p.origin)&&['armed','pending','active'].includes(p.status)&&Number.isSafeInteger(p.fromStage)&&p.fromStage>=24&&p.fromStage%3===0&&Array.isArray(p.hands)&&p.hands.length<=7&&Array.isArray(p.records)&&p.records.length<=4);
 const receipts=state.receipts as DynamicEvidenceReceipt[],byId=new Map(receipts.map(r=>[r.commandId,r]));
 const activation=p.activation,activationReceipt=activation&&byId.get(activation.commandId);check(!!activation&&activation.runId===state.runId&&activation.action?.type===(p.origin==='start'?'StartRun':'ActivateDynamicEndless')&&activationReceipt?.seq===activation.expectedSeq+1&&activationReceipt.fingerprint===stableHash(activation));
 check(p.origin==='start'?isNew&&p.fromStage===24:!isNew&&state.mode==='standard');
 if(activation.action.type==='ActivateDynamicEndless')check(Number.isSafeInteger(activation.action.stageIndex)&&p.fromStage===(Math.floor(activation.action.stageIndex/3)+1)*3);
 const validSample=(sample:DynamicStageSample)=>!!sample&&verifyDynamicClearChain(sample.clear,sample.hands,sample.hands.map(h=>byId.get(h.command.commandId)).filter((r):r is DynamicEvidenceReceipt=>!!r),state.runId);
 if(p.bootstrap){check(p.origin==='start'&&p.bootstrap.clear.stageIndex===23&&validSample(p.bootstrap));}
 if(p.status!=='active'){check(p.anchor===null&&p.previousNormal===null&&p.frontier===null&&p.records.length===0&&(p.status==='armed'?p.origin==='start'&&state.tourMode==='normal':p.origin==='choice'&&state.tourMode==='endless'&&state.stageIndex<=p.fromStage));}
 else {
  check(state.tourMode==='endless'&&typeof p.anchor==='string'&&p.records.length>0);
  let anchor=dynamicEndlessInitialAnchor(base(state,p.fromStage),p.bootstrap?.clear.score),previous:DynamicStageSample|null=null,lastSeq=activation.expectedSeq,firstIndex=p.fromStage;
  const validLock=(r:DynamicStageRecord)=>{const c=r.lock,receipt=c&&byId.get(c.commandId),kind=p.origin==='start'&&r.index===p.fromStage?'ContinueEndless':'OpenShop';return Number.isSafeInteger(r.deck.live)&&r.deck.live>=0&&Number.isSafeInteger(r.deck.disabled)&&r.deck.disabled>=0&&r.deck.disabled<=r.deck.live&&(r.boss.definitionId==='B03'||r.deck.disabled===0)&&c?.runId===state.runId&&c.action?.type===kind&&receipt?.seq===c.expectedSeq+1&&receipt.fingerprint===stableHash(c)&&dynamicReceiptParts(receipt)[3]===lockHash(r);};
  if(p.frontier){const f=p.frontier;check(f.index>=p.fromStage&&f.anchorAfter!==null&&r2BossPlanValid(f.boss)&&validLock(f)&&f.boss.definitionId===state.seenBossIds[Math.floor(f.index/3)]&&f.target===dynamicEndlessStageTarget(f.index,state.difficulty,f.anchorBefore,f.boss,allDisabled(f),base(state,f.index))&&!!(f.sample||f.skip)&&!(f.sample&&f.skip));
   if(f.previousBefore)check(validSample(f.previousBefore)&&f.previousBefore.clear.stageIndex<f.index&&f.previousBefore.clear.stageIndex%3!==2);
   const source=f.sample?.clear.command??f.skip!,r=byId.get(source.commandId);check(source.runId===state.runId&&source.expectedSeq>f.lock.expectedSeq&&r?.seq===source.expectedSeq+1&&r.fingerprint===stableHash(source)&&dynamicReceiptParts(r)[2]===stableHash(f));
   if(f.sample){check(validSample(f.sample)&&f.sample.hands[0].command.expectedSeq>f.lock.expectedSeq&&f.sample.clear.stageIndex===f.index&&(f.boss.definitionId==='B14'?BigInt(f.sample.clear.target)>=BigInt(f.target):f.sample.clear.target===f.target));}
   else check(f.index%3!==2&&source.action.type==='SkipStage');
   const expected=f.sample&&f.index%3!==2?dynamicEndlessAdvanceAnchor(f.anchorBefore,base(state,f.index),f.sample.clear.score,f.previousBefore?.clear.score):f.anchorBefore;
   const expectedPrev=f.sample&&f.index%3!==2?f.sample:f.previousBefore;check(f.anchorAfter===expected&&stableHash(f.previousAfter)===stableHash(expectedPrev));
   anchor=f.anchorAfter!;previous=f.previousAfter;lastSeq=source.expectedSeq;firstIndex=f.index+1;
  }
  for(let i=0;i<p.records.length;i++){
   const row=p.records[i];check(row.index===firstIndex+i&&r2BossPlanValid(row.boss)&&validLock(row)&&row.boss.definitionId===state.seenBossIds[Math.floor(row.index/3)]&&row.lock.expectedSeq>lastSeq&&row.anchorBefore===anchor&&stableHash(row.previousBefore)===stableHash(previous)&&row.target===dynamicEndlessStageTarget(row.index,state.difficulty,anchor,row.boss,allDisabled(row),base(state,row.index))&&!(row.sample&&row.skip));
   if(row.sample){const c=row.sample.clear;check(validSample(row.sample)&&c.stageIndex===row.index&&(row.boss.definitionId==='B14'?BigInt(c.target)>=BigInt(row.target):c.target===row.target)&&row.sample.hands[0].command.expectedSeq>row.lock.expectedSeq&&c.command.expectedSeq>lastSeq);lastSeq=c.command.expectedSeq;
    if(row.index%3!==2){anchor=dynamicEndlessAdvanceAnchor(anchor,base(state,row.index),c.score,previous?.clear.score);previous=row.sample;}
   }else if(row.skip){const c=row.skip,r=byId.get(c.commandId);check(row.index%3!==2&&c.runId===state.runId&&c.action?.type==='SkipStage'&&c.expectedSeq>row.lock.expectedSeq&&c.expectedSeq>lastSeq&&r?.seq===c.expectedSeq+1&&r.fingerprint===stableHash(c));lastSeq=c.expectedSeq;}
   else check(i===p.records.length-1);
   if(row.sample||row.skip){const source=row.sample?.clear.command??row.skip!,r=byId.get(source.commandId);check(row.anchorAfter===anchor&&stableHash(row.previousAfter)===stableHash(previous)&&dynamicReceiptParts(r)[2]===stableHash(row));}
   else check(row.anchorAfter===null&&row.previousAfter===null);
  }
  check(p.anchor===anchor&&stableHash(p.previousNormal)===stableHash(previous));
  const last=p.records.at(-1)!;check(last.sample||last.skip?state.stageIndex===last.index+1:state.stageIndex===last.index);
  if(state.chapter===Math.floor(last.index/3)+1)check(stableHash(last.boss)===stableHash(state.boss));
 }
 let heat='0',seq=-1;
 for(const h of p.hands){check(verifyDynamicHandEvidence(h,byId.get(h.command.commandId),state.runId)&&h.before===heat&&h.command.expectedSeq>seq&&h.stageIndex===state.stage?.index);heat=h.after;seq=h.command.expectedSeq;}
 if(p.hands.length)check(state.stage?.heat===heat&&state.stage.clearId===null);
 const stage=state.stage,record=stage&&[...p.records,...(p.frontier?[p.frontier]:[])].find(row=>row.index===stage.index),sample=record?.sample??(p.bootstrap?.clear.stageIndex===stage?.index?p.bootstrap:null);
 if(stage&&(record||sample||p.status==='armed'&&stage.index===23)){
  const hands=sample?.hands??p.hands;check(hands.length===stage.playIndex);
  if(hands.length){const last=hands.at(-1)!;check(last.after===stage.heat&&state.lastTrace?.rootId===last.rootId&&state.lastTrace.finalScore===last.score);if(record)check(hands[0].command.expectedSeq>record.lock.expectedSeq);}
 }
}
/** Called in the transaction wrapper, after command sequence advances and before publication. */
export function applyDynamicEndless(before:R2RunState|null,after:R2RunState,command:Command,events:readonly DomainEvent[],receipt:Receipt):DynamicEvidenceReceipt {
 if(command.action.type==='StartRun'&&isR2DynamicEndless(after)&&after.mode==='standard')after.dynamicEndless={version:'dynamic-endless-v1',origin:'start',activation:structuredClone(command),fromStage:24,status:'armed',anchor:null,bootstrap:null,previousNormal:null,hands:[],frontier:null,records:[]};
 const p=after.dynamicEndless;if(!p)return receipt;
 if(command.action.type==='ActivateDynamicEndless'){
  if(p.status!=='pending')throw Error('invalid-dynamic-activation');
 }
 let stamped:DynamicEvidenceReceipt=receipt;
 const collecting=before?.stage&&(p.status==='active'||p.origin==='start'&&p.status==='armed'&&before.stage.index===23);
 if(before&&collecting&&(command.action.type==='PlayHand'||command.action.type==='PlayAssistedHand')){
  const captured=captureDynamicScore(before,after,command,events,receipt)!;stamped=captured.receipt;p.hands.push(captured.hand);
  if(captured.clear){const sample={clear:captured.clear,hands:p.hands};p.hands=[];
   if(p.status==='armed')p.bootstrap=sample;
   else {const row=p.records.at(-1);if(!row||row.index!==captured.clear.stageIndex||row.sample||row.skip)throw Error('invalid-dynamic-clear');row.sample=sample;
    if(row.index%3!==2){p.anchor=dynamicEndlessAdvanceAnchor(p.anchor!,base(after,row.index),sample.clear.score,p.previousNormal?.clear.score);p.previousNormal=sample;}
    row.anchorAfter=p.anchor;row.previousAfter=p.previousNormal;const [handHash,clearHash]=dynamicReceiptParts(stamped);stamped={...stamped,endlessOutcome:dynamicReceiptOutcome(handHash,clearHash,stableHash(row))};
   }
  }
 }
 if(p.status==='active'&&command.action.type==='SkipStage'){
  const row=p.records.at(-1);if(!row||row.index!==before?.stageIndex||row.sample||row.skip)throw Error('invalid-dynamic-skip');row.skip=structuredClone(command);p.hands=[];row.anchorAfter=p.anchor;row.previousAfter=p.previousNormal;stamped={...stamped,endlessOutcome:dynamicReceiptOutcome('','',stableHash(row))};
 }
 if((command.action.type==='ContinueEndless'&&p.status==='armed')||(command.action.type==='OpenShop'&&p.status==='pending'&&after.stageIndex===p.fromStage)){
  p.status='active';p.anchor=dynamicEndlessInitialAnchor(base(after,after.stageIndex),p.bootstrap?.clear.score);p.previousNormal=null;
 }
 if(p.status==='active'&&['ContinueEndless','OpenShop'].includes(command.action.type)){
  const index=after.stageIndex;if(index<p.fromStage)throw Error('invalid-dynamic-index');
  if(p.records.some(row=>row.index===index))throw Error('duplicate-dynamic-lock');
  if(p.records.length===4){const frontier=p.records.shift()!;if(frontier.anchorAfter===null)throw Error('invalid-dynamic-frontier');p.frontier=frontier;}
  const live=after.deckInstances.filter(card=>!after.destroyedIds.includes(card.id)),deck={live:live.length,disabled:after.boss.definitionId==='B03'?live.filter(card=>card.suit===after.boss.disabledSuit).length:0};
  const row:DynamicStageRecord={index,target:dynamicEndlessStageTarget(index,after.difficulty,p.anchor!,after.boss,after.boss.definitionId==='B03'&&deck.live>0&&deck.live===deck.disabled,base(after,index)),boss:structuredClone(after.boss),deck,lock:structuredClone(command),anchorBefore:p.anchor!,previousBefore:p.previousNormal,sample:null,skip:null,anchorAfter:null,previousAfter:null};
  p.records.push(row);stamped={...stamped,endlessOutcome:dynamicReceiptOutcome('','','',lockHash(row))};
 }
 return stamped;
}
