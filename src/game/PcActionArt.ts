import type Phaser from 'phaser';
import type {Box} from './layout';
import {PAPER_THEME as T} from './theme';

/** A noninteractive pressed-edge ornament shares the original button transform. */
export function mountPcActionArt(scene:Phaser.Scene,button:Phaser.GameObjects.Rectangle):void {
 const art=button.getData('buttonArt') as Phaser.GameObjects.Container;
 const rim=scene.add.graphics().setName('pc/action-rim');art.add(rim);button.setData('pcActionRim',rim);
}

/** The face, text, hover and keyboard/gamepad feedback stay owned by SceneView. */
export function refreshPcActionArt(button:Phaser.GameObjects.Rectangle|undefined):void {
 if(!button)return;
 const rim=button.getData('pcActionRim') as Phaser.GameObjects.Graphics|undefined,b=button.getData('buttonBounds') as Box|undefined;
 if(!rim||!b)return;
 const enabled=!!button.input?.enabled,primary=!!button.getData('buttonPrimary');
 rim.clear();
 rim.lineStyle(1,enabled?T.paperLight:0xf2eade,enabled?.8:.5).beginPath().moveTo(8,4).lineTo(b.width-8,4).strokePath();
 rim.lineStyle(2,enabled?(primary?0x792e27:0x557379):0x858b89,enabled?.65:.55).beginPath().moveTo(7,b.height-4).lineTo(b.width-7,b.height-4).strokePath();
 rim.lineStyle(1,enabled?(primary?0xffddd0:0x87a39e):0xa8aaa4,enabled?.65:.65).strokeRoundedRect(3,3,b.width-6,b.height-6,4);
}
