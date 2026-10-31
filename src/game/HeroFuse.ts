import type Phaser from 'phaser';
import {clearInkRuns,inkSegmentCrosses,type InkBox,type InkPoint} from './AssistInkGeometry';

/** A single source-to-target conductor; never route through text, art or card faces. */
export interface FuseRoute {points:InkPoint[];source:InkPoint;target:InkPoint;bounds:InkBox;clearance?:number}
const clearance=3.6;
const blocked=(p:InkPoint,boxes:readonly InkBox[],pad=clearance)=>boxes.some(b=>p.x>=b.x-pad&&p.x<=b.x+b.width+pad&&p.y>=b.y-pad&&p.y<=b.y+b.height+pad);
const clear=(a:InkPoint,b:InkPoint,boxes:readonly InkBox[],pad=clearance)=>!boxes.some(box=>inkSegmentCrosses(a,b,box,pad));

/** Find a nearby exposed end, then a connected path around the actual occupied surfaces. */
export function routeHeroFuse(source:InkPoint,target:InkPoint,boxes:readonly InkBox[],bounds:InkBox):FuseRoute|undefined {
 // Centre a visible, uncropped glow in the narrow side channel on phones.
 const step=bounds.width<600?2:8,pad=bounds.width<600?2.2:clearance,margin=bounds.width>340&&bounds.width<600?5.6:3.8;
 const cols=Math.floor((bounds.width-2*margin)/step)+1,rows=Math.floor((bounds.height-2*margin)/step)+1;
 if(cols<2||rows<2||cols*rows>200000)return undefined;
 const point=(n:number):InkPoint=>({x:bounds.x+margin+(n%cols)*step,y:bounds.y+margin+Math.floor(n/cols)*step});
 const open=new Uint8Array(cols*rows);open.fill(1);const nearby:InkBox[][]=Array.from({length:open.length},()=>[]);
 for(const box of boxes){
  const left=box.x-pad,right=box.x+box.width+pad,top=box.y-pad,bottom=box.y+box.height+pad;
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
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const next=ny*cols+nx;if(!open[next]||closed[next]||!clear(a,point(next),nearby[id],pad))continue;const edge=nx*step<14||(cols-1-nx)*step<14?2:0;const cost=costs[id]+(dx&&dy?Math.SQRT2:1)+edge;if(cost>=costs[next])continue;costs[next]=cost;previous[next]=id;push({id:next,f:cost+distance(next)});}
 }
 if(previous[end]<0)return undefined;
 const nodes:InkPoint[]=[];for(let i=end;i!==-1;i=previous[i])nodes.push(point(i));nodes.reverse();
 // Remove grid stair-steps wherever a direct segment remains unobstructed.
 const points=[nodes[0]];for(let i=0;i<nodes.length-1;){let j=nodes.length-1;while(j>i+1&&!clear(nodes[i],nodes[j],boxes,pad))j--;points.push(nodes[j]);i=j;}
 return{points,source:{...source},target:{...target},bounds:{...bounds},clearance:pad};
}

