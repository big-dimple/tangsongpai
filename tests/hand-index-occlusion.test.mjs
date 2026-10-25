import {expect,it} from 'vitest';
import {handIndexOcclusion} from '../harness/hand-index-occlusion.mjs';

// Independent rectangle construction: rotate its four corners around its center.
function rectangle(x,y,width,height,degrees=0){
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=x+width/2,cy=y+height/2;
  const point=(u,v)=>({x:cx+(u-cx)*c-(v-cy)*s,y:cy+(u-cx)*s+(v-cy)*c});
  return {name:'rank-index',getTopLeft:()=>point(x,y),getTopRight:()=>point(x+width,y),getBottomRight:()=>point(x+width,y+height),getBottomLeft:()=>point(x,y+height)};
}
function observe(neighbor,{selected=true,visible=true,above=true}={}){
  const body={list:[rectangle(0,0,20,40)]},card={card:{id:'selected'},container:{visible:true,getData:key=>key==='selected'?selected:key==='cardBodyRoot'?body:undefined}};
  const other={card:{id:'neighbor'},container:{visible,getData:()=>false},background:neighbor};
  return handIndexOcclusion({cardViews:[card,other],view:{root:{getIndex:container=>container===card.container?1:above?2:0}}});
}
it('does not mistake the empty corner of a tilted card bounding box for printed-index coverage',()=>{
  const neighbor=rectangle(22,0,64,90,7),points=[neighbor.getTopLeft(),neighbor.getTopRight(),neighbor.getBottomRight(),neighbor.getBottomLeft()];
  // Its old axis-aligned bounds cross more than 6% of the index, but the face is entirely to its right.
  expect((20-Math.min(...points.map(p=>p.x)))/20).toBeGreaterThan(.06);
  expect(observe(neighbor)[0].occluders[0].fraction).toBeCloseTo(0);
  expect(observe(neighbor)[0].coveredBy).toEqual([]);
});
it('still detects genuine coverage by straight and tilted cards',()=>{
  expect(observe(rectangle(10,0,64,90))[0].coveredBy).toEqual([{id:'neighbor',fraction:.5}]);
  const tilted=observe(rectangle(15,0,64,90,-7))[0];
  expect(tilted.coveredBy.map(card=>card.id)).toEqual(['neighbor']);expect(tilted.occluders[0].fraction).toBeGreaterThan(.06);
});
it('retains the 6% area threshold and excludes lower, hidden and unselected cards',()=>{
  expect(observe(rectangle(19,0,64,90))[0].coveredBy).toEqual([]);
  expect(observe(rectangle(18,0,64,90))[0].coveredBy).toEqual([{id:'neighbor',fraction:.1}]);
  for(const options of [{visible:false},{above:false}])expect(observe(rectangle(0,0,64,90),options)[0].coveredBy).toEqual([]);
  expect(observe(rectangle(0,0,64,90),{selected:false})).toEqual([]);
});
