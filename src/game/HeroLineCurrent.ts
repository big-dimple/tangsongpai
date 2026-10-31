import type Phaser from 'phaser';
import {type InkBox,type InkPoint} from './AssistInkGeometry';
import {drawElectricFork,electricFork} from './HeroElectricGeometry';

/** One moving discharge and a shorter trailing branch leave the brush line intact. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],_color:number,alpha:number,variation=0){
 const heads:InkPoint[]=[];let segments=0;
 if(end<=start||alpha<=0)return {segments,heads};
 const span=end-start,a=curve(start),b=curve(end),length=Math.hypot(b.x-a.x,b.y-a.y);
 if(length<5)return {segments,heads};
 for(const [index,side] of [[0,-1],[1,1]] as const){
  const u=Math.max(.04,Math.min(.79,[.13,.67][index]+Math.sin(phase*5+index*2.3)*.035));
  const t=start+span*u,p=curve(t),before=curve(Math.max(start,t-span*.025)),after=curve(Math.min(end,t+span*.025));
  const dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy)||1,tangent={x:dx/d,y:dy/d},normal={x:-dy/d*side,y:dx/d*side};
  const reach=Math.min([48,19][index],length*(.94-u));if(reach<3)continue;
  // Follow the guide at every bend, including the small curved Liu E and
  // Xin Qiji stages. A single straight tangent visibly leaves those arcs.
  const local=electricFork(p,tangent,normal,reach,index*31+3+variation*97,phase*7,1,'line');
  const paths=local.map(path=>path.map(point=>{
   const x=point.x-p.x,y=point.y-p.y,along=x*tangent.x+y*tangent.y,away=x*normal.x+y*normal.y;
   const q=Math.max(start,Math.min(end,t+span*along/length)),center=curve(q),epsilon=span*.005;
   const c0=curve(Math.max(start,q-epsilon)),c1=curve(Math.min(end,q+epsilon)),vx=c1.x-c0.x,vy=c1.y-c0.y,vd=Math.hypot(vx,vy)||1;
   return{x:center.x-vy/vd*side*away,y:center.y+vx/vd*side*away};
  }));
  const result=drawElectricFork(g,paths,boxes,1,alpha*(index?.68:1));
  segments+=result.segments;heads.push(...result.heads);
 }
 return {segments,heads};
}
