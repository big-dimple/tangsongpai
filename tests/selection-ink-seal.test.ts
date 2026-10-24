import {expect,it} from 'vitest';
import assert from 'node:assert/strict';
import {legacySelectionInkRibbon} from './fixtures/selection-ink-ribbon-53c2abd5';
import {createSelectionInkRibbon,selectionButtonPose,selectionFeedbackRegion,selectionGatherPoint,selectionInkPoint,selectionSealBox} from '../src/game/SelectionEntryParticles';

it.each([{x:12,y:80,width:160,height:200},{x:36,y:88,width:360,height:450}])('keeps the ink below the face and seal within the portrait: %o',box=>{
 const points=Array.from({length:101},(_,i)=>selectionInkPoint(box,i/100));
 for(const p of points){expect(p.x).toBeGreaterThanOrEqual(box.x+12);expect(p.x).toBeLessThan(box.x+box.width-12);expect(p.y-13).toBeGreaterThan(box.y+box.height*.6);expect(p.y+13).toBeLessThan(box.y+box.height);}
 expect(selectionInkPoint(box,-1)).toEqual(points[0]);expect(selectionInkPoint(box,2)).toEqual(points[100]);
 const stamp=selectionSealBox(box);expect(stamp.width).toBeGreaterThan(44);expect(stamp.width).toBeLessThanOrEqual(112);expect(stamp.height).toBe(stamp.width);expect(stamp.y).toBeGreaterThan(box.y+box.height*.54);expect(stamp.x+stamp.width).toBeLessThan(box.x+box.width);expect(stamp.y+stamp.height).toBeLessThan(box.y+box.height);
});

it.each([{x:12,y:100,width:201,height:252},{x:70,y:72,width:408,height:510}])('confines all ten full gold strokes below the face through gathering and release: %o',box=>{
 const region=selectionFeedbackRegion(box);
 for(let i=0;i<10;i++)for(let frame=0;frame<=100;frame++){
  const p=selectionGatherPoint(box,frame/100,i);expect(p.x-8.5).toBeGreaterThanOrEqual(region.x);expect(p.y-8.5).toBeGreaterThanOrEqual(region.y);expect(p.x+8.5).toBeLessThanOrEqual(region.x+region.width);expect(p.y+8.5).toBeLessThanOrEqual(region.y+region.height);
 }
});

it.each([{x:100,y:664,width:278,height:56},{x:553,y:692,width:260,height:56},{x:520,y:324,width:160,height:44}])('keeps the charge, jump and landing in the existing footer clearance: %o',box=>{
 for(let i=0;i<=200;i++){const p=selectionButtonPose(i/200,box.height),cx=box.x+box.width/2,bottom=box.y+box.height+p.dy;expect(cx-box.width*p.sx/2).toBeGreaterThanOrEqual(box.x-6);expect(cx+box.width*p.sx/2).toBeLessThanOrEqual(box.x+box.width+6);expect(bottom-box.height*p.sy).toBeGreaterThanOrEqual(box.y-(box.height<50?8:12));expect(bottom).toBeLessThanOrEqual(box.y+box.height+2.001);}
 expect(selectionButtonPose(.27).sy).toBeLessThan(.61);expect(selectionButtonPose(.42).dy).toBe(-22);expect(selectionButtonPose(.52).dy).toBe(2);expect(selectionButtonPose(.75)).toEqual({sx:1,sy:1,dy:0});
});

// Strict double-precision equality, including cache hits and a subsequent interval change.
it.each([{x:12,y:80,width:160,height:200},{x:70,y:72,width:408,height:510},{x:13.25,y:81.5,width:213.7,height:267.125}])('exactly retains the original64-segment coordinates and vertex order: %o',box=>{
 const ribbon=createSelectionInkRibbon(box),scratch=ribbon(0,1,0,23);
 expect(scratch).toHaveLength(130);
 const phases=[...Array.from({length:101},(_,i)=>i/100),.28,.36,.64,.999999];
 for(const t of phases){
  const head=1-(1-Math.min(1,t/.64))**2,tail=Math.max(0,(t-.28)/.72),brush=Math.min(23,Math.max(12,box.width*.06));
  const specs=[[tail,head,0,brush+3],[tail,head,0,brush],[Math.max(tail,.12),head,-brush*.2,1.6]];
  for(let k=0;k<3;k++){const start=Math.max(tail,.12+k*.18),end=Math.min(head,start+.2);if(end>start)specs.push([start,end,brush*(k-1)*.19,1]);}
  for(const [start,end,offset,width]of specs){const actual=ribbon(start,end,offset,width);expect(actual).toBe(scratch);assert.deepStrictEqual(actual,legacySelectionInkRibbon(box,start,end,offset,width));}
 }
 for(const [start,end]of [[0,0],[-0,0],[0,-0],[-0,-0],[.7,.2],[0,1]])assert.deepStrictEqual(ribbon(start,end,-4,26),legacySelectionInkRibbon(box,start,end,-4,26));
});
