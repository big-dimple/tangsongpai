import type Phaser from 'phaser';
import type {R2RunState} from '../domain/r2Run';
import type {SceneView} from './SceneView';
import type {Box} from './layout';
import type {settlementFacts} from './SettlementPresentation';
import {pcHeroKey} from './PcHeroArt';
import {heatText} from './scoreText';
import {PAPER_CSS as C,SCORE_FONT} from './theme';
import {drawSettlementHand} from './SettlementHand';

export const mobileResultViewport=(width:number,height:number)=>width<700&&height>width;
/** A vertical result: hero/score masthead, full-width receipt, then destination and actions. */
export function drawMobileSettlement(scene:Phaser.Scene,view:SceneView,b:Box,run:R2RunState,cleared:boolean,skipped:boolean,facts:ReturnType<typeof settlementFacts>,formulaOverride?:string,rewardLabel?:string){
 const lost=!cleared&&!skipped,compact=view.layout.height<700,artHeight=220,textWidth=Math.max(160,b.width*.60),textX=b.x+b.width-textWidth;
 const fit=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const t=view.text(x,y,copy,size,color).setName(name);for(let n=size;t.width>width&&n>14;)t.setFontSize(--n);
  if(t.width>width)t.setWordWrapWidth(width,true);return t;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 // Full source frame aligned to the left screen edge and receipt baseline.
 const tag=fit(textX,b.y+16,skipped?'本场跳过':'本场总热度',14,textWidth,C.jade,'result/hand');
 const score=fit(textX,tag.y+tag.height+8,heatText(facts.stageTotal),compact?38:48,textWidth,lost?C.ink:facts.tier>=2?C.red:C.ink,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',facts.stageTotal).setData('mobilePoster',true);
 if(score.width>textWidth)score.setScale(textWidth/score.width);
 const formula=formulaOverride?.split(' · ')[0]??(skipped?'没有本场计分':lost?'目标 '+heatText(run.stage!.targetHeat):'目标 '+heatText(run.stage!.targetHeat)+'\n已过关');
 const target=fit(textX,score.y+score.displayHeight+10,formula,14,textWidth,C.jade,'result/formula');
 let infoBottom=target.y+target.height;
 if(facts.handLabel){
  const hand=fit(textX,infoBottom+8,'本手牌型 · '+facts.handLabel,15,textWidth,C.ink,'result/hand-type').setFontStyle('bold');
  const combo=drawSettlementHand(view,facts.trace!,textX,hand.y+hand.height+3,textWidth,13);
  const explanation=fit(textX,combo.bottom+3,'得分解释 · '+facts.scoreExplanation,13,textWidth,C.jade,'result/score-explanation');
  infoBottom=explanation.y+explanation.height;
 }


 const artBottom=Math.max(b.y+artHeight,infoBottom+12);
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);if(!scene.textures.exists(key))return;
  const box={x:0,y:b.y,width:textX-10,height:artBottom-b.y};
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,box.width/hero.width,box.height/hero.height));
  hero.setPosition(hero.displayWidth/2,box.y+box.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});artLayer.add(hero);return hero;
 };
 const hero=paint(),reward={x:b.x,y:artBottom+8,width:b.width,height:36};
 const rewardText=fit(reward.x+reward.width/2,reward.y+4,cleared&&!skipped?rewardLabel??'本场奖励已保存':skipped?'换场所得见下方记录':'成绩已记录',16,reward.width-44,C.ink,'result/reward').setOrigin(.5,0).setFontStyle('bold');
 reward.height=Math.max(36,rewardText.height+8);
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){
  reviewBookBand={x:b.x,y:reward.y+reward.height+6,width:b.width,height:24};
  const receipt=fit(reviewBookBand.x,reviewBookBand.y,facts.reviewBook.label,14,reviewBookBand.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);
  reviewBookBand.height=Math.max(24,receipt.height);
 }
 const height=(reviewBookBand?reviewBookBand.y+reviewBookBand.height:reward.y+reward.height)-b.y;
 return {facts,score,reward,rewardText,paint,hero,stage:{...b,height},reviewBookBand};
}
