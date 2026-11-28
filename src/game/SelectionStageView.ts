import {drawRiverScroll} from './RiverScroll';
import Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {bakedAtelierBackdrop} from './AtelierArt';

export const SELECTION_INK={back:0x0e2126,raised:0x163137,selected:0x21484d,paper:0x122a30,line:0xd8b46c,light:'#F6EFE0',gold:'#F2D28E',muted:'#B8CDC6'} as const;

/** Selection owns its backdrop; shared materials keep their existing contract. */
export function selectionStageBackground(scene:Phaser.Scene,v:SceneView,width:number,height:number):void {
 // Twilight celadon-lacquer backdrop lit by a warm central lamp behind the riverfront scroll.
 const lit=bakedAtelierBackdrop(scene,'selection',width,height);
 if(lit)v.add(lit);else v.add(scene.add.graphics()).fillStyle(SELECTION_INK.back).fillRect(0,0,width,height);
 drawRiverScroll(scene,v,{x:0,y:0,width,height},.63,.16);
 const mount=v.add(scene.add.graphics());
 mount.fillStyle(0x0b1c21,.76).fillRect(0,0,width,62);
 mount.lineStyle(1,0xd8b46c,.56).lineBetween(12,63,width-12,63);
}

/** Reuse the shared press/release behavior with a quiet, 44px text target. */
export function selectionQuietButton(v:SceneView,b:Box,label:string,name:string,action:()=>void,enabled=true,light=true):Phaser.GameObjects.Rectangle {
 const hit=v.button(b,label,name,action,enabled,false,'sort');
 (hit.getData('label') as Phaser.GameObjects.Text).setColor(enabled?(light?SELECTION_INK.muted:SELECTION_INK.gold):'#6A807E');
 return hit;
}
