import type Phaser from 'phaser';
import type {Box} from './layout';

type Point={x:number;y:number};
export const SCORE_STRIKE_LAYERS_BUDGET={wakeSamples:7,desktopRays:8,mobileRays:5,desktopChips:6,mobileChips:3} as const;

/** Projection always advances from the real source to the destination. */
export function strikeFlightPoint(from:Point,to:Point,t:number,arc=12):Point {
 const p=Math.max(0,Math.min(1,t)),u=p*p*p,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,bend=Math.sin(Math.PI*p)*arc;
 return {x:from.x+dx*u-dy/length*bend,y:from.y+dy*u+dx/length*bend};
}

/** Short wake behind the genuine moving face. No history buffer or running emitter. */
export function drawStrikeWake(g:Phaser.GameObjects.Graphics,from:Point,to:Point,t:number,arc:number,color:number,portrait:boolean,weight:number):void {
 const count=SCORE_STRIKE_LAYERS_BUDGET.wakeSamples,alpha=Math.sin(Math.PI*Math.min(1,t))*.65*Math.max(.3,weight),tail=Math.max(0,t-(portrait?.19:.25));
 if(alpha<=.001)return;
 for(let i=1;i<=count;i++){
  const a=strikeFlightPoint(from,to,tail+(t-tail)*(i-1)/count,arc),b=strikeFlightPoint(from,to,tail+(t-tail)*i/count,arc),p=i/count;
  g.lineStyle((portrait?5:9)*p,color,alpha*p*.25).lineBetween(a.x,a.y,b.x,b.y);
  g.lineStyle((portrait?1.2:2)*p,0xfff2cb,alpha*p).lineBetween(a.x,a.y,b.x,b.y);
 }
}

/** Contact crest, directional splinters and a smaller return beat. The centre
 * stays empty so the new value is legible; all travel fits inside its score cell. */
export function drawStrikeContact(g:Phaser.GameObjects.Graphics,hit:Point,from:Point,cell:Box,elapsed:number,hold:number,recovery:number,reboundAt:number,color:number,multiply:boolean,portrait:boolean,weight:number):void {
 const life=Math.max(hold+1,Math.min(hold+recovery,hold+(portrait?100:145))),p=Math.min(1,elapsed/life),alpha=(1-p)**2*Math.max(.35,weight),dx=hit.x-from.x,dy=hit.y-from.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
 const roomX=Math.max(0,Math.min(hit.x-cell.x,cell.x+cell.width-hit.x)-3),roomY=Math.max(0,Math.min(hit.y-cell.y,cell.y+cell.height-hit.y)-3),rx=Math.min(roomX,(portrait?17:27)+p*(multiply?9:5)),ry=Math.min(roomY,(portrait?10:15)+p*5);
 if(alpha>.001&&rx>2&&ry>2){
  g.lineStyle(multiply?3:2,color,alpha*.7).strokeEllipse(hit.x,hit.y,rx*2,ry*2);
  g.lineStyle(1,0xfff2cb,alpha*.95).strokeEllipse(hit.x,hit.y,Math.max(0,rx-2)*2,Math.max(0,ry-2)*2);
  const rays=portrait?SCORE_STRIKE_LAYERS_BUDGET.mobileRays:SCORE_STRIKE_LAYERS_BUDGET.desktopRays,chips=portrait?SCORE_STRIKE_LAYERS_BUDGET.mobileChips:SCORE_STRIKE_LAYERS_BUDGET.desktopChips;
  for(let i=0;i<rays;i++){
   const angle=Math.atan2(uy,ux)+(i/(rays-1)-.5)*Math.PI*1.5,a=Math.cos(angle),b=Math.sin(angle),r=.62+.28*p,end=Math.min(1,r+.18);
   g.lineStyle(multiply?2.4:1.6,color,alpha).lineBetween(hit.x+a*rx*r,hit.y+b*ry*r,hit.x+a*rx*end,hit.y+b*ry*end);
  }
  for(let i=0;i<chips;i++){
   const angle=i*2.39996+Math.atan2(uy,ux),a=Math.cos(angle),b=Math.sin(angle),r=.45+.45*p,x=hit.x+a*rx*r,y=hit.y+b*ry*r,size=(portrait?1.5:2.5)*(1-p);
   g.fillStyle(i%2?0xffe4a0:color,alpha*.85).fillTriangle(x-size,y,x+size,y-size*.6,x+size*.25,y+size);
  }
 }
 const returned=(elapsed-hold)/Math.max(1,recovery)-reboundAt,q=Math.max(0,Math.min(1,returned/.34));
 if(returned>=0&&q<1&&roomX>3&&roomY>3)g.lineStyle(1.5,color,(1-q)**2*.55*Math.max(.35,weight)).strokeEllipse(hit.x,hit.y,Math.min(roomX,9+q*10)*2,Math.min(roomY,5+q*5)*2);
}

/** Official Phaser 3.90 pre-FX, confined to the short-lived art copy. Canvas,
 * mobile and renderers without the FX pipeline use the same geometric layers. */
export function strikeArtGlow(scene:Phaser.Scene,image:Phaser.GameObjects.Image,color:number,portrait:boolean):Phaser.FX.Glow|undefined {
 const renderer=scene.sys?.renderer;
 if(portrait||scene.game?.renderer?.type!==2||!renderer||!('pipelines' in renderer)||!renderer.pipelines.FX_PIPELINE||!image.preFX)return;
 image.preFX.setPadding(8);return image.preFX.addGlow(color,1.5,0,false);
}
