import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import {drawHeroLineCurrent} from '../src/game/HeroLineCurrent';
import {drawHeroOriginStream,heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {drawElectricFork,electricBranches,electricFork} from '../src/game/HeroElectricGeometry';
import {heroStageCurrentExclusions} from '../src/game/HeroSkillStage';
import {inkSegmentCrosses} from '../src/game/AssistInkGeometry';

function graphics(){
 const paths:{x:number;y:number}[][]=[],strokes:{x:number;y:number}[][]=[],styles:{width:number;color:number}[]=[],fills:{color:number;points:{x:number;y:number}[]}[]=[];let path:{x:number;y:number}[]=[],color=0;
 const g={lineStyle(width:number,color:number){styles.push({width,color});return this;},beginPath(){path=[];return this;},moveTo(x:number,y:number){path.push({x,y});return this;},lineTo(x:number,y:number){path.push({x,y});return this;},lineBetween(){return this;},strokePath(){paths.push(path);strokes.push(path);return this;},clear(){return this;},fillStyle(value:number){color=value;return this;},fillCircle(){return this;},fillEllipse(){return this;},fillPoints(points:{x:number;y:number}[]){fills.push({color,points});paths.push(points);return this;}};
 return {g:g as unknown as Phaser.GameObjects.Graphics,paths,strokes,styles,fills};
}
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
it('holds an anchored discharge briefly while the underlying trail advances',()=>{
 const curve=(t:number)=>({x:t*1000,y:0}),a=drawHeroLineCurrent(graphics().g,curve,.1,.4,.4,[],0,1),b=drawHeroLineCurrent(graphics().g,curve,.105,.405,.405,[],0,1);
 expect(a.heads.length).toBeGreaterThan(0);expect(b.heads.length).toBe(a.heads.length);
 for(let i=0;i<a.heads.length;i++){expect(b.heads[i].x).toBeCloseTo(a.heads[i].x,5);expect(b.heads[i].y).toBeCloseTo(a.heads[i].y,5);}
});
it('bursts after leaving the avatar and protects nearby print and a full rack',()=>{
 // These source and avatar dimensions come from an actual 390px game frame.
 const curve=(t:number)=>({x:39,y:29+300*t}),avatar={x:24,y:14,width:30,height:30},print={x:76,y:14,width:56,height:36},paint=graphics();
 const burst=drawHeroLineCurrent(paint.g,curve,0,.21,.21,[avatar,print],0,1);
 expect(burst.segments).toBeGreaterThan(0);
 expect(paint.paths.flat().some(p=>p.x<29&&p.y>50)).toBe(true);expect(paint.paths.flat().some(p=>p.x>58&&p.y>50)).toBe(true);
 for(const {points} of paint.fills)for(const guard of [avatar,print]){
  expect(points.some(p=>p.x>=guard.x&&p.x<=guard.x+guard.width&&p.y>=guard.y&&p.y<=guard.y+guard.height)).toBe(false);
  expect(points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],guard,0))).toBe(false);
 }
 // With the whole accessible source region occupied there is no substitute
 // burst over the occupied cards or controls.
 const blocked=graphics(),rack={x:-100,y:-100,width:300,height:300};
 expect(drawHeroLineCurrent(blocked.g,curve,0,.21,.21,[rack],0,1)).toEqual({segments:0,heads:[]});expect(blocked.paths).toHaveLength(0);
});
it.each([
 {name:'a wide occupied slot',speed:200,start:.15,end:.45,box:{x:10,y:50,width:40,height:100}},
 // Samples fall at x=10 and x=20; the expanded guard lies between them.
 {name:'a thin guard between samples',speed:2000,start:0,end:.1,box:{x:14.5,y:50,width:.2,height:100}},
])('does not restart the source burst beyond $name while retaining ordinary current',({speed,start,end,box})=>{
 const paint=graphics(),curve=(t:number)=>({x:speed*t,y:100});
 const result=drawHeroLineCurrent(paint.g,curve,start,end,end,[box],0,1);
 // Two ordinary forks have at most 22 segments in total. The former bug
 // painted an additional radial burst in the later clear area.
 expect(result.segments).toBeGreaterThan(0);expect(result.segments).toBeLessThanOrEqual(22);
 for(const {points} of paint.fills){
  expect(points.some(p=>p.x>=box.x&&p.x<=box.x+box.width&&p.y>=box.y&&p.y<=box.y+box.height)).toBe(false);
  expect(points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],box,0))).toBe(false);
 }
});
it('uses the score-board edges only when the first source opening cannot hold a burst',()=>{
 const curve=(t:number)=>({x:39,y:29+400*t}),avatar={x:24,y:14,width:30,height:30},joker={x:10,y:75,width:68,height:82},board={x:12,y:172,width:366,height:108};
 const labels=[{x:22,y:176,width:70,height:18},{x:48,y:195,width:50,height:25},{x:142,y:195,width:60,height:25},{x:263,y:195,width:70,height:25},{x:45,y:225,width:285,height:42}];
 const blocked=graphics(),cue={burstSegments:0,fallbackSegments:0},result=drawHeroLineCurrent(blocked.g,curve,0,.24,.24,[avatar,joker,...labels],0,1,0,board,cue);
 expect(cue.burstSegments).toBe(0);expect(cue.fallbackSegments).toBeGreaterThan(0);expect(result.segments).toBeGreaterThanOrEqual(cue.fallbackSegments);
 const onBoard=blocked.fills.filter(f=>f.points.every(p=>p.x>=board.x&&p.x<=board.x+board.width&&p.y>=board.y&&p.y<=board.y+board.height));expect(onBoard.length).toBeGreaterThan(0);
 for(const {points} of blocked.fills)for(const guard of [avatar,joker,...labels]){
  expect(points.some(p=>p.x>=guard.x&&p.x<=guard.x+guard.width&&p.y>=guard.y&&p.y<=guard.y+guard.height)).toBe(false);
  expect(points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],guard,0))).toBe(false);
 }
 const occupied=graphics(),noSpace={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(occupied.g,curve,0,.24,.24,[avatar,joker,board],0,1,0,board,noSpace);expect(noSpace.fallbackSegments).toBe(0);
 for(const time of [.08,.18,.24,.34]){
  const open=graphics(),normal={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(open.g,curve,0,time,time,[avatar,...labels],0,1,0,board,normal);
  expect(normal.fallbackSegments).toBe(0);if(time===.24)expect(normal.burstSegments).toBeGreaterThan(0);
 }
 // Cards can move after activation; the chosen cue must not jump between
 // the source and score board during the same saved event.
 const chosenFallback:{mode?:'source'|'fallback'}={},first={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(graphics().g,curve,0,.1,.1,[avatar,joker,...labels],0,1,0,board,first,chosenFallback);expect(chosenFallback.mode).toBe('fallback');
 const later={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(graphics().g,curve,0,.24,.24,[avatar,...labels],0,1,0,board,later,chosenFallback);expect(later.burstSegments).toBe(0);expect(later.fallbackSegments).toBeGreaterThan(0);
 const chosenSource:{mode?:'source'|'fallback'}={},early={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(graphics().g,curve,0,.08,.08,[avatar,...labels],0,1,0,board,early,chosenSource);expect(chosenSource.mode).toBe('source');
 const covered={burstSegments:0,fallbackSegments:0};drawHeroLineCurrent(graphics().g,curve,0,.24,.24,[avatar,joker,...labels],0,1,0,board,covered,chosenSource);expect(covered.fallbackSegments).toBe(0);
});
it('keeps the source burst and current off the whole nearby beneficiary card',()=>{
 const source={x:39,y:29},avatar={x:24,y:14,width:30,height:30},target={x:90,y:40,width:120,height:80},end={x:target.x+target.width/2,y:target.y-6};
 const mid={x:(source.x+end.x)/2,y:(source.y+end.y)/2-Math.min(35,Math.abs(end.y-source.y)*.12+12)},curve=(t:number)=>({x:(1-t)**2*source.x+2*(1-t)*t*mid.x+t*t*end.x,y:(1-t)**2*source.y+2*(1-t)*t*mid.y+t*t*end.y});
 const overlaps=(points:{x:number;y:number}[])=>{
  const inside=(p:{x:number;y:number})=>p.x>=target.x&&p.x<=target.x+target.width&&p.y>=target.y&&p.y<=target.y+target.height;
  const contains=(p:{x:number;y:number})=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++)if((points[i].y>p.y)!==(points[j].y>p.y)&&p.x<(points[j].x-points[i].x)*(p.y-points[i].y)/(points[j].y-points[i].y)+points[i].x)hit=!hit;return hit;};
  const corners=[{x:target.x,y:target.y},{x:target.x+target.width,y:target.y},{x:target.x,y:target.y+target.height},{x:target.x+target.width,y:target.y+target.height}];
  return points.some(inside)||points.some((p,i)=>inkSegmentCrosses(p,points[(i+1)%points.length],target,0))||corners.some(contains);
 };
 const unguarded=graphics(),before=drawHeroLineCurrent(unguarded.g,curve,.18,.48,.48,[avatar],0,1);
 // This placement makes the extra whole-card guard necessary, rather than
 // passing merely because the source is far away or the effect is absent.
 expect(before.segments).toBeGreaterThan(22);expect(unguarded.fills.some(f=>overlaps(f.points))).toBe(true);
 const base=graphics(),current=graphics(),style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:'azao.multiply-multiplier'});
 const result=drawHeroOriginStream(base.g,source,[target],style,.48,[avatar],1,current.g);
 expect(result.electricSegments).toBeGreaterThan(0);expect(current.fills.length).toBeGreaterThan(0);
 expect(current.fills.some(f=>overlaps(f.points))).toBe(false);
});
it('moves along the original curve and excludes protected print with stroke clearance',()=>{
 const curve=(t:number)=>({x:100*t,y:20*t*t}),box={x:45,y:-10,width:10,height:40},a=graphics(),b=graphics();
 const first=drawHeroLineCurrent(a.g,curve,0,1,.12,[box],0xffaa44,1),next=drawHeroLineCurrent(b.g,curve,0,1,.19,[box],0xffaa44,1);
 expect(first.segments).toBeGreaterThan(0);expect(next.heads).not.toEqual(first.heads);
 const variant=graphics(),other=drawHeroLineCurrent(variant.g,curve,0,1,.12,[box],0xffaa44,1,1);expect(other.heads).not.toEqual(first.heads);
 for(const path of [...a.paths,...b.paths])for(const p of path){expect(Math.abs(p.y-20*(p.x/100)**2)).toBeLessThan(23);expect(p.x<44.5||p.x>55.5).toBe(true);}
 // A blue tapered body carries a visible white core; neither may cover print.
 expect(new Set(a.fills.map(f=>f.color))).toEqual(new Set([0x76c8f2,0x1768c3,0xf3fdff]));
 expect(a.fills.every(f=>f.points.length===4)).toBe(true);
 const widths=(color:number)=>a.fills.filter(f=>f.color===color).flatMap(({points:p})=>[Math.hypot(p[0].x-p[3].x,p[0].y-p[3].y),Math.hypot(p[1].x-p[2].x,p[1].y-p[2].y)]);
 const blue=widths(0x1768c3),white=widths(0xf3fdff);
 // At phone size the main body and white core must remain legible, while
 // pointed ends and the four-pixel protected radius are still respected.
 expect(Math.max(...blue)).toBeGreaterThan(5.4);expect(Math.min(...blue)).toBeLessThan(1.5);
 expect(blue.filter(width=>width>4).length).toBeGreaterThan(4);expect(Math.max(...blue)).toBeLessThanOrEqual(6.2+1e-6);
 expect(Math.max(...white)).toBeGreaterThan(3);expect(Math.max(...white)).toBeLessThanOrEqual(3.4+1e-6);
 expect(a.strokes).toHaveLength(0);
 expect(drawHeroLineCurrent(a.g,curve,0,1,.2,[{x:-5,y:-5,width:110,height:40}],0xffaa44,1)).toEqual({segments:0,heads:[]});
});
it('follows a tightly curved stage guide instead of extending its initial tangent',()=>{
 const curve=(t:number)=>{const a=-.95+t*1.9;return{x:120+54*Math.cos(a),y:90+25*Math.sin(a)};},paint=graphics();
 expect(drawHeroLineCurrent(paint.g,curve,0,1,.45,[],0xffaa44,1).segments).toBeGreaterThan(0);
 const guide=Array.from({length:501},(_,i)=>curve(i/500));
 for(const p of paint.paths.flat())expect(Math.min(...guide.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))).toBeLessThan(23);
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
it('keeps the skill-stage discharge and stroke clearance inside its pocket',()=>{
 const w=300,h=84,t=.4,strike=(t-.36)/.22,len=(w*.14+6)*(1-strike*.3),z={x:w/2-6,y:h/2-12},q={x:z.x-len,y:h/2-9},paint=graphics();
 const result=drawHeroLineCurrent(paint.g,u=>({x:q.x+(z.x-q.x)*u,y:q.y+(z.y-q.y)*u}),0,1,t,heroStageCurrentExclusions(w,h),0xffaa44,1);
 expect(result.segments).toBeGreaterThan(0);expect(paint.paths.flat().every(p=>p.x>=-w/2+.2&&p.x<=w/2-.2&&p.y>=-h/2+.2&&p.y<=h/2-.2)).toBe(true);
 expect(paint.strokes.flat().every(p=>p.x>=-w/2+3.1&&p.x<=w/2-3.1&&p.y>=-h/2+3.1&&p.y<=h/2-3.1)).toBe(true);
});
it('keeps the source stream connected above a blank board while protecting text',()=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:'azao.multiply-multiplier'}),board={x:80,y:-100,width:40,height:200},base=graphics(),current=graphics();
 drawHeroOriginStream(base.g,{x:0,y:0},[{x:180,y:0,width:40,height:40}],style,.85,[],1,current.g);
 expect(base.paths.length).toBeGreaterThan(0);expect(current.paths.length).toBeGreaterThan(0);
 expect(base.paths.some(path=>path.some(p=>p.x<board.x)&&path.some(p=>p.x>board.x+board.width))).toBe(true);
 const protectedText={x:96,y:-100,width:8,height:200},masked=graphics();
 drawHeroOriginStream(masked.g,{x:0,y:0},[{x:180,y:0,width:40,height:40}],style,.85,[protectedText],1);
 expect(masked.paths.flat().every(p=>p.x<protectedText.x-1||p.x>protectedText.x+protectedText.width+1)).toBe(true);
 expect(masked.paths.flat().some(p=>p.x>board.x+board.width)).toBe(true);
});
it.each(['amo.exile','erxiang.handoff','azao.multiply-multiplier','xiemu.multiply-multiplier','touye.won','laohuan.refill'])('%s keeps moving current on the existing source stream',reason=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:reason}),target=[{x:220,y:80,width:50,height:80}],source={x:0,y:0},a=graphics(),b=graphics();
 const first=drawHeroOriginStream(a.g,source,target,style,.2,[],1),next=drawHeroOriginStream(b.g,source,target,style,.3,[],1);
 expect(first.electricSegments).toBeGreaterThan(0);expect(first.electricHeads.length).toBeGreaterThan(0);expect(first.electricHeads).not.toEqual(next.electricHeads);
});
