import type Phaser from 'phaser';
import type {HeroScoreAction} from './HeroScoreAction';
import {prepareJokerScoreStrike} from './JokerScoreStrike';
import {OWNED_SCORE_SPRING} from './inkwaveSpring';

export interface HeroStrikeCard {id:string;container:Phaser.GameObjects.Container;width:number;height:number}
type Options=Omit<Parameters<typeof prepareJokerScoreStrike>[4],'sourceCard'|'textureKey'|'artBounds'>;

/** Group genuine beneficiary faces for ONE saved multiplier, rather than emitting
 * a fake multiplier per card. Hit rectangles remain outside this temporary carrier. */
export function prepareHeroScoreStrike(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,action:HeroScoreAction,cards:readonly HeroStrikeCard[],options:Options){
 if(!action.positive||options.context.signal.aborted||action.contributions.length!==1||!action.targetIds.length)return;
 const rows=action.targetIds.map(id=>cards.find(card=>card.id===id));
 if(rows.some(row=>!row?.container.active||!row.container.visible||row.container.parentContainer!==parent||!Number.isFinite(row.width)||!Number.isFinite(row.height)||row.width<=0||row.height<=0))return;
 const members=rows as HeroStrikeCard[];
 if(members.length===1){const row=members[0];return prepareJokerScoreStrike(scene,parent,row.container,action,{...options,sourceCard:true,readableLanding:true,textureKey:'',artBounds:{x:-row.width/2,y:-row.height/2,width:row.width,height:row.height}});}
 const inverse=parent.getWorldTransformMatrix(),points=members.flatMap(row=>{const matrix=row.container.getWorldTransformMatrix();return [[-row.width/2,-row.height/2],[row.width/2,-row.height/2],[-row.width/2,row.height/2],[row.width/2,row.height/2]].map(([x,y])=>{const p=matrix.transformPoint(x,y);return inverse.applyInverse(p.x,p.y);});});
 const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),width=Math.max(...points.map(p=>p.x))-left,height=Math.max(...points.map(p=>p.y))-top,cx=left+width/2,cy=top+height/2;
 if(width<=0||height<=0)return;
 const saved=members.map(row=>({row,x:row.container.x,y:row.container.y,angle:row.container.angle,sx:row.container.scaleX,sy:row.container.scaleY,alpha:row.container.alpha,index:parent.list.indexOf(row.container)}));
 const carrier=scene.add.container(cx,cy).setName('hero/score-carrier').setData('eventId',action.eventId).setData('targetIds',[...action.targetIds]).setData('costIds',[...action.costIds]).setData('heroId',action.hero);
 let closed=false,parentClosing=false,carrierClosing=false,stopStrike:(()=>void)|undefined;carrier.once('destroy',()=>{carrierClosing=true;});
 const parentDestroy=()=>{parentClosing=true;};parent.once('destroy',parentDestroy);
 const destroying=new Set<Phaser.GameObjects.Container>(),destroyHooks=new Map<Phaser.GameObjects.Container,()=>void>();
 const memberDestroyed=(card:Phaser.GameObjects.Container)=>{destroying.add(card);carrier.remove(card);if(stopStrike)stopStrike();else cleanup();};
 const cleanup=()=>{if(closed)return;closed=true;parent.off('destroy',parentDestroy);for(const [card,hook]of destroyHooks)card.off('destroy',hook);destroyHooks.clear();
  if(parent.active&&!parentClosing)for(const rest of [...saved].sort((a,b)=>a.index-b.index)){const card=rest.row.container;if(!card.active||destroying.has(card))continue;carrier.remove(card);parent.addAt(card,Math.min(rest.index,parent.list.length));card.setPosition(rest.x,rest.y).setScale(rest.sx,rest.sy).setAngle(rest.angle).setAlpha(rest.alpha).setData('scoreMotionPhase','rest');}
  if(!carrierClosing)carrier.destroy();options.onDispose?.();
 };
 parent.add(carrier);for(const rest of saved){parent.remove(rest.row.container);carrier.add(rest.row.container);rest.row.container.setPosition(rest.x-cx,rest.y-cy).setData('heroScoreEventId',action.eventId);}
 for(const rest of saved){const card=rest.row.container,hook=()=>memberDestroyed(card);destroyHooks.set(card,hook);card.once('destroy',hook);}
 const strike=prepareJokerScoreStrike(scene,parent,carrier,action,{...options,sourceCard:true,readableLanding:true,textureKey:'',artBounds:{x:-width/2,y:-height/2,width,height},arrivalWidth:options.arrivalWidth??Math.min(options.portrait?68:104,width*.62,options.cells[action.contributions[0].target].width*.8),onStep:elapsed=>{for(const row of members)if(row.container.active)row.container.setData('scoreMotionPhase',carrier.getData('scoreMotionPhase'));options.onStep?.(elapsed);},onDispose:cleanup});
 stopStrike=strike?.dispose;if(!strike)cleanup();return strike;
}

