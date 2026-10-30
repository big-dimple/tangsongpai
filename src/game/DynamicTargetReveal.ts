import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {crispText} from './TextRaster';

/** Ornament a number already shown by the saved stage. Never creates input or predicts a target. */
export function mountDynamicTargetReveal(scene:Phaser.Scene,view:SceneView,target:Phaser.GameObjects.Text,box:Box,reduced:()=>boolean,dark:boolean):void {
 crispText(target);
 if(reduced()||document.hidden)return;
 const bounds=target.getBounds(),width=Math.min(bounds.width+8,box.width),height=Math.min(bounds.height+8,box.height);
 const x=Math.max(box.x,Math.min(bounds.centerX-width/2,box.x+box.width-width)),y=Math.max(box.y,Math.min(bounds.centerY-height/2,box.y+box.height-height));
 if(width<40||height<20||bounds.x<x-1||bounds.right>x+width+1||bounds.y<y-1||bounds.bottom>y+height+1)return;
 const art=scene.add.graphics().setName('dynamic-target/reveal').setData('safeBounds',{x,y,width,height}).setPosition(x+width/2,y+height/2).setScale(.03,1);
 art.fillStyle(0x1d1510,.2).fillRoundedRect(-width/2+2,-height/2+2,width-2,height-2,4)
  .fillStyle(dark?0x30251f:0xf5e8cc,.98).fillRoundedRect(-width/2,-height/2,width,height,4)
  .fillStyle(dark?0x76583c:0xffffff,.12).fillRoundedRect(-width/2+3,-height/2+3,width-6,Math.min(12,height-6),2)
  .lineStyle(1,0xb99455,.95).strokeRoundedRect(-width/2+.5,-height/2+.5,width-1,height-1,4)
  .lineStyle(1,dark?0xf5e8cc:0x7f6040,.26).lineBetween(-width/2+5,height/2-4,width/2-5,height/2-4)
  .fillStyle(0xa13e31,.95).fillCircle(-width/2+5,-height/2+3,1.5)
  .fillStyle(0xb99455,.95).fillCircle(width/2-5,-height/2+3,1.5);
 view.add(art);view.root.moveBelow<Phaser.GameObjects.GameObject>(art,target);
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');let finished=false,hold:Phaser.Time.TimerEvent|undefined;
 const cleanup=()=>{media.removeEventListener?.('change',changed);window.removeEventListener('tangsongpai-presentation',changed);hold?.remove();scene.tweens.killTweensOf(art);};
 const dispose=()=>{if(finished)return;finished=true;cleanup();if(art.active)art.destroy();};
 const changed=()=>{if(reduced())dispose();};media.addEventListener?.('change',changed);window.addEventListener('tangsongpai-presentation',changed);
 art.once('destroy',()=>{if(finished)return;finished=true;cleanup();});
 scene.events.once('shutdown',dispose);
 scene.tweens.add({targets:art,scaleX:1,duration:500,ease:'Cubic.easeOut'});
 hold=scene.time.delayedCall(2100,()=>{if(!art.active||finished){dispose();return;}scene.tweens.add({targets:art,alpha:0,duration:300,ease:'Sine.easeIn',onComplete:dispose});});
}
