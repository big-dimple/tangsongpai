import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';

export const SUSHI_KING_ENERGY_BUDGET={motes:12,targets:8} as const;
const INK=0x245653,VERMILION=0x9b4939,PAPER=0xf7edd9;
const TAU=Math.PI*2;
const preparedOwners=new WeakMap<Phaser.GameObjects.Container,{retire:()=>void;boxes:()=>readonly InkBox[]}>();
/** Hand off only this exact source face; never destroy the real card. */
export function ownPreparedSushiKing(card:Phaser.GameObjects.Container,retire:()=>void,boxes:()=>readonly InkBox[]=()=>[]):()=>void {
 preparedOwners.get(card)?.retire();preparedOwners.set(card,{retire,boxes});
 return()=>{if(preparedOwners.get(card)?.retire===retire)preparedOwners.delete(card);};
}
export function consumePreparedSushiKing(card:Phaser.GameObjects.Container):readonly InkBox[] {const owner=preparedOwners.get(card),boxes=owner?.boxes()??[];owner?.retire();return boxes;}
/** Largest exposed paper rectangle, after foreground faces and printed/control ink.
 * Back faces are excluded by the caller. Never relocate onto another card. */
export function sushiKingInkSurface(width:number,height:number,boxes:readonly InkBox[]):InkBox|undefined {
 let regions:InkBox[]=[{x:-width/2+4,y:-height/2+4,width:width-8,height:height-8}];
 for(const box of boxes){const b={x:box.x-2,y:box.y-2,width:box.width+4,height:box.height+4};
  regions=regions.flatMap(a=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),d=Math.min(a.y+a.height,b.y+b.height);if(x>=r||y>=d)return[a];return[{x:a.x,y:a.y,width:x-a.x,height:a.height},{x:r,y:a.y,width:a.x+a.width-r,height:a.height},{x,y:a.y,width:r-x,height:y-a.y},{x,y:d,width:r-x,height:a.y+a.height-d}].filter(p=>p.width>=12&&p.height>=16);}).sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,32);
 }
 return regions[0];
}
/** Twelve rotating, breathing ink dashes. Tapered curved nibs replace square
 * double strokes and diamond flecks; the middle remains entirely unpainted. */
export class SushiKingEnergy {
 private readonly nib=Array.from({length:18},()=>({x:0,y:0}));
 draw(g:Phaser.GameObjects.Graphics,width:number,height:number,clock:number,reduced:boolean,release=0,boxes:readonly InkBox[]=[]):void {
  const out=Math.max(0,Math.min(1,release));if(reduced||out>=1)return;
  const paper=sushiKingInkSurface(width,height,boxes);if(!paper)return;
  const cx=paper.x+paper.width/2,cy=paper.y+paper.height/2,rx=Math.min(width*.34,(paper.width/2-1.75)/1.035),ry=Math.min(height*.29,(paper.height/2-1.75)/1.035),phase=clock/840;
  for(let lane=0;lane<12;lane++){
   const t=(phase+(lane*.61803398875)%1)%1,angle=lane*TAU/12+.7*(1-t),radius=(.78+.22*(1-t))*(1-.7*out),arc=.28+.15*(1-t),opacity=(1-out)*(.65+.35*Math.sin(t*Math.PI));
   // A paper-coloured hairline separates ink from court art without a filled core.
   for(let pass=0;pass<2;pass++){
    for(let i=0;i<=8;i++){const u=i/8,a=angle+(u-.5)*arc,bend=.035*Math.sin(u*Math.PI),half=(pass===0?1.75:1.05)*Math.sin(Math.PI*u)**.55;
     const x=cx+Math.cos(a)*rx*(radius+bend),y=cy+Math.sin(a)*ry*(radius+bend),nx=Math.cos(a),ny=Math.sin(a);
     this.nib[i].x=x+nx*half;this.nib[i].y=y+ny*half;this.nib[17-i].x=x-nx*half;this.nib[17-i].y=y-ny*half;
    }
    g.fillStyle(pass===0?PAPER:lane%6===1?VERMILION:INK,opacity).fillPoints(this.nib,true);
   }
  }
 }
}
