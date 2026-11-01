import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import {inkSegmentCrosses,type InkBox,type InkPoint} from '../src/game/AssistInkGeometry';
import {drawHeroFuse,drawHeroIgnition,routeHeroFuse,fuseRouteSafe} from '../src/game/HeroFuse';
import {drawHeroLineCurrent} from '../src/game/HeroLineCurrent';
import {drawHeroOriginStream,heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {drawElectricFork,electricBranches,electricFork} from '../src/game/HeroElectricGeometry';

function graphics(){
 const paths:InkPoint[][]=[],strokes:InkPoint[][]=[],fills:{color:number;points:InkPoint[]}[]=[],circles:{x:number;y:number;r:number;color:number}[]=[],styles:{width:number;color:number}[]=[];let path:InkPoint[]=[],color=0;
 const g={lineStyle(width:number,color:number){styles.push({width,color});return this;},beginPath(){path=[];return this;},moveTo(x:number,y:number){path.push({x,y});return this;},lineTo(x:number,y:number){path.push({x,y});return this;},strokePath(){paths.push(path);strokes.push(path);return this;},clear(){return this;},fillStyle(value:number){color=value;return this;},fillCircle(x:number,y:number,r:number){circles.push({x,y,r,color});return this;},fillPoints(p:InkPoint[]){fills.push({color,points:p});paths.push(p);return this;}};
 return {g:g as unknown as Phaser.GameObjects.Graphics,paths,strokes,fills,circles,styles};
}
const bounds={x:0,y:0,width:390,height:844};
it('routes one continuous source-to-card conductor through an occupied five-slot rack',()=>{
 const source={x:39,y:29},target={x:55,y:465},avatar={x:24,y:14,width:30,height:30};
 const rack=[13,88,163,238,311].map(x=>({x,y:75,width:67,height:82})),card={x:12,y:472,width:92,height:120},boxes=[avatar,...rack,card];
 const route=routeHeroFuse(source,target,boxes,bounds)!;expect(route).toBeDefined();expect(route.points.length).toBeGreaterThan(2);
 expect(Math.hypot(route.points[0].x-source.x,route.points[0].y-source.y)).toBeLessThan(35);
 expect(Math.hypot(route.points.at(-1)!.x-target.x,route.points.at(-1)!.y-target.y)).toBeLessThan(25);
 expect(fuseRouteSafe(route,boxes)).toBe(true);
 for(let i=1;i<route.points.length;i++)for(const box of boxes)expect(inkSegmentCrosses(route.points[i-1],route.points[i],box,route.clearance??3.6)).toBe(false);
});
it('uses the safe interior gap of a 390px five-slot rack rather than the screen edge',()=>{
 const viewport={x:0,y:0,width:390,height:844},source={x:39,y:29},target={x:54,y:306};
 const rack=[12,86.4,160.8,235.2,309.6].map(x=>({x,y:68,width:68.4,height:95.8}));
 const boxes=[{x:24,y:14,width:30,height:30},{x:76,y:14,width:28,height:16},{x:76,y:36,width:41,height:14},{x:112,y:14,width:103,height:14},...rack,{x:23,y:313,width:63,height:100}];
 const route=routeHeroFuse(source,target,boxes,viewport)!;expect(route).toBeDefined();expect(fuseRouteSafe(route,boxes)).toBe(true);
 const crossings=route.points.slice(1).flatMap((b,i)=>{const a=route.points[i];if((a.y-100)*(b.y-100)>0||a.y===b.y)return[];return [a.x+(100-a.y)*(b.x-a.x)/(b.y-a.y)];});
 expect(crossings.length).toBeGreaterThan(0);expect(crossings.every(x=>x>20&&x<viewport.width-20)).toBe(true);
});
it('does not invent a disconnected replacement when a surface seals the screen',()=>{
 const wall={x:0,y:170,width:390,height:50};expect(routeHeroFuse({x:30,y:40},{x:80,y:500},[wall],bounds)).toBeUndefined();
});
it('moves exactly one front monotonically, then reaches and fades at the target',()=>{
 const points=[{x:40,y:30},{x:80,y:30},{x:80,y:260}],route={points,source:points[0],target:points[2],bounds},heads:InkPoint[]=[];
 for(const p of [.1,.3,.5,.7,.82,.94]){const paint=graphics(),result=drawHeroFuse(paint.g,route,p,[],1);expect(result.heads).toHaveLength(1);heads.push(result.heads[0]);expect(paint.styles.some(s=>s.color===0xffffff)).toBe(true);}
 expect(heads[1].y).toBeGreaterThan(heads[0].y);expect(heads[2].y).toBeGreaterThan(heads[1].y);expect(heads[3].y).toBeGreaterThan(heads[2].y);expect(heads[4]).toEqual(points.at(-1));expect(heads[5]).toEqual(points.at(-1));
});
it('keeps the current and every connected spark away from real text and card guards',()=>{
 const points=[{x:10,y:40},{x:190,y:40}],route={points,source:points[0],target:points[1],bounds},guard={x:75,y:55,width:35,height:16},paint=graphics();
 expect(drawHeroFuse(paint.g,route,.4,[guard],1).heads).toHaveLength(1);
 for(const path of paint.paths)for(let i=1;i<path.length;i++)expect(inkSegmentCrosses(path[i-1],path[i],guard,.5)).toBe(false);
});
it('advances one bright front with a short-lived wake and a single release on the true route',()=>{
 const points=[{x:40,y:40},{x:40,y:190},{x:90,y:260}],route={points,source:points[0],target:points.at(-1)!,bounds},samples:ReturnType<typeof drawHeroIgnition>[]=[];
 for(const p of [.1,.25,.4,.55,.7,.82,.89,.96]){const paint=graphics(),r=drawHeroIgnition(paint.g,route,p,[],1);expect(r.heads).toHaveLength(1);expect(r.coreRadius).toBeGreaterThan(2);expect(r.sparks).toBeLessThanOrEqual(3);expect(paint.fills.some(c=>c.color===0xf4fdff)).toBe(true);samples.push(r);}
 for(let i=1;i<5;i++)expect(samples[i].front).toBeGreaterThan(samples[i-1].front);
 expect(samples[5].heads[0]).toEqual(points.at(-1));expect(samples[6].release).toBeGreaterThan(samples[5].release);expect(samples[7].release).toBeLessThan(samples[6].release);
 const speeds=samples.slice(1,5).map((sample,i)=>sample.front-samples[i].front);expect(Math.max(...speeds)-Math.min(...speeds)).toBeGreaterThan(.005);
});
it('keeps every ignition glow inside a 390px viewport and outside a full rack',()=>{
 const guard={x:12,y:68,width:68,height:96},points=[{x:5.6,y:72},{x:5.6,y:160}],route={points,source:points[0],target:points[1],bounds},paint=graphics();
 const result=drawHeroIgnition(paint.g,route,.4,[guard],1);expect(result.heads).toHaveLength(1);expect(result.coreRadius).toBeGreaterThan(2);
 for(const c of paint.circles){expect(c.x-c.r).toBeGreaterThanOrEqual(0);expect(c.x+c.r).toBeLessThanOrEqual(bounds.width);expect(c.y-c.r).toBeGreaterThanOrEqual(0);expect(c.y+c.r).toBeLessThanOrEqual(bounds.height);expect(c.x+c.r<=guard.x||c.x-c.r>=guard.x+guard.width||c.y+c.r<=guard.y||c.y-c.r>=guard.y+guard.height).toBe(true);}
 for(const {points} of paint.fills){for(const p of points){expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(bounds.width);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(bounds.height);}for(let i=0;i<points.length;i++)expect(inkSegmentCrosses(points[i],points[(i+1)%points.length],guard,0)).toBe(false);}
});
it('opens the hot core into a safe gap while staying connected to the source wire',()=>{
 const viewport={x:0,y:0,width:500,height:757},guard={x:48,y:68,width:76,height:107},points=[{x:42,y:80},{x:42,y:160}],route={points,source:points[0],target:points[1],bounds:viewport},paint=graphics();
 const result=drawHeroIgnition(paint.g,route,.4,[guard],1),head=result.heads[0];expect(head).toBeDefined();expect(result.corePoint.x).toBeLessThan(head.x);expect(Math.hypot(result.corePoint.x-head.x,result.corePoint.y-head.y)).toBeLessThanOrEqual(5.01);
 for(const {points} of paint.fills)for(let i=0;i<points.length;i++)expect(inkSegmentCrosses(points[i],points[(i+1)%points.length],guard,0)).toBe(false);
});
it('uses the actual first beneficiary for the source stream, never a separate score-board burst',()=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:'erxiang.handoff'}),paint=graphics(),current=graphics(),decision={};
 const targets=[{x:220,y:130,width:45,height:80},{x:290,y:130,width:45,height:80}],source={x:40,y:30};
 const result=drawHeroOriginStream(paint.g,source,targets,style,.5,[],1,current.g,undefined,decision,bounds);
 expect(result.electricHeads).toHaveLength(1);expect(result.scoreFallbackSegments).toBe(0);expect(result.route?.at(-1)!.x).toBeLessThan(targets[1].x);
});
it('keeps stage effects connected to their guide and never resumes beyond a guarded region',()=>{
 const curve=(t:number)=>({x:100*t,y:20*t*t}),guard={x:45,y:-10,width:10,height:40},paint=graphics();
 const result=drawHeroLineCurrent(paint.g,curve,0,1,.4,[guard],0,1);expect(result.heads).toHaveLength(1);
 expect(paint.paths.flat().every(p=>p.x<guard.x-3)).toBe(true);
});
it('clips the full filled lightning strip including its stroke radius',()=>{
 const paint=graphics(),guard:InkBox={x:25,y:53.49,width:10,height:4};
 const paths=electricFork({x:10,y:50.29},{x:1,y:0},{x:0,y:1},35,122,2,.85,'edge');
 drawElectricFork(paint.g,paths,[guard],1,1);
 for(const path of paint.paths)for(let i=0;i<path.length;i++)expect(inkSegmentCrosses(path[i],path[(i+1)%path.length],guard,0)).toBe(false);
});

