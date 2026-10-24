import {advanceEntryParticleField,createEntryParticleField,entryParticleVisible,paintEntryParticleBrush,ENTRY_PARTICLE_BUDGET,type EntryParticleField} from './EntryDepthParticles';
import type {Box} from './layout';
import './LoadingEntryParticles.css';

/** Decoration only. Reads the loading host's existing motion/pause state, never its resource gate. */
export class LoadingEntryParticles {
 private readonly media=window.matchMedia('(prefers-reduced-motion: reduce)');
 private readonly brushes=new Map<string,HTMLCanvasElement>();
 private readonly resizeObserver:ResizeObserver;
 private readonly stateObserver:MutationObserver;
 private readonly intersection?:IntersectionObserver;
 private field?:EntryParticleField;
 private protected:Box[]=[];
 private raf=0;private last?:number;private elapsed=0;private onScreen=true;private blurred=false;private destroyed=false;
 private readonly visibility=()=>this.sync();
 private readonly blur=()=>{this.blurred=true;this.sync();};
 private readonly focus=()=>{this.blurred=false;this.sync();};
 private readonly resize=()=>{
  const b=this.stage.getBoundingClientRect();if(b.width<=0||b.height<=0){this.stop();return;}
  const width=Math.round(b.width),height=Math.round(b.height),dpr=Math.max(1,Math.min(ENTRY_PARTICLE_BUDGET.maxDpr,window.devicePixelRatio||1));
  this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.context.setTransform(dpr,0,0,dpr,0,0);
  const local=(e:Element):Box=>{const r=e.getBoundingClientRect();return{x:r.x-b.x-6,y:r.y-b.y-6,width:r.width+12,height:r.height+12};};
  this.protected=[...this.stage.querySelectorAll('.load-brand,.load-side,.load-fan')].map(local);
  const fan=this.stage.querySelector('.load-fan'),anchor=fan?local(fan):undefined;
  this.field=createEntryParticleField(width,height,window.innerWidth,anchor);this.paint(true);this.sync();
 };
 private readonly tick=(stamp:number)=>{
  this.raf=0;if(!this.running()){this.sync();return;}const delta=this.last===undefined?0:stamp-this.last;this.last=stamp;this.elapsed+=delta;
  const hz=window.innerWidth<ENTRY_PARTICLE_BUDGET.breakpoint?ENTRY_PARTICLE_BUDGET.mobileHz:ENTRY_PARTICLE_BUDGET.desktopHz;
  if(this.elapsed>=1000/hz){advanceEntryParticleField(this.field!,this.elapsed);this.elapsed=0;this.paint();}
  this.raf=requestAnimationFrame(this.tick);
 };
 constructor(private readonly host:HTMLDialogElement,private readonly stage:HTMLElement,private readonly canvas:HTMLCanvasElement,private readonly context:CanvasRenderingContext2D){
  this.canvas.className='entry-loading-particles';this.canvas.setAttribute('aria-hidden','true');
  stage.insertBefore(this.canvas,stage.querySelector('.load-brand'));
  this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(stage);
  this.stateObserver=new MutationObserver(this.visibility);this.stateObserver.observe(host,{attributes:true,attributeFilter:['open','data-load-motion','data-load-paused']});
  if(typeof IntersectionObserver!=='undefined'){this.intersection=new IntersectionObserver(([e])=>{if(e){this.onScreen=e.isIntersecting;this.sync();}});this.intersection.observe(stage);}
  document.addEventListener('visibilitychange',this.visibility);window.addEventListener('blur',this.blur);window.addEventListener('focus',this.focus);window.addEventListener('tangsongpai-presentation',this.visibility);this.media.addEventListener('change',this.visibility);this.resize();
 }
 private reduced():boolean {return this.media.matches||this.host.dataset.loadMotion==='reduce';}
 private visible():boolean {return !this.destroyed&&this.onScreen&&!this.blurred&&!document.hidden&&this.host.open&&!this.host.hasAttribute('data-load-paused')&&!!this.field;}
 private running():boolean {return this.visible()&&!this.reduced();}
 private stop():void {if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.last=undefined;this.elapsed=0;}
 private sync():void {if(!this.running()){this.stop();if(this.visible())this.paint(true);return;}if(!this.raf)this.raf=requestAnimationFrame(this.tick);}
 private paint(staticFrame=false):void {
  const field=this.field;if(!field)return;if(staticFrame)advanceEntryParticleField(field,0,true);const c=this.context;c.clearRect(0,0,field.width,field.height);
  for(const p of field.particles.sort((a,b)=>a.projectedScale-b.projectedScale)){
   if(!entryParticleVisible(p,field,this.protected))continue;const key=p.color+'/'+p.bright;let brush=this.brushes.get(key);
   if(!brush){brush=document.createElement('canvas');brush.width=brush.height=ENTRY_PARTICLE_BUDGET.brush;const context=brush.getContext('2d');if(!context)continue;paintEntryParticleBrush(context,p.color,p.bright);this.brushes.set(key,brush);}
   const r=p.size*p.projectedScale;c.globalAlpha=p.opacity;c.drawImage(brush,p.screenX-r,p.screenY-r,r*2,r*2);
  }c.globalAlpha=1;
 }
 destroy():void {if(this.destroyed)return;this.destroyed=true;this.stop();this.resizeObserver.disconnect();this.stateObserver.disconnect();this.intersection?.disconnect();document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('blur',this.blur);window.removeEventListener('focus',this.focus);window.removeEventListener('tangsongpai-presentation',this.visibility);this.media.removeEventListener('change',this.visibility);this.brushes.clear();this.canvas.remove();this.canvas.width=this.canvas.height=1;this.field=undefined;}
}
export function mountLoadingEntryParticles(host:HTMLDialogElement):LoadingEntryParticles|undefined {
 const stage=host.id==='resource-loading'?host.querySelector<HTMLElement>('.load-scene'):undefined;
 if(!stage)return;const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:true});
 return context?new LoadingEntryParticles(host,stage,canvas,context):undefined;
}
