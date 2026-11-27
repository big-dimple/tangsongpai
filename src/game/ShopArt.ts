import {drawRiverScroll} from './RiverScroll';
import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import type {shopLayout} from './ShopLayout';
import {PAPER_THEME as T} from './theme';
import {castPaperShadow,paintPaperGrain,paperGrainSprite,rasterizePaper,SHEET_GRAIN,TRAY_GRAIN} from './PaperStock';

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
  if(raised)g.fillStyle(T.ink,.045).fillRoundedRect(b.x,b.y+2,b.width,b.height,3);
  g.fillStyle(color).fillRoundedRect(b.x,b.y,b.width,b.height,3);view.add(g);
  if(outlined)view.add(scene.add.graphics().lineStyle(1,T.divider,.75).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,3).setName('shop-art/offer-edge').setData('bounds',{...b}));
  const grain=b.width>8&&b.height>8?paperGrainSprite(scene,{x:b.x+4,y:b.y+4,width:b.width-8,height:b.height-8},SHEET_GRAIN):undefined;
  if(grain)view.add(grain.setName('shop-art/'+name+'-paper'));
}

export function drawShopArt(scene:Phaser.Scene,view:SceneView,p:ReturnType<typeof shopLayout>):void {
  const pc=p.pc;
  if(pc){
    const g=scene.add.graphics().setName('shop-art/pc-frame');
    const panel=(b:Box,fill:number)=>{
      g.fillStyle(fill).fillRoundedRect(b.x,b.y,b.width,b.height,3)
       .lineStyle(1,0xb7a484,.7).strokeRoundedRect(b.x+.5,b.y+.5,b.width-1,b.height-1,3);
    };
    panel(pc.left,0xe6dccb);panel(pc.ownedRail,0xf7f0e2);panel(pc.shopPanel,0xe5d9c1);
    g.lineStyle(1,0xb7a484,.7).lineBetween(pc.shopPanel.x+12,p.play.y-12,pc.shopPanel.x+pc.shopPanel.width-12,p.play.y-12);
    const {width,height}=view.layout,panels=[pc.left,pc.ownedRail,pc.shopPanel].map(box=>({box,radius:3}));
    // The three trays are static: one cached picture carries their fibres and soft shadows.
    view.add(rasterizePaper(scene,g,{slot:'shop-frame',width,height,sheet:true,signature:['shop-pc',pc.left,pc.ownedRail,pc.shopPanel,p.play.y],finish:(c,page,density)=>{
      for(const tray of panels){castPaperShadow(c,page,tray,.8,.8);paintPaperGrain(scene,c,page,density,TRAY_GRAIN,tray);}
    }})??g);
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
