import type Phaser from 'phaser';
import type {SceneView} from './SceneView';
import {pcLandscapeFrame} from './PcLandscapeFrame';
import {pcResultSidebar,resultLayout} from './IntermissionLayout';
import {castPaperShadow,paintPaperGrain,paintPaperLamp,rasterizePaper,TRAY_GRAIN} from './PaperStock';

/** A PC-only lacquer surround and portrait alcove, with no input or game state. */
export function drawPcSettlementArt(scene:Phaser.Scene,view:SceneView):void {
 const {width,height,safe}=view.layout,grid=pcLandscapeFrame(width,height,0,0,safe.left,safe.right);
 const layout=resultLayout(width,height,0,0,true,safe.left,safe.right),side=pcResultSidebar(width,height,safe.left,safe.right);
 const sideX=layout.x-grid.gap-side.width,groupRight=layout.x+layout.w;
 const x=Math.max(grid.frame.x-12,sideX-20),right=Math.min(grid.frame.x+grid.frame.width+12,groupRight+20);
 const g=scene.add.graphics().setName('result-art/pc-stage');
 g.fillStyle(0x253e40).fillRect(0,0,width,height);
 g.fillStyle(0xeee2ce).fillRoundedRect(x,40,right-x,height-56,5);
 g.lineStyle(1,0x9d8767).strokeRoundedRect(x+1,41,right-x-2,height-58,4);
 g.lineStyle(1,0xfff9ee,.85).strokeRoundedRect(x+6,46,right-x-12,height-68,2);
 // The supplied cutouts carry fine red/white brushwork. A quiet dark alcove
 // preserves that silhouette instead of losing it inside the warm receipt.
 g.fillStyle(0x162e31,.98).fillRoundedRect(sideX-8,64,side.width+16,height-80,4);
 g.lineStyle(1,0xb59b70,.72).strokeRoundedRect(sideX-7.5,64.5,side.width+15,height-81,3);
 g.lineStyle(1,0xf3eadb,.16).strokeRoundedRect(sideX-2,70,side.width+4,height-92,2);
 g.fillStyle(0xfff9ee,.58).fillRoundedRect(layout.x,64,layout.w,height-80,3);
 g.lineStyle(1,0xc5b398,.65).strokeRoundedRect(layout.x+.5,64.5,layout.w-1,height-81,3);
 const sheet={box:{x,y:40,width:right-x,height:height-56},radius:5},alcove={box:{x:sideX-8,y:64,width:side.width+16,height:height-80},radius:4};
 // Rasterized once per layout: the receipt lies on the same lamp-lit desk as the table.
 view.add(rasterizePaper(scene,g,{slot:'settlement',width,height,sheet:true,signature:['pc-settlement',sheet,alcove,layout.x,layout.w],finish:(c,page,density)=>{
  paintPaperLamp(scene,c,page,'desk',undefined,[sheet]);
  castPaperShadow(c,page,sheet,1.25,1.7);
  paintPaperGrain(scene,c,page,density,TRAY_GRAIN,sheet,[alcove]);
  paintPaperLamp(scene,c,page,'paper',sheet,[alcove]);
 }})??g);
}
