import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';

/** A bounded bolt follows the existing line. Its stable zigzag and two forks move
 * with the head, rather than randomly flashing each frame. All strokes, including
 * the forks, use the same protected regions as the underlying ink. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],color:number,alpha:number){
 const heads:InkPoint[]=[];let segments=0;
 if(end<=start||alpha<=0)return {segments,heads};
 const paint=(points:InkPoint[],head?:InkPoint)=>{
  for(const run of clearInkRuns(points,boxes,3)){
   g.lineStyle(5,0x243c40,.72*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();
   g.lineStyle(2.3,color,alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();segments+=run.length-1;
   if(head&&run[run.length-1]===head)heads.push(head);
  }
 };
 for(let i=0;i<2;i++){
  const u=((phase*.8+i*.5)%1+1)%1,head=start+(end-start)*u,tail=Math.max(start,head-(end-start)*.28);
  if(head-tail<.001)continue;
  const anchors=Array.from({length:9},(_,j)=>curve(tail+(head-tail)*j/8));
  const length=anchors.reduce((sum,p,j)=>j?sum+Math.hypot(p.x-anchors[j-1].x,p.y-anchors[j-1].y):0,0);
  const amplitude=Math.min(4,length*.11);
  const points=anchors.map((p,j)=>{
   const before=anchors[Math.max(0,j-1)],after=anchors[Math.min(8,j+1)],dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy)||1;
   const offset=j===0||j===8?0:(j%2?1:-1)*amplitude;
   return{x:p.x-dy/d*offset,y:p.y+dx/d*offset};
  });
  paint(points,points[8]);
  for(const j of [3,6]){
   const a=anchors[j-1],b=anchors[j+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,side=j===3?1:-1,reach=Math.min(8,length*.22);
   if(reach<1)continue;
   const p=points[j],fork=[p,{x:p.x+(dx/d*.35-dy/d*side*.6)*reach,y:p.y+(dy/d*.35+dx/d*side*.6)*reach},{x:p.x+(dx/d*.7-dy/d*side)*reach,y:p.y+(dy/d*.7+dx/d*side)*reach}];
   paint(fork);
  }
 }
 return {segments,heads};
}
