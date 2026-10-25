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
 const lost=!cleared&&!skipped,compact=view.layout.height<700,artHeight=b.height-52,textWidth=b.width*.4-10;
 const fit=(x:number,y:number,copy:string,size:number,width:number,color=C.ink,name='')=>{
  const t=view.text(x,y,copy,size,color).setName(name);for(let n=size;t.width>width&&n>14;)t.setFontSize(--n);
  if(t.width>width)t.setWordWrapWidth(width,true);return t;
 };
 const paper=view.add(scene.add.graphics().setName('result-art/stage').setData('bounds',b));
 paper.fillStyle(lost?T.jadeSoft:T.paperLight,.65).fillCircle(b.x+b.width*.68,b.y+artHeight*.46,Math.min(b.width*.31,artHeight*.43));
 paper.lineStyle(2,lost?T.jade:T.red,.7).lineBetween(b.x,b.y+4,b.x+36,b.y+4)
  .lineStyle(1,lost?T.jade:T.red,.3).lineBetween(b.x,b.y+artHeight+1,b.x+b.width,b.y+artHeight+1);
 const tag=fit(b.x,b.y+16,skipped?'本场跳过':lost?'本局结果':'本场总热度',14,textWidth,C.jade,'result/hand');
 const score=fit(b.x,tag.y+tag.height+8,heatText(facts.stageTotal),compact?38:48,textWidth,lost?C.ink:facts.tier>=2?C.red:C.ink,'result/score').setFontFamily(SCORE_FONT).setFontStyle('bold').setData('exactScore',facts.stageTotal).setData('pcPoster',true);
 if(score.width>textWidth)score.setScale(textWidth/score.width);
 const formula=formulaOverride?.split(' · ')[0]??(skipped?'没有本场计分':lost?'目标 '+heatText(run.stage!.targetHeat):'目标 '+heatText(run.stage!.targetHeat)+'\n已过关');
 const target=fit(b.x,score.y+score.displayHeight+10,formula,14,textWidth,C.jade,'result/formula');
 if(!compact&&facts.tier>=2&&!lost&&!skipped)fit(b.x,target.y+target.height+8,facts.tag,18,textWidth,C.red,'result/tier');
 fit(b.x,b.y+artHeight-26,getCharacter(run.characterId).name,compact?20:24,textWidth,C.ink,'result/hero-name').setFontStyle('bold');
 const artLayer=view.add(scene.add.container(0,0).setName('result-art/source-layer'));
 const paint=()=>{
  artLayer.removeAll(true);const key=pcHeroKey(run.characterId);if(!scene.textures.exists(key))return;
  const c=PC_HERO_COMPOSITION[run.characterId],box={x:b.x+b.width*.4,y:b.y,width:b.width*.6,height:artHeight-4};
  const hero=scene.add.image(0,0,key).setName('result-art/hero').setData('assetId',run.characterId+'.pc');
  hero.setScale(Math.min(1,box.width/hero.width,box.height/hero.height)*c.scale);
  hero.setPosition(box.x+hero.displayWidth/2+(box.width-hero.displayWidth)*c.align,box.y+box.height-hero.displayHeight/2);
  hero.setData('bounds',{x:hero.x-hero.displayWidth/2,y:hero.y-hero.displayHeight/2,width:hero.displayWidth,height:hero.displayHeight});artLayer.add(hero);return hero;
 };
 const hero=paint(),reward={x:b.x,y:b.y+artHeight+8,width:b.width,height:36};
 view.add(scene.add.graphics().lineStyle(1,lost?T.jade:T.red,.65).lineBetween(reward.x,reward.y-4,reward.x+Math.min(reward.width,52),reward.y-4).setName('result/reward-rule'));
 const rewardText=fit(reward.x+reward.width/2,reward.y+4,cleared&&!skipped?rewardLabel??'本场奖励已保存':skipped?'换场所得见下方记录':'成绩已记录',16,reward.width-44,C.ink,'result/reward').setOrigin(.5,0).setFontStyle('bold');
 reward.height=Math.max(36,rewardText.height+8);
 let reviewBookBand:Box|undefined;
 if(facts.reviewBook){reviewBookBand={x:b.x,y:reward.y+reward.height+6,width:b.width,height:24};fit(b.x,reviewBookBand.y,facts.reviewBook.label,14,b.width,C.jade,'result/review-book').setData('sourceEventId',facts.reviewBook.eventId).setData('clearId',facts.reviewBook.clearId);}
 const height=(reviewBookBand?reviewBookBand.y+reviewBookBand.height:reward.y+reward.height)-b.y;
 return {facts,score,reward,rewardText,paint,hero,stage:{...b,height},reviewBookBand};
}
