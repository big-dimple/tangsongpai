import type {PadDirection} from '../platform/GamepadInput';
export interface FocusBox {x:number;y:number;width:number;height:number}
export interface FocusTarget {id:string;box:FocusBox}

/** Prefer neighbours in the same row/column, including the visibly overlapping hand fan. */
export function nextControllerTarget<T extends FocusTarget>(targets:readonly T[],current:string|undefined,direction:PadDirection):T|undefined {
  const origin=targets.find(target=>target.id===current);if(!origin)return targets[0];
  const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;
  const center=(b:FocusBox)=>({x:b.x+b.width/2,y:b.y+b.height/2}),start=center(origin.box);
  let winner:T|undefined,best=Infinity;
  for(const target of targets){
    if(target===origin)continue;const end=center(target.box),along=(horizontal?end.x-start.x:end.y-start.y)*sign;
    if(along<=1)continue;
    const across=Math.abs(horizontal?end.y-start.y:end.x-start.x),span=horizontal?(origin.box.height+target.box.height)/2:(origin.box.width+target.box.width)/2;
    // Lifted cards still overlap the same row. Prefer their nearest seat over a farther aligned card.
    const gap=Math.max(0,across-span),score=along+across*.1+gap*3+(gap>0?1000:0);
    if(score<best){best=score;winner=target;}
  }
  return winner??origin;
}
