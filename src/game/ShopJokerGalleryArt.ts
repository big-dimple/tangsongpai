import type Phaser from 'phaser';
import {decodeArtImage,detailArt,invalidateArt,observeDecodedArt} from './DetailArt';
import {jokerArtKey} from './jokerArt';
import {HANDDRAWN_ART} from './HanddrawnArt';
import {cardArtSource} from './CardArtSource';
import {GOODS_ART} from './GoodsArt';
import {goodsArtKey} from './GoodsArtLoading';

const keyFor=(id:string)=>(jokerArtKey(id)?'shop-joker-detail/':'shop-goods-detail/')+id;
interface Entry {controller:AbortController;status:'loading'|'loaded'|'failed'}
const owners=new WeakMap<Phaser.Scene,GalleryArt>();
/** Only the currently visible PC gallery leases detail textures. The normal thumbnail path stays immediate. */
class GalleryArt {
 private readonly entries=new Map<string,Entry>();
 private disposed=false;
 private refresh=()=>{};
 constructor(private readonly scene:Phaser.Scene){scene.events.once('shutdown',this.dispose);scene.events.once('destroy',this.dispose);}
 request(ids:readonly string[],refresh:()=>void):void {
  this.refresh=refresh;const wanted=new Set(ids.filter(id=>cardArtSource(id)));
  for(const [id,entry] of this.entries)if(!wanted.has(id)){entry.controller.abort();this.entries.delete(id);this.scene.textures.remove(keyFor(id));}
  for(const id of wanted){
   if(this.disposed||this.entries.has(id))continue;
   const controller=new AbortController(),entry:Entry={controller,status:'loading'},url=cardArtSource(id)!.detailUrl;this.entries.set(id,entry);
   const publish=(src:string,image:HTMLImageElement)=>{
    if(this.disposed||controller.signal.aborted||this.entries.get(id)!==entry||!this.scene.sys.settings.active||entry.status==='loaded')return;
    const expected=HANDDRAWN_ART.find(a=>a.id===id&&a.category==='functional-card')?.outputs.find(o=>o.purpose==='detail')??GOODS_ART.find(a=>a.domainId===id)?.outputs.find(o=>o.purpose==='detail');
    if(!expected||image.naturalWidth!==expected.width||image.naturalHeight!==expected.height){invalidateArt(url,src);entry.status='failed';return;}
    if(!this.scene.textures.exists(keyFor(id)))this.scene.textures.addImage(keyFor(id),image);entry.status='loaded';this.refresh();
   };
   observeDecodedArt(url,controller.signal,publish);
   void detailArt(url,true,controller.signal).then(async src=>{
    let image:HTMLImageElement;
    try{image=await decodeArtImage(src,controller.signal);}catch(error){if(!controller.signal.aborted)invalidateArt(url,src);throw error;}
    publish(src,image);
   }).catch(()=>{if(!controller.signal.aborted&&entry.status!=='loaded')entry.status='failed';});
  }
 }
 private readonly dispose=()=>{
  if(this.disposed)return;this.disposed=true;
  for(const [id,entry] of this.entries){entry.controller.abort();this.scene.textures.remove(keyFor(id));}
  this.entries.clear();this.scene.events.off('shutdown',this.dispose);this.scene.events.off('destroy',this.dispose);owners.delete(this.scene);
 };
}
export function requestShopGalleryArt(scene:Phaser.Scene,ids:readonly string[],refresh:()=>void):void {
 let owner=owners.get(scene);if(!scene.sys.settings.active)return;if(!owner){if(!ids.length)return;owner=new GalleryArt(scene);owners.set(scene,owner);}owner.request(ids,refresh);
}
export const requestShopJokerGalleryArt=requestShopGalleryArt;
export function shopJokerPictureKey(scene:Phaser.Scene,id:string,box:{width:number;height:number}):string|undefined {
 const detail=keyFor(id);return (box.width>128||box.height>160)&&scene.textures.exists(detail)?detail:jokerArtKey(id);
}
/** Dense displays also benefit when a visible goods face is 128 logical pixels wide. */
export function shopGoodsPictureKey(scene:Phaser.Scene,id:string):string {
 const detail=keyFor(id);return scene.textures.exists(detail)?detail:goodsArtKey(id);
}
