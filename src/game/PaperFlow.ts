import {prepareDestination} from './LoadingScreen';
import {AudioEngine} from '../audio/AudioEngine';
import {gameSession} from './session';
import type Phaser from 'phaser';

/** Scene cuts keep their navigation owner without adding domain callbacks. */
export class PaperFlow {
  constructor(_reduced:()=>boolean){}
  cancel():void {}
  run(_canvas:HTMLCanvasElement,_full=false):void {this.cancel();}
}
const cuts=new WeakMap<Phaser.Scene,object>();

export function paperSceneStart(scene:Phaser.Scene,key:string,data?:object,_full=false):void {
  const cut={};cuts.set(scene,cut);
  void prepareDestination(scene.game,key).then(prepared=>{if(!prepared||cuts.get(scene)!==cut||!scene.scene.isActive())return;cuts.delete(scene);if(data===undefined)scene.scene.start(key);else scene.scene.start(key,data);});
}

/**
 * Qiyu-only transition hook. Gameplay and save state are committed before this
 * starts; the ink-scroll veil is strictly presentation-only (`pointer-events: none`),
 * never delays `scene.scene.start`, and respects reduced motion.
 */
export function qiyuSceneStart(scene:Phaser.Scene,key:string,data?:object,copy='奇遇 · 纸上流彩'):void {
  const cut={};cuts.set(scene,cut);
  const reduced=(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)||gameSession().reducedMotion;
  let overlay:HTMLDivElement|undefined;
  if(typeof document!=='undefined'&&document.body){
    document.querySelectorAll('[data-qiyu-transition]').forEach(node=>node.remove());
    overlay=document.createElement('div');
    overlay.dataset.qiyuTransition='true';
    overlay.dataset.motion=reduced?'static':'animated';
    overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{
      position:'fixed',inset:'0',zIndex:'10001',display:'grid',placeItems:'center',
      pointerEvents:'none',overflow:'hidden',
      background:'radial-gradient(circle at 50% 44%,rgba(138,62,48,.88) 0%,rgba(20,45,43,.94) 68%)',
      borderTop:'3px solid rgba(216,179,106,.75)',borderBottom:'3px solid rgba(216,179,106,.75)',
      opacity:reduced?'0':'0.96',
      transition:reduced?'none':'opacity 360ms cubic-bezier(.22,1,.36,1), transform 360ms cubic-bezier(.22,1,.36,1)',
    });
    const scroll=document.createElement('div');
    Object.assign(scroll.style,{
      display:'grid',gap:'8px',justifyItems:'center',padding:'18px 34px',
      border:'1px solid rgba(240,199,122,.72)',borderRadius:'6px',
      background:'linear-gradient(135deg,rgba(24,47,44,.96),rgba(69,36,34,.94))',
      boxShadow:'0 16px 48px rgba(0,0,0,.45), inset 0 0 0 2px rgba(248,232,200,.22)',
      color:'#f8e8c8',fontFamily:'Georgia,"Noto Serif SC",SimSun,serif',textAlign:'center',
    });
    const seal=document.createElement('span');
    seal.textContent='奇遇';
    Object.assign(seal.style,{
      display:' inline-grid',placeItems:'center',padding:'2px 10px',
      border:'1.5px solid #d96b52',borderRadius:'4px',background:'rgba(166,54,42,.32)',
      color:'#ffdfc2',fontSize:'13px',fontWeight:'700',letterSpacing:'.24em',
    });
    const title=document.createElement('strong');
    title.textContent=copy;
    Object.assign(title.style,{
      fontSize:'clamp(22px,3.6vw,42px)',letterSpacing:'.18em',color:'#f8e8c8',
    });
    const sub=document.createElement('span');
    sub.textContent='墨幕开场 · 七至九关真实验收机缘';
    Object.assign(sub.style,{
      fontSize:'13px',letterSpacing:'.14em',color:'#dfc594',
    });
    scroll.append(seal,title,sub);
    overlay.append(scroll);
    document.body.appendChild(overlay);
    try{AudioEngine.shared.curtainOpen();}catch{/* Audio is optional presentation. */}
  }
  void prepareDestination(scene.game,key).then(prepared=>{
    if(!prepared||cuts.get(scene)!==cut||!scene.scene.isActive()){overlay?.remove();return;}
    cuts.delete(scene);
    if(data===undefined)scene.scene.start(key);else scene.scene.start(key,data);
    if(!overlay)return;
    if(reduced){overlay.remove();return;}
    requestAnimationFrame(()=>{
      if(!overlay)return;
      overlay.style.opacity='0';
      overlay.style.transform='scale(1.03)';
      window.setTimeout(()=>overlay?.remove(),380);
    });
  });
}
