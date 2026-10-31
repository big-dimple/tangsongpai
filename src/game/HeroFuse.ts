import type Phaser from 'phaser';
import {clearInkRuns,inkSegmentCrosses,type InkBox,type InkPoint} from './AssistInkGeometry';

/** A single source-to-target conductor; never route through text, art or card faces. */
export interface FuseRoute {points:InkPoint[];source:InkPoint;target:InkPoint;bounds:InkBox}
const clearance=3.6;
const blocked=(p:InkPoint,boxes:readonly InkBox[])=>boxes.some(b=>p.x>=b.x-clearance&&p.x<=b.x+b.width+clearance&&p.y>=b.y-clearance&&p.y<=b.y+b.height+clearance);
const clear=(a:InkPoint,b:InkPoint,boxes:readonly InkBox[])=>!boxes.some(box=>inkSegmentCrosses(a,b,box,clearance));

/** Find a nearby exposed end, then a connected path around the actual occupied surfaces. */
export function routeHeroFuse(source:InkPoint,target:InkPoint,boxes:readonly InkBox[],bounds:InkBox):FuseRoute|undefined {
 const step=bounds.width<600?4:8,margin=3.8;
 const cols=Math.floor((bounds.width-2*margin)/step)+1,rows=Math.floor((bounds.height-2*margin)/step)+1;
 if(cols<2||rows<2||cols*rows>200000)return undefined;
 const point=(n:number):InkPoint=>({x:bounds.x+margin+(n%cols)*step,y:bounds.y+margin+Math.floor(n/cols)*step});
 const open=new Uint8Array(cols*rows);open.fill(1);const nearby:InkBox[][]=Array.from({length:open.length},()=>[]);
 for(const box of boxes){
  const left=box.x-clearance,right=box.x+box.width+clearance,top=box.y-clearance,bottom=box.y+box.height+clearance;
  const x0=Math.max(0,Math.ceil((left-bounds.x-margin)/step)-1),x1=Math.min(cols-1,Math.floor((right-bounds.x-margin)/step)+1);
  const y0=Math.max(0,Math.ceil((top-bounds.y-margin)/step)-1),y1=Math.min(rows-1,Math.floor((bottom-bounds.y-margin)/step)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const id=y*cols+x,p=point(id);nearby[id].push(box);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)open[id]=0;}
 }
 const closest=(p:InkPoint)=>{let best=-1,d=Infinity;for(let i=0;i<open.length;i++)if(open[i]){const q=point(i),v=(q.x-p.x)**2+(q.y-p.y)**2;if(v<d){d=v;best=i;}}return best;};
 const start=closest(source),end=closest(target);if(start<0||end<0||start===end)return undefined;
 const targetPoint=point(end),distance=(i:number)=>{const p=point(i);return Math.hypot(p.x-targetPoint.x,p.y-targetPoint.y)/step;};
 const costs=new Float64Array(open.length);costs.fill(Infinity);costs[start]=0;const previous=new Int32Array(open.length);previous.fill(-1);
 const heap:{id:number;f:number}[]=[];
 const push=(v:{id:number;f:number})=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=v.f)break;heap[i]=heap[p];i=p;}heap[i]=v;};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[i]=heap[child];i=child;}heap[i]=last;}return top;};
 push({id:start,f:distance(start)});const closed=new Uint8Array(open.length);
 while(heap.length){const {id}=pop();if(closed[id])continue;closed[id]=1;if(id===end)break;const x=id%cols,y=Math.floor(id/cols),a=point(id);
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const next=ny*cols+nx;if(!open[next]||closed[next]||!clear(a,point(next),nearby[id]))continue;const edge=nx*step<14||(cols-1-nx)*step<14?2:0;const cost=costs[id]+(dx&&dy?Math.SQRT2:1)+edge;if(cost>=costs[next])continue;costs[next]=cost;previous[next]=id;push({id:next,f:cost+distance(next)});}
 }
 if(previous[end]<0)return undefined;
 const nodes:InkPoint[]=[];for(let i=end;i!==-1;i=previous[i])nodes.push(point(i));nodes.reverse();
 // Remove grid stair-steps wherever a direct segment remains unobstructed.
 const points=[nodes[0]];for(let i=0;i<nodes.length-1;){let j=nodes.length-1;while(j>i+1&&!clear(nodes[i],nodes[j],boxes))j--;points.push(nodes[j]);i=j;}
 return{points,source:{...source},target:{...target},bounds:{...bounds}};
}

