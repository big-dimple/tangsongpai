import type Phaser from 'phaser';
import type {R2RunState} from '../domain/r2Run';
import type {SceneView} from './SceneView';
import type {Box} from './layout';
import type {settlementFacts} from './SettlementPresentation';
import {getCharacter} from './characters';
import {pcHeroKey} from './PcHeroArt';
import {heatText,readableFractionText} from './scoreText';
import {rankLabel,SUIT_SYMBOL} from '../cards/types';
import {enhancementText} from './CardSpecialLabels';
import {pcLandscapeFrame} from './PcLandscapeFrame';
import {HAND_LABELS} from '../content/handLabels';
import {failureSummary} from './FailureSummary';
import {PAPER_THEME as T,PAPER_CSS as C,SCORE_FONT} from './theme';
import {resultLayout} from './IntermissionLayout';

/** A geometry gate plus the primary pointer: touch tablets retain their existing view. */
export function pcResultViewport(width:number,height:number){
 return width>=1180&&height>=640&&width>height&&!(typeof window!=='undefined'&&window.matchMedia('(pointer: coarse)').matches);
}

/** Existing saved facts only. No commands, thresholds, reward issuance or timers. */
export function drawPcSettlement(scene:Phaser.Scene,view:SceneView,b:Box,run:R2RunState,cleared:boolean,skipped:boolean,facts:ReturnType<typeof settlementFacts>,formulaOverride?:string,rewardLabel?:string){
 const l=resultLayout(view.layout.width,view.layout.height,0,b.height,true),lost=!cleared&&!skipped;
 const grid=pcLandscapeFrame(view.layout.width,view.layout.height),compact=grid.compact;
 const text=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const item=view.text(x,y,copy,size,color).setName(name);
  for(let font=size;item.width>width&&font>16;)item.setFontSize(--font);
  if(item.width>width)item.setWordWrapWidth(width,true);
  return item;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 const side={x:grid.sidebar.x,y:b.y,width:grid.sidebar.width,height:b.height};
 const baseline=l.primary.y+l.primary.height;
 paper.lineStyle(1,T.divider,.8).lineBetween(b.x-grid.gap/2,0,b.x-grid.gap/2,baseline);
 paper.lineStyle(1,T.divider,.8).lineBetween(l.next.x-grid.gap/2,b.y,l.next.x-grid.gap/2,baseline);
 const tag=text(side.x,side.y,skipped?'本场跳过':'本场总热度',18,side.width,C.jade,'result/hand');
 const exactScore=facts.stageTotal,copy=(exactScore.length>15&&/[1-9]/.test(exactScore.slice(3))?'≈':'')+heatText(exactScore);
 const score=text(side.x,tag.y+32,copy,compact?52:64,side.width,lost?C.ink:C.red,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',exactScore).setData('pcPoster',true);
 const formula=formulaOverride??(lost?'目标 '+heatText(run.stage!.targetHeat)+' · 差 '+heatText((BigInt(run.stage!.targetHeat)-BigInt(facts.stageTotal)).toString()):skipped?'没有本场计分':'目标 '+heatText(run.stage!.targetHeat)+' · 已过关');
 const target=text(side.x,score.y+score.height+16,formula,18,side.width,C.jade,'result/formula');
 const purse=text(side.x,target.y+target.height+20,'金币 '+run.gold+'　·　出牌余量 '+run.stage!.handsLeft,18,side.width,C.ink,'result/resources');
 const heroHeight=Math.min(compact?210:370,Math.max(80,baseline-purse.y-purse.height-94));
 // Keep the complete source frame inside the sidebar, with the lower
 // silhouette resting on an explicit information baseline.
 const heroBox={x:side.x,y:baseline-54-heroHeight,width:side.width,height:heroHeight};
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);
  if(!scene.textures.exists(key))return;
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,heroBox.width/hero.width,heroBox.height/hero.height));
  hero.setPosition(heroBox.x+hero.displayWidth/2,heroBox.y+heroBox.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});
  artLayer.add(hero);return hero;
 };
 const hero=paint();
 paper.lineStyle(1,T.divider,.8).lineBetween(side.x,baseline-54,side.x+side.width,baseline-54);
 text(side.x,baseline-42,getCharacter(run.characterId).name,compact?22:26,side.width,C.ink,'result/hero-name').setFontStyle('bold');
 if(facts.hero)text(side.x,baseline-10,(facts.heroSkill??'角色能力')+' · '+facts.heroCopy.replace('本手兑现 · ',''),16,side.width,C.jade,'result/hero-effect');

 const trace=facts.trace,heading=trace?(lost?'末手牌型 · ':'致胜牌型 · ')+HAND_LABELS[trace.handType]:skipped?'本场跳过':lost?'本场回顾':'本场计分记录';
 text(b.x,b.y,heading,compact?28:36,b.width,C.ink,'result/hand-type').setFontStyle('bold');
 if(trace){
  const cards=trace.sets.playedIds.map(id=>trace.cards.find(card=>card.id===id)).filter((card):card is NonNullable<typeof card>=>!!card);
  const cardWidth=Math.min(compact?94:132,(b.width-24*Math.max(0,cards.length-1))/Math.max(1,cards.length)),cardHeight=cardWidth*1.4;
  const cardsY=b.y+(compact?50:66),cardsX=b.x+(b.width-(cardWidth*cards.length+24*Math.max(0,cards.length-1)))/2;
  text(b.x, cardsY+cardHeight+12,'实际打出 '+cards.length+' 张 · '+trace.sets.activeScoringIds.length+' 张有效计分',16,b.width,C.jade,'result/hand-combo').setData('fullText',facts.handCards);
  cards.forEach((card,i)=>{
   const x=cardsX+i*(cardWidth+24),y=cardsY,active=trace.sets.activeScoringIds.includes(card.id),red=card.suit==='hearts'||card.suit==='diamonds',ink=red?C.red:C.ink;
   const face=view.add(scene.add.graphics().setName('result/card-face').setData('cardId',card.id).setData('scoring',active).setData('bounds',{x,y,width:cardWidth,height:cardHeight}));
   face.fillStyle(T.ink,.08).fillRoundedRect(x,y+5,cardWidth,cardHeight,7).fillStyle(T.paperLight).fillRoundedRect(x,y,cardWidth,cardHeight,7).lineStyle(active?2:1,active?T.jade:T.divider,1).strokeRoundedRect(x,y,cardWidth,cardHeight,7);
   text(x+10,y+9,rankLabel(card.rank)+'\n'+SUIT_SYMBOL[card.suit],compact?21:28,cardWidth-20,ink,'result/card-index').setData('cardId',card.id);
   text(x+cardWidth/2,y+cardHeight*.5,SUIT_SYMBOL[card.suit],compact?40:62,cardWidth,ink,'result/card-suit').setOrigin(.5);
   const corner=text(x+cardWidth-8,y+cardHeight-8,rankLabel(card.rank),compact?19:24,cardWidth-16,ink,'result/card-corner').setOrigin(0,0).setAngle(180);corner.setData('cardId',card.id);
   if(card.enhancement||card.edition&&card.edition!=='none'){
    const editions={none:'',foil:'闪箔',holographic:'全息',polychrome:'多彩'};
    text(x,y+cardHeight-25,[card.enhancement?enhancementText(card).split(' · ')[0]:'',editions[card.edition??'none']].filter(Boolean).join('·'),14,cardWidth,C.jade,'result/card-modifiers').setOrigin(0,0);
   }
  });
  const calcY=cardsY+cardHeight+(compact?52:66),gap=16,cellWidth=(b.width-gap*2)/3,calcHeight=compact?102:128;
  const columns=[{label:'热度累计',value:readableFractionText(trace.accumulator.H),color:C.jade},{label:'倍率累计',value:readableFractionText(trace.accumulator.M),color:C.red},{label:'本手入账',value:heatText(trace.finalScore),color:C.ink}];
  columns.forEach((column,i)=>{const x=b.x+i*(cellWidth+gap);paper.fillStyle(T.paperLight,.9).fillRoundedRect(x,calcY,cellWidth,calcHeight,8).lineStyle(1,T.divider,.8).strokeRoundedRect(x,calcY,cellWidth,calcHeight,8);text(x+14,calcY+12,column.label,16,cellWidth-28,C.jade);text(x+14,calcY+40,column.value,compact?32:44,cellWidth-28,column.color,'result/calculation-'+i).setFontFamily(SCORE_FONT).setFontStyle('bold');});
  const explanation=text(b.x,calcY+calcHeight+14,facts.scoreExplanation!,compact?18:22,b.width,C.ink,'result/score-explanation');
  // Stage heat is the saved sum of credited hands; show its relation to this
  // trace without rerunning scoring rules or treating a source bonus as a total.
  const previous=(BigInt(facts.stageTotal)-BigInt(trace.finalScore)).toString();
  const credit=text(b.x,explanation.y+explanation.height+10,'此前累计 '+heatText(previous)+' + 本手 '+heatText(trace.finalScore)+' = 本场 '+heatText(facts.stageTotal),compact?18:22,b.width,C.ink,'result/stage-credit');
  const attribution=[facts.card?facts.card.name+' · '+facts.cardCopy?.replaceAll('\n','；'):undefined,facts.hero?(facts.heroSkill??getCharacter(run.characterId).name)+' · '+facts.heroCopy:undefined,facts.routeCopy].filter(Boolean).join('　／　');
  if(attribution){const source=text(b.x,credit.y+credit.height+10,'关键来源 · '+attribution,16,b.width,C.jade,'result/source-continuity').setData('fullText',attribution);if(source.height>48)source.setText('关键来源 · '+(facts.card?.name??facts.heroSkill??'本局资历')+' · 完整顺序见本场详情');}
 }else{
  text(b.x,b.y+64,skipped?'没有出牌，不产生本场计分。':lost?failureSummary(run).lastHand:'本场末手记录不可用。',24,b.width,C.jade,'result/hand-combo');
  if(lost)text(b.x,b.y+120,failureSummary(run).reason,20,b.width,C.ink,'result/failure-reason');
 }

 const reward={x:l.next.x,y:b.y+38,width:l.next.width,height:126};
 text(reward.x,b.y,lost?'本局留档':skipped?'换场记录':'本场奖励',22,reward.width,C.ink,'result/reward-heading').setFontStyle('bold');
 let rewardText:Phaser.GameObjects.Text|undefined;
 if(cleared&&!skipped&&rewardLabel){
  const [headline,...details]=rewardLabel.split(' · ');
  rewardText=text(reward.x+reward.width/2,reward.y+10,headline.replace(/^奖励\s+/,''),compact?30:38,reward.width-48,C.red,'result/reward').setOrigin(.5,0).setFontStyle('bold');
  const detail=text(reward.x,reward.y+rewardText.height+24,details.length?details.join(' · '):'已计入金币余额',16,reward.width,C.jade,'result/reward-details').setData('fullText',details.join(' · '));
  if(detail.height>48)detail.setText('含特殊收益 · 完整记录见本场详情');
  reward.height=Math.max(reward.height,detail.y+detail.height-reward.y+12);
 }else text(reward.x,reward.y+10,lost?'成绩已记录，下一局重新启程。':'跳场所得见下方记录。',18,reward.width,C.jade,'result/receipt-state');
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){
  reviewBookBand={x:reward.x,y:reward.y+reward.height+8,width:reward.width,height:52};
  text(reviewBookBand.x,reviewBookBand.y,facts.reviewBook.label,16,reviewBookBand.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);
  text(reviewBookBand.x,reviewBookBand.y+26,'本章最常用牌型 · 升级已保存',14,reviewBookBand.width,C.jade,'result/review-book-saved');
 }
 return {facts,score,reward,rewardText,paint,hero,stage:b,reviewBookBand};
}

