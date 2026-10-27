import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import type {shopLayout} from './ShopLayout';
import type {CharacterId} from './characters';
import {PAPER_THEME as T} from './theme';

/** The same dark ink header leads into a cool paper shop, without recoloring card art. */
export function drawShopBackdrop(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>,_hero?:CharacterId):void {
 if(p.pc){
  const edge=p.top+54;
  view.add(scene.add.graphics().fillStyle(0x203f3b).fillRect(0,0,view.layout.width,edge).lineStyle(1,0xc2a773,.85).lineBetween(0,edge,view.layout.width,edge).setName('shop-art/pc-header'));
  return;
 }
 if(!p.portrait)view.add(scene.add.rectangle(0,0,view.layout.width,view.layout.height,0xefeee5).setOrigin(0).setName('shop-art/backdrop'));
 const edge=p.top+(p.portrait?48+(p.headerRows-1)*44:42),y=Math.max(0,p.top-8);
 view.add(scene.add.graphics().fillStyle(0x203f3b,1).fillRect(0,y,view.layout.width,edge-y).lineStyle(1,0xb7a36d,.8).lineBetween(p.x,edge,p.x+p.w,edge).setName('shop-art/ink-header'));
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
    panel(pc.left,0xe6dcc8);panel(pc.ownedRail,0xf5eddd);panel(pc.shopPanel,0xe7dcc7);
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
