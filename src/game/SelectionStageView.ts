import {drawRiverScroll} from './RiverScroll';
import Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {bakedPaper} from './PaperStock';

export const SELECTION_INK={back:0x192d32,raised:0x2a4144,paper:0xf3eadb,line:0x9d9d83,light:'#F3EADB',muted:'#C3CABA'} as const;

/** Selection owns its backdrop; shared materials keep their existing contract. */
export function selectionStageBackground(scene:Phaser.Scene,v:SceneView,width:number,height:number):void {
 // The night backdrop is lit by the same single lamp as the table; no fibres on a dark ground.
 const lit=bakedPaper(scene,{slot:'selection',width,height,base:SELECTION_INK.back,lamp:'desk',grain:0});
 if(lit)v.add(lit);else v.add(scene.add.graphics()).fillStyle(SELECTION_INK.back).fillRect(0,0,width,height);
 drawRiverScroll(scene,v,{x:0,y:0,width,height},.63,.14);
 const mount=v.add(scene.add.graphics());
 mount.fillStyle(0x142e2c,.68).fillRect(0,0,width,62);
 mount.lineStyle(1,0xc5ab74,.56).lineBetween(12,63,width-12,63);
}

/** Reuse the shared press/release behavior with a quiet, 44px text target. */
export function selectionQuietButton(v:SceneView,b:Box,label:string,name:string,action:()=>void,enabled=true,light=true):Phaser.GameObjects.Rectangle {
 const hit=v.button(b,label,name,action,enabled,false,'sort');
 (hit.getData('label') as Phaser.GameObjects.Text).setColor(enabled?(light?SELECTION_INK.muted:'#3F606B'):'#747E7B');
 return hit;
}
