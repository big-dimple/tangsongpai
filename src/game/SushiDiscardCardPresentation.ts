import type Phaser from 'phaser';
import {cardVisualRoot,cardFaceOwner} from './CardVisualRoot';
import type {ScoreTrace} from '../domain/scoreR2';
import type {EffectContext} from '../core/EffectQueue';
import type {InkBox,InkPoint} from './AssistInkGeometry';
import {drawSushiFragment,drawSushiDiscardOrigin,savedSushiDiscardReceipt,type SushiDiscardReceipt} from './SushiDiscardOrigin';
import {cssViewport} from '../platform/Viewport';
import {heroNativeParticlesAvailable} from './HeroSkillParticles';
import {drawHeroOriginStream,heroAtmosphereStyle,HERO_SOURCE_CURRENT_MS} from './HeroCardAttachmentAtmosphere';
import {drawSushiSwordSlash,SUSHI_EXILE_SLASH_PALETTE} from './SushiSwordSlash';
import type {HeroEffectOrigin} from './HeroEffectOrigin';
import {HeroAttachmentPhases,type HeroAttachmentPhaseObserver} from './HeroAttachmentPhases';

import {HeroLiveSmoke} from './HeroLiveSmoke';
import {heroInkBox,type HeroInkBox} from './HeroVisibleSurface';
import {textDensity} from './TextRaster';
import {UI_FONT} from './theme';
import {SushiKingEnergy,SUSHI_KING_ENERGY_BUDGET,ownPreparedSushiKing} from './SushiKingEnergy';

