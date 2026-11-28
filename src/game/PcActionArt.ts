import type Phaser from 'phaser';
import type {Box} from './layout';
import {ATELIER_THEME as A} from './theme';

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
 rim.lineStyle(1,enabled?(primary?A.goldBright:A.celadon):0x4c6266,enabled?.45:.22).beginPath().moveTo(8,3).lineTo(b.width-8,3).strokePath();
 rim.lineStyle(2,enabled?(primary?0x681b14:A.void):0x0b161a,enabled?.6:.45).beginPath().moveTo(7,b.height-3).lineTo(b.width-7,b.height-3).strokePath();
 rim.lineStyle(1,enabled?(primary?A.gold:A.goldSoft):0x384e52,enabled?.6:.35).strokeRoundedRect(3,3,b.width-6,b.height-6,4);
}
