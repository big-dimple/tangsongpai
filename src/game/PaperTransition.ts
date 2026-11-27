import type Phaser from 'phaser';
import {gameSession} from './session';
import {PAPER_CSS} from './theme';

/**
 * Paper transitions: a sheet covers the cut and is then unrolled, rolled up or turned away;
 * ink seeps in from the edges before a finale. Presentation only. Navigation is never
 * delayed (the caller starts the next scene as before), the layer takes no input, any
 * key, press, blur or resize removes it, and reduced motion or the Canvas renderer keep
 * the plain cut with no layer at all.
 */
export type PaperTransitionKind='unroll'|'roll'|'page'|'ink';
export const PAPER_TRANSITION={cover:90,leave:260,total:350,limit:360,hardStop:800,zIndex:1000} as const;
const INK='#182a2e';

export interface PaperTransitionPlan {duration:number;sheet:Keyframe[];origin:string;ink:boolean;rod:'left'|'right'|'none'}
/** Pure description of one transition at a presentation speed; tests and the DOM share it. */
export function paperTransitionPlan(kind:PaperTransitionKind,speed:1|2|4=1):PaperTransitionPlan {
  const rate=speed===2||speed===4?speed:1,duration=Math.round(PAPER_TRANSITION.total/rate),covered=PAPER_TRANSITION.cover/PAPER_TRANSITION.total;
  const out='cubic-bezier(.3,0,.2,1)';
  if(kind==='unroll')return {duration,ink:false,rod:'left',origin:'0 50%',sheet:[
    {offset:0,opacity:0,transform:'translateX(0)'},{offset:covered,opacity:1,transform:'translateX(0)',easing:out},{offset:1,opacity:1,transform:'translateX(101%)'}]};
  if(kind==='roll')return {duration,ink:false,rod:'right',origin:'100% 50%',sheet:[
    {offset:0,opacity:0,transform:'translateX(0)'},{offset:covered,opacity:1,transform:'translateX(0)',easing:out},{offset:1,opacity:1,transform:'translateX(-101%)'}]};
  if(kind==='page')return {duration,ink:false,rod:'none',origin:'0 50%',sheet:[
    {offset:0,opacity:0,transform:'perspective(1600px) rotateY(0deg)'},{offset:covered,opacity:1,transform:'perspective(1600px) rotateY(0deg)',easing:out},
    {offset:.86,opacity:1,transform:'perspective(1600px) rotateY(-74deg)'},{offset:1,opacity:0,transform:'perspective(1600px) rotateY(-88deg)'}]};
  return {duration,ink:true,rod:'none',origin:'50% 44%',sheet:[
    {offset:0,opacity:0,transform:'scale(1.5)'},{offset:covered+.08,opacity:.92,transform:'scale(1.04)',easing:'ease-out'},{offset:1,opacity:0,transform:'scale(1)'}]};
}

let release:(()=>void)|undefined;
/** Whether a layer may be shown at all. Reduced motion and Canvas keep the hard cut. */
export function paperTransitionAllowed(scene:Phaser.Scene):boolean {
  if(typeof document==='undefined'||typeof window==='undefined'||!document.body)return false;
  if(scene.game?.renderer?.type!==2||document.hidden)return false;
  return !gameSession().reducedMotion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lay the sheet over the scene cut that the caller performs right after this call.
 * Returns a disposer; at most one transition exists at a time.
 */
export function beginPaperTransition(scene:Phaser.Scene,kind:PaperTransitionKind):()=>void {
  release?.();
  if(!paperTransitionAllowed(scene))return ()=>{};
  const plan=paperTransitionPlan(kind,gameSession().speed),layer=document.createElement('div');
  if(typeof layer.animate!=='function')return ()=>{};
  layer.setAttribute('aria-hidden','true');layer.dataset.paperTransition=kind;
  Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:String(PAPER_TRANSITION.zIndex),pointerEvents:'none',overflow:'hidden',contain:'strict'});
  const sheet=document.createElement('div');
  Object.assign(sheet.style,{position:'absolute',inset:'0',opacity:'0',transformOrigin:plan.origin,willChange:'transform,opacity',
    background:plan.ink
      ?`radial-gradient(ellipse farthest-corner at 50% 44%,${INK}00 26%,${INK}d9 62%,${INK} 100%)`
      :`var(--paper-grain,none) 0 0/256px 256px,${PAPER_CSS.paper}`});
  if(plan.rod!=='none'){
    // The scroll's rod and the shade it casts on the sheet it is rolling over.
    const rod=document.createElement('div'),edge=plan.rod==='left'?'left':'right';
    Object.assign(rod.style,{position:'absolute',top:'0',bottom:'0',width:'22px',[edge]:'0',
      background:`linear-gradient(${plan.rod==='left'?90:270}deg,#6d5636,#b7996b 38%,#8a6f49 70%,#3a2a1800)`,boxShadow:`${plan.rod==='left'?'-':''}10px 0 18px #2a1c0c40`});
    sheet.append(rod);
  }
  layer.append(sheet);document.body.append(layer);
  let disposed=false,animation:Animation|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const dispose=()=>{
    if(disposed)return;disposed=true;if(timer!==undefined)clearTimeout(timer);animation?.cancel();layer.remove();
    for(const name of ['blur','pagehide','resize','tangsongpai-presentation'])window.removeEventListener(name,dispose);
    window.removeEventListener('pointerdown',dispose,true);window.removeEventListener('keydown',dispose,true);
    document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',dispose);scene.game.events.off('destroy',dispose);
    if(release===dispose)release=undefined;
  };
  const visibility=()=>{if(document.hidden)dispose();};
  release=dispose;
  for(const name of ['blur','pagehide','resize','tangsongpai-presentation'])window.addEventListener(name,dispose);
  window.addEventListener('pointerdown',dispose,true);window.addEventListener('keydown',dispose,true);
  document.addEventListener('visibilitychange',visibility);preference.addEventListener('change',dispose);scene.game.events.once('destroy',dispose);
  // The layer spans the scene boundary on purpose; a hard bound covers a failed navigation.
  timer=setTimeout(dispose,PAPER_TRANSITION.hardStop);
  animation=sheet.animate(plan.sheet,{duration:plan.duration,fill:'forwards'});
  animation.onfinish=dispose;animation.oncancel=()=>{if(!disposed)dispose();};
  return dispose;
}
