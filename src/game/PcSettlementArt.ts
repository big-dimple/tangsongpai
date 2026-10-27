import type Phaser from 'phaser';
import type {SceneView} from './SceneView';
import {pcLandscapeFrame} from './PcLandscapeFrame';
import {resultLayout} from './IntermissionLayout';

/** A PC-only lacquer surround and portrait alcove, with no input or game state. */
export function drawPcSettlementArt(scene:Phaser.Scene,view:SceneView):void {
 const {width,height}=view.layout,grid=pcLandscapeFrame(width,height),layout=resultLayout(width,height,0,0,true);
 const sideX=layout.x-grid.gap-grid.sidebar.width,groupRight=layout.x+layout.w;
 const x=Math.max(grid.frame.x-12,sideX-20),right=Math.min(width-grid.margin+12,groupRight+20);
 const g=scene.add.graphics().setName('result-art/pc-stage');
 g.fillStyle(0x253e40).fillRect(0,0,width,height);
 g.fillStyle(0x142b2e,.7).fillRoundedRect(x,45,right-x,height-56,18);
 g.fillStyle(0xeee2ce).fillRoundedRect(x,40,right-x,height-56,16);
 g.lineStyle(2,0x9d8767).strokeRoundedRect(x+1,41,right-x-2,height-58,15);
 g.lineStyle(1,0xfff9ee,.85).strokeRoundedRect(x+6,46,right-x-12,height-68,11);
 g.fillStyle(0xfff9ee,.58).fillRoundedRect(layout.x,64,layout.w,height-80,12);
 g.lineStyle(1,0xc5b398,.65).strokeRoundedRect(layout.x+.5,64.5,layout.w-1,height-81,12);
 view.add(g);
}