export function fuseRouteSafe(route:FuseRoute,boxes:readonly InkBox[]):boolean {
 return route.points.every((p,i)=>i===0?!blocked(p,boxes):clear(route.points[i-1],p,boxes));
}
function atDistance(points:readonly InkPoint[],distance:number):InkPoint {
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b.x-a.x,b.y-a.y);if(distance<=d){const t=d?distance/d:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}distance-=d;}
 return points[points.length-1];
}
function portion(points:readonly InkPoint[],from:number,to:number):InkPoint[] {
 const total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0),begin=total*from,end=total*to,out=[atDistance(points,begin)];let d=0;
 for(let i=1;i<points.length;i++){d+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);if(d>begin&&d<end)out.push(points[i]);}out.push(atDistance(points,end));return out;
}
function stroke(g:Phaser.GameObjects.Graphics,points:InkPoint[],boxes:readonly InkBox[],width:number,color:number,alpha:number):number {
 let count=0;for(const run of clearInkRuns(points,boxes,width/2+.5)){g.lineStyle(width,color,alpha).beginPath();run.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokePath();count+=run.length-1;}return count;
}
/** One advancing ignition front. Short sparks emanate from that front only. */
export function drawHeroFuse(g:Phaser.GameObjects.Graphics,route:FuseRoute,progress:number,boxes:readonly InkBox[],alpha:number){
 const p=Math.max(0,Math.min(1,progress)),front=Math.min(1,p/.8),fade=p<.8?1:Math.max(0,(1-p)/.2),guide=route.points;
 let segments=stroke(g,guide,boxes,1.8,0x238bd5,.62*alpha*fade);
 if(front>0){const lit=portion(guide,0,front),trail=portion(guide,Math.max(0,front-.16),front);
  segments+=stroke(g,lit,boxes,3,0x1981d1,.78*alpha*fade);
  segments+=stroke(g,trail,boxes,5,0x298fea,.55*alpha*fade);
  segments+=stroke(g,trail,boxes,2.4,0xe3faff,alpha*fade);
 }
 const head=atDistance(guide,guide.slice(1).reduce((n,q,i)=>n+Math.hypot(q.x-guide[i].x,q.y-guide[i].y),0)*front);
 // A hot travelling segment remains visible even inside a narrow gap.
 const hot=portion(guide,Math.max(0,front-.028),Math.min(1,front+.015));
 segments+=stroke(g,hot,boxes,3,0xffffff,alpha*fade);
 const inBounds=(q:InkPoint,r:number)=>route.bounds.width<=0||q.x-r>=route.bounds.x&&q.x+r<=route.bounds.x+route.bounds.width&&q.y-r>=route.bounds.y&&q.y+r<=route.bounds.y+route.bounds.height;
 const room=(q:InkPoint,r:number)=>inBounds(q,r)&&boxes.every(b=>q.x+r<b.x||q.x-r>b.x+b.width||q.y+r<b.y||q.y-r>b.y+b.height);
 if(room(head,8))g.fillStyle(0x2295ed,.28*alpha*fade).fillCircle(head.x,head.y,8);
 if(room(head,3.5))g.fillStyle(0xe9fcff,alpha*fade).fillCircle(head.x,head.y,3.5);
 const burst=p<.8?11:11+5*Math.sin(Math.PI*Math.min(1,(p-.8)/.2));
 // Every ray begins at the one advancing head, never as an independent particle.
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]]){
  const end={x:head.x+dx*burst,y:head.y+dy*burst};
  if(inBounds(end,1.5)&&clear(head,end,boxes)){
   segments+=stroke(g,[head,end],boxes,3,0x268bdd,.8*alpha*fade);
   segments+=stroke(g,[head,end],boxes,1.2,0xe8fcff,alpha*fade);
  }
 }
 // Two short sparks are born on the illuminated tail and die with it.
 const total=guide.slice(1).reduce((n,q,i)=>n+Math.hypot(q.x-guide[i].x,q.y-guide[i].y),0);
 for(const [offset,side] of [[.045,-1],[.09,1]]){
  if(front<offset)continue;const anchor=atDistance(guide,total*(front-offset)),a=atDistance(guide,total*Math.max(0,front-offset-.006)),b=atDistance(guide,total*Math.min(1,front-offset+.006)),d=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const tip={x:anchor.x-(b.y-a.y)/d*side*6,y:anchor.y+(b.x-a.x)/d*side*6};
  if(inBounds(tip,1)&&clear(anchor,tip,boxes))segments+=stroke(g,[anchor,tip],boxes,1.4,0xa8e9ff,.8*alpha*fade);
 }
 return{segments,heads:segments?[head]:[],front};
}
