import type Phaser from 'phaser';
import type {SceneView} from './SceneView';
import {bossRuleCuePlacement} from './LastPlayWarning';
import {crispText,textDensity} from './TextRaster';
import {UI_FONT} from './theme';

/** Continue a shown stage cut-in in verified spare table space, without a modal or input surface. */
export function scheduleStageEntryCaption(scene:Phaser.Scene,view:SceneView,copy:string,valid:()=>boolean,delayMs=1250):void {
 let group:Phaser.GameObjects.Container|undefined,delay:number|undefined,expiry:number|undefined,stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;if(delay!==undefined)window.clearTimeout(delay);if(expiry!==undefined)window.clearTimeout(expiry);scene.events.off('update',check);scene.events.off('shutdown',stop);if(group?.active)group.destroy();};
 const check=()=>{if(!valid()||document.hidden||document.querySelector('dialog[open]'))stop();};
 scene.events.once('shutdown',stop);
 // The full-screen entrance lasts 1.25s. Its caption continues only after the veil has gone.
 delay=window.setTimeout(()=>{
  delay=undefined;if(!valid()||document.hidden||document.querySelector('dialog[open]')){stop();return;}
  const l=view.layout,mobile=l.mode==='portrait',width=Math.min(mobile?l.width*.85:360,mobile?l.width*.85:l.playedArea.width),density=textDensity(scene);
  const label=scene.add.text(0,0,copy,{fontFamily:UI_FONT,fontSize:mobile?'16px':'18px',color:'#F5E8CC',resolution:density,wordWrap:{width:Math.max(1,width-24),useAdvancedWrap:true},lineSpacing:2}).setName('opening/continuation-text');
  const height=Math.max(44,label.height+20),box=bossRuleCuePlacement(l.width,l.height,l.scoreBoard,l.playedArea,[l.hud,l.jokers,l.scoreBoard,l.hand,l.handLabel,l.piles,l.tools,l.actions,...l.slots],mobile,height);
  if(!box){label.destroy();stop();return;}
  group=view.add(scene.add.container(Math.round(box.x*density)/density,Math.round(box.y*density)/density)).setName('opening/continuation').setData('cueBounds',box);
  const sheet=scene.add.graphics().fillStyle(0x30251f,.98).fillRoundedRect(0,0,box.width,box.height,6).lineStyle(1,0xc9a65f,.95).strokeRoundedRect(.5,.5,box.width-1,box.height-1,6);
  label.setPosition(12,10);crispText(label);group.add([sheet,label]);
  scene.events.on('update',check);expiry=window.setTimeout(stop,2200);
 },delayMs);
}
