import {drawRiverScroll} from './RiverScroll';
import {whenTextureReady} from './LateTextureArt';
import type Phaser from 'phaser';
import {playedFootprint,intersects,type Box,type TableLayout} from './layout';
import {toolInventoryPlayedArea} from './ToolInventoryEntry';
import {selectionPortraitKey} from './portraits';
import {pcHeroKey,PC_HERO_COMPOSITION} from './PcHeroArt';
import type {CharacterId} from './characters';
import type {SceneView} from './SceneView';
import {ATELIER_THEME as A} from './theme';
import {rasterizePaper} from './PaperStock';
import {paintAtelierBackdrop,paintLacquerPanel,paintLanternHalo} from './AtelierArt';

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
/** Rosewood-obsidian lacquer desk, lantern-lit hero niche, warm velvet playmat and ivory card contrasts. */
export function drawStageTableArt(scene:Phaser.Scene,view:SceneView,characterId:CharacterId,inspectHero?:()=>void,legacyPortrait=true,finale=false):void {
 const plan=stageTableArtPlan(view.layout);
 const playMat=(g:Phaser.GameObjects.Graphics,b:Box)=>{
  g.fillStyle(0x21171c).fillRoundedRect(b.x,b.y,b.width,b.height,7);
  g.lineStyle(1,0xd8b46c,.72).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,7);
  const inset=6,arm=Math.max(5,Math.min(20,b.height*.16));
  for(const [x,y,dx,dy] of [[b.x+inset,b.y+inset,1,1],[b.x+b.width-inset,b.y+inset,-1,1],[b.x+inset,b.y+b.height-inset,1,-1],[b.x+b.width-inset,b.y+b.height-inset,-1,-1]]){
   g.lineStyle(1.2,0xf5deb0,.62).beginPath().moveTo(x+dx*arm,y).lineTo(x,y).lineTo(x,y+dy*arm).strokePath();
  }
 };
 const addLacquer=(graphics:Phaser.GameObjects.Graphics,signature:unknown,finish:(c:CanvasRenderingContext2D,page:import('./PaperStock').PaperPage,density:number)=>void)=>{
  const {width,height}=view.layout;
  view.add(rasterizePaper(scene,graphics,{slot:'table',width,height,signature,finish,sheet:true})??graphics);
 };
 if(view.layout.pc){
  const l=view.layout,{frame,main,build}=l.pc!,g=scene.add.graphics().setName('table-art/pc-paper').setData('bounds',frame);
  // Graphics fallback for headless environments without Canvas rasterization:
  g.fillStyle(A.void).fillRect(0,0,l.width,l.height);
  g.fillStyle(A.lacquer).fillRoundedRect(frame.x-8,frame.y-16,frame.width+16,frame.height+24,6);
  g.lineStyle(1,A.gold,.65).strokeRoundedRect(frame.x-7.5,frame.y-15.5,frame.width+15,frame.height+23,5);
  g.fillStyle(A.panelInset).fillRoundedRect(l.hud.x,l.hud.y,l.hud.width,frame.height,4);
  g.fillStyle(A.panelInset).fillRoundedRect(build.x,build.y-4,build.width,build.height+8,4);
  const stage=l.playedArea;
  playMat(g,stage);
  g.fillStyle(A.panel).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y,l.scoreBoard.width,l.scoreBoard.height,4);
  g.fillStyle(A.panelInset).fillRoundedRect(main.x,l.hand.y-8,main.width,l.actions.y+l.actions.height-l.hand.y+16,4);
  const outerBox:Box={x:frame.x-8,y:frame.y-16,width:frame.width+16,height:frame.height+24};
  const hudBox:Box={x:l.hud.x,y:l.hud.y,width:l.hud.width,height:frame.height};
  const buildBox:Box={x:build.x,y:build.y-4,width:build.width,height:build.height+8};
  const handTray:Box={x:main.x,y:l.hand.y-8,width:main.width,height:l.actions.y+l.actions.height-l.hand.y+16};
  const heroSlot=l.pc!.heroPortrait;
  addLacquer(g,['pc-rosewood-atelier',finale,l.width,l.height,frame,main,build,l.hud,stage,l.scoreBoard,l.hand,l.actions],(c,page)=>{
   paintAtelierBackdrop(c,page,{finale,holes:[{box:outerBox,radius:6}]});
   paintLacquerPanel(c,outerBox,6,'panel',{corners:true,shadow:true});
   paintLacquerPanel(c,hudBox,4,'inset',{shadow:false,accentBar:'gold'});
   if(heroSlot)paintLanternHalo(c,heroSlot.x+heroSlot.width*.5,heroSlot.y+heroSlot.height*.44,heroSlot.width*.46,heroSlot.height*.38,.95);
   paintLacquerPanel(c,buildBox,4,'inset',{shadow:false});
   // Preserve clean warm rosewood-velvet playmat inside outer lacquer surround
   c.save();
   c.fillStyle='#21171c';
   c.beginPath();c.roundRect(stage.x,stage.y,stage.width,stage.height,7);c.fill();
   c.strokeStyle='rgba(216,180,108,0.72)';c.lineWidth=1;c.stroke();
   c.restore();
   paintLacquerPanel(c,l.scoreBoard,4,'score',{corners:true,shadow:true,accentBar:finale?'cinnabar':'gold'});
   paintLacquerPanel(c,handTray,4,'inset',{shadow:false});
   // Signature cinnabar seal-line accent above hand/top left
   c.fillStyle='rgba(201,75,59,0.92)';
   c.fillRect(main.x+14,frame.y-10,54,3);
  });
  drawRiverScroll(scene,view,{x:stage.x+7,y:stage.y+7,width:stage.width-14,height:stage.height-14},.62,.62);
  return;
 }
 function sheet(name:string,b:Box,color:number,edge:number,shadow=false):void {
  if(b.width<=0||b.height<=0)return;
  const g=scene.add.graphics().setName('table-art/'+name).setData('bounds',{...b});
  if(shadow)g.fillStyle(0x06040a,.46).fillRoundedRect(b.x,b.y+3,b.width,b.height,8);
  g.fillStyle(color,.96).fillRoundedRect(b.x,b.y,b.width,b.height,8).lineStyle(1,edge,.52).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,8);
  const inset=5,corner=Math.min(16,b.height/5);g.lineStyle(1,0xf5deb0,.32);
  for(const [x,y,dx,dy] of [[b.x+inset,b.y+inset,1,1],[b.x+b.width-inset,b.y+b.height-inset,-1,-1]])g.beginPath().moveTo(x,y+dy*corner).lineTo(x,y).lineTo(x+dx*corner,y).strokePath();
  view.add(g);
 }
 if(view.layout.mode==='portrait'){
  const l=view.layout,accent=scene.add.graphics().setName('table-art/mobile-arena').setData('bounds',plan.surface);
  accent.fillStyle(A.lacquer,.98).fillRoundedRect(plan.surface.x,plan.surface.y,plan.surface.width,plan.surface.height,4);
  accent.fillStyle(0x1b1520,.98).fillRect(plan.program.x,plan.program.y,plan.program.width,plan.program.height);
  accent.fillStyle(A.panel,.96).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y,l.scoreBoard.width,l.scoreBoard.height,4);
  const mat={...l.playedArea,height:Math.max(l.playedArea.height,l.heroAction.y-5-l.playedArea.y)};
  playMat(accent,mat);
  const handTray:Box={x:l.hand.x-4,y:l.hand.y-8,width:l.hand.width+8,height:l.actions.y+l.actions.height-l.hand.y+12};
  accent.fillStyle(A.panelInset,.98).fillRect(handTray.x,handTray.y,handTray.width,handTray.height);
  const matBox=mat,scoreBox=l.scoreBoard;
  addLacquer(accent,['portrait-rosewood-atelier',finale,l.width,l.height,plan.surface,plan.program,scoreBox,matBox,l.hand,l.actions],(c,page)=>{
   paintAtelierBackdrop(c,page,{finale});
   paintLacquerPanel(c,plan.surface,4,'panel',{shadow:true});
   c.save();
   c.fillStyle='#1b1520';
   c.fillRect(plan.program.x,plan.program.y,plan.program.width,plan.program.height);
   c.strokeStyle='rgba(216,180,108,0.48)';c.lineWidth=1;
   c.beginPath();c.moveTo(plan.program.x,plan.program.y+plan.program.height-.5);c.lineTo(plan.program.x+plan.program.width,plan.program.y+plan.program.height-.5);c.stroke();
   c.restore();
   paintLacquerPanel(c,scoreBox,4,'score',{shadow:true,accentBar:'gold'});
   c.save();
   c.fillStyle='#21171c';
   c.beginPath();c.roundRect(matBox.x,matBox.y,matBox.width,matBox.height,7);c.fill();
   c.strokeStyle='rgba(216,180,108,0.68)';c.lineWidth=1;c.stroke();
   c.restore();
   paintLacquerPanel(c,handTray,4,'inset',{shadow:false,accentBar:'cinnabar'});
  });
  drawRiverScroll(scene,view,{x:mat.x+6,y:mat.y+6,width:mat.width-12,height:mat.height-12},.62,.52);
  const holder=view.add(scene.add.container(0,0).setName('table-art/mobile-hero-layer'));
  whenTextureReady(scene,holder,pcHeroKey(characterId),()=>{
   const key=pcHeroKey(characterId),source=scene.textures.get(key).getSourceImage() as HTMLImageElement;
   const area=mat,composition=PC_HERO_COMPOSITION[characterId],width=area.width*.56,height=area.height*.96;
   const scale=Math.min(width/source.width,height/source.height)*composition.scale;
   const image=scene.add.image(area.x+area.width*.78,area.y+area.height*.56,key).setScale(scale).setAlpha(.72).setName('table-art/mobile-hero');
   image.setData('assetId',characterId+'.pc').setData('bounds',{x:image.x-image.displayWidth/2,y:image.y-image.displayHeight/2,width:image.displayWidth,height:image.displayHeight});holder.add(image);
  });
 } else sheet('surface',plan.surface,A.panel,A.gold,true);
 sheet('program',plan.program,A.panelInset,A.gold);
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

