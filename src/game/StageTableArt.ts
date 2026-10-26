import {whenTextureReady} from './LateTextureArt';
import type Phaser from 'phaser';
import {playedFootprint,intersects,type Box,type TableLayout} from './layout';
import {toolInventoryPlayedArea} from './ToolInventoryEntry';
import {selectionPortraitKey} from './portraits';
import {pcHeroKey,PC_HERO_COMPOSITION} from './PcHeroArt';
import type {CharacterId} from './characters';
import type {SceneView} from './SceneView';
import {PAPER_THEME as T} from './theme';

export interface StageTableArtPlan {surface:Box;program:Box;rack:Box;hand:Box;stage:Box;portrait?:Box}
const fit=(l:TableLayout,b:Box):Box=>{const x=Math.max(0,b.x),y=Math.max(0,b.y);return{x,y,width:Math.max(0,Math.min(l.width,b.x+b.width)-x),height:Math.max(0,Math.min(l.height,b.y+b.height)-y)};};
/** Decoration follows final published rectangles. It never allocates seats or moves targets. */
export function stageTableArtPlan(l:TableLayout):StageTableArtPlan {
 if(l.pc){
  const {frame}=l.pc;
  return {surface:frame,program:{...l.hud,height:frame.height},rack:l.jokers,hand:l.hand,stage:playedFootprint(l.playedArea,false)};
 }
 const portrait=l.mode==='portrait',slots=l.slots,rackLeft=Math.min(...slots.map(b=>b.x)),rackRight=Math.max(...slots.map(b=>b.x+b.width)),rackBottom=Math.max(...slots.map(b=>b.y+b.height));
 const mainX=portrait?l.hand.x:l.jokers.x,mainRight=Math.max(l.hand.x+l.hand.width,l.jokers.x+l.jokers.width),top=l.jokers.y-8,bottom=l.actions.y+l.actions.height+4;
 const surface=fit(l,{x:mainX-8,y:top,width:mainRight-mainX+16,height:bottom-top});
 const program=fit(l,{...l.hud,height:l.mode==='desktop'?l.actions.y+l.actions.height-l.hud.y:l.hud.height});
 const plan:StageTableArtPlan={surface,program,rack:fit(l,{x:rackLeft-7,y:l.jokers.y-5,width:rackRight-rackLeft+14,height:rackBottom-l.jokers.y+10}),hand:fit(l,{x:l.hand.x-3,y:l.hand.y-2,width:l.hand.width+6,height:l.hand.height+4}),stage:playedFootprint(toolInventoryPlayedArea(l),portrait)};
 const imageTop=Math.max(l.hud.y+544,l.scoreBoard.y+l.scoreBoard.height+100),imageHeight=Math.min(140,program.y+program.height-imageTop-12);
 if(l.mode==='desktop'&&imageHeight>=112)plan.portrait={x:l.hud.x+(l.hud.width-100)/2,y:imageTop,width:100,height:imageHeight};
 return plan;
}
/** Existing paper/character art; an optional hero entry owns only its portrait bounds. */
export function drawStageTableArt(scene:Phaser.Scene,view:SceneView,characterId:CharacterId,inspectHero?:()=>void,legacyPortrait=true):void {
 const plan=stageTableArtPlan(view.layout);
 if(view.layout.pc){
  const l=view.layout,{frame,main,stage,build}=l.pc!,g=scene.add.graphics().setName('table-art/pc-paper').setData('bounds',frame);
  const bottom=frame.y+frame.height,right=main.x+main.width,handTop=l.hand.y-8;
  g.fillStyle(T.paper,.98).fillRect(frame.x,frame.y,frame.width,frame.height);
  // Hero wing: a paper field and ink wash make the transparent character feel
  // supported by the table instead of floating beside it.
  g.fillStyle(T.paperEdge,.9).fillRect(frame.x,frame.y,main.x-frame.x-14,frame.height);
  // An ink wash follows the lower silhouette instead of boxing the hero in a
  // rectangular panel; the transparent art supplies the actual contour.
  g.fillStyle(T.ink,.16).beginPath().moveTo(frame.x,frame.y+frame.height*.68)
    .lineTo(main.x-14,frame.y+frame.height*.52).lineTo(main.x-14,bottom)
    .lineTo(frame.x,bottom).closePath().fillPath();
  g.fillStyle(T.jade,.5).fillRect(main.x-14,frame.y,14,frame.height);
  g.fillStyle(T.paperLight,.94).fillRoundedRect(main.x,main.y,main.width,main.height,10);
  // Build row and target plate are deliberately separate cards of the paper.
  g.fillStyle(T.jadeSoft,.52).fillRoundedRect(build.x,build.y,build.width,build.height,10);
  g.lineStyle(1,T.jade,.4).strokeRoundedRect(build.x+.5,build.y+.5,build.width-1,build.height-1,10);
  g.fillStyle(T.redSoft,.48).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y,l.scoreBoard.width,l.scoreBoard.height,10);
  g.lineStyle(2,T.red,.5).strokeRoundedRect(l.scoreBoard.x+1,l.scoreBoard.y+1,l.scoreBoard.width-2,l.scoreBoard.height-2,10);
  // The centre stage is the largest uninterrupted surface. Its corner marks
  // and red seal give a clear landing point for the played hand.
  g.fillStyle(T.paper,.88).fillRoundedRect(stage.x,stage.y,stage.width,stage.height,12);
  g.lineStyle(1,T.jade,.46).strokeRoundedRect(stage.x+.5,stage.y+.5,stage.width-1,stage.height-1,12);
  g.lineStyle(1,T.jade,.2).lineBetween(stage.x+18,stage.y+28,stage.x+stage.width-18,stage.y+28);
  g.lineStyle(1,T.jade,.18).lineBetween(stage.x+18,stage.y+stage.height-24,stage.x+stage.width-18,stage.y+stage.height-24);
  const sealX=stage.x+stage.width-30,sealY=stage.y+30;
  g.lineStyle(2,T.red,.66).strokeCircle(sealX,sealY,12);g.lineStyle(1,T.red,.45).lineBetween(sealX-7,sealY,sealX+7,sealY);
  // Hand and action band sit on a bright foreground lip, keeping the next
  // interaction visually distinct from the stage without changing hit areas.
  g.fillStyle(T.paperLight,.98).fillRect(main.x,handTop,main.width,bottom-handTop);
  g.lineStyle(2,T.ink,.2).lineBetween(main.x,handTop,right,handTop);
  g.lineStyle(2,T.red,.52).lineBetween(right-64,bottom,right,bottom);
  g.lineStyle(1,T.jade,.25).lineBetween(main.x+20,handTop+7,right-20,handTop+7);
  view.add(g);
  return;
 }
 function sheet(name:string,b:Box,color:number,edge:number,shadow=false):void {
  if(b.width<=0||b.height<=0)return;
  const g=scene.add.graphics().setName('table-art/'+name).setData('bounds',{...b});
  if(shadow)g.fillStyle(T.ink,.055).fillRoundedRect(b.x,b.y+2,b.width,b.height,8);
  g.fillStyle(color).fillRoundedRect(b.x,b.y,b.width,b.height,8).lineStyle(1,edge,.3).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,8);
  const inset=5,corner=Math.min(16,b.height/5);g.lineStyle(1,edge,.24);
  for(const [x,y,dx,dy] of [[b.x+inset,b.y+inset,1,1],[b.x+b.width-inset,b.y+b.height-inset,-1,-1]])g.beginPath().moveTo(x,y+dy*corner).lineTo(x,y).lineTo(x+dx*corner,y).strokePath();
  view.add(g);
  if(scene.textures.exists('p00-paper'))view.add(scene.add.tileSprite(b.x+4,b.y+4,b.width-8,b.height-8,'p00-paper').setOrigin(0).setAlpha(color===T.jadeSoft ? .08 : .18).setName('table-art/'+name+'-paper'));
 }
 if(view.layout.mode==='portrait'){
  const l=view.layout,accent=scene.add.graphics().setName('table-art/mobile-arena').setData('bounds',plan.surface);
  accent.fillStyle(T.paper,.96).fillRoundedRect(plan.surface.x,plan.surface.y,plan.surface.width,plan.surface.height,12);
  accent.fillStyle(T.ink,.9).fillRect(plan.program.x,plan.program.y,plan.program.width,plan.program.height);
  accent.fillStyle(T.jadeSoft,.5).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y,l.scoreBoard.width,l.scoreBoard.height,10);
  accent.lineStyle(1,T.jade,.42).strokeRoundedRect(l.scoreBoard.x+.5,l.scoreBoard.y+.5,l.scoreBoard.width-1,l.scoreBoard.height-1,10);
  accent.fillStyle(T.paperLight,.98).fillRoundedRect(l.playedArea.x,l.playedArea.y,l.playedArea.width,l.playedArea.height,12);
  accent.lineStyle(1,T.red,.42).strokeRoundedRect(l.playedArea.x+.5,l.playedArea.y+.5,l.playedArea.width-1,l.playedArea.height-1,12);
  accent.fillStyle(T.paperLight,.99).fillRect(l.hand.x-4,l.hand.y-8,l.hand.width+8,l.actions.y-l.hand.y+8);
  accent.lineStyle(2,T.ink,.16).lineBetween(l.hand.x,l.hand.y-8,l.hand.x+l.hand.width,l.hand.y-8);
  accent.lineStyle(2,T.red,.48).lineBetween(l.actions.x,l.actions.y+l.actions.height,l.actions.x+l.actions.width,l.actions.y+l.actions.height);
  view.add(accent);
  // The supplied full-frame hero art is part of the table's atmosphere on
  // phones too. It sits behind the landing lane with a soft alpha so sleeves,
  // hair and weapons dissolve into the paper while the live cards stay crisp.
  const holder=view.add(scene.add.container(0,0).setName('table-art/mobile-hero-layer'));
  whenTextureReady(scene,holder,pcHeroKey(characterId),()=>{
   const key=pcHeroKey(characterId),source=scene.textures.get(key).getSourceImage() as HTMLImageElement;
   const area=l.playedArea,composition=PC_HERO_COMPOSITION[characterId],width=area.width*.56,height=area.height*.96;
   const scale=Math.min(width/source.width,height/source.height)*composition.scale;
   const image=scene.add.image(area.x+area.width*.78,area.y+area.height*.56,key).setScale(scale).setAlpha(.3).setName('table-art/mobile-hero');
   image.setData('assetId',characterId+'.pc').setData('bounds',{x:image.x-image.displayWidth/2,y:image.y-image.displayHeight/2,width:image.displayWidth,height:image.displayHeight});holder.add(image);
  });
 } else sheet('surface',plan.surface,T.jadeSoft,T.jade,true);
 sheet('program',plan.program,T.paper,T.brass);
 const key=selectionPortraitKey(characterId),box=plan.portrait;
 if(box&&legacyPortrait){
  const holder=view.add(scene.add.container(0,0).setName('table-art/character-holder'));
  if(inspectHero){const hit=view.rect(box).setFillStyle(0,0).setStrokeStyle(0);view.target(hit,'table-art/hero-details',{tap:inspectHero,detail:inspectHero});}
  whenTextureReady(scene,holder,key,()=>{
  const image=scene.add.image(box.x+box.width/2,box.y+box.height/2,key);image.setScale(Math.min(box.width/image.width,box.height/image.height)).setName('table-art/character').setData('assetId',characterId+'.selection').setData('bounds',box);holder.add(image);
  });
 }
}

/** A decorative caption must not paint over a selection/footer on tight two-row screens. */
export function playedCaptionBox(l:TableLayout,stage:Box):Box|undefined {
 const caption={x:stage.x,y:stage.y-18,width:Math.min(80,stage.width),height:18};
 return l.mode==='landscape'||caption.y<0||[l.hud,l.scoreBoard,...l.slots].some(b=>intersects(caption,b))?undefined:caption;
}

