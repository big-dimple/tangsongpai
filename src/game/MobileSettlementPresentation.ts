import type Phaser from 'phaser';
import type {R2RunState} from '../domain/r2Run';
import type {SceneView} from './SceneView';
import type {Box} from './layout';
import type {settlementFacts} from './SettlementPresentation';
import {pcHeroKey,PC_HERO_COMPOSITION} from './PcHeroArt';
import {getCharacter} from './characters';
import {heatText} from './scoreText';
import {PAPER_CSS as C,PAPER_THEME as T,SCORE_FONT} from './theme';

export const mobileResultViewport=(width:number,height:number)=>width<700&&height>width;
/** A vertical result: hero/score masthead, full-width receipt, then destination and actions. */
export function drawMobileSettlement(scene:Phaser.Scene,view:SceneView,b:Box,run:R2RunState,cleared:boolean,skipped:boolean,facts:ReturnType<typeof settlementFacts>,formulaOverride?:string,rewardLabel?:string){
 const lost=!cleared&&!skipped,compact=view.layout.height<700,artHeight=Math.max(174,b.height-20),textWidth=Math.max(112,b.width*.39-10);
 const fit=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const t=view.text(x,y,copy,size,color).setName(name);for(let n=size;t.width>width&&n>14;)t.setFontSize(--n);
  if(t.width>width)t.setWordWrapWidth(width,true);return t;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 // The hero owns the right side of the composition. The wash is an irregular
 // paper edge rather than a portrait frame, so the silhouette can breathe
 // past it without looking pasted into a badge.
 const heroStart=b.x+Math.max(b.width*.48,textWidth+16);
 const washLeft=heroStart-8,washRight=b.x+b.width-4,washTop=b.y+5,washBottom=b.y+artHeight-7;
 const wash=[
  {x:washLeft+13,y:washTop},{x:washRight-10,y:washTop+4},{x:washRight,y:washTop+22},
  {x:washRight-5,y:washBottom-16},{x:washRight-19,y:washBottom},{x:washLeft+22,y:washBottom-4},
  {x:washLeft+7,y:washBottom-18},{x:washLeft+17,y:washTop+artHeight*.48},{x:washLeft+5,y:washTop+34},
 ];
 // The cutout remains transparent and independent; keep the information
 // column readable without a portrait color block.
 const tag=fit(b.x,b.y+16,skipped?'本场跳过':'本场总热度',14,textWidth,C.jade,'result/hand');
 const score=fit(b.x,tag.y+tag.height+8,heatText(facts.stageTotal),compact?38:48,textWidth,lost?C.ink:facts.tier>=2?C.red:C.ink,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',facts.stageTotal).setData('pcPoster',true);
 if(score.width>textWidth)score.setScale(textWidth/score.width);
 const formula=formulaOverride?.split(' · ')[0]??(skipped?'没有本场计分':lost?'目标 '+heatText(run.stage!.targetHeat):'目标 '+heatText(run.stage!.targetHeat)+'\n已过关');
 const target=fit(b.x,score.y+score.displayHeight+10,formula,14,textWidth,C.jade,'result/formula');
 let infoBottom=target.y+target.height;
 if(facts.handLabel){
  const hand=fit(b.x,infoBottom+8,'本手牌型 · '+facts.handLabel,15,textWidth,C.ink,'result/hand-type').setFontStyle('bold');
  const combo=fit(b.x,hand.y+hand.height+3,'使用组合 · '+(facts.handCards??'已保存'),13,textWidth,C.jade,'result/hand-combo');
  const explanation=fit(b.x,combo.y+combo.height+3,'得分解释 · '+facts.scoreExplanation,13,textWidth,C.jade,'result/score-explanation');
  infoBottom=explanation.y+explanation.height;
 }
 if(!compact&&facts.tier>=2&&!lost&&!skipped)fit(b.x,infoBottom+8,facts.tag,18,textWidth,C.red,'result/tier');
 fit(b.x,b.y+artHeight-25,getCharacter(run.characterId).name,compact?20:24,textWidth,C.ink,'result/hero-name').setFontStyle('bold');
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);if(!scene.textures.exists(key))return;
  const c=PC_HERO_COMPOSITION[run.characterId],box={x:heroStart,y:b.y-2,width:Math.max(1,b.x+b.width-heroStart),height:artHeight+2};
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,box.width/hero.width,box.height/hero.height)*c.scale);
  hero.setPosition(box.x+hero.displayWidth/2+(box.width-hero.displayWidth)*c.align,box.y+box.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});artLayer.add(hero);return hero;
 };
 const hero=paint(),reward={x:b.x,y:b.y+artHeight+8,width:b.width,height:36};
 const rewardText=fit(reward.x+reward.width/2,reward.y+4,cleared&&!skipped?rewardLabel??'本场奖励已保存':skipped?'换场所得见下方记录':'成绩已记录',16,reward.width-44,C.ink,'result/reward').setOrigin(.5,0).setFontStyle('bold');
 reward.height=Math.max(36,rewardText.height+8);
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){reviewBookBand={x:b.x,y:reward.y+reward.height+6,width:b.width,height:24};fit(b.x,reviewBookBand.y,facts.reviewBook.label,14,b.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);}
 const height=(reviewBookBand?reviewBookBand.y+reviewBookBand.height:reward.y+reward.height)-b.y;
 return {facts,score,reward,rewardText,paint,hero,stage:{...b,height},reviewBookBand};
}
