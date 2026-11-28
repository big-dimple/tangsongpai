import {drawRiverScroll} from './RiverScroll';
import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import type {shopLayout} from './ShopLayout';
import {ATELIER_THEME as A} from './theme';
import {rasterizePaper} from './PaperStock';
import {paintAtelierBackdrop,paintLacquerPanel} from './AtelierArt';

/** Twilight riverfront along the shop signboard. Lacquer trays sit below. */
export function drawShopBackdrop(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>):void {
 const width=view.layout.width;
 if(!p.pc&&!p.portrait)view.add(scene.add.rectangle(0,0,width,view.layout.height,A.lacquer).setOrigin(0).setName('shop-art/backdrop'));
 const y=p.pc?0:Math.max(0,p.top-8),bottom=p.top+(p.pc?54:p.portrait?48+(p.headerRows-1)*44:42);
 view.add(scene.add.graphics().fillStyle(0x10282e).fillRect(0,y,width,bottom-y).lineStyle(1.5,A.gold,.72).lineBetween(0,bottom,width,bottom).setName(p.pc?'shop-art/pc-header':'shop-art/ink-header'));
 drawRiverScroll(scene,view,{x:0,y,width,height:bottom-y-1},.68,.36);
}

/** Deep celadon-lacquer sheets follow published shop rectangles; decoration owns no input. */
export function shopSheet(scene:Phaser.Scene,view:SceneView,name:string,b:Box,color:number,raised=false,outlined=false):void {
  if(b.width<=0||b.height<=0)return;
  const g=scene.add.graphics().setName('shop-art/'+name).setData('bounds',{...b});
  if(raised)g.fillStyle(0x040b0e,.42).fillRoundedRect(b.x,b.y+3,b.width,b.height,4);
  g.fillStyle(color,.96).fillRoundedRect(b.x,b.y,b.width,b.height,4);view.add(g);
  if(outlined)view.add(scene.add.graphics().lineStyle(1,A.goldSoft,.62).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,4).setName('shop-art/offer-edge').setData('bounds',{...b}));
}

export function drawShopArt(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>):void {
  const pc=p.pc;
  if(pc){
    const g=scene.add.graphics().setName('shop-art/pc-frame');
    const panel=(b:Box,fill:number)=>{
      g.fillStyle(fill).fillRoundedRect(b.x,b.y,b.width,b.height,4)
       .lineStyle(1,A.goldSoft,.7).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,4);
    };
    panel(pc.left,A.panel);panel(pc.ownedRail,A.panelInset);panel(pc.shopPanel,A.panel);
    g.lineStyle(1,A.goldSoft,.52).lineBetween(pc.shopPanel.x+12,p.play.y-12,pc.shopPanel.x+pc.shopPanel.width-12,p.play.y-12);
    const {width,height}=view.layout,topH=p.top+54;
    view.add(rasterizePaper(scene,g,{slot:'shop-frame',width,height,sheet:true,signature:['shop-pc-atelier',width,height,pc.left,pc.ownedRail,pc.shopPanel,p.play.y],finish:(c,page)=>{
      c.save();c.beginPath();c.rect(0,topH+1,page.width,page.height-topH-1);c.clip();
      paintAtelierBackdrop(c,page);
      c.restore();
      paintLacquerPanel(c,pc.left,4,'panel',{corners:true,shadow:true,accentBar:'gold'});
      paintLacquerPanel(c,pc.ownedRail,4,'inset',{shadow:true});
      paintLacquerPanel(c,pc.shopPanel,4,'panel',{corners:true,shadow:true});
      c.save();
      c.strokeStyle='rgba(216,180,108,0.42)';c.lineWidth=1;
      c.beginPath();c.moveTo(pc.shopPanel.x+12,p.play.y-12);c.lineTo(pc.shopPanel.x+pc.shopPanel.width-12,p.play.y-12);c.stroke();
      c.restore();
    }})??g);
  }else if(p.short){
    shopSheet(scene,view,'stock',{x:p.tabs.x-4,y:p.tabs.y-4,width:p.tabs.width+8,height:Math.max(...p.shelf.map(b=>b.y+b.height))+6-p.tabs.y},A.panel,true,true);
    shopSheet(scene,view,'entry',{x:p.play.x-4,y:p.play.y-4,width:p.play.width+8,height:p.play.height+8},A.panelRaised,false,true);
  }else if(p.portrait){
    const bottom=Math.min(view.layout.height,p.play.y-8);
    shopSheet(scene,view,'mobile-shelf',{x:p.x-4,y:p.tabs.y-4,width:p.w+8,height:Math.max(44,bottom-p.tabs.y+8)},A.panelInset,true,true);
    shopSheet(scene,view,'mobile-actions',{x:p.x-4,y:p.play.y-4,width:p.w+8,height:view.layout.height-p.play.y+4},A.lacquer,false,false);
  }
}
