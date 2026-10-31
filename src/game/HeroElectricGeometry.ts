import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';

// Include subpixel antialiasing around the widest 6.2px strip.
export const ELECTRIC_CLEARANCE_PX=4;
export const ELECTRIC_OUTER_RADIUS_PX=3.1;

// These hashes are local to drawing; they never touch the run's random state.
function sample(seed:number,step:number):number {
 const n=Math.sin(seed*91.23+step*17.71)*43758.5453;return (n-Math.floor(n))*2-1;
}
export function electricSeed(id:string):number {let n=17;for(const c of id)n=(n*31+c.charCodeAt(0))%65521;return n;}
export function electricVariation(seed:number):number {return (sample(seed,0)+1)/2;}
/** Each branch makes its own deterministic on/off decision for this discharge. */
export function electricBranches(seed:number,time:number):readonly [boolean,boolean] {
 const step=Math.floor(time);return [sample(seed+251,step)>-.28,sample(seed+379,step)>-.08];
}

/** A local discharge. The source may cross its guide; a card spark stays outside its face. */
export function electricFork(origin:InkPoint,tangent:InkPoint,outward:InkPoint,length:number,seed:number,time:number,spread=1,shape:'line'|'edge'='edge'):InkPoint[][] {
 const at=(along:number,away:number):InkPoint=>({x:origin.x+tangent.x*length*along+outward.x*length*away*spread,y:origin.y+tangent.y*length*along+outward.y*length*away*spread});
 const step=Math.floor(time),n=(i:number)=>sample(seed+i*7,step);
 // Hold each irregular channel briefly, then reconstruct it. Interpolating
 // all the bends together makes the discharge look like a crawling creature.
 const along=[0,.20+n(1)*.055,.30+n(2)*.025,.51+n(3)*.07,.68+n(4)*.055,.78+n(15)*.025,1];
 const sign=sample(seed+29,step)>0?1:-1;
 // Alternating long and short bends create an asymmetric bolt, rather than
 // parallel scratches. Edge geometry always points away from the card face.
 const away=shape==='line'?[0,sign*(.12+n(5)*.07),sign*(-.09+n(6)*.08),sign*(-.21+n(7)*.07),sign*(-.03+n(8)*.08),sign*(.18+n(9)*.07),sign*(.07+n(16)*.06)]:[0,.08+n(5)*.06,.26+n(6)*.13,.08+n(7)*.06,.30+n(8)*.11,.13+n(9)*.08,.26+n(16)*.10];
 const trunk=along.map((a,i)=>at(a,away[i]));
 // Branches trade length between discharges. One remains
 // long and outward; the shorter branch bends back along the guide.
 const wave=(sample(seed+177,step)+1)/2,long=.48+.52*wave,short=.10+.90*(1-wave);
 const branchA=shape==='line'
  ?[trunk[2],at(along[2]-.045*long,away[2]+sign*(.12+n(10)*.04)*long),at(along[2]+.015*long,away[2]+sign*(.20+n(11)*.04)*long),at(along[2]+(.11+n(11)*.04)*long,away[2]+sign*(.30+n(12)*.06)*long)]
  :[trunk[2],at(along[2]-.025*long,away[2]+(.12+n(10)*.04)*long),at(along[2]+.035*long,away[2]+(.21+n(11)*.04)*long),at(along[2]+(.14+n(11)*.04)*long,away[2]+(.32+n(12)*.06)*long)];
 const branchB=shape==='line'
  ?[trunk[4],at(along[4]-.07*short,away[4]-sign*(.10+n(13)*.04)*short),at(along[4]+(-.15+n(15)*.03)*short,away[4]-sign*(.20+n(14)*.04)*short)]
  :[trunk[4],at(along[4]-.07*short,away[4]+(.09+n(13)*.04)*short),at(along[4]+(-.15+n(15)*.03)*short,away[4]+(.19+n(14)*.04)*short)];
 return [trunk,branchA,branchB];
}

/** Tapered convex strips keep every filled pixel within the certified stroke radius. */
function ribbon(g:Phaser.GameObjects.Graphics,points:readonly InkPoint[],width:number,color:number,opacity:number,scale:number,joins=false):void {
 // The body stays substantial through its uneven bends and still ends in a
 // narrow point. Different endpoint widths make the silhouette less tubular.
 const weight=(i:number)=>points.length===2?(i? .46:.78):.23+.77*Math.sin(Math.PI*i/(points.length-1))**.48*(i%2?.91:1);
 g.fillStyle(color,opacity);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.001)continue;
  const nx=-dy/d,ny=dx/d,wa=width*weight(i-1)/(2*scale),wb=width*weight(i)/(2*scale);
  g.fillPoints([{x:a.x+nx*wa,y:a.y+ny*wa},{x:b.x+nx*wb,y:b.y+ny*wb},{x:b.x-nx*wb,y:b.y-ny*wb},{x:a.x-nx*wa,y:a.y-ny*wa}],true);
  // Small convex facets bridge selected sharp turns without a Canvas miter.
  if(joins&&i<points.length-1&&i%2===0){const r=wb;g.fillPoints([{x:b.x,y:b.y-r},{x:b.x+r,y:b.y},{x:b.x,y:b.y+r},{x:b.x-r,y:b.y}],true);}
 }
}

/** Clip every stroke; never draw a disconnected fragment beyond a mask. */
export function drawElectricFork(g:Phaser.GameObjects.Graphics,paths:readonly InkPoint[][],boxes:readonly InkBox[],scale:number,alpha:number,visible?:(p:InkPoint)=>boolean,clearance=ELECTRIC_CLEARANCE_PX/scale,branches:readonly [boolean,boolean]=[true,true]):{segments:number;heads:InkPoint[]} {
 let segments=0;const heads:InkPoint[]=[];let trunkLength=0;
 for(let i=0;i<paths.length;i++){
  if(i===1&&(!branches[0]||trunkLength<3)||i===2&&(!branches[1]||trunkLength<5))continue;
  const path=paths[i],runs=clearInkRuns(path,boxes,clearance);let run=runs[0];
  if(!run||run[0]!==path[0])continue;
  if(visible){const stop=run.findIndex(p=>!visible(p));if(stop>=0)run=run.slice(0,stop);if(run.length<2)continue;}
  if(i===0)trunkLength=run.length;
  // A narrow translucent fringe sits behind a tapering blue body and a
  // continuous, brighter white core. Branches remain shorter and finer.
  // Convex strips avoid Canvas' unbounded miter joins at sharp lightning bends.
  ribbon(g,run,i?3.8:6.2,0x76c8f2,.16*alpha,scale);
  ribbon(g,run,i?3.4:6.2,0x1768c3,.98*alpha,scale,true);
  ribbon(g,run,i?1.7:3.4,0xf3fdff,alpha,scale,true);
  segments+=run.length-1;heads.push(run[run.length-1]);
 }
 return {segments,heads};
}
