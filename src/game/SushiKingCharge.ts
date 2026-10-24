import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreTrace} from '../domain/scoreR2';
import type {ScoreBeat} from './scorePresentation';
import {savedSushiDiscardReceipt} from './SushiDiscardOrigin';
import {SushiKingEnergy,SUSHI_KING_ENERGY_BUDGET,consumePreparedSushiKing} from './SushiKingEnergy';

interface KingFace {id:string;container:Phaser.GameObjects.Container;width:number;height:number}
const owners=new WeakMap<Phaser.GameObjects.Container,()=>void>();
/** Only real saved cost kings react. This samples the shared score tween and
 * contracts the exposed-paper ink dashes before the existing genuine-face fracture. */
export function bindSushiKingCharge(scene:Phaser.Scene,trace:ScoreTrace,eventId:string,cards:readonly KingFace[],options:{context:EffectContext;beat:ScoreBeat}){
 const receipt=savedSushiDiscardReceipt(trace,eventId);if(!receipt||options.context.signal.aborted)return;
 const ids=trace.cards.filter(c=>c.rank===13&&receipt.discardedIds.includes(c.id)).map(c=>c.id).slice(0,SUSHI_KING_ENERGY_BUDGET.targets),selected=ids.flatMap(id=>cards.filter(c=>c.id===id&&c.container.active).slice(0,1));
 const masks=new Map(selected.map(card=>{owners.get(card.container)?.();return [card.container,consumePreparedSushiKing(card.container)] as const;}));
 const rows=selected.map(card=>({card,x:card.container.x,y:card.container.y,sx:card.container.scaleX,sy:card.container.scaleY,angle:card.container.angle,energy:new SushiKingEnergy(),ink:scene.add.graphics().setName('hero/sushi-king-charge').setData('eventId',eventId).setData('targetId',card.id)}));
 if(!rows.length)return;
 for(const row of rows)row.card.container.add(row.ink);
 let disposed=false,released=false;
 const reset=()=>{for(const r of rows)if(r.card.container.active)r.card.container.setPosition(r.x,r.y).setScale(r.sx,r.sy).setAngle(r.angle);};
 const release=()=>{if(disposed||released)return;released=true;reset();for(const row of rows)row.ink.destroy();};
 const hidden=()=>{if(document.hidden)dispose();};
 const dispose=()=>{if(disposed)return;if(!released)reset();disposed=true;options.context.signal.removeEventListener('abort',dispose);scene.events.off('shutdown',dispose);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);if(typeof window!=='undefined')window.removeEventListener('blur',dispose);for(const r of rows){if(owners.get(r.card.container)===dispose)owners.delete(r.card.container);r.card.container.off('destroy',dispose);r.ink.destroy();}};
 options.context.signal.addEventListener('abort',dispose,{once:true});scene.events.once('shutdown',dispose);if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);if(typeof window!=='undefined')window.addEventListener('blur',dispose);for(const r of rows){owners.set(r.card.container,dispose);r.card.container.once('destroy',dispose);}
 const step=(elapsed:number)=>{if(disposed||released||options.context.signal.aborted)return;const {windup}=options.beat,fractureAt=windup*.62;if(elapsed>=fractureAt){release();return;}const p=Math.min(1,elapsed/Math.max(1,fractureAt)),out=Math.max(0,(p-.55)/.45),u=(1-(1-p)**3)*(1-out);
  for(const [i,r]of rows.entries()){if(!r.card.container.active)continue;const {width:w,height:h}=r.card;r.card.container.setY(r.y+5*u).setScale(r.sx*(1+.04*u),r.sy*(1-.045*u)).setAngle(r.angle+(i%2?-1:1)*3*u);r.ink.clear().lineStyle(1.5+u,0x225b70,.5+.5*u).strokeRoundedRect(-w/2-2,-h/2-2,w+4,h+4,5).setData('phase',out>0?'release':'windup').setData('progress',p);r.energy.draw(r.ink,w,h,elapsed,false,out,masks.get(r.card.container));}
 };
 step(0);
 return {step,release,dispose,ids};
}
