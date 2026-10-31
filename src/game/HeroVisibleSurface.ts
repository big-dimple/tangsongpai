import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';
import {cardFaceOwner,cardVisualRoot} from './CardVisualRoot';
import type {HeroParticleCard} from './HeroSkillParticles';

/** View-only masks. Positions remain root-local; IDs are the semantic outer card IDs. */
export interface HeroInkBox extends InkBox {ownerId?:string;inkKind?:'face'|'paper'|'art'|'print';order?:readonly number[]}
function drawOrder(object:Phaser.GameObjects.Container,root:Phaser.GameObjects.Container):number[]|undefined {
 const path:number[]=[];let node:Phaser.GameObjects.Container|null=object;
 while(node&&node!==root){const parent:Phaser.GameObjects.Container|null=node.parentContainer;if(!parent)return;const index=parent.list.indexOf(node);if(index<0)return;path.push(index);node=parent;}
 return node===root?path.reverse():undefined;
}
export function heroInkBox(root:Phaser.GameObjects.Container,object:Phaser.GameObjects.GameObject,box:InkBox,kind:HeroInkBox['inkKind']):HeroInkBox {
 const owner=cardFaceOwner(object);return{...box,inkKind:kind,ownerId:owner?String(owner.getData('cardId')):undefined,order:owner?drawOrder(owner,root):undefined};
}
function behind(a:readonly number[]|undefined,b:readonly number[]|undefined):boolean {
 if(!a||!b)return false;for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]<b[i];return false;
}
function subtract(a:InkBox,b:InkBox):InkBox[] {
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),d=Math.min(a.y+a.height,b.y+b.height);if(x>=r||y>=d)return[a];
 return[{x:a.x,y:a.y,width:x-a.x,height:a.height},{x:r,y:a.y,width:a.x+a.width-r,height:a.height},{x,y:a.y,width:r-x,height:y-a.y},{x,y:d,width:r-x,height:a.y+a.height-d}].filter(p=>p.width>0&&p.height>0);
}
/** Largest clear rectangle on the real visible paper; never searches outside the single card. */
export function heroVisiblePatch(card:HeroParticleCard,root:Phaser.GameObjects.Container,boxes:readonly HeroInkBox[],prepared=true):InkBox|undefined {
 const body=cardVisualRoot(card),m=body.getWorldTransformMatrix(),r=root.getWorldTransformMatrix(),sx=Math.max(.1,Math.hypot(m.a,m.b)),sy=Math.max(.1,Math.hypot(m.c,m.d)),order=drawOrder(card.occlusionOwner??body,root);
 let opaque=true;for(let n:Phaser.GameObjects.Container|null=body;n&&n!==root;n=n.parentContainer)if(n.alpha<.98)opaque=false;
 let regions:InkBox[]=[{x:-card.width/2+2/sx,y:-card.height/2+2/sy,width:card.width-4/sx,height:card.height-4/sy}];
 for(const box of boxes){
  if(box.ownerId===card.id&&box.inkKind!=='print')continue;
  if(box.ownerId&&box.ownerId!==card.id&&opaque&&behind(box.order,order))continue;
  const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>{const p=r.transformPoint(x,y);return m.applyInverse(p.x,p.y);}),x=Math.min(...points.map(p=>p.x))-1/sx,y=Math.min(...points.map(p=>p.y))-1/sy,b={x,y,width:Math.max(...points.map(p=>p.x))-x+1/sx,height:Math.max(...points.map(p=>p.y))-y+1/sy};
  regions=regions.flatMap(a=>subtract(a,b)).sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,48);if(!regions.length)return;
 }
 const region=regions.find(p=>p.width*sx>=7&&p.height*sy>=10);if(!region)return;
 const width=Math.min(region.width,(prepared?24:32)/sx,card.width*.4),height=Math.min(region.height,(prepared?28:44)/sy,card.height*.4);
 return{x:region.x+(region.width-width)/2,y:region.y+(region.height-height)/2,width,height};
}

/** Canvas/low-cost fallback: continuous filled wisps within the same certified visible patch, never point clouds. */
export function drawPreparedSurface(g:Phaser.GameObjects.Graphics,patch:InkBox,clock:number,glow:number,spark:number,mode:number):void {
 g.clear();const t=clock/1000,direction=mode===2||mode===5?-1:1,w=patch.width,h=patch.height;
 for(let lane=0;lane<2;lane++)for(let i=0;i<12;i++){
  const u=i/12,v=(i+1)/12,at=(p:number)=>{
   if(mode===2||mode===5){const a=p*Math.PI*2+t*direction*.5,r=.23+.055*Math.cos(a*(mode===2?5:3)-t+lane);return{x:patch.x+w*(.5+Math.cos(a)*r),y:patch.y+h*(.5+Math.sin(a)*r)};}
   const bend=mode===4?Math.sin(p*19+t*4)*.12:Math.sin(p*4+t*direction*(mode===3?3:2)+lane*2)*.18;return{x:patch.x+w*(.5+bend),y:patch.y+h*(.08+p*.84)};
  },a=at(u),b=at(v),wave=.5+.5*Math.sin((u-t*direction*.7+lane*.35)*Math.PI*2),half=Math.min(w*.06,.8)*(lane?.7:1);
  const poly=[{x:a.x-half,y:a.y},{x:b.x-half,y:b.y},{x:b.x+half,y:b.y},{x:a.x+half,y:a.y}];g.fillStyle(lane?spark:glow,(.15+wave*.5)*(lane?.75:1)).fillPoints(poly,true);
 }
}
