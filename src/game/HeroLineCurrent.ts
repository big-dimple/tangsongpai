import type Phaser from 'phaser';
import {clearInkRuns,inkSegmentCrosses,type InkBox,type InkPoint} from './AssistInkGeometry';
import {drawElectricFork,electricBranches,electricFork,electricVariation,ELECTRIC_CLEARANCE_PX,ELECTRIC_OUTER_RADIUS_PX} from './HeroElectricGeometry';

export interface SourceElectricCue {burstSegments:number;fallbackSegments:number}
export interface SourceElectricDecision {mode?:'source'|'fallback'}

/** A brief independent cue on empty inside edges of the real score board. */
function drawScoreFallback(g:Phaser.GameObjects.Graphics,board:InkBox,boxes:readonly InkBox[],phase:number,alpha:number):{segments:number;heads:InkPoint[]} {
 const m=g.getWorldTransformMatrix?.(),a=m?.a??1,b=m?.b??0,c=m?.c??0,d=m?.d??1,sum=a*a+b*b+c*c+d*d,det=a*d-b*c,scale=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2),minimum=Math.abs(det)/scale;
 // A rotated world AABB cannot describe the actual board interior safely.
 if(!Number.isFinite(scale)||!Number.isFinite(minimum)||minimum<.01||Math.abs(b)>.0001||Math.abs(c)>.0001||board.width<=0||board.height<=0)return{segments:0,heads:[]};
 const clearance=ELECTRIC_OUTER_RADIUS_PX/scale+(ELECTRIC_CLEARANCE_PX-ELECTRIC_OUTER_RADIUS_PX)/minimum,pad=clearance+4/minimum;
 const visible=(p:InkPoint)=>p.x>=board.x+clearance&&p.x<=board.x+board.width-clearance&&p.y>=board.y+clearance&&p.y<=board.y+board.height-clearance;
 const fade=Math.min(1,(phase-.06)/.05)*Math.min(1,(.44-phase)/.08),clock=phase*9;
 let segments=0;const heads:InkPoint[]=[];
 if(fade<=0||board.width<=2*pad||board.height<=2*pad)return{segments,heads};
 for(const side of [-1,1])for(const fraction of [.43,.58,.27,.72]){
  const p={x:side<0?board.x+pad:board.x+board.width-pad,y:board.y+board.height*fraction},angles=[-.92,-.05,.98],lengths=[22,28,17];
  // Unequal channels radiate inward from one point; they do not trace a
  // second frame around the score or imply a line through occupied cards.
  const arms=angles.map((angle,index)=>{
   const tangent={x:-side*Math.cos(angle),y:Math.sin(angle)},outward={x:-tangent.y,y:tangent.x},seed=(side<0?937:991)+index*41;
   const paths=electricFork(p,tangent,outward,Math.min(lengths[index]/scale,board.height*.28),seed,clock,.8,'line'),run=clearInkRuns(paths[0],boxes,clearance)[0];
   if(!run||run[0]!==paths[0][0])return{seed,paths,usable:false};const stop=run.findIndex(point=>!visible(point)),usable=stop<0?run:run.slice(0,stop);return{seed,paths,usable:usable.length>=4};
  });
  if(arms.filter(arm=>arm.usable).length<2)continue;
  for(const arm of arms){if(!arm.usable)continue;const drawn=drawElectricFork(g,arm.paths,boxes,scale,alpha*fade,visible,clearance,electricBranches(arm.seed,clock));segments+=drawn.segments;heads.push(...drawn.heads);}break;
 }
 return{segments,heads};
}

