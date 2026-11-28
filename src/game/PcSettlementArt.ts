import type Phaser from 'phaser';
import type {SceneView} from './SceneView';
import {pcLandscapeFrame} from './PcLandscapeFrame';
import {pcResultSidebar,resultLayout} from './IntermissionLayout';
import {paintAtelierBackdrop,paintLacquerPanel,paintLanternHalo} from './AtelierArt';
import {rasterizePaper} from './PaperStock';

/** A PC-only lacquer surround and portrait alcove, with no input or game state. */
export function drawPcSettlementArt(scene:Phaser.Scene,view:SceneView):void {
 const {width,height,safe}=view.layout,grid=pcLandscapeFrame(width,height,0,0,safe.left,safe.right);
 const layout=resultLayout(width,height,0,0,true,safe.left,safe.right),side=pcResultSidebar(width,height,safe.left,safe.right);
 const sideX=layout.x-grid.gap-side.width,groupRight=layout.x+layout.w;
 const x=Math.max(grid.frame.x-12,sideX-20),right=Math.min(grid.frame.x+grid.frame.width+12,groupRight+20);
 const g=scene.add.graphics().setName('result-art/pc-stage');
 g.fillStyle(0x0c1e24).fillRect(0,0,width,height);
 g.fillStyle(0x132b32).fillRoundedRect(x,40,right-x,height-56,6);
 g.lineStyle(1,0xd8b46c,.45).strokeRoundedRect(x+1,41,right-x-2,height-58,5);
 g.fillStyle(0x0d2126,.98).fillRoundedRect(sideX-8,64,side.width+16,height-80,5);
 g.lineStyle(1,0xc8a462,.5).strokeRoundedRect(sideX-7.5,64.5,side.width+15,height-81,4);
 g.fillStyle(0x153238,.94).fillRoundedRect(layout.x,64,layout.w,height-80,5);
 g.lineStyle(1,0xd8b46c,.5).strokeRoundedRect(layout.x+.5,64.5,layout.w-1,height-81,4);
 const sheet={box:{x,y:40,width:right-x,height:height-56},radius:6},alcove={box:{x:sideX-8,y:64,width:side.width+16,height:height-80},radius:5};
 const rightSheet={box:{x:layout.x,y:64,width:layout.w,height:height-80},radius:5};
 // Rasterized once per layout on deep twilight celadon lacquer.
 view.add(rasterizePaper(scene,g,{slot:'settlement',width,height,sheet:true,signature:['pc-atelier-settlement',sheet,alcove,rightSheet],finish:(c,page)=>{
  paintAtelierBackdrop(c,page,{finale:true});
  paintLacquerPanel(c,sheet.box,sheet.radius,'panel',{corners:true});
  paintLacquerPanel(c,alcove.box,alcove.radius,'inset');
  paintLanternHalo(c,sideX+side.width/2,64+(height-80)*.38,Math.min(side.width*.46,(height-80)*.34),Math.min(side.width*.46,(height-80)*.34),.95);
  paintLacquerPanel(c,rightSheet.box,rightSheet.radius,'score',{accentBar:'gold'});
 }})??g);
}
