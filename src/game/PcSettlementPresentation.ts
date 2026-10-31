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
import {settlementHandCards,settlementSuitInk} from './SettlementHand';
import {failureSummary} from './FailureSummary';
import {PAPER_THEME as T,PAPER_CSS as C,SCORE_FONT} from './theme';
import {pcResultSidebar,resultLayout} from './IntermissionLayout';

/** A geometry gate plus the primary pointer: touch tablets retain their existing view. */
export function pcResultViewport(width:number,height:number){
 return width>=1180&&height>=640&&width>height&&!(typeof window!=='undefined'&&window.matchMedia('(pointer: coarse)').matches);
}

/** Existing saved facts only. No commands, thresholds, reward issuance or timers. */
export function drawPcSettlement(scene:Phaser.Scene,view:SceneView,b:Box,run:R2RunState,cleared:boolean,skipped:boolean,facts:ReturnType<typeof settlementFacts>,formulaOverride?:string,rewardLabel?:string){
 const l=resultLayout(view.layout.width,view.layout.height,0,b.height,true),lost=!cleared&&!skipped;
 const grid=pcLandscapeFrame(view.layout.width,view.layout.height),compact=grid.compact,cx=b.x+b.width/2;
 // Even the minimum PC width has room for two readable receipt columns;
 // keeping them parallel leaves the next action visible on short screens.
 const ceremony=b.width>=600,columnWidth=ceremony?b.width*.47:b.width;
 let columnX=ceremony?b.x+b.width*.25:cx;
 const text=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const item=view.text(x,y,copy,size,color).setColor(color).setName(name);
  for(let font=size;item.width>width&&font>16;)item.setFontSize(--font);
  if(item.width>width)item.setWordWrapWidth(width,true);
  return item;
 };
 const centered=(y:number,copy:string,size:number,width:number,color=C.ink,name='')=>text(columnX,y,copy,size,Math.min(width,columnWidth),color,name).setOrigin(.5,0).setAlign('center');
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 const side={...pcResultSidebar(view.layout.width,view.layout.height),x:b.x-grid.gap-pcResultSidebar(view.layout.width,view.layout.height).width};
 const heroHeight=Math.min(compact?390:520,Math.max(240,view.layout.height-b.y-176));
 const heroBox={x:side.x,y:b.y+4,width:side.width,height:heroHeight};
 const halo=view.add(scene.add.graphics().setName('result-art/hero-halo'));
 const haloRadius=Math.min(side.width*.43,heroBox.height*.36),haloX=side.x+side.width/2,haloY=heroBox.y+heroBox.height*.4;
 halo.fillStyle(0xc7d8cf,.18).fillCircle(haloX,haloY,haloRadius).lineStyle(1,0xc7b89d,.42).strokeCircle(haloX,haloY,haloRadius+5);
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);
  if(!scene.textures.exists(key))return;
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,heroBox.width/hero.width,heroBox.height/hero.height));
  hero.setPosition(heroBox.x+heroBox.width/2,heroBox.y+heroBox.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});
  artLayer.add(hero);return hero;
 };
 const hero=paint();
 const heroName=text(side.x+side.width/2,heroBox.y+heroBox.height+8,getCharacter(run.characterId).name,22,side.width,C.paperLight,'result/hero-name').setOrigin(.5,0).setFontStyle('bold');
 const resources=text(side.x+side.width/2,heroName.y+heroName.height+4,'金币 '+run.gold+'　·　出牌余量 '+run.stage!.handsLeft,15,side.width,'#d8cdb8','result/resources').setOrigin(.5,0);
 if(facts.hero)text(side.x+side.width/2,resources.y+resources.height+4,(facts.heroSkill??'角色能力')+' · '+facts.heroCopy.replace('本手兑现 · ',''),14,side.width-16,C.redSoft,'result/hero-effect').setOrigin(.5,0).setAlign('center');

 const tag=centered(b.y,skipped?'本场跳过':'本场总得分',16,b.width,C.jade,'result/hand');
 const exactScore=facts.stageTotal,copy=(exactScore.length>15&&/[1-9]/.test(exactScore.slice(3))?'≈':'')+heatText(exactScore);
 const score=centered(tag.y+tag.height+2,copy,compact?40:64,b.width,lost||skipped?C.ink:C.red,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',exactScore).setData('pcPoster',true);
 // Font family and weight can change the measured width after creation.
 score.setWordWrapWidth(0);for(let size=compact?40:64;score.width>columnWidth&&size>20;)score.setFontSize(--size);
 if(score.width>columnWidth)score.setScale(columnWidth/score.width);
 const formula=formulaOverride??(lost?'目标 '+heatText(run.stage!.targetHeat)+' · 差 '+heatText((BigInt(run.stage!.targetHeat)-BigInt(facts.stageTotal)).toString()):skipped?'没有本场计分':'目标 '+heatText(run.stage!.targetHeat)+' · 已过关');
 const target=centered(score.y+score.displayHeight+3,formula,16,b.width,C.jade,'result/formula');
 let bottom=target.y+target.height;
 const reward={x:columnX-columnWidth/2,y:bottom+6,width:columnWidth,height:28};
 let rewardText:Phaser.GameObjects.Text|undefined;
 if(cleared&&!skipped&&rewardLabel){
  const [headline,...details]=rewardLabel.split(' · ');
  const plate=view.add(scene.add.graphics().setName('result/reward-plate'));
  rewardText=centered(reward.y,headline,20,reward.width-48,C.red,'result/reward').setFontStyle('bold');
  const plateWidth=Math.min(reward.width,rewardText.width+72),plateHeight=rewardText.height+8;
  plate.fillStyle(T.redSoft,.9).fillRoundedRect(columnX-plateWidth/2,reward.y-4,plateWidth,plateHeight,5).lineStyle(1,T.red,.35).strokeRoundedRect(columnX-plateWidth/2+.5,reward.y-3.5,plateWidth-1,plateHeight-1,5);
  if(details.length){const detail=centered(rewardText.y+rewardText.height+2,details.join(' · '),14,reward.width,C.jade,'result/reward-details').setData('fullText',details.join(' · '));if(detail.height>36)detail.setText('含特殊收益 · 完整记录见本场详情');reward.height=detail.y+detail.height-reward.y;}
  else reward.height=rewardText.height;
 }else{
  const receipt=centered(reward.y,lost?'成绩已记录，下一局重新启程。':'跳场所得见下方记录。',16,reward.width,C.jade,'result/receipt-state');reward.height=receipt.height;
 }
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){
  const label=centered(reward.y+reward.height+6,facts.reviewBook.label,14,b.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);
  const saved=centered(label.y+label.height+2,'本章最常用牌型 · 升级已保存',14,b.width,C.jade,'result/review-book-saved');
  reviewBookBand={x:columnX-columnWidth/2,y:label.y,width:columnWidth,height:saved.y+saved.height-label.y};
 }
 bottom=reviewBookBand?reviewBookBand.y+reviewBookBand.height:reward.y+reward.height;
 const scoreBottom=bottom;
 if(ceremony)columnX=b.x+b.width*.75;
 const trace=facts.trace;
 if(trace){
  const heading=centered(ceremony?b.y+4:bottom+6,(lost?'末手牌型 · ':'致胜牌型 · ')+HAND_LABELS[trace.handType],compact?20:24,b.width,C.ink,'result/hand-type').setFontStyle('bold');
  const cards=trace.sets.playedIds.map(id=>trace.cards.find(card=>card.id===id)).filter((card):card is NonNullable<typeof card>=>!!card),handCards=settlementHandCards(trace);
  const gap=12,desiredCardWidth=ceremony?112:compact?(view.layout.height>=720?(facts.reviewBook?60:68):54):92;
  const cardWidth=Math.min(desiredCardWidth,(columnWidth-gap*Math.max(0,cards.length-1))/Math.max(1,cards.length)),cardHeight=cardWidth*1.4;
  const cardsY=heading.y+heading.height+5,cardsX=columnX-(cardWidth*cards.length+gap*Math.max(0,cards.length-1))/2;
  cards.forEach((card,i)=>{
   const x=cardsX+i*(cardWidth+gap),y=cardsY,active=handCards[i].active,ink=settlementSuitInk(card.suit);
   const face=view.add(scene.add.graphics().setName('result/card-face').setData('cardId',card.id).setData('scoring',active).setData('bounds',{x,y,width:cardWidth,height:cardHeight}));
   face.fillStyle(T.ink,.08).fillRoundedRect(x,y+3,cardWidth,cardHeight,5).fillStyle(T.paperLight).fillRoundedRect(x,y,cardWidth,cardHeight,5).lineStyle(active?2:1,active?T.jade:T.divider,1).strokeRoundedRect(x,y,cardWidth,cardHeight,5);
   text(x+5,y+4,rankLabel(card.rank)+'\n'+SUIT_SYMBOL[card.suit],compact?18:22,cardWidth-10,ink,'result/card-index').setData('cardId',card.id).setData('suit',card.suit);
   text(x+cardWidth/2,y+cardHeight*.52,SUIT_SYMBOL[card.suit],compact?30:40,cardWidth,ink,'result/card-suit').setOrigin(.5).setData('cardId',card.id).setData('suit',card.suit);
   const corner=text(x+cardWidth-4,y+cardHeight-4,rankLabel(card.rank),16,cardWidth-8,ink,'result/card-corner').setOrigin(0,0).setAngle(180);corner.setData('cardId',card.id);
   if(card.enhancement||card.edition&&card.edition!=='none'){
    const editions={none:'',foil:'闪箔',holographic:'全息',polychrome:'多彩'};
    text(x+cardWidth/2,y+cardHeight-30,[card.enhancement?enhancementText(card).split(' · ')[0]:'',editions[card.edition??'none']].filter(Boolean).join('·'),11,cardWidth-8,C.jade,'result/card-modifiers').setOrigin(.5,0).setAlign('center');
   }
  });
  const combo=centered(cardsY+cardHeight+4,'实际打出 '+cards.length+' 张 · '+trace.sets.activeScoringIds.length+' 张有效计分',14,b.width,C.jade,'result/hand-combo').setData('fullText',facts.handCards);
  const explanation=centered(combo.y+combo.height+6,facts.scoreExplanation!,18,b.width,C.ink,'result/score-explanation');
  const previous=(BigInt(facts.stageTotal)-BigInt(trace.finalScore)).toString();
  const credit=centered(explanation.y+explanation.height+3,'此前累计 '+heatText(previous)+' + 本手 '+heatText(trace.finalScore)+' = 本场 '+heatText(facts.stageTotal),14,b.width,C.jade,'result/stage-credit');
  bottom=credit.y+credit.height;
  const attribution=[facts.card?facts.card.name+' · '+facts.cardCopy?.replaceAll('\n','；'):undefined,facts.hero?(facts.heroSkill??getCharacter(run.characterId).name)+' · '+facts.heroCopy:undefined,facts.routeCopy].filter(Boolean).join('　／　');
  if(attribution){const source=centered(bottom+3,'关键来源 · '+attribution,14,b.width,C.jade,'result/source-continuity').setData('fullText',attribution);if(source.height>36)source.setText('关键来源 · '+(facts.card?.name??facts.heroSkill??'本局资历')+' · 完整顺序见本场详情');bottom=source.y+source.height;}
 }else{
  const heading=centered(ceremony?b.y+4:bottom+8,skipped?'本场跳过':lost?'本场回顾':'本场计分记录',20,b.width,C.ink,'result/hand-type').setFontStyle('bold');
  const detail=centered(heading.y+heading.height+6,skipped?'没有出牌，不产生本场计分。':lost?failureSummary(run).lastHand:'本场末手记录不可用。',16,b.width,C.jade,'result/hand-combo');bottom=detail.y+detail.height;
  if(lost){const reason=centered(bottom+4,failureSummary(run).reason,16,b.width,C.ink,'result/failure-reason');bottom=reason.y+reason.height;}
 }
 bottom=Math.max(scoreBottom,bottom);
 if(ceremony){
  const y=b.y-12,leftHeight=scoreBottom-y+12,rightHeight=bottom-y+12;
  paper.fillStyle(T.ink,.05).fillRoundedRect(b.x,y+3,b.width*.49,leftHeight,10).fillRoundedRect(b.x+b.width*.51,y+3,b.width*.49,rightHeight,10);
  paper.fillStyle(T.paperLight,.78).fillRoundedRect(b.x,y,b.width*.49,leftHeight,10).fillRoundedRect(b.x+b.width*.51,y,b.width*.49,rightHeight,10);
  paper.lineStyle(1,T.divider,.68).strokeRoundedRect(b.x+.5,y+.5,b.width*.49-1,leftHeight-1,10).strokeRoundedRect(b.x+b.width*.51+.5,y+.5,b.width*.49-1,rightHeight-1,10);
  paper.fillStyle(lost||skipped?T.jade:T.red,.86).fillRect(b.x+18,y,52,3).fillRect(b.x+b.width*.51+18,y,52,3);
 }
 return {facts,score,reward,rewardText,paint,hero,stage:b,reviewBookBand,receiptBottom:bottom};
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
