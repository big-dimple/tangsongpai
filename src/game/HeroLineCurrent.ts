import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';

/** Short moving highlights sampled on an existing curve, never a new route.
 * Every segment is clipped with its full stroke radius against the same protected
 * regions as the underlying ink. The caller owns the clock and graphics. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],color:number,alpha:number){
 const heads:InkPoint[]=[];let segments=0;
 if(end<=start||alpha<=0)return {segments,heads};
 for(let i=0;i<2;i++){
  const u=((phase*2+i*.5)%1+1)%1,head=start+(end-start)*u,tail=Math.max(start,head-(end-start)*.11);
  if(head-tail<.001)continue;
  const points=Array.from({length:9},(_,j)=>curve(tail+(head-tail)*j/8));
  for(const run of clearInkRuns(points,boxes,2)){
   g.lineStyle(3.5,color,.3*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();
   g.lineStyle(1.5,0xffffff,.9*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();segments+=run.length-1;
   if(run[run.length-1]===points[points.length-1])heads.push(run[run.length-1]);
  }
 }
 return {segments,heads};
}
