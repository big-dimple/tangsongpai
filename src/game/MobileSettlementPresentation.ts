import type Phaser from 'phaser';
import type {R2RunState} from '../domain/r2Run';
import type {SceneView} from './SceneView';
import type {Box} from './layout';
import type {settlementFacts} from './SettlementPresentation';
import {pcHeroKey} from './PcHeroArt';
import {heatText} from './scoreText';
import {PAPER_THEME as T,PAPER_CSS as C,SCORE_FONT} from './theme';
import {drawSettlementHand} from './SettlementHand';

export const mobileResultViewport=(width:number,height:number)=>width<700&&height>width;
/** A vertical result: hero/score masthead, full-width hand receipt, then destination and actions. */
export function drawMobileSettlement(scene:Phaser.Scene,view:SceneView,b:Box,run:R2RunState,cleared:boolean,skipped:boolean,facts:ReturnType<typeof settlementFacts>,formulaOverride?:string,rewardLabel?:string){
 const lost=!cleared&&!skipped,compact=view.layout.height<700,headerHeight=compact?184:216,textWidth=b.width*.56,textX=b.x+b.width-textWidth;
 const fit=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const t=view.text(x,y,copy,size,color).setName(name);for(let n=size;t.width>width&&n>14;)t.setFontSize(--n);
  if(t.width>width)t.setWordWrapWidth(width,true);return t;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 // The masthead carries only the result. The played hand gets its own full-width
 // receipt below, rather than competing with the number in a narrow right rail.
 const tag=fit(textX,b.y+18,skipped?'本场跳过':'本场总得分',14,textWidth-12,C.jade,'result/hand');
 const score=fit(textX,tag.y+tag.height+8,heatText(facts.stageTotal),compact?38:50,textWidth-12,lost?C.ink:facts.tier>=2?C.red:C.ink,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',facts.stageTotal).setData('mobilePoster',true);
 if(score.width>textWidth-12)score.setScale((textWidth-12)/score.width);
 const formula=formulaOverride?.split(' · ')[0]??(skipped?'没有本场计分':lost?'目标 '+heatText(run.stage!.targetHeat):'目标 '+heatText(run.stage!.targetHeat)+'\n已过关');
 const target=fit(textX,score.y+score.displayHeight+10,formula,14,textWidth-12,C.jade,'result/formula');
 const artBottom=b.y+headerHeight;
 let contentBottom=Math.max(artBottom,target.y+target.height);
 if(facts.handLabel){
  const hand=fit(b.x,artBottom+12,(lost?'末手牌型 · ':'致胜牌型 · ')+facts.handLabel,16,b.width,C.ink,'result/hand-type').setFontStyle('bold');
  const combo=drawSettlementHand(view,facts.trace!,b.x,hand.y+hand.height+6,b.width,14);
  const explanation=fit(b.x,combo.bottom+5,'得分解释 · '+facts.scoreExplanation,14,b.width,C.jade,'result/score-explanation');
  contentBottom=explanation.y+explanation.height;
 }
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);if(!scene.textures.exists(key))return;
  const box={x:0,y:b.y,width:textX-10,height:headerHeight+12};
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,box.width/hero.width,box.height/hero.height));
  hero.setPosition(box.x+box.width/2,box.y+box.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});artLayer.add(hero);return hero;
 };
 const hero=paint(),reward={x:b.x,y:contentBottom+10,width:b.width,height:36};
 const rewardText=fit(reward.x+reward.width/2,reward.y+4,cleared&&!skipped?rewardLabel??'本场奖励已保存':skipped?'换场所得见下方记录':'成绩已记录',16,reward.width-44,C.ink,'result/reward').setOrigin(.5,0).setFontStyle('bold');
 reward.height=Math.max(36,rewardText.height+8);
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){
  reviewBookBand={x:b.x,y:reward.y+reward.height+6,width:b.width,height:24};
  const receipt=fit(reviewBookBand.x,reviewBookBand.y,facts.reviewBook.label,14,reviewBookBand.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);
  reviewBookBand.height=Math.max(24,receipt.height);
 }
 // Painted last on an earlier display object: panels stay behind every fact.
 paper.fillStyle(T.ink,.045).fillRoundedRect(textX-8,b.y+11,textWidth+8,headerHeight-13,10);
 paper.fillStyle(T.paperLight,.88).fillRoundedRect(textX-8,b.y+8,textWidth+8,headerHeight-16,10).lineStyle(1,T.divider,.7).strokeRoundedRect(textX-7.5,b.y+8.5,textWidth+7,headerHeight-17,10);
 paper.fillStyle(lost?T.jade:T.red,.82).fillRect(textX+4,b.y+8,42,3);
 if(facts.handLabel){
  const y=artBottom+4,height=contentBottom-artBottom+4;
  paper.fillStyle(T.paperLight,.72).fillRoundedRect(b.x,y,b.width,height,10).lineStyle(1,T.divider,.55).strokeRoundedRect(b.x+.5,y+.5,b.width-1,height-1,10);
 }
 const height=(reviewBookBand?reviewBookBand.y+reviewBookBand.height:reward.y+reward.height)-b.y;
 return {facts,score,reward,rewardText,paint,hero,stage:{...b,height},reviewBookBand};
}
