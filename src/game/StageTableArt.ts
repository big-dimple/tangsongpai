import {whenTextureReady} from './LateTextureArt';
import type Phaser from 'phaser';
import {playedFootprint,intersects,type Box,type TableLayout} from './layout';
import {toolInventoryPlayedArea} from './ToolInventoryEntry';
import {selectionPortraitKey} from './portraits';
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
  const l=view.layout,{frame,main,focusSpine,focusGap}=l.pc!,g=scene.add.graphics().setName('table-art/pc-paper').setData('bounds',frame);
  // One open sheet, with a darker identity edge and two live lanes. The
  // score spine and landing lane carry different weights so the current hand
  // remains the foreground instead of becoming another equal card panel.
  const bottom=frame.y+frame.height,right=main.x+main.width;
  const rackBottom=l.jokers.y+l.jokers.height+8,handTop=l.hand.y-8;
  const score=l.scoreBoard,played=l.playedArea;
  g.fillStyle(T.paper,.98).fillRect(frame.x,frame.y,frame.width,frame.height);
  g.fillStyle(T.paperEdge,.36).beginPath().moveTo(frame.x,frame.y)
    .lineTo(main.x-22,frame.y).lineTo(main.x-8,bottom).lineTo(frame.x,bottom).closePath().fillPath();
  g.fillStyle(T.paperLight,.56).fillRect(main.x,main.y,main.width,main.height);
  // The cool, quiet centre makes the warm card faces read as the active layer.
  const focusTop=Math.min(handTop,rackBottom+12);
  g.fillStyle(T.jadeSoft,.42).beginPath().moveTo(main.x,focusTop)
    .lineTo(right,focusTop).lineTo(right,handTop).lineTo(main.x+18,handTop).closePath().fillPath();
  // Score and played cards share one working plane, but the score lane is
  // quieter and narrower than the broad landing lane.
  g.fillStyle(T.redSoft,.26).fillRoundedRect(score.x,score.y,score.width,score.height,10);
  g.fillStyle(T.paperLight,.72).fillRoundedRect(played.x,played.y,played.width,played.height,10);
  g.lineStyle(1,T.red,.28).strokeRoundedRect(score.x+.5,score.y+.5,Math.max(0,score.width-1),Math.max(0,score.height-1),10);
  g.lineStyle(1,T.jade,.26).strokeRoundedRect(played.x+.5,played.y+.5,Math.max(0,played.width-1),Math.max(0,played.height-1),10);
  // The hand rises out of a white paper lip. All geometry still comes from layout.
  g.fillStyle(T.ink,.045).fillRect(main.x,handTop,main.width,5);
  g.fillStyle(T.paperLight,.94).beginPath().moveTo(main.x+18,handTop+5)
    .lineTo(right,handTop+5).lineTo(right,bottom).lineTo(main.x,bottom)
    .lineTo(main.x,handTop+23).closePath().fillPath();
  g.lineStyle(1,T.jade,.24).lineBetween(main.x-16,frame.y+8,main.x-16,bottom-8);
  g.lineStyle(3,T.red,.65).lineBetween(frame.x+12,frame.y,frame.x+54,frame.y);
  g.lineStyle(1,T.ink,.16).lineBetween(main.x,rackBottom,right,rackBottom);
  // Short repeated marks belong to the five real build slots, not extra seats.
  for(const slot of l.slots){
    const cx=slot.x+slot.width/2;
    g.lineStyle(2,T.jade,.32).lineBetween(cx-12,rackBottom,cx+12,rackBottom);
    g.lineStyle(1,T.jade,.16).lineBetween(cx,rackBottom,cx,rackBottom+4);
  }
  const spine=focusSpine??{x:score.x+score.width+focusGap/2,y:score.y,width:2,height:score.height};
  g.lineStyle(2,T.red,.52).lineBetween(spine.x,spine.y+10,spine.x,spine.y+spine.height-10);
  g.fillStyle(T.red,.75).fillCircle(spine.x+1,score.y+10,3);
  g.fillStyle(T.jade,.55).fillCircle(spine.x+1,played.y+played.height-10,3);
  g.lineStyle(1,T.ink,.17).lineBetween(main.x+24,handTop+5,right,handTop+5);
  // One measured accent at the action edge echoes the red result seal.
  g.lineStyle(2,T.red,.45).lineBetween(right-44,bottom,right,bottom);
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
 sheet('surface',plan.surface,T.jadeSoft,T.jade,true);
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