it('holds then reconstructs unequal connected branches and keeps card sparks outside the face',()=>{
 const origin={x:0,y:0},tangent={x:1,y:0},normal={x:0,y:1};
 const [trunk,first,second]=electricFork(origin,tangent,normal,36,3,.4,1,'line');
 const next=electricFork(origin,tangent,normal,36,3,1.4,1,'line');
 expect(trunk.some(p=>p.y>0)).toBe(true);expect(trunk.some(p=>p.y<0)).toBe(true);
 expect(first[0]).toEqual(trunk[2]);expect(second[0]).toEqual(trunk[4]);
 expect(electricFork(origin,tangent,normal,36,3,.9,1,'line')).toEqual([trunk,first,second]);
 expect(Math.hypot(first.at(-1)!.x-first[0].x,first.at(-1)!.y-first[0].y))
  .toBeGreaterThan(Math.hypot(second.at(-1)!.x-second[0].x,second.at(-1)!.y-second[0].y));
 expect(next).not.toEqual([trunk,first,second]);
 const frames=Array.from({length:8},(_,i)=>electricFork(origin,tangent,normal,36,3,i,1,'line')[0]);
 const movements=frames.slice(1).flatMap((frame,j)=>frame.map((p,i)=>Math.hypot(p.x-frames[j][i].x,p.y-frames[j][i].y)));
 expect(Math.max(...movements)).toBeGreaterThan(2);
 const branchLengths=Array.from({length:10},(_,i)=>{const branch=electricFork(origin,tangent,normal,36,3,i,1,'line')[2];return Math.hypot(branch.at(-1)!.x-branch[0].x,branch.at(-1)!.y-branch[0].y);});
 expect(Math.max(...branchLengths)-Math.min(...branchLengths)).toBeGreaterThan(2);
 expect(electricFork(origin,tangent,normal,28,21,.4,.78,'edge').flat().every(p=>p.y>=0)).toBe(true);
});

