import type Phaser from 'phaser';
import type {EffectContext} from '../core/EffectQueue';

type Pose={x:number;y:number;rotation:number;sx:number;sy:number;alpha:number};
/** A small pool of original-texture snapshots, sampled ONLY by the owner's
 * outbound Tween. Impact disposes it; there is no return emitter or clock. */
export class ImageAfterimages {
 private readonly root:Phaser.GameObjects.Container;
 private readonly slots:{image:Phaser.GameObjects.Image;born:number;alpha:number}[]=[];
 private previous?:Pose;
 private lastEmission=-Infinity;
 private cursor=0;
 private disposed=false;
 private closing=false;
 constructor(private readonly scene:Phaser.Scene,private readonly parent:Phaser.GameObjects.Container,private readonly source:Phaser.GameObjects.Image,private readonly context:EffectContext,private readonly options:{eventId:string;capacity:number;life:number;alpha:number}){
  this.root=scene.add.container(0,0).setName('score/image-afterimages').setData('eventId',options.eventId);parent.addAt(this.root,0);
  this.root.once('destroy',this.parentClosing);source.once('destroy',this.dispose);scene.events.once('shutdown',this.dispose);context.signal.addEventListener('abort',this.dispose,{once:true});
  this.previous=this.pose();if(context.signal.aborted)this.dispose();
 }
 private readonly parentClosing=()=>{this.closing=true;this.dispose();};
 private pose():Pose|undefined {
  if(!this.source.active||!this.source.visible||this.source.alpha<=0||!this.parent.active||!this.parent.visible||this.parent.alpha<=0)return;
  let alpha=this.source.alpha;for(let p=this.source.parentContainer;p&&p!==this.parent;p=p.parentContainer){if(!p.active||!p.visible||p.alpha<=0)return;alpha*=p.alpha;}
  const r=this.parent.getWorldTransformMatrix(),s=this.source.getWorldTransformMatrix(),det=r.a*r.d-r.b*r.c;if(Math.abs(det)<1e-8)return;
  const a=(r.d*s.a-r.c*s.b)/det,b=(-r.b*s.a+r.a*s.b)/det,c=(r.d*s.c-r.c*s.d)/det,d=(-r.b*s.c+r.a*s.d)/det,p=r.applyInverse(s.tx,s.ty),sx=Math.hypot(a,b);
  return {x:p.x,y:p.y,rotation:Math.atan2(b,a),sx,sy:sx?(a*d-b*c)/sx:1,alpha};
 }
 sample(elapsed:number,enabled=true):void {
  if(this.disposed)return;
  if(!enabled||typeof document!=='undefined'&&document.hidden){for(const slot of this.slots){slot.alpha=0;slot.image.setAlpha(0);}this.previous=undefined;return;}
  const current=this.pose();if(!current){this.dispose();return;}
  for(const slot of this.slots)slot.image.setAlpha(slot.alpha*Math.max(0,1-(elapsed-slot.born)/this.options.life)**2);
  const previous=this.previous;this.previous=current;
  if(!previous||elapsed-this.lastEmission<this.options.life/(this.options.capacity+1)||Math.hypot(current.x-previous.x,current.y-previous.y)<1.2&&Math.abs(current.rotation-previous.rotation)<.006&&Math.abs(current.sx-previous.sx)<Math.abs(current.sx)*.006)return;
  let slot=this.slots[this.cursor];if(!slot){const image=this.scene.add.image(0,0,this.source.texture.key,this.source.frame.name).setName('score/afterimage').setData('eventId',this.options.eventId);this.root.add(image);slot={image,born:elapsed,alpha:0};this.slots.push(slot);}
  this.cursor=(this.cursor+1)%this.options.capacity;this.lastEmission=elapsed;slot.born=elapsed;slot.alpha=this.options.alpha*previous.alpha;
  slot.image.setTexture(this.source.texture.key,this.source.frame.name).setOrigin(this.source.originX,this.source.originY).setFlip(this.source.flipX,this.source.flipY).setTint(this.source.tintTopLeft,this.source.tintTopRight,this.source.tintBottomLeft,this.source.tintBottomRight).setPosition(previous.x,previous.y).setRotation(previous.rotation).setScale(previous.sx,previous.sy).setAlpha(slot.alpha);
 }
 readonly dispose=()=>{if(this.disposed)return;this.disposed=true;this.context.signal.removeEventListener('abort',this.dispose);this.source.off('destroy',this.dispose);this.scene.events.off('shutdown',this.dispose);this.root.off('destroy',this.parentClosing);if(!this.closing)this.root.destroy();this.slots.length=0;this.previous=undefined;};
}
