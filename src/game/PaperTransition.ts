import type Phaser from 'phaser';
import {gameSession} from './session';
import {
  physicalTransitionDurationMs,
  startCinematicWebGLTransition,
  type PhysicalShaderKind,
} from './CinematicTransitions';

/**
 * Physical & tactile transitions powered by WebGL2 GLSL ES 3.00 shaders
 * (tear, flaps, wash, slam), with an inert WAAPI fallback when WebGL2 is unavailable.
 * Strictly presentation-only: pointer-events none, instant yield on user input, never delays cuts.
 */
export type PaperTransitionKind='unroll'|'roll'|'page'|'ink'|PhysicalShaderKind;
export const PAPER_TRANSITION={cover:90,leave:260,total:350,limit:360,hardStop:1500,zIndex:1000} as const;
const INK='#100d13';

export function transitionShaderKind(kind:PaperTransitionKind):PhysicalShaderKind {
  if(kind==='tear'||kind==='unroll')return 'tear';
  if(kind==='flaps'||kind==='page')return 'flaps';
  if(kind==='wash'||kind==='roll')return 'wash';
  return 'slam';
}

export interface PaperTransitionPlan {duration:number;sheet:Keyframe[];origin:string;ink:boolean;rod:'left'|'right'|'none';shader:PhysicalShaderKind}
/** Pure description of one transition at a presentation speed; tests and fallbacks share it. */
export function paperTransitionPlan(kind:PaperTransitionKind,speed:1|2|4=1):PaperTransitionPlan {
  const rate=speed===2||speed===4?speed:1,shader=transitionShaderKind(kind),duration=Math.round(PAPER_TRANSITION.total/rate),covered=PAPER_TRANSITION.cover/PAPER_TRANSITION.total;
  const out='cubic-bezier(.3,0,.2,1)';
  if(kind==='unroll'||kind==='tear')return {duration,shader,ink:false,rod:'left',origin:'0 50%',sheet:[
    {offset:0,opacity:0,transform:'translateX(0)'},{offset:covered,opacity:1,transform:'translateX(0)',easing:out},{offset:1,opacity:1,transform:'translateX(101%)'}]};
  if(kind==='roll'||kind==='wash')return {duration,shader,ink:false,rod:'right',origin:'100% 50%',sheet:[
    {offset:0,opacity:0,transform:'translateX(0)'},{offset:covered,opacity:1,transform:'translateX(0)',easing:out},{offset:1,opacity:1,transform:'translateX(-101%)'}]};
  if(kind==='page'||kind==='flaps')return {duration,shader,ink:false,rod:'none',origin:'0 50%',sheet:[
    {offset:0,opacity:0,transform:'perspective(1600px) rotateY(0deg)'},{offset:covered,opacity:1,transform:'perspective(1600px) rotateY(0deg)',easing:out},
    {offset:.86,opacity:1,transform:'perspective(1600px) rotateY(-74deg)'},{offset:1,opacity:0,transform:'perspective(1600px) rotateY(-88deg)'}]};
  return {duration,shader,ink:true,rod:'none',origin:'50% 44%',sheet:[
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
 * Render a GPU WebGL2 physical transition (or rosewood WAAPI fallback in headless environments)
 * over the scene cut that the caller performs right after this call.
 */
export function beginPaperTransition(scene:Phaser.Scene,kind:PaperTransitionKind):()=>void {
  release?.();
  if(!paperTransitionAllowed(scene))return ()=>{};
  const speed=gameSession().speed,shader=transitionShaderKind(kind);

  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,animation:Animation|undefined,layer:HTMLElement|undefined,rafInput=0;
  let webglStop:(()=>void)|undefined;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const visibility=()=>{if(document.hidden)dispose();};
  const dispose=()=>{
    if(disposed)return;disposed=true;
    if(timer!==undefined)clearTimeout(timer);
    if(rafInput&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(rafInput);
    animation?.cancel();
    webglStop?.();
    layer?.remove();
    for(const name of ['blur','pagehide','resize','tangsongpai-presentation'])window.removeEventListener(name,dispose);
    window.removeEventListener('pointerdown',dispose,true);window.removeEventListener('keydown',dispose,true);
    document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',dispose);scene.game.events.off('destroy',dispose);
    if(release===dispose)release=undefined;
  };
  release=dispose;
  for(const name of ['blur','pagehide','resize','tangsongpai-presentation'])window.addEventListener(name,dispose);
  document.addEventListener('visibilitychange',visibility);preference.addEventListener('change',dispose);scene.game.events.once('destroy',dispose);

  const webglDuration=physicalTransitionDurationMs(shader,speed);
  const activeWebGL=startCinematicWebGLTransition(scene,shader,kind,webglDuration,PAPER_TRANSITION.zIndex,dispose);
  if(activeWebGL){
    webglStop=activeWebGL.stop;
    // Arm click/key skip on the next frame so the triggering click/Enter cannot cancel the new cut.
    if(typeof requestAnimationFrame==='function'){
      rafInput=requestAnimationFrame(()=>{
        rafInput=0;
        if(disposed)return;
        window.addEventListener('pointerdown',dispose,true);
        window.addEventListener('keydown',dispose,true);
      });
    }else{
      window.addEventListener('pointerdown',dispose,true);
      window.addEventListener('keydown',dispose,true);
    }
    timer=setTimeout(dispose,PAPER_TRANSITION.hardStop);
    return dispose;
  }

  // Fallback WAAPI sheet path when WebGL2 is unavailable (e.g. headless DOM tests).
  const plan=paperTransitionPlan(kind,speed),fallback=document.createElement('div');
  if(typeof fallback.animate!=='function'){dispose();return ()=>{};}
  layer=fallback;
  fallback.setAttribute('aria-hidden','true');fallback.dataset.paperTransition=kind;fallback.dataset.transitionShader=shader;
  Object.assign(fallback.style,{position:'fixed',inset:'0',zIndex:String(PAPER_TRANSITION.zIndex),pointerEvents:'none',overflow:'hidden',contain:'strict'});
  const sheet=document.createElement('div');
  Object.assign(sheet.style,{position:'absolute',inset:'0',opacity:'0',transformOrigin:plan.origin,willChange:'transform,opacity',
    background:plan.ink
      ?`radial-gradient(ellipse farthest-corner at 50% 44%,${INK}00 26%,${INK}d9 62%,${INK} 100%)`
      :'radial-gradient(ellipse at 50% 42%,rgba(242,202,130,0.09),transparent 65%),linear-gradient(110deg,#16111a,#231c27 55%,#120e16)'});
  if(plan.rod!=='none'){
    const rod=document.createElement('div'),edge=plan.rod==='left'?'left':'right';
    Object.assign(rod.style,{position:'absolute',top:'0',bottom:'0',width:'22px',[edge]:'0',
      background:`linear-gradient(${plan.rod==='left'?90:270}deg,#5b411d,#e0bc74 40%,#987136 72%,#100d1300)`,boxShadow:`${plan.rod==='left'?'-':''}12px 0 22px #06040a80`});
    sheet.append(rod);
  }
  fallback.append(sheet);document.body.append(fallback);
  window.addEventListener('pointerdown',dispose,true);window.addEventListener('keydown',dispose,true);
  timer=setTimeout(dispose,PAPER_TRANSITION.hardStop);
  animation=sheet.animate(plan.sheet,{duration:plan.duration,fill:'forwards'});
  animation.onfinish=dispose;animation.oncancel=()=>{if(!disposed)dispose();};
  return dispose;
}
