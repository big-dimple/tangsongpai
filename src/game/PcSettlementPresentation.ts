import type Phaser from 'phaser';
import type {R2RunState} from '../domain/r2Run';
import type {SceneView} from './SceneView';
import type {Box} from './layout';
import type {settlementFacts} from './SettlementPresentation';
import {getCharacter} from './characters';
import {portraitKey,selectionPortraitKey} from './portraits';
import {heatText} from './scoreText';
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
 const compact=view.layout.height<850,gap=compact?24:32,heroWidth=Math.min(compact?344:440,b.width*.43),heroHeight=Math.min(b.height-68,heroWidth*768/615);
 const heroBox={x:b.x,y:b.y,width:heroWidth,height:heroHeight};
 const x=b.x+heroWidth+gap,width=b.width-heroWidth-gap;
 const text=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const item=view.text(x,y,copy,size,color).setName(name);
  for(let font=size;item.width>width&&font>14;)item.setFontSize(--font);
  if(item.width>width)item.setWordWrapWidth(width,true);
  return item;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 // Open editorial spread: one quiet vertical seam, no outer panel or card frame.
 paper.fillStyle(lost?T.jadeSoft:T.paperLight,.7).fillRect(x-12,b.y,width+12,b.height)
  .lineStyle(1,T.divider,.8).beginPath().moveTo(l.next.x-gap/2,b.y).lineTo(l.next.x-gap/2,b.y+b.height).strokePath();
 const tag=text(x,b.y+8,skipped?'本场跳过':'本场总热度',16,width,C.jade,'result/hand');
 const exactScore=facts.stageTotal,copy=(exactScore.length>15&&/[1-9]/.test(exactScore.slice(3))?'≈':'')+heatText(exactScore);
 const size=compact?(facts.tier>=2?76:68):(facts.tier>=2?104:88);
 const score=view.text(x,tag.y+tag.height+16,copy,size,lost?C.ink:facts.tier>=2?C.red:C.ink).setFontFamily(SCORE_FONT).setFontStyle('bold').setName('result/score').setData('exactScore',exactScore).setData('pcPoster',true);
 for(let font=size;score.width>width&&font>28;)score.setFontSize(--font);
 if(score.width>width)score.setScale(width/score.width);
 const formula=formulaOverride??(lost?'目标 '+heatText(run.stage!.targetHeat)+' · 差 '+heatText((BigInt(run.stage!.targetHeat)-BigInt(facts.stageTotal)).toString()):skipped?'没有本场计分':'目标 '+heatText(run.stage!.targetHeat)+' · 已过关');
 const target=text(x,score.y+score.displayHeight+16,formula,16,width,C.jade,'result/formula');
 const ruleY=target.y+target.height+24;
 paper.lineStyle(lost?1:3,lost?T.jade:T.red,lost?.45:.8).beginPath().moveTo(x,ruleY).lineTo(x+Math.min(64,width*.3),ruleY).strokePath();
 if(!lost&&facts.tier>=2)text(x,ruleY+16,facts.tag,24,width,C.red,'result/tier').setFontFamily('Georgia, "Noto Serif SC", SimSun, serif').setFontStyle('bold');
 const receipt=skipped?'没有本场计分':lost?failureSummary(run).lastHand:facts.trace?'末手 '+HAND_LABELS[facts.trace.handType]+' · '+heatText(facts.trace.finalScore):'末手记录不可用';
 // Last-hand attribution remains subordinate. Full contributions stay in the existing detail action.
 const receiptY=Math.max(ruleY+(facts.tier>=2&&!lost?62:24),b.y+b.height-104);
 const receiptText=text(x,receiptY,receipt,14,width,C.jade,'result/gap');
 const sourceY=receiptText.y+receiptText.height+10;
 if(facts.card)text(x,sourceY,'末手来源 · '+facts.card.name,14,width,C.jade,'result/source-continuity');
 else if(lost)text(x,sourceY,failureSummary(run).reason,14,width,C.jade,'result/failure-reason');
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const start=view.root.length;
  const key=scene.textures.exists(portraitKey(run.characterId))?portraitKey(run.characterId):selectionPortraitKey(run.characterId);
  let hero:Phaser.GameObjects.Image|undefined;
  if(scene.textures.exists(key)){
   hero=view.add(scene.add.image(heroBox.x+heroBox.width/2,heroBox.y+heroBox.height/2,key).setName('result-art/hero').setData('assetId',run.characterId+'.portrait'));
   // Never enlarge a low-resolution fallback. The high-quality asset loads asynchronously.
   hero.setScale(Math.min(1,heroBox.width/hero.width,heroBox.height/hero.height));
   hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});
  }
  text(heroBox.x,heroBox.y+heroBox.height+12,getCharacter(run.characterId).name,compact?24:30,heroBox.width,C.ink,'result/hero-name').setFontFamily('Georgia, "Noto Serif SC", SimSun, serif').setFontStyle('bold');
  if(facts.hero)text(heroBox.x,heroBox.y+heroBox.height+48,'末手 · '+(facts.heroSkill??'')+' '+facts.heroCopy.replace('本手兑现 · ',''),14,heroBox.width,C.jade,'result/hero-effect');
  artLayer.add(view.root.list.slice(start));return hero;
 };
 const hero=paint();
 const reward={x:l.next.x,y:b.y+40,width:l.next.width,height:68};
 text(reward.x,b.y+8,lost?'本局留档':skipped?'换场记录':'本场所得',16,reward.width,C.jade,'result/reward-heading');
 let rewardText:Phaser.GameObjects.Text|undefined;
 if(cleared&&!skipped&&rewardLabel){
  rewardText=text(reward.x+reward.width/2,reward.y+8,rewardLabel,22,reward.width-48,C.ink,'result/reward').setOrigin(.5,0).setFontStyle('bold');
  reward.height=Math.max(reward.height,rewardText.height+16);
 }else text(reward.x,reward.y+8,lost?'成绩已记录，下一局重新启程。':'跳场所得见下方记录。',16,reward.width,C.ink,'result/receipt-state');
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