/** Facts are present from the first frame; reveal motion never gates the controls. */
export function mountPcSettlementMotion(scene:Phaser.Scene,score:Phaser.GameObjects.Text,hero:Phaser.GameObjects.Image|undefined,lost:boolean){
 const sx=score.scaleX,sy=score.scaleY,alpha=score.alpha,hx=hero?.x,ha=hero?.alpha,started=performance.now();let disposed=false;
 const restore=()=>{if(score.active)score.setScale(sx,sy).setAlpha(alpha);if(hero?.active)hero.setX(hx!).setAlpha(ha!);};
 const dispose=()=>{if(disposed)return;disposed=true;scene.events.off('update',update);scene.events.off('shutdown',dispose);restore();};
 const update=()=>{const elapsed=performance.now()-started,t=Math.min(1,elapsed/900),entry=1-Math.pow(1-Math.min(1,elapsed/420),3),land=Math.min(1,Math.max(0,(elapsed-140)/300));
  if(hero?.active)hero.setX(hx!-12*(1-entry)).setAlpha(ha!*(.7+.3*entry));
  if(score.active)score.setAlpha(alpha*(.72+.28*land)).setScale(sx*(lost?1:.97+.03*land),sy*(lost?1:.97+.03*land));
  if(t===1)dispose();
 };
 scene.events.on('update',update);scene.events.once('shutdown',dispose);update();return {dispose};
}

