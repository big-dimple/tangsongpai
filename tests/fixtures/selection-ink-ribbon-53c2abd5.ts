// Exact reference geometry from53c2abd5; intentionally retains the original operation order.
import type {Box} from '../../src/game/layout';
function selectionInkPoint(b:Box,t:number):{x:number;y:number} {
 const u=Math.max(0,Math.min(1,t));return{x:b.x+b.width*(.09+.82*u),y:b.y+b.height*(.88+.055*Math.sin(u*Math.PI*2)-.19*u)};
}
export function legacySelectionInkRibbon(anchor:Box,start:number,end:number,offset:number,width:number):{x:number;y:number}[]{
      const left:{x:number;y:number}[]=[],right:{x:number;y:number}[]=[];
      for(let i=0;i<=64;i++){const u=start+(end-start)*i/64,local=i/64,p=selectionInkPoint(anchor,u),q=selectionInkPoint(anchor,Math.min(1,u+.002)),angle=Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2,nx=Math.cos(angle),ny=Math.sin(angle),w=width*Math.pow(Math.sin(Math.PI*local),.8)*(.82+.18*Math.sin(u*13));left.push({x:p.x+nx*(offset+w/2),y:p.y+ny*(offset+w/2)});right.push({x:p.x+nx*(offset-w/2),y:p.y+ny*(offset-w/2)});}
      return [...left,...right.reverse()];
}
