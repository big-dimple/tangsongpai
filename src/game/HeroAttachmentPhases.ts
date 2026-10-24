import type {EffectContext} from '../core/EffectQueue';
import type {AttachmentMotion} from './HeroTargetAttachmentState';

export type HeroAttachmentPhase='committed'|'source'|'attached'|'impact'|'settled'|'suspended'|'resumed'|'cancelled';
export interface HeroAttachmentBinding {
 readonly owner:'card'|'discard'|'retained-impact';readonly activationId:string;readonly eventId?:string;readonly reasonKey:string;
 readonly targetIds:readonly string[];readonly sourceTargetIds:readonly string[];readonly motion:AttachmentMotion;readonly context?:EffectContext;
}
export interface HeroAttachmentPhaseEvent extends HeroAttachmentBinding {readonly phase:HeroAttachmentPhase;readonly cause?:string}
export type HeroAttachmentPhaseObserver=(event:HeroAttachmentPhaseEvent)=>void;
/** Synchronous optional observations of existing owners, never an event bus, timer, score or audio scheduler. */
export class HeroAttachmentPhases {
 private binding?:HeroAttachmentBinding;private sent=new Set<HeroAttachmentPhase>();private suspended=false;private unbind?:()=>void;
 constructor(private readonly observer?:HeroAttachmentPhaseObserver){}
 isCurrent(activationId:string):boolean {return !this.observer||this.binding?.activationId===activationId;}
 bind(binding:HeroAttachmentBinding):void {
  if(!this.observer||binding.context?.signal.aborted)return;
  if(this.binding?.activationId!==binding.activationId)this.end('replaced');
  const prior=this.binding?.context?.signal;this.binding={...binding,targetIds:Object.freeze([...binding.targetIds]),sourceTargetIds:Object.freeze([...binding.sourceTargetIds])};
  if(prior!==binding.context?.signal){this.unbind?.();const signal=binding.context?.signal,cancel=()=>this.end('aborted');signal?.addEventListener('abort',cancel,{once:true});this.unbind=()=>signal?.removeEventListener('abort',cancel);}
 }
 publish(phase:HeroAttachmentPhase,cause?:string):void {
  if(!this.binding||this.sent.has(phase))return;this.sent.add(phase);this.notify(phase,cause);
 }
 private notify(phase:HeroAttachmentPhase,cause?:string):void {if(this.binding)this.observer?.(Object.freeze({...this.binding,phase,...(cause?{cause}:{})}));}
 suspend(cause:string):void {if(this.binding&&!this.suspended){this.suspended=true;this.notify('suspended',cause);}}
 resume():void {if(this.binding&&this.suspended){this.suspended=false;this.notify('resumed');}}
 setMotion(motion:AttachmentMotion):void {if(this.binding)this.binding={...this.binding,motion};if(motion==='full')this.resume();else this.suspend('motion');}
 setReason(reasonKey:string|undefined):void {if(this.binding&&reasonKey)this.binding={...this.binding,reasonKey};}
 end(cause='cleared'):void {if(this.binding&&!this.sent.has('settled'))this.publish('cancelled',cause);this.unbind?.();this.unbind=undefined;this.binding=undefined;this.sent.clear();this.suspended=false;}
}