let releasePcCut:(()=>void)|undefined;
/** Non-blocking paper bridge across scene.start. It owns no game state or input. */
export function beginPcSettlementCut(scene:Phaser.Scene,reduced:boolean):()=>void {
 releasePcCut?.();
 if(reduced||typeof document==='undefined'||typeof window==='undefined'||!pcResultViewport(scene.scale.width,scene.scale.height))return ()=>{};
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(preference.matches||document.hidden)return ()=>{};
 const veil=document.createElement('div');veil.setAttribute('aria-hidden','true');veil.dataset.pcSettlementCut='';
 Object.assign(veil.style,{position:'fixed',inset:'0',pointerEvents:'none',background:C.paper,opacity:'0',zIndex:'1000'});
 document.body.append(veil);
 let disposed=false,animation:Animation|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const dispose=()=>{if(disposed)return;disposed=true;if(timer!==undefined)clearTimeout(timer);animation?.cancel();veil.remove();window.removeEventListener('blur',dispose);window.removeEventListener('pagehide',dispose);window.removeEventListener('resize',dispose);window.removeEventListener('pointerdown',dispose,true);window.removeEventListener('keydown',dispose,true);window.removeEventListener('tangsongpai-presentation',dispose);document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',changed);scene.events.off('destroy',dispose);if(releasePcCut===dispose)releasePcCut=undefined;};
 const visibility=()=>{if(document.hidden)dispose();},changed=()=>{if(preference.matches)dispose();};
 releasePcCut=dispose;window.addEventListener('blur',dispose);window.addEventListener('pagehide',dispose);window.addEventListener('resize',dispose);window.addEventListener('pointerdown',dispose,true);window.addEventListener('keydown',dispose,true);window.addEventListener('tangsongpai-presentation',dispose);document.addEventListener('visibilitychange',visibility);preference.addEventListener('change',changed);scene.events.once('destroy',dispose);
 // Scene shutdown deliberately does not cancel the bridge: it spans that boundary.
 // A hard bound also covers failed navigation or an interrupted browser animation.
 timer=setTimeout(dispose,800);
 if(typeof veil.animate==='function'){
  animation=veil.animate([{opacity:0},{opacity:.72,offset:.24},{opacity:0}],{duration:650,easing:'ease-out'});
  animation.onfinish=dispose;animation.oncancel=()=>{if(!disposed)dispose();};
 }else dispose();
 return dispose;
}
