import {drawRiverScroll} from './RiverScroll';
import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import type {shopLayout} from './ShopLayout';
import {PAPER_THEME as T} from './theme';

/** Crop the riverfront along the shop sign. Product art and quotes have their own paper. */
export function drawShopBackdrop(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>):void {
 const width=view.layout.width;
 if(!p.pc&&!p.portrait)view.add(scene.add.rectangle(0,0,width,view.layout.height,0xefeee5).setOrigin(0).setName('shop-art/backdrop'));
 const y=p.pc?0:Math.max(0,p.top-8),bottom=p.top+(p.pc?54:p.portrait?48+(p.headerRows-1)*44:42);
 view.add(scene.add.graphics().fillStyle(0x193d35).fillRect(0,y,width,bottom-y).lineStyle(2,0xb79e6c,.9).lineBetween(0,bottom,width,bottom).setName(p.pc?'shop-art/pc-header':'shop-art/ink-header'));
 drawRiverScroll(scene,view,{x:0,y,width,height:bottom-y-1},.68,.26);
}

/** Quiet sheets follow published shop rectangles; decoration owns no input. */
export function shopSheet(scene:Phaser.Scene,view:SceneView,name:string,b:Box,color:number,raised=false,outlined=false):void {
  if(b.width<=0||b.height<=0)return;
  const g=scene.add.graphics().setName('shop-art/'+name).setData('bounds',{...b});
  if(raised)g.fillStyle(T.ink,.065).fillRoundedRect(b.x,b.y+2,b.width,b.height,6);
  g.fillStyle(color).fillRoundedRect(b.x,b.y,b.width,b.height,6);view.add(g);
  if(outlined)view.add(scene.add.graphics().lineStyle(1,T.jade,.6).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,6).setName('shop-art/offer-edge').setData('bounds',{...b}));
  if(scene.textures.exists('p00-paper')&&b.width>8&&b.height>8)view.add(scene.add.tileSprite(b.x+4,b.y+4,b.width-8,b.height-8,'p00-paper').setOrigin(0).setAlpha(.09).setName('shop-art/'+name+'-paper'));
}

export function drawShopArt(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>):void {
  const pc=p.pc;
  if(pc){
    const g=scene.add.graphics().setName('shop-art/pc-frame');
    const panel=(b:Box,fill:number)=>{
      g.fillStyle(T.ink,.1).fillRoundedRect(b.x,b.y+4,b.width,b.height,8)
       .fillStyle(fill).fillRoundedRect(b.x,b.y,b.width,b.height,8)
       .lineStyle(1,0xb7a484,.8).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,8);
    };
    panel(pc.left,0xdccdba);panel(pc.ownedRail,0xf4eddb);panel(pc.shopPanel,0xd9c9a9);
    g.lineStyle(1,0xb7a484,.7).lineBetween(pc.shopPanel.x+12,p.play.y-12,pc.shopPanel.x+pc.shopPanel.width-12,p.play.y-12);
    view.add(g);
  }else if(p.short){
    shopSheet(scene,view,'stock',{x:p.tabs.x-4,y:p.tabs.y-4,width:p.tabs.width+8,height:Math.max(...p.shelf.map(b=>b.y+b.height))+6-p.tabs.y},T.paperLight);
    shopSheet(scene,view,'entry',{x:p.play.x-4,y:p.play.y-4,width:p.play.width+8,height:p.play.height+8},T.jadeSoft);
  }else if(p.portrait){
    // On phones the native list scrolls inside one continuous sheet. The
    // sheet is deliberately broader than the cards so the safe-area gutter
    // remains visible while the user scrolls the shelf.
    const bottom=Math.min(view.layout.height,p.play.y-8);
    shopSheet(scene,view,'mobile-shelf',{x:p.x-4,y:p.tabs.y-4,width:p.w+8,height:Math.max(44,bottom-p.tabs.y+8)},T.paperLight,true,true);
    shopSheet(scene,view,'mobile-actions',{x:p.x-4,y:p.play.y-4,width:p.w+8,height:view.layout.height-p.play.y+4},T.paperLight,false,false);
  }
}
