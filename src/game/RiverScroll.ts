import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {whenTextureReady} from './LateTextureArt';

const KEY='river-market';

/** The opening HTML already owns this image. Reuse its decode in Phaser. */
export function registerRiverScroll(game:Phaser.Game,image:HTMLImageElement|null):void {
  if(!image)return;
  void image.decode().then(()=>{
    if(game.textures?.list&&!game.textures.exists(KEY))game.textures.addImage(KEY,image);
  }).catch(()=>{ /* Every scene has an opaque painted base. */ });
}

/** Frame a section of the original scroll without stretching or painting outside the panel. */
export function drawRiverScroll(scene:Phaser.Scene,view:SceneView,box:Box,focusY:number,alpha:number):void {
  if(box.width<=0||box.height<=0)return;
  const layer=view.add(scene.add.container(box.x,box.y).setName('art/river-scroll'));
  whenTextureReady(scene,layer,KEY,()=>{
    const image=scene.add.image(0,0,KEY).setOrigin(0);
    const scale=Math.max(box.width/image.width,box.height/image.height);
    const width=Math.min(image.width,Math.round(box.width/scale)),height=Math.min(image.height,Math.round(box.height/scale));
    const x=Math.floor((image.width-width)*.38),y=Math.round((image.height-height)*focusY);
    image.setCrop(x,y,width,height).setPosition(-x*scale,-y*scale).setScale(scale).setAlpha(alpha);
    layer.add(image);
  });
}
