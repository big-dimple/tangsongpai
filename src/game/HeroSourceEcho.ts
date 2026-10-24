import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';
import {drawHeroAtmosphere,type AtmosphereStyle} from './HeroCardAttachmentAtmosphere';
import {cssViewport} from '../platform/Viewport';

/** Live portrait bounds in root space; skips hidden parents and never substitutes the inventory or a skill button. */
export function heroPortraitBox(root:Phaser.GameObjects.Container,mobile:boolean):InkBox|undefined {
 let portrait:InkBox|undefined,avatar:InkBox|undefined;const inverse=root.getWorldTransformMatrix();
 const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const item of list){const o=item as Phaser.GameObjects.Container;if(!o.active||!o.visible||o.alpha<=0)continue;if(o.type==='Image'){const image=o as unknown as Phaser.GameObjects.Image;if(o.name==='hero/portrait'||image.texture.key.startsWith('avatar-')){const b=image.getBounds(),a=inverse.applyInverse(b.x,b.y),z=inverse.applyInverse(b.right,b.bottom),box={x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y};if(o.name==='hero/portrait')portrait=box;else if(box.y<90)avatar=box;}}if(o.list)walk(o.list);}};walk(root.list??[]);return mobile?avatar??portrait:portrait??avatar;
}
/** One bounded Graphics per visual owner, driven by its existing20/30Hz clock. No particles/timers or hit objects. */
export class HeroSourceEcho {
 private ink?:Phaser.GameObjects.Graphics;
 constructor(private readonly scene:Phaser.Scene){}
 sync(root:Phaser.GameObjects.Container,style:AtmosphereStyle,clock:number,boxes:readonly InkBox[],full:boolean,alpha=1,anchor?:InkBox):void {
  if(!full||!root.active||!root.visible){this.clear();return;}anchor??=heroPortraitBox(root,cssViewport(this.scene).width<600);if(!anchor){this.clear();return;}
  if(!this.ink?.active){this.ink=this.scene.add.graphics().setName('hero/source-echo');root.add(this.ink);}
  const stats=drawHeroAtmosphere(this.ink,{style,clock,targets:[anchor],protectedBoxes:[...boxes,anchor],full:true,alpha:alpha*(clock<650?1:.64)});this.ink.setData('stats',stats).setData('heroStyle',style.key).setData('anchor',anchor).setData('clock',clock);
 }
 clear():void {this.ink?.destroy();this.ink=undefined;}
}
