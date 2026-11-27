import type Phaser from 'phaser';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {whenTextureReady} from './LateTextureArt';
import {asPaperSheet} from './PaperStock';

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
    const image=asPaperSheet(scene.add.image(0,0,KEY).setOrigin(0));
    const scale=Math.max(box.width/image.width,box.height/image.height);
    const width=Math.min(image.width,Math.round(box.width/scale)),height=Math.min(image.height,Math.round(box.height/scale));
    const x=Math.floor((image.width-width)*.38),y=Math.round((image.height-height)*focusY);
    image.setCrop(x,y,width,height).setPosition(-x*scale,-y*scale).setScale(scale).setAlpha(alpha);
    image.setData('bounds',{...box});
    Object.defineProperty(image,'getBounds',{value:(out?:Phaser.Geom.Rectangle)=>{
      const m=layer.getWorldTransformMatrix(),a=m.transformPoint(0,0),b=m.transformPoint(box.width,box.height);
      const rx=Math.min(a.x,b.x),ry=Math.min(a.y,b.y),rw=Math.abs(b.x-a.x),rh=Math.abs(b.y-a.y);
      return out?out.setTo(rx,ry,rw,rh):{x:rx,y:ry,width:rw,height:rh,left:rx,top:ry,right:rx+rw,bottom:ry+rh,centerX:rx+rw/2,centerY:ry+rh/2};
    },configurable:true});
    layer.add(image);
  });
}
