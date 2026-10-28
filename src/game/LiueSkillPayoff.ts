import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreTrace} from '../domain/scoreR2';
import type {ScoreBeat} from './scorePresentation';
import {savedHeroAttachment} from './HeroAttachmentFacts';
import {UI_FONT,PAPER_CSS} from './theme';
import {textDensity} from './TextRaster';

const INK=0x3b3430,JADE=0x367b80,GOLD=0xc19a59;
export const LIUE_PAYOFF_INK='#94651f';
interface Options {
 context:EffectContext;beat:ScoreBeat;reduced:boolean;root:Phaser.GameObjects.Container;
 cards:readonly {id:string;container:Phaser.GameObjects.Container}[];onDispose?:()=>void;
}
/** Animate an actual saved conversion event; the card remains intact. */
export function mountLiueSkillPayoff(scene:Phaser.Scene,button:Phaser.GameObjects.Rectangle|undefined,trace:ScoreTrace,eventId:string,options:Options){
 const saved=savedHeroAttachment(trace,'erxiang'),event=trace.erxiangGroup?trace.events.find(e=>e.eventId===eventId&&e.sourceType==='character'&&e.sourceDefinitionId==='erxiang'&&e.reasonKey==='erxiang.handoff'):saved?.event,label=button?.getData('label') as Phaser.GameObjects.Text|undefined,status=button?.getData('skillStatus') as Phaser.GameObjects.Text|undefined;
 if(!event||event.eventId!==eventId||event.phase!=='onCardScore'||event.operation!=='add-multiplier'||(!trace.erxiangGroup&&event.retriggerDepth!==0)||event.value.d!=='1'||BigInt(event.value.n)<=0n||trace.erxiangHandoff?.points!==Number(event.value.n)||options.context.signal.aborted||!options.root.active||!button?.active||!label?.active||button.getData('liueSkillPayoff'))return;
 const source=options.cards.find(c=>c.id===event.targetCardId&&c.container.active&&c.container.visible);if(!source)return;
 const amount=event.value.n,token={eventId,targetId:source.id,amount,arrived:false},rest={text:label.text,color:label.style.color,sx:label.scaleX,sy:label.scaleY,y:label.y,status:status?.text,statusColor:status?.style.color};
 let disposed=false,buttonClosing=false,elapsed=0,origin:{x:number;y:number}|undefined,group:Phaser.GameObjects.Container|undefined,packet:Phaser.GameObjects.Text|undefined,ink:Phaser.GameObjects.Graphics|undefined;
 const local=(x:number,y:number)=>options.root.getWorldTransformMatrix().applyInverse(x,y);
 const destination=()=>{const b=label.getBounds();return local(b.centerX,b.centerY);};
 const sourcePoint=()=>{const b=source.container.getBounds();return local(b.centerX,b.y-18);};
 const finishAnimation=()=>{group?.destroy();group=undefined;packet=undefined;ink=undefined;};
 const refresh=()=>{if(disposed||!token.arrived||!button.active||!label.active||button.getData('liueSkillPayoff')!==token)return;
  label.setText('听政 +'+amount+'倍率').setColor(LIUE_PAYOFF_INK);
  const fit=Math.min(rest.sx,(button.width-12)/Math.max(1,label.width)),p=options.reduced?1:Math.max(0,Math.min(1,(elapsed-options.beat.windup-options.beat.flight)/Math.max(1,options.beat.impact))),bounce=options.reduced?0:Math.sin(Math.PI*p);
  label.setScale(fit*(1+.055*bounce),Math.min(rest.sy,fit)*(1+.055*bounce)).setY(rest.y-2*bounce);status?.setText('本次已转入').setColor(LIUE_PAYOFF_INK);
 };
 const hidden=()=>{if(document.hidden)dispose();};
 const buttonDestroyed=()=>{buttonClosing=true;dispose();};
 const dispose=()=>{if(disposed)return;disposed=true;finishAnimation();options.context.signal.removeEventListener('abort',dispose);scene.events.off('shutdown',dispose);scene.events.off('destroy',dispose);button.off('destroy',buttonDestroyed);source.container.off('destroy',dispose);options.root.off('destroy',dispose);
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);if(typeof window!=='undefined')window.removeEventListener('blur',dispose);
  if(buttonClosing||button.getData('liueSkillPayoff')===token){if(!buttonClosing)button.setData('liueSkillPayoff',undefined);if(label.active)label.setText(rest.text).setColor(rest.color).setScale(rest.sx,rest.sy).setY(rest.y);if(status?.active)status.setText(rest.status??'').setColor(rest.statusColor??rest.color);}options.onDispose?.();
 };
 button.setData('liueSkillPayoff',token);options.context.signal.addEventListener('abort',dispose,{once:true});scene.events.once('shutdown',dispose);scene.events.once('destroy',dispose);button.once('destroy',buttonDestroyed);source.container.once('destroy',dispose);options.root.once('destroy',dispose);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);if(typeof window!=='undefined')window.addEventListener('blur',dispose);
 if(!options.reduced){
  group=scene.add.container(0,0).setName('hero/liue-skill-flight').setData('eventId',eventId).setData('targetId',source.id).setData('amount',amount);options.root.add(group);
  ink=scene.add.graphics().setName('hero/liue-transfer-ink');
  packet=scene.add.text(0,0,'+'+amount+' 倍率',{fontFamily:UI_FONT,fontSize:'26px',fontStyle:'bold',color:LIUE_PAYOFF_INK,backgroundColor:PAPER_CSS.paperLight,padding:{x:5,y:2},resolution:textDensity(scene)}).setOrigin(.5).setName('hero/liue-skill-packet');group.add([ink,packet]);
 }
 const charge=(progress:number)=>{if(disposed||token.arrived||!group?.active||!packet?.active||!source.container.active)return;
  const p=Math.max(0,Math.min(1,progress));origin=sourcePoint();packet.setPosition(origin.x,origin.y+12*(1-p)).setAlpha(Math.min(1,p*4)).setScale(.92+.08*p);group.setData('phase','charge').setData('origin',origin).setData('destination',destination()).setData('progress',p);
  // A short paper underline links the number to the selected face without a glow wash.
  ink?.clear().lineStyle(2,JADE,.8*p).beginPath().moveTo(origin.x-17,origin.y+packet.height/2+3).lineTo(origin.x+17,origin.y+packet.height/2+3).strokePath();
 };
 const arrive=()=>{if(disposed||token.arrived)return;token.arrived=true;elapsed=Math.max(elapsed,options.beat.windup+options.beat.flight);packet?.setVisible(false);group?.setData('phase','impact');refresh();};
 const step=(time:number)=>{if(disposed||options.context.signal.aborted)return;elapsed=time;
  if(token.arrived){refresh();if(ink?.active){const p=Math.max(0,Math.min(1,(time-options.beat.windup-options.beat.flight)/Math.max(1,options.beat.impact))),b=button.getBounds(),a=local(b.x,b.y),z=local(b.right,b.bottom),pad=3+4*p;
    ink.clear().lineStyle(2.5,GOLD,1-p*.65).strokeRoundedRect(a.x-pad,a.y-pad,z.x-a.x+pad*2,z.y-a.y+pad*2,6).lineStyle(1.5,INK,.8*(1-p));
    for(const sign of [-1,1])ink.beginPath().moveTo((a.x+z.x)/2+sign*(z.x-a.x)/2,(a.y+z.y)/2).lineTo((a.x+z.x)/2+sign*((z.x-a.x)/2+9+5*p),(a.y+z.y)/2-3).strokePath();
   }return;}
  if(!group?.active||!packet?.active)return;
  if(time<options.beat.windup){charge(1);return;}
  origin??=sourcePoint();const at=destination(),p=Math.max(0,Math.min(1,(time-options.beat.windup)/Math.max(1,options.beat.flight))),u=p*p*(3-2*p),x=origin.x+(at.x-origin.x)*u,y=origin.y+(at.y-origin.y)*u-Math.sin(Math.PI*p)*18;
  packet.setPosition(x,y).setAlpha(1).setScale(1-.08*p);group.setData('phase','flight').setData('progress',p).setData('origin',origin).setData('destination',at);ink?.clear();
  if(p>0&&p<1)ink?.lineStyle(2,JADE,.55).beginPath().moveTo(x-(at.x-origin.x)*.07,y-(at.y-origin.y)*.07).lineTo(x,y).strokePath();
 };
 charge(0);return {eventId,charge,step,arrive,refresh,finishAnimation,dispose};
}
