import type Phaser from 'phaser';
import type {InkPoint} from './AssistInkGeometry';

export interface HeroEffectOrigin extends InkPoint {kind?:'avatar'|'skill'}
type Anchor=Phaser.GameObjects.Container|Phaser.GameObjects.Rectangle;
/** Live world-space hero anchor. Never offset a button's right edge into its neighbouring inventory. */
export function heroEffectOrigin(avatar:Anchor|undefined,skill:Anchor|undefined,viewport:{width:number;height:number}):HeroEffectOrigin|undefined {
 for(const [object,kind]of [[avatar,'avatar'],[skill,'skill']] as const){if(!object?.active||!object.visible||object.alpha<=0)continue;let hidden=false;for(let p=object.parentContainer;p;p=p.parentContainer)if(!p.active||!p.visible||p.alpha<=0)hidden=true;if(hidden)continue;const b=object.getBounds(),x=b.x+b.width/2,y=b.y+b.height/2;if(b.width>0&&b.height>0&&x>=0&&y>=0&&x<=viewport.width&&y<=viewport.height)return{x,y,kind};}
}
