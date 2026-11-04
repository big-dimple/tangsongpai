import './NoviceGestureDemo.css';

export type NoviceGestureMode='hold-drag'|'sweep';
export type NoviceGesturePoint={x:number;y:number};
export interface NoviceGestureDemoOptions {
 mode:NoviceGestureMode;
 /** Actual, live viewport CSS-pixel positions, in the order the finger travels. */
 points:()=>readonly NoviceGesturePoint[]|undefined;
 /** CSS-pixel equivalent of the game's 10-logical-pixel sweep threshold. */
 sweepThresholdPx?:()=>number;
 /** The game preference; the system preference is also observed by this component. */
 reducedMotion:()=>boolean;
 /** A real input or interrupted page dismisses this demonstration. */
 onDismiss?:()=>void;
}
export interface NoviceGestureDemoHandle {destroy():void}
export type NoviceGesturePhase='press'|'hold'|'move'|'release'|'rest';

/** A real hold lasts at least 350 ms; the visual pause is deliberately longer. */
export const NOVICE_GESTURE_TIMING={
 'hold-drag':{press:250,hold:1050,move:2200,release:2650,total:3100},
 'sweep':{press:90,hold:90,maxMoveDuration:560,releaseDuration:350,restDuration:400},
} as const;

function validPoints(points:readonly NoviceGesturePoint[]|undefined):points is readonly NoviceGesturePoint[] {
 return !!points&&points.length>=2&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&
  points.some(p=>Math.hypot(p.x-points[0].x,p.y-points[0].y)>1);
}
/** Interpolate along the actual path, at constant speed rather than inventing a slot. */
function pointAt(points:readonly NoviceGesturePoint[],progress:number):NoviceGesturePoint {
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
 let distance=Math.max(0,Math.min(1,progress))*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){
  const length=lengths[i];if(!length)continue;
  if(distance<=length||i===lengths.length-1){const t=Math.min(1,distance/length),a=points[i],b=points[i+1];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  distance-=length;
 }
 return points[points.length-1];
}

export function sampleNoviceGesture(mode:NoviceGestureMode,elapsed:number,points:readonly NoviceGesturePoint[],sweepThresholdPx=10){
 const sweep=NOVICE_GESTURE_TIMING.sweep;
 const distance=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
 // Reach the real movement threshold about 140 ms after the press, even when
 // the canvas is scaled. A long pause would activate the table's detail hold.
 const duration=Math.min(sweep.maxMoveDuration,Math.max(40,distance*140/Math.max(1,sweepThresholdPx)));
 const timing=mode==='hold-drag'?NOVICE_GESTURE_TIMING['hold-drag']:{press:sweep.press,hold:sweep.hold,
  move:sweep.hold+duration,release:sweep.hold+duration+sweep.releaseDuration,total:sweep.hold+duration+sweep.releaseDuration+sweep.restDuration};
 const at=((elapsed%timing.total)+timing.total)%timing.total;
 const phase:NoviceGesturePhase=at<timing.press?'press':at<timing.hold?'hold':at<timing.move?'move':at<timing.release?'release':'rest';
 const progress=phase==='move'?(at-timing.hold)/(timing.move-timing.hold):phase==='release'||phase==='rest'?1:0;
 return {phase,point:pointAt(points,progress)};
}

/** A visual overlay only. It never sends input or changes a saved run. */
export function mountNoviceGestureDemo(options:NoviceGestureDemoOptions):NoviceGestureDemoHandle {
 const root=document.createElement('div');root.className='novice-gesture-demo';root.dataset.noviceGesture='';root.dataset.mode=options.mode;
 root.setAttribute('aria-hidden','true');root.style.pointerEvents='none';
 root.innerHTML='<svg class="novice-gesture-route" data-novice-gesture-route aria-hidden="true"><polyline></polyline><path></path></svg>'+
  '<span class="novice-gesture-contact" data-novice-gesture-contact></span><span class="novice-gesture-hand" data-novice-gesture-hand><svg viewBox="0 0 40 50" aria-hidden="true">'+
  '<path d="M15 7C15 2 20 2 20 7V21C21 17 25 18 25 22C27 19 31 21 31 24C34 22 37 25 36 29L34 39C33 44 30 47 25 47H21C18 47 16 46 14 43L7 34C5 31 7 28 10 29L15 33Z"/></svg></span>';
 const hand=root.querySelector<HTMLElement>('.novice-gesture-hand')!,contact=root.querySelector<HTMLElement>('.novice-gesture-contact')!;
 const line=root.querySelector<SVGPolylineElement>('polyline')!,arrow=root.querySelector<SVGPathElement>('.novice-gesture-route path')!;
 document.body.append(root);
 const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):undefined;
 let stopped=false,frame=0,start=performance.now(),hadPoints=false;
 const render=()=>{
  if(stopped)return;
  const points=options.points();if(!validPoints(points)){root.hidden=true;hadPoints=false;frame=requestAnimationFrame(render);return;}
  if(!hadPoints){start=performance.now();hadPoints=true;}
  root.hidden=false;const reduced=options.reducedMotion()||!!media?.matches;
  const sample=reduced?{phase:'static' as const,point:points[0]}:sampleNoviceGesture(options.mode,performance.now()-start,points,options.sweepThresholdPx?.());
  const {x,y}=sample.point;root.dataset.phase=sample.phase;root.dataset.reduced=String(reduced);root.dataset.x=x.toFixed(2);root.dataset.y=y.toFixed(2);
  const compactSweep=options.mode==='sweep'&&window.innerWidth<=380;
  hand.style.transform=`translate(${x-14}px,${y-(options.mode==='hold-drag'?7.5:compactSweep?6:2.4)}px)`;contact.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
  line.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));
  const end=points[points.length-1],previous=[...points].reverse().find(p=>Math.hypot(p.x-end.x,p.y-end.y)>1)!;
  const angle=Math.atan2(end.y-previous.y,end.x-previous.x),a=angle+Math.PI*.83,b=angle-Math.PI*.83;
  arrow.setAttribute('d',`M ${end.x+8*Math.cos(a)} ${end.y+8*Math.sin(a)} L ${end.x} ${end.y} L ${end.x+8*Math.cos(b)} ${end.y+8*Math.sin(b)}`);
  frame=requestAnimationFrame(render);
 };
 const destroy=()=>{
  if(stopped)return;stopped=true;if(frame)cancelAnimationFrame(frame);root.remove();
  window.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',dismiss,true);
  window.removeEventListener('tangsongpai-controller-input',dismiss);
  window.removeEventListener('blur',dismiss);window.removeEventListener('pagehide',dismiss);
  document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',preference);
  window.removeEventListener('tangsongpai-presentation',preference);
 };
 const dismiss=()=>{if(stopped)return;destroy();options.onDismiss?.();};
 const visibility=()=>{if(document.hidden)dismiss();};
 const preference=()=>{start=performance.now();};
 window.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',dismiss,true);
 window.addEventListener('tangsongpai-controller-input',dismiss);
 window.addEventListener('blur',dismiss);window.addEventListener('pagehide',dismiss);
 document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',preference);
 window.addEventListener('tangsongpai-presentation',preference);
 render();return {destroy};
}