/** Brief discharges ride the existing brush line without replacing it. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],_color:number,alpha:number,variation=0,fallbackBoard?:InkBox,cue?:SourceElectricCue,decision?:SourceElectricDecision){
 const heads:InkPoint[]=[];let segments=0;
 if(end<=start||alpha<=0)return {segments,heads};
 const span=end-start,a=curve(start),b=curve(end),length=Math.hypot(b.x-a.x,b.y-a.y);
 const moving=Math.abs(end-phase)<.0001&&Math.abs(start-Math.max(0,phase-.3))<.0001;
 // The real source can be inside the avatar. Find the first clear portion of
 // its guide, then leave another 24px before choosing a brief radial burst.
 // Each arm is clipped independently; if there is no room for two meaningful
 // arms, leave the ordinary gold stream and current alone.
 if(variation===0&&moving&&phase<.5){
  const clear=(p:InkPoint)=>boxes.every(box=>p.x<box.x-ELECTRIC_CLEARANCE_PX||p.x>box.x+box.width+ELECTRIC_CLEARANCE_PX||p.y<box.y-ELECTRIC_CLEARANCE_PX||p.y>box.y+box.height+ELECTRIC_CLEARANCE_PX);
  let exit:InkPoint|undefined,previous:InkPoint|undefined,lastCandidate:InkPoint|undefined,candidate:{time:number;clock:number;makeArms:(frame:number)=>{seed:number;paths:InkPoint[][];usable:boolean}[]}|undefined;
  // Test the complete first source stretch, including the portion the gold
  // head has not reached yet. A not-yet-visible burst is not a lack of room.
  for(let i=0;decision?.mode!=='fallback'&&i<=80;i++){
   const t=i/200,center=curve(t);
   // Once the guide leaves the source, only its first continuous clear
   // stretch may host the burst; never reappear beyond an occupied slot.
   if(!clear(center)){if(exit)break;continue;}
   const prior=previous;if(exit&&prior&&boxes.some(box=>inkSegmentCrosses(prior,center,box,ELECTRIC_CLEARANCE_PX)))break;
   previous=center;
   if(!exit){exit=center;continue;}if(Math.hypot(center.x-exit.x,center.y-exit.y)<24)continue;
   if(lastCandidate&&Math.hypot(center.x-lastCandidate.x,center.y-lastCandidate.y)<5)continue;lastCandidate=center;
   const before=curve(Math.max(0,t-.005)),after=curve(Math.min(1,t+.005)),dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy);if(d<.001)continue;
   const forward={x:dx/d,y:dy/d},clock=phase*12,angles=[-1.35,-.60,.65,1.35],reaches=[32,19,27,15];
   const makeArms=(frame:number)=>angles.map((angle,index)=>{
    const seed=503+index*41,turn=angle+(electricVariation(seed+Math.floor(frame)*79)-.5)*.2,c=Math.cos(turn),s=Math.sin(turn),tangent={x:forward.x*c-forward.y*s,y:forward.x*s+forward.y*c},outward={x:-tangent.y,y:tangent.x};
    const paths=electricFork(center,tangent,outward,reaches[index],seed,frame,.8,'line'),run=clearInkRuns(paths[0],boxes,ELECTRIC_CLEARANCE_PX)[0];
    return {seed,paths,usable:!!run&&run[0]===paths[0][0]&&run.length>=4};
   });
   const probe=makeArms(0);if(!probe.slice(0,2).some(arm=>arm.usable)||!probe.slice(2).some(arm=>arm.usable))continue;
   candidate={time:t,clock,makeArms};break;
  }
  // Choose once for this activation, even if moving cards later alter masks.
  // This prevents a single event from switching between both locations.
  const mode=decision?.mode??(candidate?'source':'fallback');if(decision&&!decision.mode&&phase>=.06)decision.mode=mode;
  if(mode==='source'&&candidate){const age=phase-candidate.time;if(age>=0&&age<.22){
   const burstAlpha=alpha*Math.min(1,age/.02)*Math.min(1,(.22-age)/.08);
   for(const arm of candidate.makeArms(candidate.clock)){if(!arm.usable)continue;const result=drawElectricFork(g,arm.paths,boxes,1,burstAlpha,undefined,undefined,electricBranches(arm.seed,candidate.clock));segments+=result.segments;heads.push(...result.heads);if(cue)cue.burstSegments+=result.segments;if(decision&&result.segments)decision.mode='source';}
  }}
  if(mode==='fallback'&&fallbackBoard&&phase>.06&&phase<.44){const result=drawScoreFallback(g,fallbackBoard,boxes,phase,alpha);segments+=result.segments;heads.push(...result.heads);if(cue)cue.fallbackSegments+=result.segments;}
 }
 if(length<5)return {segments,heads};
 for(const [index,side] of [[0,-1],[1,1]] as const){
  const seed=index*31+3+variation*97,clock=phase*7,beat=Math.floor(clock);
  // Pick a fixed point in this beat's trail. Each new discharge chooses
  // afresh, and can blink out as the moving gold trail passes underneath.
  const choice=.12+.76*electricVariation(seed+beat*131);
  const hi=Math.min(1,(beat+.5)/7),lo=Math.max(0,hi-.3);
  const u=moving?choice:Math.max(.08,Math.min(.8,[.22,.67][index]+(choice-.5)*.12));
  const t=moving?lo+(hi-lo)*choice:start+span*u;if(t<start||t>end)continue;
  const p=curve(t),before=curve(Math.max(start,t-span*.025)),after=curve(Math.min(end,t+span*.025));
  const dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy)||1,tangent={x:dx/d,y:dy/d},normal={x:-dy/d*side,y:dx/d*side};
  const reach=Math.min([48,19][index],length*(.94-u));if(reach<3)continue;
  // Follow the guide at every bend, including the small curved Liu E and
  // Xin Qiji stages. A single straight tangent visibly leaves those arcs.
  const local=electricFork(p,tangent,normal,reach,seed,clock,1,'line');
  const paths=local.map(path=>path.map(point=>{
   const x=point.x-p.x,y=point.y-p.y,along=x*tangent.x+y*tangent.y,away=x*normal.x+y*normal.y;
   const q=Math.max(start,Math.min(end,t+span*along/length)),center=curve(q),epsilon=span*.005;
   const c0=curve(Math.max(start,q-epsilon)),c1=curve(Math.min(end,q+epsilon)),vx=c1.x-c0.x,vy=c1.y-c0.y,vd=Math.hypot(vx,vy)||1;
   return{x:center.x-vy/vd*side*away,y:center.y+vx/vd*side*away};
  }));
  const result=drawElectricFork(g,paths,boxes,1,alpha*(index?.68:1),undefined,undefined,electricBranches(seed,clock));
  segments+=result.segments;heads.push(...result.heads);
 }
 return {segments,heads};
}
