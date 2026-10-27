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
  const l=view.layout,{frame,main,build}=l.pc!,g=scene.add.graphics().setName('table-art/pc-paper').setData('bounds',frame);
  // Layered lacquer surround, warm card trays and a quiet jade playing field.
  // Every painted surface follows existing hit geometry and has no input.
  g.fillStyle(0x253e40).fillRect(0,0,l.width,l.height);
  g.fillStyle(0x172d30,.65).fillRoundedRect(frame.x-12,frame.y-12,frame.width+24,frame.height+24,18);
  g.fillStyle(0xe9ddc7).fillRoundedRect(frame.x-8,frame.y-16,frame.width+16,frame.height+24,14);
  g.lineStyle(2,0x9a8261,.8).strokeRoundedRect(frame.x-7,frame.y-15,frame.width+14,frame.height+22,13);
  g.fillStyle(0xf7f0e4).fillRoundedRect(l.hud.x,l.hud.y,l.hud.width,frame.height,9);
  g.lineStyle(1,0xc4b397).strokeRoundedRect(l.hud.x+.5,l.hud.y+.5,l.hud.width-1,frame.height-1,9);
  g.fillStyle(0xe1d3bc).fillRoundedRect(build.x,build.y-4,build.width,build.height+8,9);
  g.lineStyle(1,0xb4a083,.8).strokeRoundedRect(build.x+.5,build.y-3.5,build.width-1,build.height+7,9);
  const stage=l.playedArea;
  g.fillStyle(0xc6d7cf).fillRoundedRect(stage.x,stage.y,stage.width,stage.height,10);
  g.lineStyle(2,0x718f88,.7).strokeRoundedRect(stage.x+1,stage.y+1,stage.width-2,stage.height-2,9);
  g.lineStyle(1,0xf6f1e5,.6).strokeRoundedRect(stage.x+5,stage.y+5,stage.width-10,stage.height-10,6);
  g.fillStyle(0x26313a,.12).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y+3,l.scoreBoard.width,l.scoreBoard.height,9);
  g.fillStyle(0xfff9ee).fillRoundedRect(l.scoreBoard.x,l.scoreBoard.y,l.scoreBoard.width,l.scoreBoard.height,9);
  g.lineStyle(1,0xb4a083).strokeRoundedRect(l.scoreBoard.x+.5,l.scoreBoard.y+.5,l.scoreBoard.width-1,l.scoreBoard.height-1,9);
  g.fillStyle(0xf6eee0).fillRoundedRect(main.x,l.hand.y-8,main.width,l.actions.y+l.actions.height-l.hand.y+16,9);
  g.lineStyle(1,0xc4b397,.8).strokeRoundedRect(main.x+.5,l.hand.y-7.5,main.width-1,l.actions.y+l.actions.height-l.hand.y+15,9);
  g.lineStyle(3,T.red,.8).lineBetween(main.x+12,frame.y-9,main.x+64,frame.y-9);
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

