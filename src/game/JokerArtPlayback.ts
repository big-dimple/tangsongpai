import type Phaser from 'phaser';
import {artTransfer} from './ArtTextureLoading';
import {JOKER_ART_FRAME_MS} from './JokerArtAnimation';
import {assetUrl} from './theme';

const WIDTH=180,HEIGHT=224,COUNT=9,MAX_BYTES=256*1024;
type Loads={controller:AbortController;jobs:Map<string,Promise<string|undefined>>};
const loads=new WeakMap<Phaser.Game,Loads>();

/** Load on visible demand, once per game. The atlas stays immutable on the GPU. */
function atlas(game:Phaser.Game,id:string):Promise<string|undefined> {
  const key='joker-animation/'+id;
  if(game.textures.exists(key))return Promise.resolve(key);
  let pool=loads.get(game);
  if(!pool){
    pool={controller:new AbortController(),jobs:new Map()};loads.set(game,pool);
    const owner=pool;
    game.events.once('destroy',()=>{owner.controller.abort();owner.jobs.clear();loads.delete(game);});
  }
  const ready=pool.jobs.get(key);if(ready)return ready;
  const owner=pool;
  const job=artTransfer(async transferSignal=>{
    const signal=AbortSignal.any([transferSignal,AbortSignal.timeout(6000)]);
    const response=await fetch(assetUrl('assets/handdrawn-p08/cards/'+id+'.frames.webp'),{signal,credentials:'same-origin'});
    if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('animation-http-budget');
    const blob=await response.blob();if(blob.size>MAX_BYTES||signal.aborted)throw Error('animation-budget');
    const url=URL.createObjectURL(blob),strip=new Image();strip.decoding='async';strip.src=url;
    try {
      await strip.decode();
      if(signal.aborted||strip.naturalWidth!==WIDTH*COUNT||strip.naturalHeight!==HEIGHT)throw Error('animation-dimensions');
      if(!game.textures.exists(key))game.textures.addSpriteSheet(key,strip,{frameWidth:WIDTH,frameHeight:HEIGHT,endFrame:COUNT-1});
      return game.textures.exists(key)?key:undefined;
    }finally{URL.revokeObjectURL(url);}
  },1,owner.controller.signal,'joker-animation').catch(()=>undefined);
  // A failed optional animation keeps its static fallback and never retries every frame.
  owner.jobs.set(key,job);return job;
}

/** Follow the displayed image's lifetime; catalog preloads never start playback. */
export function animateJokerImage<T extends Phaser.GameObjects.Image>(scene:Phaser.Scene,image:T,definitionId?:string):T {
  const key=image.texture?.key??'',id=definitionId??(key.startsWith('p08-joker-')?key.slice('p08-joker-'.length):'');
  const frameMs=JOKER_ART_FRAME_MS[id];if(!frameMs)return image;
  let stopped=false,requested=false,atlasKey:string|undefined,shown=-1;
  const update=(time:number)=>{
    if(stopped||document.hidden||!scene.sys.isVisible()||!image.active||!image.visible||image.alpha===0)return;
    for(let parent=image.parentContainer;parent;parent=parent.parentContainer)if(!parent.visible||parent.alpha===0)return;
    if(!requested){requested=true;void atlas(scene.game,id).then(value=>{if(!stopped)atlasKey=value;});}
    if(!atlasKey||!scene.textures.exists(atlasKey))return;
    const frame=Math.floor(time/frameMs)%COUNT;if(frame===shown)return;
    if(shown===-1){
      const width=image.displayWidth,height=image.displayHeight;
      image.setTexture(atlasKey,frame).setDisplaySize(width,height);
    }else image.setFrame(frame);
    shown=frame;
  };
  const dispose=()=>{if(stopped)return;stopped=true;scene.events.off('update',update);scene.events.off('shutdown',dispose);image.off('destroy',dispose);};
  scene.events.on('update',update);scene.events.once('shutdown',dispose);image.once('destroy',dispose);
  return image;
}
