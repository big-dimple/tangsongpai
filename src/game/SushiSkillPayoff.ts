import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreTrace} from '../domain/scoreR2';
import type {ScoreBeat} from './scorePresentation';
import {savedSushiDiscardReceipt} from './SushiDiscardOrigin';
import {readableFractionText} from './scoreText';
import {UI_FONT,PAPER_CSS} from './theme';
import {textDensity} from './TextRaster';

export const SUSHI_PAYOFF_GOLD='#94651f';
interface CostCard {id:string;container:Phaser.GameObjects.Container}
interface Options {context:EffectContext;beat:ScoreBeat;reduced:boolean;root?:Phaser.GameObjects.Container;cards:readonly CostCard[];releaseKings?:()=>void;onDispose?:()=>void}
let ordinal=0;
/** Real saved cost kings shatter; ONE intact multiplier travels to the existing
 * skill control. Legacy no-K costs use a real discarded card as the origin,
 * without a fracture. Samples the score clock, with no rule or lasting buff. */
export function mountSushiSkillPayoff(scene:Phaser.Scene,button:Phaser.GameObjects.Rectangle|undefined,trace:ScoreTrace,eventId:string,options:Options){
 const receipt=savedSushiDiscardReceipt(trace,eventId),event=trace.events.find(e=>e.eventId===eventId),label=button?.getData('label') as Phaser.GameObjects.Text|undefined,status=button?.getData('skillStatus') as Phaser.GameObjects.Text|undefined;
 if(!receipt||!event||options.context.signal.aborted||!button?.active||!label?.active)return;
 const kingIds=receipt.discardedIds.filter(id=>trace.cards.some(c=>c.id===id&&c.rank===13)),kings=kingIds.flatMap(id=>options.cards.filter(c=>c.id===id&&c.container.active)),source=kings[0]??(!kingIds.length?receipt.discardedIds.flatMap(id=>options.cards.filter(c=>c.id===id&&c.container.active))[0]:undefined),sourceIds=kingIds.length?kingIds:source?[source.id]:[];
 const token={eventId,value:'本次得分 ×'+readableFractionText(event.value),arrived:false,sourceIds,originId:source?.id},rest={text:label.text,color:label.style.color,sx:label.scaleX,sy:label.scaleY,y:label.y,status:status?.text,statusColor:status?.style.color};
 let disposed=false,elapsed=0,landedAt:number|undefined,flight:Phaser.GameObjects.Container|undefined,packet:Phaser.GameObjects.Text|undefined,flare:Phaser.GameObjects.Graphics|undefined,origin:{x:number;y:number}|undefined,sacrificed=false;
 const textures:string[]=[],hiddenKings:{container:Phaser.GameObjects.Container;alpha:number}[]=[],pieces:{image:Phaser.GameObjects.Image;x:number;y:number;dx:number;dy:number;angle:number}[]=[];
 const fractureAt=options.beat.windup*.62,fractureEnd=options.beat.windup+options.beat.flight*.45;
 button.setData('sushiSkillPayoff',token);
 const local=(x:number,y:number)=>options.root!.getWorldTransformMatrix().applyInverse(x,y),destination=()=>{const b=label.getBounds();return local(b.centerX,b.centerY);};
 const finishAnimation=()=>{flight?.destroy();flight=undefined;packet=undefined;flare=undefined;pieces.length=0;for(const key of textures)scene.textures.remove(key);textures.length=0;};
 const refresh=()=>{if(disposed||!token.arrived||!button.active||!label.active||button.getData('sushiSkillPayoff')!==token)return;label.setText(token.value).setColor(SUSHI_PAYOFF_GOLD);status?.setText(rest.text+' · 已生效').setColor(SUSHI_PAYOFF_GOLD);const p=options.reduced||landedAt===undefined?0:Math.max(0,Math.min(1,(elapsed-landedAt)/Math.min(220,options.beat.impact))),bounce=options.reduced?0:Math.sin(Math.PI*p);label.setScale(rest.sx*(1+.1*bounce),rest.sy*(1+.1*bounce)).setY(rest.y-2*bounce);};
 const hidden=()=>{if(document.hidden)dispose();};
 const dispose=()=>{if(disposed)return;disposed=true;options.context.signal.removeEventListener('abort',dispose);scene.events.off('shutdown',dispose);button.off('destroy',dispose);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);finishAnimation();
  for(const row of hiddenKings)if(row.container.active){row.container.setAlpha(row.alpha);if(row.container.getData('sushiCostPaid')===eventId)row.container.setData('sushiCostPaid',undefined);}hiddenKings.length=0;
  if(button.getData('sushiSkillPayoff')===token){button.setData('sushiSkillPayoff',undefined);if(label.active)label.setText(rest.text).setColor(rest.color).setScale(rest.sx,rest.sy).setY(rest.y);if(status?.active)status.setText(rest.status??'').setColor(rest.statusColor??rest.color);}options.onDispose?.();
 };
 options.context.signal.addEventListener('abort',dispose,{once:true});scene.events.once('shutdown',dispose);button.once('destroy',dispose);if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
 if(!options.reduced&&options.root?.active&&source){flight=scene.add.container(0,0).setName('hero/sushi-skill-flight').setData('eventId',eventId).setData('originId',source.id).setData('sourceIds',sourceIds);options.root.add(flight);packet=scene.add.text(0,0,'×'+readableFractionText(event.value),{fontFamily:UI_FONT,fontSize:'24px',fontStyle:'bold',color:SUSHI_PAYOFF_GOLD,backgroundColor:PAPER_CSS.paperLight,padding:{x:2,y:0},resolution:textDensity(scene)}).setOrigin(.5).setName('hero/sushi-skill-packet').setVisible(false);flight.add(packet);}
 const sacrifice=()=>{if(sacrificed||!flight?.active)return;sacrificed=true;options.releaseKings?.();
  for(const {id,container}of kings){if(!container.active)continue;const width=Number(container.getData('width')),height=Number(container.getData('height'));if(!(width>0&&height>0))continue;
   const b=container.getBounds(),at=local(b.centerX,b.centerY),key='sushi-cost-king-'+(++ordinal),texture=scene.textures.addDynamicTexture(key,Math.ceil(width),Math.ceil(height));if(!texture)continue;
   textures.push(key);const sx=container.scaleX,sy=container.scaleY,angle=container.angle;try{container.setScale(1).setAngle(0);texture.draw(container,width/2,height/2);}finally{container.setScale(sx,sy).setAngle(angle);}
   // Crop the actual complete card face, including its K/suit/court art. Four
   // bounded pieces per cost king; main-hand K and other remainders are untouched.
   for(let row=0;row<2;row++)for(let col=0;col<2;col++){const ox=(col-.5)*width/2,oy=(row-.5)*height/2,image=scene.add.image(at.x+ox,at.y+oy,key).setOrigin(0).setCrop(col*width/2,row*height/2,width/2,height/2).setName('hero/sushi-cost-king-shard').setData('targetId',id).setData('eventId',eventId);image.setPosition(at.x-width/2,at.y-height/2);flight.add(image);pieces.push({image,x:image.x,y:image.y,dx:(col?1:-1)*18,dy:(row?1:-1)*15,angle:(col?1:-1)*9});}
   hiddenKings.push({container,alpha:container.alpha});container.setAlpha(0).setData('sushiCostPaid',eventId);
  }
  if(packet?.active)flight.bringToTop(packet);
 };
 const arrive=()=>{if(disposed||token.arrived)return;token.arrived=true;landedAt=options.beat.windup+options.beat.flight;elapsed=Math.max(elapsed,landedAt);refresh();if(flight?.active){flight.setData('phase','impact');if(packet?.active){const at=destination();packet.setPosition(at.x,at.y).setVisible(false);}flare=scene.add.graphics().setName('hero/sushi-skill-arrival');flight.add(flare);}};
 const step=(time:number)=>{if(disposed||options.context.signal.aborted)return;elapsed=time;
  if(token.arrived){refresh();const t=Math.max(0,Math.min(1,(time-(landedAt??time))/Math.min(220,options.beat.impact)));if(flare?.active){const at=destination(),w=label.width+12+8*t,h=label.height+8+5*t;flare.clear().lineStyle(2,0xd5aa57,.85*(1-t)).strokeRoundedRect(at.x-w/2,at.y-h/2,w,h,5);for(const sign of [-1,1])flare.beginPath().moveTo(at.x+sign*(w/2+3),at.y).lineTo(at.x+sign*(w/2+7+6*t),at.y).strokePath();}if(t===1)finishAnimation();return;}
  if(!flight?.active||!packet?.active||!source?.container.active)return;
  const b=source.container.getBounds(),current=local(b.centerX,b.centerY);if(!origin||!sacrificed)origin=current;
  if(kings.length&&time>=fractureAt)sacrifice();
  const f=Math.max(0,Math.min(1,(time-fractureAt)/Math.max(1,fractureEnd-fractureAt)));flight.setData('fractureProgress',f);for(const piece of pieces)piece.image.setPosition(piece.x+piece.dx*f,piece.y+piece.dy*f+9*f*f).setAlpha((1-f)**1.4).setAngle(piece.angle*f);
  const target=destination(),p=Math.max(0,Math.min(1,(time-options.beat.windup)/Math.max(1,options.beat.flight)));
  if(time<options.beat.windup){packet.setVisible(false);flight.setData('phase',sacrificed?'sacrifice':'charge');}
  else {const u=p*p;packet.setVisible(true).setAlpha(1).setScale(1.14-.14*p).setPosition(origin.x+(target.x-origin.x)*u,origin.y+(target.y-origin.y)*u-Math.sin(Math.PI*p)*20);flight.setData('phase','flight');}
  flight.setData('origin',origin).setData('destination',target).setData('progress',p);
 };
 return {eventId,refresh,step,arrive,finishAnimation,dispose};
}
