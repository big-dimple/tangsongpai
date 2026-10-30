import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';

/** One small blue arc rides the original line, without repainting its shape. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],_color:number,alpha:number){
 const heads:InkPoint[]=[];let segments=0;
 if(end<=start||alpha<=0)return {segments,heads};
 const u=((phase*.72+.2)%1+1)%1,head=start+(end-start)*u,tail=Math.max(start,head-(end-start)*.24);
 if(head-tail<.001)return {segments,heads};
 const anchors=Array.from({length:9},(_,j)=>curve(tail+(head-tail)*j/8));
 const length=anchors.reduce((sum,p,j)=>j?sum+Math.hypot(p.x-anchors[j-1].x,p.y-anchors[j-1].y):0,0),amplitude=Math.min(1.5,length*.07);
 const offsets=[0,.25,-.55,.7,-.2,.9,-.45,.25,0];
 const points=anchors.map((p,j)=>{const before=anchors[Math.max(0,j-1)],after=anchors[Math.min(8,j+1)],dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy)||1,offset=2.2+offsets[j]*amplitude;return{x:p.x-dy/d*offset,y:p.y+dx/d*offset};});
 for(const run of clearInkRuns(points,boxes,2.5)){
  g.lineStyle(3.5,0x48b6e7,.2*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();
  g.lineStyle(1.6,0x168ed0,.9*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();
  g.lineStyle(.65,0xdafaff,.95*alpha).beginPath();run.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();segments+=run.length-1;
  if(run[run.length-1]===points[8])heads.push(points[8]);
 }
 if(length>12){const p=points[4],a=anchors[3],b=anchors[5],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,reach=Math.min(3,length*.12),fork=[p,{x:p.x+(dx*.22-dy*.55)/d*reach,y:p.y+(dy*.22+dx*.55)/d*reach},{x:p.x+(dx*.48-dy)/d*reach,y:p.y+(dy*.48+dx)/d*reach}];for(const run of clearInkRuns(fork,boxes,1.5)){g.lineStyle(1,0x168ed0,.85*alpha).beginPath();run.forEach((v,j)=>j?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.strokePath();segments+=run.length-1;}}
 return {segments,heads};
}