/** A lost promise cools only its saved pending new cards. No H/M packet,
 * multiplier cheer, readout fracture or audio rebound is manufactured. */
export function prepareHeroLossPose(scene:Phaser.Scene,action:HeroScoreAction,cards:readonly HeroStrikeCard[],options:Options){
 if(action.positive||action.kind!=='wager-lost'||options.context.signal.aborted)return;
 const rows=action.targetIds.flatMap(id=>cards.filter(card=>card.id===id&&card.container.active&&card.container.visible)).map(row=>({card:row.container,x:row.container.x,y:row.container.y,sx:row.container.scaleX,sy:row.container.scaleY,angle:row.container.angle,alpha:row.container.alpha}));
 if(!rows.length)return;
 const abort=new AbortController(),context={generation:options.context.generation,signal:abort.signal};let disposed=false;
 const hidden=()=>{if(document.hidden)dispose();};
 const dispose=()=>{if(disposed)return;disposed=true;abort.abort();options.context.signal.removeEventListener('abort',dispose);scene.events.off('shutdown',dispose);for(const row of rows){row.card.off('destroy',dispose);if(row.card.active)row.card.setPosition(row.x,row.y).setScale(row.sx,row.sy).setAngle(row.angle).setAlpha(row.alpha).setData('scoreMotionPhase','rest');}if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);options.onDispose?.();};
 const tween=(duration:number,offset:number,pose:(t:number)=>void)=>{const cursor={t:0};return options.animate({targets:cursor,t:1,duration,ease:'Linear',onUpdate:()=>{if(disposed)return;pose(cursor.t);options.onStep?.(offset+duration*cursor.t);}},context);};
 options.context.signal.addEventListener('abort',dispose,{once:true});scene.events.once('shutdown',dispose);for(const row of rows)row.card.once('destroy',dispose);if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
 const phase=(value:string)=>rows.forEach(row=>row.card.active&&row.card.setData('heroScoreEventId',action.eventId).setData('scoreMotionPhase',value));
 phase('windup');const windup=tween(options.beat.windup,0,t=>rows.forEach((row,i)=>row.card.setAngle(row.angle+(i%2?-1:1)*1.6*t).setScale(row.sx*(1-.018*t),row.sy*(1-.018*t))));
 const fly=()=>tween(options.beat.flight,options.beat.windup,()=>{});
 const land=()=>{phase('failure');return tween(options.beat.impact,options.beat.windup+options.beat.flight,t=>{const s=OWNED_SCORE_SPRING.value(t);for(const [i,row]of rows.entries())row.card.setY(row.y+4*Math.abs(s)).setAngle(row.angle+(i%2?-1:1)*2*s).setScale(row.sx*(1-.025*Math.abs(s)),row.sy*(1-.025*Math.abs(s))).setAlpha(row.alpha*(1-.22*Math.abs(s)));}).finally(dispose);};
 return {windup,fly,land,dispose};
}