export interface SushiDiscardCard {id:string;container:Phaser.GameObjects.Container;visual?:Phaser.GameObjects.Container;width:number;height:number;rank?:number}
/** Keep actual saved discard faces through the existing cut/fade. */
export function sushiDiscardFadeTiming(index:number,reduced:boolean,replay=false):{duration:number;delay:number} {
 return {duration:reduced?0:180,delay:reduced?0:(replay?0:260)+Math.max(0,index)*30};
}
/** Both blade endpoints are inside ONE card. No union, first-to-last target span or group outline exists. */
export function sushiLocalSlash(width:number,height:number,progress:number):readonly InkPoint[] {
 const t=Math.max(0,Math.min(1,progress)),at=(u:number)=>({x:(u*2-1)*width*.38,y:(u*2-1)*height*.18});return[at(Math.max(0,t-.52)),at(t)];
}
export interface AmoExileVisualState {smokeAlpha:number;silhouetteAlpha:number;slashAlpha:number;flameAlpha:number;hit:boolean;destroyReady:boolean}
/** One deterministic local state drives smoke, assassin silhouette, hit and K flame. It never widens beyond the current card. */
export function amoExileVisualState(cut:number|undefined,rank:number|undefined,reduced:boolean):AmoExileVisualState {
 const p=Math.max(0,Math.min(1,cut??0)),smoke=reduced?0:cut===undefined?1:Math.max(0,1-p/.62),silhouette=reduced?0:Math.max(0,1-p/.58),slash=reduced?0:cut===undefined?0:Math.min(1,p/.34),flame=rank===13?(reduced?.45:cut===undefined?.72:Math.max(.18,1-p*.55)):0;
 return{smokeAlpha:smoke*.9,silhouetteAlpha:silhouette*.86,slashAlpha:slash,flameAlpha:flame,hit:!reduced&&cut!==undefined&&p>=.34,destroyReady:cut!==undefined&&p>=1};
}
const ellipsePoints=(x:number,y:number,rx:number,ry:number):InkPoint[]=>Array.from({length:10},(_,i)=>{const a=i*Math.PI*2/10;return{x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});
function drawAmoExileVisual(g:Phaser.GameObjects.Graphics,width:number,height:number,clock:number,cut:number|undefined,reduced:boolean,occluders:readonly InkBox[],rank:number|undefined):void {
 const state=amoExileVisualState(cut,rank,reduced),p=Math.max(0,Math.min(1,cut??0)),centerY=height*.08;
 if(state.smokeAlpha>0){for(let i=0;i<6;i++){const u=(i+1)/7,phase=clock/170+i*1.65,x=Math.sin(phase)*width*.2+(i%2?width*.07:-width*.07),y=centerY-height*(.12+u*.46)+Math.cos(phase*.7)*height*.035,size=Math.min(width,height)*(.13+.065*(1-u)),ink=i%2?0x20272e:0x0b0f14;g.fillStyle(ink,state.smokeAlpha*(.32+.1*(1-u))).fillPoints(ellipsePoints(x,y,size*1.55,size*(.9+.12*(i%2))),true);}}
 if(state.silhouetteAlpha>0){const side=width*.28*(Math.sin(clock/160)>0?1:-1),base=height*.28,blade=height*.22;g.fillStyle(0x11131a,state.silhouetteAlpha).fillPoints([{x:side-width*.07,y:base},{x:side+width*.07,y:base},{x:side+width*.04,y:-height*.12},{x:side,y:-height*.24},{x:side-width*.04,y:-height*.12}],true);g.lineStyle(Math.max(2,width*.035),0xe9edf0,state.silhouetteAlpha*.9).beginPath().moveTo(side+width*.04,-height*.03).lineTo(side+width*.24,-height*.03-blade).strokePath();}
 if(state.flameAlpha>0){const flames=rank===13?5:0;for(let i=0;i<flames;i++){const x=(i/(flames-1)-.5)*width*.64,y=height*.31+Math.sin(clock/95+i)*height*.035,w=width*(.12+.025*(i%2));g.fillStyle(0x8f1c12,state.flameAlpha*.9).fillPoints([{x:x-w,y:y+height*.16},{x:x-w*.72,y:y-height*.08},{x:x,y:y-height*(.28+.08*(i%2))},{x:x+w*.72,y:y-height*.08},{x:x+w,y:y+height*.16}],true);g.fillStyle(0xffc247,state.flameAlpha).fillPoints(ellipsePoints(x,y-height*.04,w*.7,height*.16),true);}}
 if(state.slashAlpha>0)drawSushiSwordSlash(g,width,height,sushiLocalSlash(width,height,cut??0),p,occluders,SUSHI_EXILE_SLASH_PALETTE);
 if(state.hit&&!state.destroyReady){g.fillStyle(0xfff4cf,Math.min(1,state.slashAlpha+.15)).fillPoints(ellipsePoints(0,0,Math.max(4,width*.06),Math.max(4,width*.06)),true);g.fillStyle(0xfff4cf,Math.min(1,state.slashAlpha+.2)).fillPoints([{x:0,y:-Math.max(6,width*.1)},{x:Math.max(6,width*.1),y:0},{x:0,y:Math.max(6,width*.1)},{x:-Math.max(6,width*.1),y:0}],true);}
}
export function drawSushiDiscardCard(g:Phaser.GameObjects.Graphics,width:number,height:number,clock:number,cut:number|undefined,reduced:boolean,occluders:readonly InkBox[],native=false,rank?:number){
 g.clear().setBlendMode('NORMAL');if(cut!==undefined&&cut>=1)return;
 const alpha=cut===undefined?1:1-cut;
 if(!native)drawSushiFragment(g,{x:0,y:-height/2-7},reduced?3:6.5+Math.sin(clock/120)*.7,alpha,occluders);
 drawAmoExileVisual(g,width,height,clock,cut,reduced,occluders,rank);
}
type Row={card:SushiDiscardCard;root:Phaser.GameObjects.Container;holder:Phaser.GameObjects.Container;ink:Phaser.GameObjects.Graphics;energy?:SushiKingEnergy;badge?:Phaser.GameObjects.Text;cut?:number;captured:boolean;unbind?:()=>void};
type ScoreFlight={sink:InkPoint;travelMs:number;impactMs:number;elapsed:number;arrived:boolean;context:EffectContext;token:number};

/** One local container per discarded instance. Existing owner drives cut progress and actual score arrival. */
export class SushiDiscardCardPresentation {
 private rows=new Map<string,Row>();
 private receipt?:SushiDiscardReceipt;
 private flight?:ScoreFlight;
 private flowInk?:Phaser.GameObjects.Graphics;
 private flowCurrent?:Phaser.GameObjects.Graphics;
 private unbind?:()=>void;
 private clock=0;
 private cadence=0;
 private token=0;
 private ignitionAt=0;
 private preparationFactor?:3|4;

 private readonly phases:HeroAttachmentPhases;

 private readonly liveSmoke:HeroLiveSmoke;
 constructor(private readonly scene:Phaser.Scene,private readonly root:()=>Phaser.GameObjects.Container|undefined,private readonly source:(id:string)=>SushiDiscardCard|undefined,private readonly reduced:()=>boolean,private readonly origin:()=>HeroEffectOrigin|undefined=()=>undefined,onPhase?:HeroAttachmentPhaseObserver,private readonly exclusions:()=>readonly InkBox[]=()=>[],private readonly sourceExclusions:()=>readonly InkBox[]=()=>[]){this.phases=new HeroAttachmentPhases(onPhase);this.liveSmoke=new HeroLiveSmoke(scene);}
 get active():boolean {return this.rows.size>0||!!this.receipt;}
 private drop(id:string,row:Row):void {row.unbind?.();this.liveSmoke.releaseTarget(id);if(row.holder.active)row.holder.destroy(true);this.rows.delete(id);}
 private sourceAlive(row:Row):boolean {const source=row.card.container,declared=row.card.visual??source.getData?.('cardBodyRoot') as Phaser.GameObjects.Container|undefined;return source.active&&(!declared||declared.active);}
 private sourceVisible(row:Row):boolean {const source=row.card.container,body=cardVisualRoot(row.card);if(!this.sourceAlive(row)||!source.visible||source.alpha<=.01||!body.visible||body.alpha<=.01)return false;for(let node:Phaser.GameObjects.Container|null=body;node;node=node.parentContainer)if(!node.active||!node.visible||node.alpha<=.01)return false;return true;}
 /** View-only K sources. The caller has already checked the real skill choice. */
 prepareKings(ids:readonly string[],factor:3|4):void {if(this.receipt)return;this.preparationFactor=factor;this.preview(ids.filter(id=>this.source(id)?.rank===13).slice(0,SUSHI_KING_ENERGY_BUDGET.targets));}
 preview(ids:readonly string[]):void {
  const root=this.root();if(!root?.active){this.clear();return;}
  if(this.receipt)return;
  const visible=[...new Set(ids)].slice(0,8),allowed=new Set(visible);
  for(const [id,row]of this.rows){const card=this.source(id);if(!allowed.has(id)||!card?.container.active||!row.holder.active||row.root!==root||row.card.container!==card.container)this.drop(id,row);else row.card=card;}
  for(const id of visible){if(this.rows.has(id))continue;const card=this.source(id);if(!card?.container.active)continue;
   const holder=this.scene.add.container(0,0).setName('hero/sushi-discard/'+id).setData('sourceInstanceId',id),ink=this.scene.add.graphics(),row:Row={card,root,holder,ink,captured:false},body=cardVisualRoot(card),dead=()=>this.drop(id,row);holder.add(ink);root.add(holder);this.rows.set(id,row);const releaseOwner=this.preparationFactor!==undefined?ownPreparedSushiKing(card.container,dead,()=>this.occluders(row.holder,row.card,true).filter(b=>b.inkKind==='face'||b.inkKind==='print')):undefined;card.container.once?.('destroy',dead);if(body!==card.container)body.once?.('destroy',dead);row.unbind=()=>{releaseOwner?.();card.container.off?.('destroy',dead);if(body!==card.container)body.off?.('destroy',dead);};
  }
  if(!this.rows.size){this.liveSmoke.clear();}
 }
 bindSaved(trace:ScoreTrace,context:EffectContext):boolean {
  const event=trace.events.find(e=>e.sourceType==='character'&&e.sourceDefinitionId==='amo'&&e.reasonKey==='amo.exile'),receipt=event?savedSushiDiscardReceipt(trace,event.eventId):undefined;
  if(!receipt||context.signal.aborted){this.clear();return false;}
  const prepared=this.preparationFactor!==undefined;this.receipt=undefined;
  if(prepared){const factor=Number(receipt.multiplier);if(factor!==3&&factor!==4){this.clear();return false;}this.preparationFactor=factor;this.preview(receipt.discardedIds.filter(id=>trace.cards.some(c=>c.id===id&&c.rank===13)));}
  else {this.preparationFactor=undefined;this.preview(receipt.discardedIds);}
  if(!this.rows.size)return false;this.receipt=receipt;this.phases.bind({owner:'discard',activationId:receipt.eventId,eventId:receipt.eventId,reasonKey:'amo.exile',targetIds:[...this.rows.keys()],sourceTargetIds:[...this.rows.keys()],motion:this.reduced()?'reduced':'full',context});this.phases.publish('committed');if(this.receipt!==receipt||context.signal.aborted)return false;this.ignitionAt=this.reduced()?-Infinity:this.clock;this.unbind?.();const cancel=()=>this.clear();context.signal.addEventListener('abort',cancel,{once:true});this.unbind=()=>context.signal.removeEventListener('abort',cancel);this.step(0,true);return true;
 }
 cut(id:string,progress:number):boolean {const row=this.rows.get(id);if(!row||!this.receipt?.discardedIds.includes(id))return false;row.cut=Math.max(0,Math.min(1,progress));if(row.cut>=1){this.drop(id,row);return true;}if(!this.sourceVisible(row)){this.drop(id,row);return false;}return true;}
 present(trace:ScoreTrace,eventId:string,context:EffectContext,arrival:Promise<void>,travelMs:number,impactMs:number,worldSink:InkPoint):void {
  const receipt=savedSushiDiscardReceipt(trace,eventId),root=this.root();if(!receipt||receipt.eventId!==this.receipt?.eventId||context.signal.aborted||!root?.active)return;
  const sink=root.getWorldTransformMatrix().applyInverse(worldSink.x,worldSink.y),token=++this.token;this.flight={sink,travelMs:Math.max(1,travelMs),impactMs:Math.max(1,impactMs),elapsed:0,arrived:false,context,token};
  void arrival.then(()=>{if(this.flight?.token!==token||context.signal.aborted)return;this.flight.arrived=true;this.flight.elapsed=0;this.phases.publish('impact');this.drawFlight();});
 }
 private sync(row:Row):void {
  const root=this.root(),source=row.card.container;if(!root?.active||!source.active)return;
  const r=root.getWorldTransformMatrix(),s=cardVisualRoot(row.card).getWorldTransformMatrix(),det=r.a*r.d-r.b*r.c;if(Math.abs(det)<1e-8)return;
  const a=(r.d*s.a-r.c*s.b)/det,b=(-r.b*s.a+r.a*s.b)/det,c=(r.d*s.c-r.c*s.d)/det,d=(-r.b*s.c+r.a*s.d)/det,p=r.applyInverse(s.tx,s.ty),sx=Math.hypot(a,b);
  let alpha=1;for(let node:Phaser.GameObjects.Container|null=cardVisualRoot(row.card);node&&node!==root;node=node.parentContainer)alpha*=node.alpha??1;
  row.holder.setPosition(p.x,p.y).setRotation(Math.atan2(b,a)).setScale(sx,sx?(a*d-b*c)/sx:1);row.holder.setAlpha?.(alpha);row.captured=true;
 }
 private boundsIn(container:Phaser.GameObjects.Container,target:Phaser.GameObjects.Container,width:number,height:number):InkBox {
  const m=cardVisualRoot({container:target}).getWorldTransformMatrix(),inverse=container.getWorldTransformMatrix(),points=[[-width/2,-height/2],[width/2,-height/2],[-width/2,height/2],[width/2,height/2]].map(([x,y])=>{const p=m.transformPoint(x,y);return inverse.applyInverse(p.x,p.y);}),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
 }
 private paintedBehind(face:Phaser.GameObjects.Container,own:Phaser.GameObjects.Container,root:Phaser.GameObjects.Container):boolean {
  const chain=(node:Phaser.GameObjects.Container)=>{const path:Phaser.GameObjects.Container[]=[];let p:Phaser.GameObjects.Container|null=node;for(;p&&p!==root;p=p.parentContainer)path.push(p);return p===root?path.reverse():[];},a=chain(face),b=chain(own);let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  if(i===a.length||i===b.length)return false;const parent=i?a[i-1]:root,ai=parent.list.indexOf(a[i]),bi=parent.list.indexOf(b[i]);return ai>=0&&bi>=0&&ai<bi;
 }
 private occluders(container:Phaser.GameObjects.Container,own?:SushiDiscardCard,protectOwnText=false,targetFaces:ReadonlySet<Phaser.GameObjects.Container>=new Set(),material=false,facesOnly=false):HeroInkBox[] {
  const root=this.root(),boxes:HeroInkBox[]=[];if(!root)return boxes;const inverse=container.getWorldTransformMatrix();
  const behind=new Map<Phaser.GameObjects.Container,boolean>(),isBehind=(face:Phaser.GameObjects.Container|undefined)=>{if(!own||!protectOwnText||!face||face===own.container)return false;if(!behind.has(face))behind.set(face,this.paintedBehind(face,own.container,root));return behind.get(face)===true;};
  const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const object of list){const o=object as Phaser.GameObjects.Container;if(!o.active||!o.visible||o.alpha<.01||(o.name.startsWith('hero/sushi-discard')||o.name==='hero/live-smoke'))continue;
   if(o.getData('cardFace')&&(material||o!==own?.container&&!targetFaces.has(o))&&!isBehind(o))boxes.push(heroInkBox(root,o,this.boundsIn(container,o,Number(o.getData('width')),Number(o.getData('height'))),'face'));
   if(!facesOnly&&(o.type==='Text'||o.type==='Image')&&(!own||!this.receipt||cardFaceOwner(o)!==own.container||protectOwnText&&o.type==='Text')&&!isBehind(cardFaceOwner(o))){const b=(o as unknown as Phaser.GameObjects.Text).getBounds(),points=[[b.x,b.y],[b.right,b.y],[b.x,b.bottom],[b.right,b.bottom]].map(([x,y])=>inverse.applyInverse(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));boxes.push(heroInkBox(root,o,{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y},o.type==='Text'||o.getData('heroInkPrint')?'print':'art'));}
   if(o.list)walk(o.list);
  }};walk(root.list);for(const b of this.exclusions()){const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>inverse.applyInverse(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));boxes.push({x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y,inkKind:'print'});}return boxes;
 }
 // One hand multiplier follows the first visible pending K's printed index.
 // Its x anchor never searches over a neighboring card to make the label fit.
 private kingBadge(row:Row):void {
  const factor=this.receipt?.multiplier??this.preparationFactor,viewport=cssViewport(this.scene),owner=[...this.rows.values()].find(candidate=>{if(candidate.card.rank!==13||candidate.cut!==undefined||!this.sourceVisible(candidate))return false;const b=cardVisualRoot(candidate.card).getBounds();return b.right>0&&b.bottom>0&&b.x<viewport.width&&b.y<viewport.height;});
  if(row!==owner||factor===undefined){row.badge?.destroy();row.badge=undefined;return;}
  const badge=row.badge?.active?row.badge:(row.badge=this.scene.add.text(0,0,'',{fontFamily:UI_FONT,fontSize:'13px',fontStyle:'bold',color:'#673516',backgroundColor:'#fff1d4',padding:{x:4,y:2},resolution:textDensity(this.scene)}).setOrigin(.5).setName('hero/sushi-king-badge').setData('sourceInstanceId',row.card.id));if(badge.parentContainer!==row.holder)row.holder.add(badge);
  const m=row.holder.getWorldTransformMatrix(),sx=Math.max(.1,Math.hypot(m.a,m.b)),sy=Math.max(.1,Math.hypot(m.c,m.d)),boxes=this.occluders(row.holder,row.card).filter(b=>b.inkKind==='print'||!b.ownerId),index=cardVisualRoot(row.card).list.find(o=>o.name==='rank-index') as Phaser.GameObjects.Text|undefined,indexBounds=index?.getBounds();
  badge.setText('本次得分 ×'+factor).setScale(1/sx,1/sy).setData('savedEventId',this.receipt?.eventId).setVisible(false);
  const halfW=badge.width/2/sx,halfH=badge.height/2/sy,x=indexBounds?m.applyInverse(indexBounds.centerX,indexBounds.y).x:-row.card.width/2+12/sx;
  for(let lift=0;lift<2;lift++){const y=-row.card.height/2-halfH-(3+lift*(badge.height+4))/sy,b={x:x-halfW,y:y-halfH,width:halfW*2,height:halfH*2};badge.setPosition(x,y);const world=badge.getBounds();if(world.x<2||world.right>viewport.width-2||world.y<2||world.bottom>viewport.height-2||boxes.some(a=>b.x<a.x+a.width+1/sx&&b.x+b.width>a.x-1/sx&&b.y<a.y+a.height+1/sy&&b.y+b.height>a.y-1/sy))continue;badge.setVisible(true);return;}
 }
 private renderRow(row:Row):void {this.sync(row);if(!row.captured)return;
  const source=cardVisualRoot(row.card),viewport=cssViewport(this.scene),b=source.getBounds();if(!this.sourceVisible(row)||b.right<=0||b.bottom<=0||b.x>=viewport.width||b.y>=viewport.height){row.holder.setVisible(false);row.ink.clear();return;}
  row.holder.setVisible(true);this.kingBadge(row);
  if(this.preparationFactor!==undefined){row.ink.clear();if(row.badge?.visible){row.ink.lineStyle(1.3,0xc18435,.9).lineBetween(row.badge.x,row.badge.y+row.badge.displayHeight/2,row.badge.x,-row.card.height/2); }(row.energy??=new SushiKingEnergy()).draw(row.ink,row.card.width,row.card.height,this.clock,this.reduced(),0,this.occluders(row.holder,row.card,true).filter(b=>b.inkKind==='face'||b.inkKind==='print'));row.holder.setData('preparation','king').setData('energy','ink-dashes').setData('motion',this.reduced()?'static':'full');}
  else drawSushiDiscardCard(row.ink,row.card.width,row.card.height,this.clock,row.cut,this.reduced(),this.occluders(row.holder,row.card,row.cut!==undefined),true,row.card.rank);row.holder.setData('cut',row.cut).setData('savedEventId',this.receipt?.eventId).setData('slashPreset',row.cut===undefined?undefined:'lempo/sword_slash').setData('slashPalette','exile-red-orange').setData('slashProgress',row.cut);}
 private drawFlight():void {
  const flight=this.flight,receipt=this.receipt,root=this.root();if(!receipt||!root?.active)return;
  if(!flight&&!this.rows.size){this.flowInk?.clear();this.flowCurrent?.clear();return;}
  if(!flight){const origin=this.origin(),progress=(this.clock-this.ignitionAt)/HERO_SOURCE_CURRENT_MS;if(origin&&!this.reduced()&&heroNativeParticlesAvailable(this.scene)&&progress<=1){this.phases.publish('source');if(this.receipt!==receipt||!root.active)return;if(!this.flowInk?.active){this.flowInk=this.scene.add.graphics().setName('hero/sushi-discard-transfer');root.add(this.flowInk);}if(!this.flowCurrent?.active){this.flowCurrent=this.scene.add.graphics().setName('hero/sushi-discard-current');root.add(this.flowCurrent);}const inverse=root.getWorldTransformMatrix(),p=inverse.applyInverse(origin.x,origin.y),boxes=[...this.rows.values()].filter(row=>row.captured&&row.holder.visible).map(row=>this.boundsIn(root,row.holder,row.card.width,row.card.height)),protectedBoxes=[...this.occluders(root),...this.sourceExclusions().map(b=>{const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>inverse.applyInverse(x,y)),x=Math.min(...points.map(v=>v.x)),y=Math.min(...points.map(v=>v.y));return{x,y,width:Math.max(...points.map(v=>v.x))-x,height:Math.max(...points.map(v=>v.y))-y};})],stats=drawHeroOriginStream(this.flowInk,p,boxes,heroAtmosphereStyle({key:receipt.eventId,targetId:receipt.discardedIds[0],releaseReason:'amo.exile'}),progress,protectedBoxes,1,this.flowCurrent);this.flowInk.setData('stats',stats).setData('progress',progress).setData('source',p).setData('sourceKind',origin.kind??'skill').setData('targetIds',receipt.discardedIds).setData('savedEventId',receipt.eventId);this.flowCurrent.setData('stats',stats).setData('progress',progress).setData('protectedBoxes',protectedBoxes);}else {this.flowInk?.clear();this.flowCurrent?.clear();}return;}
  this.flowCurrent?.destroy();this.flowCurrent=undefined;
  if(flight.context.signal.aborted){this.clear();return;}
  if(!this.flowInk?.active){this.flowInk=this.scene.add.graphics().setName('hero/sushi-discard-transfer');root.add(this.flowInk);}
  const poses=[...this.rows].filter(([,row])=>row.captured&&row.holder.visible).map(([id,row])=>({id,box:this.boundsIn(root,row.holder,row.card.width,row.card.height)})),progress=flight.arrived?Math.min(1,flight.elapsed/flight.impactMs):Math.min(.94,flight.elapsed/flight.travelMs);
  if(poses.length)drawSushiDiscardOrigin(this.flowInk,{phase:flight.arrived?'arrive':'transfer',receipt,eventId:receipt.eventId,context:flight.context,poses,protectedPrint:this.occluders(root),progress,reducedMotion:this.reduced(),sink:flight.sink});else this.flowInk.clear();
  // Actual arrival alone cannot erase a live discarded face's cut. The owner's cut(1)
  // or actual face destruction consumes the last row; no independent timeout replaces it.
  if(flight.arrived&&!this.rows.size){this.phases.publish('settled');this.clear();}
 }
 step(delta:number,force=false):void {if(!this.active)return;const root=this.root();if(!root?.active||[...this.rows.values()].some(row=>row.root!==root)){this.clear();return;}for(const [id,row]of this.rows){if(!row.holder.active||!this.sourceAlive(row))this.drop(id,row);else if(!this.sourceVisible(row)){row.holder.setVisible(false);row.ink.clear();this.liveSmoke.releaseTarget(id);}}this.liveSmoke.setFrozen(this.reduced());this.liveSmoke.step(delta);if(this.reduced())this.ignitionAt=-Infinity;this.clock+=Math.max(0,Math.min(50,delta));if(this.flight)this.flight.elapsed+=Math.max(0,delta);this.cadence+=delta;if(!force&&this.cadence<50)return;this.cadence%=50;for(const row of this.rows.values())row.badge?.setVisible(false);for(const row of this.rows.values())this.renderRow(row);if(![...this.rows.values()].some(row=>row.holder.visible)){this.liveSmoke.clear();this.drawFlight();return;}{
   // refreshSelection can raise every real face above these earlier-created proxies. Keep the
   // actual discard effects in front; visible patches still protect all print and foreground faces.
   for(const row of this.rows.values())root.bringToTop(row.holder);
   if(this.preparationFactor!==undefined){this.liveSmoke.clear();this.drawFlight();if(this.flowInk?.active)root.bringToTop(this.flowInk);if(this.flowCurrent?.active)root.bringToTop(this.flowCurrent);return;}
   const key=this.receipt?.eventId??'sushi/prepared/'+[...this.rows.keys()].join('|'),style=heroAtmosphereStyle({key,targetId:this.receipt?.discardedIds[0]??this.rows.keys().next().value??'',releaseReason:'amo.exile'}),targetFaces=new Set([...this.rows.values()].map(row=>row.card.container)),cards=[...this.rows].map(([id,row])=>({id,container:row.holder,occlusionOwner:row.card.container,width:row.card.width,height:row.card.height,releaseProgress:row.cut??0})),boxes=this.occluders(root,undefined,false,targetFaces,true);this.liveSmoke.sync(key,cards,style,root,boxes,true,this.flight?.arrived?Math.min(1,this.flight.elapsed/this.flight.impactMs):0,false,()=>this.occluders(root,undefined,false,targetFaces,true),!this.receipt);
  }this.drawFlight();if(this.receipt){this.phases.setMotion(this.reduced()?'reduced':'full');if([...this.rows.values()].some(row=>row.holder.visible))this.phases.publish('attached');}if(this.flowInk?.active)root.bringToTop(this.flowInk);if(this.flowCurrent?.active)root.bringToTop(this.flowCurrent);}
 suspend():void {this.liveSmoke.clear();if(this.receipt){this.clear('hidden');return;}for(const row of this.rows.values())row.holder.setVisible(false);}
 clear(cause='cleared'):void {this.token++;this.liveSmoke.clear();this.phases.end(cause);this.unbind?.();this.unbind=undefined;for(const [id,row]of this.rows)this.drop(id,row);this.flowInk?.destroy();this.flowInk=undefined;this.flowCurrent?.destroy();this.flowCurrent=undefined;this.receipt=undefined;this.flight=undefined;this.preparationFactor=undefined;}
}