it('switches independent branches while keeping visible branches joined to the trunk',()=>{
 const states=Array.from({length:24},(_,i)=>electricBranches(3,i+.5));
 expect(new Set(states.map(s=>s.join(','))).size).toBe(4);
 expect(electricBranches(3,2.1)).toEqual(electricBranches(3,2.9));
 const paths=electricFork({x:0,y:0},{x:1,y:0},{x:0,y:1},36,3,2,1,'line');
 const both=drawElectricFork(graphics().g,paths,[],1,1),one=drawElectricFork(graphics().g,paths,[],1,1,undefined,undefined,[false,true]);
 expect(both.heads).toHaveLength(3);expect(one.heads).toEqual([both.heads[0],both.heads[2]]);
 // A hidden parent section must not leave an orphaned branch beyond the guard.
 const blocked=drawElectricFork(graphics().g,paths,[{x:2,y:-40,width:100,height:80}],1,1,undefined,undefined,[true,true]);
 expect(blocked.heads).toHaveLength(0);
});

it('keeps every filled strip out of a small guard beside a sharp bend',()=>{
 const paint=graphics(),guard={x:75.6607,y:69.683,width:1,height:1};
 const paths=electricFork({x:50,y:50},{x:1,y:0},{x:0,y:1},35,122,2,.85,'edge');
 expect(drawElectricFork(paint.g,paths,[guard],1,1).segments).toBeGreaterThan(0);expect(paint.strokes).toHaveLength(0);
 const corners=[{x:guard.x,y:guard.y},{x:guard.x+guard.width,y:guard.y},{x:guard.x,y:guard.y+guard.height},{x:guard.x+guard.width,y:guard.y+guard.height}];
 const contains=(poly:{x:number;y:number}[],p:{x:number;y:number})=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)inside=!inside;return inside;};
 for(const {points} of paint.fills){expect(points.some(p=>p.x>=guard.x&&p.x<=guard.x+guard.width&&p.y>=guard.y&&p.y<=guard.y+guard.height)).toBe(false);expect(corners.some(p=>contains(points,p))).toBe(false);expect(points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],guard,0))).toBe(false);}
});

it('leaves rasterization room around a guard next to a horizontal discharge',()=>{
 const paint=graphics(),guard={x:25,y:53.49,width:10,height:4},rasterGuard={x:24.5,y:52.99,width:11,height:5};
 const path=[{x:10,y:50.29},{x:20,y:50.29},{x:30,y:50.29},{x:40,y:50.29},{x:50,y:50.29}];
 expect(drawElectricFork(paint.g,[path],[guard],1,1).segments).toBeGreaterThan(0);
 for(const {points} of paint.fills){expect(points.some(p=>p.x>=rasterGuard.x&&p.x<=rasterGuard.x+rasterGuard.width&&p.y>=rasterGuard.y&&p.y<=rasterGuard.y+rasterGuard.height)).toBe(false);expect(points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],rasterGuard,0))).toBe(false);}
});