export function fuseRouteSafe(route:FuseRoute,boxes:readonly InkBox[]):boolean {
 const pad=route.clearance??clearance;return route.points.every((p,i)=>i===0?!blocked(p,boxes,pad):clear(route.points[i-1],p,boxes,pad));
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


/** A disc stays entirely on screen and outside every protected painted surface. */
function safeDiscRadius(point:InkPoint,desired:number,boxes:readonly InkBox[],bounds:InkBox):number {
 let radius=desired;
 if(bounds.width>0&&bounds.height>0)radius=Math.min(radius,point.x-bounds.x-.8,point.y-bounds.y-.8,bounds.x+bounds.width-point.x-.8,bounds.y+bounds.height-point.y-.8);
 for(const b of boxes){const dx=Math.max(b.x-point.x,0,point.x-b.x-b.width),dy=Math.max(b.y-point.y,0,point.y-b.y-b.height);radius=Math.min(radius,Math.hypot(dx,dy)-.8);}
 return Math.max(0,radius);
}
function safeDisc(g:Phaser.GameObjects.Graphics,point:InkPoint,radius:number,color:number,opacity:number,boxes:readonly InkBox[],bounds:InkBox):number {
 const r=safeDiscRadius(point,radius,boxes,bounds);if(r<.7||opacity<=0)return 0;g.fillStyle(color,opacity).fillCircle(point.x,point.y,r);return r;
}
/** Irregular, filled hot core; it is not an outlined symbol or a moving dot. */
function safeFlare(g:Phaser.GameObjects.Graphics,point:InkPoint,radius:number,color:number,opacity:number,boxes:readonly InkBox[],bounds:InkBox,angle:number):number {
 const r=safeDiscRadius(point,radius,boxes,bounds);if(r<.7||opacity<=0)return 0;
 const shape=[.76,.97,.79,.92,.71,.98,.81,.88,.69,.96,.8,.9];
 const points=shape.map((weight,i)=>{const a=angle+i*Math.PI/6;return{x:point.x+Math.cos(a)*r*weight,y:point.y+Math.sin(a)*r*weight};});
 g.fillStyle(color,opacity).fillPoints(points,true);return r;
}
/** A spark is born on the already-lit wire, grows briefly, and dies there. */
function ignitionSpark(g:Phaser.GameObjects.Graphics,origin:InkPoint,tip:InkPoint,boxes:readonly InkBox[],bounds:InkBox,opacity:number):number {
 const within=(p:InkPoint)=>bounds.width<=0||p.x>=bounds.x+1.5&&p.x<=bounds.x+bounds.width-1.5&&p.y>=bounds.y+1.5&&p.y<=bounds.y+bounds.height-1.5;
 const safe=(p:InkPoint)=>within(p)&&!boxes.some(b=>inkSegmentCrosses(origin,p,b,1.6));
 let low=0,high=1;for(let i=0;i<8;i++){const t=(low+high)/2,p={x:origin.x+(tip.x-origin.x)*t,y:origin.y+(tip.y-origin.y)*t};if(safe(p))low=t;else high=t;}
 const end={x:origin.x+(tip.x-origin.x)*low,y:origin.y+(tip.y-origin.y)*low};if(Math.hypot(end.x-origin.x,end.y-origin.y)<2)return 0;
 let segments=stroke(g,[origin,end],boxes,2.2,0x1463ad,.9*opacity);
 segments+=stroke(g,[origin,end],boxes,1,0xe4fbff,opacity);
 safeDisc(g,end,1.5,0xb5eaff,.85*opacity,boxes,bounds);return segments;
}
/** A hot, asymmetric front travels one real path and releases at its destination. */
export function drawHeroIgnition(g:Phaser.GameObjects.Graphics,route:FuseRoute,progress:number,boxes:readonly InkBox[],alpha:number){
 const p=Math.max(0,Math.min(1,progress)),raw=Math.min(1,p/.78);
 // Uneven but strictly forward movement: no abrupt blinking or independent heads.
 const front=Math.max(0,Math.min(1,raw+.028*Math.sin(2*Math.PI*raw)+.016*Math.sin(4*Math.PI*raw)));
 const arrival=Math.max(0,Math.min(1,(p-.78)/.22)),release=Math.sin(Math.PI*arrival),fade=p>.84?Math.max(0,(1-p)/.16):1;
 const start=Math.min(1,.25+p/.06),opacity=alpha*fade*start,guide=route.points,total=guide.slice(1).reduce((n,q,i)=>n+Math.hypot(q.x-guide[i].x,q.y-guide[i].y),0);
 const at=(fraction:number)=>atDistance(guide,total*Math.max(0,Math.min(1,fraction)));
 const head=at(front),back=at(Math.max(0,front-.012)),ahead=at(Math.min(1,front+.012)),dx=ahead.x-back.x,dy=ahead.y-back.y,d=Math.hypot(dx,dy)||1,tangent={x:dx/d,y:dy/d},normal={x:-dy/d,y:dx/d};
 // The faint conductor only explains direction. A short luminous wake, not
 // an always-bright second line, follows the same advancing burn front.
 let segments=stroke(g,guide,boxes,1.15,0x286b9e,.30*opacity);
 if(front>0){const trail=portion(guide,Math.max(0,front-Math.min(32,total*.12)/Math.max(1,total)),front);
  segments+=stroke(g,trail,boxes,5.8,0x2777bd,.26*opacity);
  segments+=stroke(g,trail,boxes,3.2,0x146ab4,.78*opacity);
  segments+=stroke(g,trail,boxes,1.4,0xd2f5ff,.94*opacity);
 }
 const pulse=.9+.1*Math.sin(p*Math.PI*4),spread=8+4*release,angle=Math.atan2(tangent.y,tangent.x)+.12*Math.sin(p*Math.PI*3);
 // If the wire is beside a card, keep the flame connected but bias its core
 // slightly into the open side instead of crushing it against the frame.
 let core=head,best=safeDiscRadius(head,9,boxes,route.bounds);
 for(const side of [-1,1]){const q={x:head.x+normal.x*side*5,y:head.y+normal.y*side*5},available=safeDiscRadius(q,9,boxes,route.bounds);
  if(available>best+.8&&!boxes.some(box=>inkSegmentCrosses(head,q,box,1.4))){core=q;best=available;}
 }
 if(core!==head){segments+=stroke(g,[head,core],boxes,2.4,0x187bc4,.8*opacity);segments+=stroke(g,[head,core],boxes,1,0xe2faff,opacity);}
 // Uneven blue lobes stay compact and fit the available space beside a card.
 for(const [along,away,size,weight] of [[-3,-4,1,.23],[-5,2,.9,.26],[0,0,1,.28],[1,3,.8,.2]] as const){
  const q={x:core.x+tangent.x*along+normal.x*away,y:core.y+tangent.y*along+normal.y*away};
  safeFlare(g,q,spread*size,0x187bc4,weight*opacity*pulse,boxes,route.bounds,angle+away*.08);
 }

 safeFlare(g,core,8.4+2.3*release,0x07569f,.68*opacity,boxes,route.bounds,angle);
 safeFlare(g,core,6.1+1.5*release,0x65d8ff,.95*opacity,boxes,route.bounds,angle+.18);
 const hot={x:core.x-tangent.x*.65,y:core.y-tangent.y*.65};
 const coreRadius=safeFlare(g,hot,3.2+1.1*release,0xf4fdff,opacity,boxes,route.bounds,angle-.1);
 // Three short offshoots remain anchored within 16px of the hot front. Their
 // unequal lifetimes make a compact burning edge, never free-roaming motes.
 let sparkSegments=0,sparks=0;const time=p*900;
 for(const [index,offset,period,preferred] of [[0,2,137,-1],[1,8,173,1],[2,15,197,-1]] as const){
  if(front*total<offset)continue;const distance=front*total-offset,fraction=distance/Math.max(1,total),anchor=at(fraction),before=at(fraction-.012),after=at(fraction+.012),vx=after.x-before.x,vy=after.y-before.y,length=Math.hypot(vx,vy)||1,nx=-vy/length,ny=vx/length;
  const probe=(side:number)=>safeDiscRadius({x:anchor.x+nx*side*4,y:anchor.y+ny*side*4},1.2,boxes,route.bounds);
  const side=probe(preferred)<.9&&probe(-preferred)>probe(preferred)?-preferred:preferred;
  const life=((time+index*53)%period)/period,grow=Math.sin(Math.PI*life),reach=(5+index*2)*grow;
  const tip={x:anchor.x+nx*side*reach-vx/length*reach*.3,y:anchor.y+ny*side*reach-vy/length*reach*.3};
  const drawn=ignitionSpark(g,anchor,tip,boxes,route.bounds,opacity*grow);sparkSegments+=drawn;if(drawn)sparks++;
 }
 // One restrained release at the real endpoint, then all layers fade.
 if(arrival>0&&arrival<1){for(const [a,b] of [[.28,1],[-.58,-1],[.82,-1]] as const){
  if(sparks>=3)break;const reach=(5+6*release),tip={x:head.x+(tangent.x*a+normal.x*b)*reach,y:head.y+(tangent.y*a+normal.y*b)*reach};
  const drawn=ignitionSpark(g,head,tip,boxes,route.bounds,opacity*release);sparkSegments+=drawn;if(drawn)sparks++;
 }}
 segments+=sparkSegments;return{segments,heads:segments?[head]:[],front,corePoint:core,coreRadius,sparks,release};
}
