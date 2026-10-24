import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreTrace} from '../domain/scoreR2';
import type {ScoreAnimate} from './ScorePosture';
import {savedSushiDiscardReceipt} from './SushiDiscardOrigin';
import {discardMotion} from './DiscardMotion';

interface DiscardFace {id:string;container:Phaser.GameObjects.Container;remove:()=>void}
/** The saved rule has already discarded these IDs. Keep the genuine faces alive
 * until this event arrives, then use the ordinary discard gesture. */
export async function playSushiDiscardExit(trace:ScoreTrace,eventId:string,faces:readonly DiscardFace[],context:EffectContext,arrival:Promise<void>,bottom:number,reduced:boolean,animate:ScoreAnimate):Promise<void> {
 const receipt=savedSushiDiscardReceipt(trace,eventId);if(!receipt)return;
 const rows=receipt.discardedIds.flatMap(id=>faces.filter(f=>f.id===id&&f.container.active));
 if(!rows.length)return;
 let cancel!:()=>void;const cancelled=new Promise<void>(resolve=>cancel=resolve);context.signal.addEventListener('abort',cancel,{once:true});
 try {
  if(context.signal.aborted)return;await Promise.race([arrival,cancelled]);if(context.signal.aborted)return;
  await Promise.all(rows.map((face,i)=>face.container.active?animate(discardMotion(face.container,i,bottom,reduced),context):Promise.resolve()));
 } finally {context.signal.removeEventListener('abort',cancel);for(const face of rows)face.remove();}
}
