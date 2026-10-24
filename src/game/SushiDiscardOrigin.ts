import type Phaser from 'phaser';
import type {ScoreTrace} from '../domain/scoreR2';
import type {EffectContext} from '../core/EffectQueue';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';

export interface SushiDiscardReceipt {
 readonly eventId:string;readonly discardedIds:readonly string[];readonly beforeScore:string;readonly afterScore:string;readonly multiplier:string;
}
/** Current saved schema adapter. Does not choose a discard count, derive the cost from held cards or calculate any multiplier. */
export function savedSushiDiscardReceipt(trace:ScoreTrace,eventId:string):SushiDiscardReceipt|undefined {
 const saved=trace.amoExile,event=trace.events.find(e=>e.eventId===eventId&&e.sourceType==='character'&&e.sourceDefinitionId==='amo'&&e.reasonKey==='amo.exile');
 if(!event||!saved?.use||!saved.discardedIds.length||saved.beforeScore===null||saved.afterScore===null)return;
 const ids=[...saved.discardedIds],partition=trace.sets.discardedIds??[];if(new Set(ids).size!==ids.length||ids.some(id=>!partition.includes(id)||trace.sets.playedIds.includes(id)))return;
 return Object.freeze({eventId,discardedIds:Object.freeze(ids),beforeScore:saved.beforeScore,afterScore:saved.afterScore,multiplier:event.value.d==='1'?event.value.n:event.value.n+'/'+event.value.d});
}
export interface DiscardOriginPose {readonly id:string;readonly box:InkBox}
interface CommonFrame {
 readonly poses:readonly DiscardOriginPose[];readonly protectedPrint:readonly InkBox[];readonly progress:number;readonly reducedMotion:boolean;
}
export type SushiDiscardOriginFrame=(CommonFrame&{phase:'mark-cost';selectedDiscardIds:readonly string[];signal:AbortSignal})|(CommonFrame&{
 phase:'dissolve'|'transfer'|'arrive';receipt:SushiDiscardReceipt;eventId:string;context:EffectContext;sink:InkPoint;
});
export const SUSHI_DISCARD_VISUAL_BUDGET={visibleOrigins:8,fragmentsPerOrigin:4,maxFragments:32} as const;
const overlaps=(b:InkBox,boxes:readonly InkBox[])=>boxes.some(a=>b.x<a.x+a.width+1&&b.x+b.width>a.x-1&&b.y<a.y+a.height+1&&b.y+b.height>a.y-1);
export function drawSushiFragment(g:Phaser.GameObjects.Graphics,p:InkPoint,size:number,alpha:number,boxes:readonly InkBox[]):boolean {
 if(overlaps({x:p.x-size*1.5,y:p.y-size*2.8,width:size*3,height:size*4},boxes))return false;
 g.fillStyle(0x9e281d,.72*alpha).fillPoints([{x:p.x-size,y:p.y},{x:p.x-size*.3,y:p.y-size},{x:p.x+size*.3,y:p.y-size*2.7},{x:p.x+size,y:p.y+size*.3},{x:p.x,y:p.y+size}],true);
 g.fillStyle(0xf78a46,.88*alpha).fillEllipse(p.x,p.y,size*1.2,size*1.5);return true;
}

/** Unwired drawing primitive. Caller owns phases, progress, transaction acceptance, score arrival and cleanup. No timer, listener or queue is installed. */
export function drawSushiDiscardOrigin(g:Phaser.GameObjects.Graphics,frame:SushiDiscardOriginFrame){
 g.clear();const empty={sourceIds:[] as string[],fragments:0,eventId:undefined as string|undefined};
 const saved=frame.phase!=='mark-cost';if(saved?(frame.context.signal.aborted||frame.eventId!==frame.receipt.eventId):frame.signal.aborted)return empty;
 const ids=saved?frame.receipt.discardedIds:frame.selectedDiscardIds,allowed=new Set(ids),sources=frame.poses.filter(p=>allowed.has(p.id)).filter((p,i,all)=>all.findIndex(q=>q.id===p.id)===i).slice(0,SUSHI_DISCARD_VISUAL_BUDGET.visibleOrigins);
 if(!sources.length)return empty;
 const t=Math.max(0,Math.min(1,frame.progress)),sourceIds=sources.map(p=>p.id);let fragments=0;
 if(frame.reducedMotion){if(frame.phase==='mark-cost')for(const {box}of sources)drawSushiFragment(g,{x:box.x+box.width/2,y:box.y-8},2.8,1,frame.protectedPrint);return{sourceIds,fragments:0,eventId:saved?frame.receipt.eventId:undefined};}
 for(const [index,{box}]of sources.entries()){
  const start={x:box.x+box.width/2,y:box.y-7};
  if(frame.phase==='mark-cost'||frame.phase==='dissolve'){
   if(frame.phase==='dissolve'&&t===1)continue;for(let i=0;i<SUSHI_DISCARD_VISUAL_BUDGET.fragmentsPerOrigin;i++){const u=frame.phase==='mark-cost'?(t+i/4+index*.11)%1:t,p={x:start.x+Math.sin(i*1.7+u*5)*(6+u*9),y:start.y-u*34},alpha=frame.phase==='dissolve'?1-t:.5+.5*(1-u);if(drawSushiFragment(g,p,3.5+(1-u)*2,alpha,frame.protectedPrint))fragments++;}
  }else if(frame.phase==='transfer'){
   const mid={x:(start.x+frame.sink.x)/2,y:Math.min(start.y,frame.sink.y)-36},curve=(u:number)=>({x:(1-u)**2*start.x+2*(1-u)*u*mid.x+u*u*frame.sink.x,y:(1-u)**2*start.y+2*(1-u)*u*mid.y+u*u*frame.sink.y}),points=Array.from({length:17},(_,i)=>curve(Math.max(0,t-.23)+Math.min(.23,t)*i/16));
   for(const run of clearInkRuns(points,frame.protectedPrint,3)){g.lineStyle(3.4,0xc94b2a,.8).beginPath();run.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();}if(drawSushiFragment(g,curve(t),4,1,frame.protectedPrint))fragments++;
  }
 }
 if(frame.phase==='arrive')for(let i=0;i<8;i++){const a=i*Math.PI/4,r=8+t*16;if(drawSushiFragment(g,{x:frame.sink.x+Math.cos(a)*r,y:frame.sink.y+Math.sin(a)*r},3,1-t,frame.protectedPrint))fragments++;}
 return{sourceIds,fragments,eventId:saved?frame.receipt.eventId:undefined};
}
