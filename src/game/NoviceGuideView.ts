import type {Box} from './layout';
import './NoviceGuideView.css';

/** All geometry is in browser viewport CSS pixels, not framebuffer pixels. */
export interface NoviceGuideGeometry {
  highlights?:readonly Box[];
  /** Live input areas that neither the hint nor its reopen button may cover. */
  avoid?:readonly Box[];
}
export interface NoviceGuideStep {
  id:string;
  title:string;
  body:string;
  progress?:string;
  /** Optional explanation, initially collapsed and opened by the player. */
  details?:string;
  action?:{label:string;run:()=>void};
}
export interface NoviceGuideOptions {
  step:NoviceGuideStep;
  getGeometry:()=>NoviceGuideGeometry;
  onClose?:()=>void;
  onReopen?:()=>void;
  onSkip?:()=>void;
  reducedMotion?:boolean;
  host?:HTMLElement;
  /** A mobile list can reserve natural space for the guide instead of covering items. */
  getInlineHost?:()=>HTMLElement|undefined;
}
export interface NoviceGuideHandle {
  update(step:NoviceGuideStep):void;
  /** Call after scene layout or canvas geometry changes. */
  refresh():void;
  close():void;
  reopen():void;
  unmount():void;
}

/** Convert SceneView's logical CSS coordinates to the displayed canvas' viewport coordinates. */
export function noviceGuideCanvasBox(box:Box,canvasRect:Pick<DOMRect,'left'|'top'|'width'|'height'>,logicalSize:{width:number;height:number}):Box {
  const sx=logicalSize.width>0?canvasRect.width/logicalSize.width:0,sy=logicalSize.height>0?canvasRect.height/logicalSize.height:0;
  return {x:canvasRect.left+box.x*sx,y:canvasRect.top+box.y*sy,width:box.width*sx,height:box.height*sy};
}

const right=(b:Box)=>b.x+b.width,bottom=(b:Box)=>b.y+b.height;
const valid=(b:Box)=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0;
const overlap=(a:Box,b:Box)=>a.x<right(b)&&right(a)>b.x&&a.y<bottom(b)&&bottom(a)>b.y;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** Empty rectangles in the safe viewport. No candidate crosses any protected input area. */
function freeRegions(bounds:Box,avoid:readonly Box[]):Box[] {
  if(!valid(bounds))return [];
  const obstacles=avoid.filter(valid).filter(b=>overlap(bounds,b)).map(b=>{
    const x=Math.max(bounds.x,b.x),y=Math.max(bounds.y,b.y);
    return {x,y,width:Math.min(right(bounds),right(b))-x,height:Math.min(bottom(bounds),bottom(b))-y};
  });
  const ys=[...new Set([bounds.y,bottom(bounds),...obstacles.flatMap(b=>[b.y,bottom(b)])])].sort((a,b)=>a-b),regions:Box[]=[];
  for(let i=0;i<ys.length-1;i++)for(let j=i+1;j<ys.length;j++){
    const y=ys[i],height=ys[j]-y;
    const intervals=obstacles.filter(b=>b.y<ys[j]&&bottom(b)>y).map(b=>[b.x,right(b)] as const).sort((a,b)=>a[0]-b[0]);
    let x=bounds.x;
    for(const [left,end] of intervals){if(left>x)regions.push({x,y,width:left-x,height});x=Math.max(x,end);}
    if(x<right(bounds))regions.push({x,y,width:right(bounds)-x,height});
  }
  return regions;
}

/** Exported to verify placement against real table layouts without creating a scene. */
export function placeNoviceGuide(bounds:Box,avoid:readonly Box[],desired:{width:number;height:number},anchor?:Box):Box|undefined {
  if(!valid(bounds)||!Number.isFinite(desired.width)||!Number.isFinite(desired.height)||desired.width<=0||desired.height<=0)return;
  const regions=freeRegions(bounds,avoid).filter(b=>b.width>=44&&b.height>=44);
  const target=valid(anchor??{x:0,y:0,width:0,height:0})?anchor:undefined;
  let best:Box|undefined,bestScore=-Infinity;
  for(const region of regions){
    const width=Math.min(desired.width,region.width),height=Math.min(desired.height,region.height);
    const centerX=target?target.x+target.width/2:bounds.x+bounds.width/2;
    const centerY=target?target.y+target.height/2:bounds.y+bounds.height*.4;
    const x=clamp(centerX-width/2,region.x,right(region)-width),y=clamp(centerY-height/2,region.y,bottom(region)-height);
    const fits=width>=desired.width-.01&&height>=desired.height-.01;
    const coverage=(width/desired.width)*(height/desired.height);
    const distance=Math.hypot(x+width/2-centerX,y+height/2-centerY)/Math.max(1,bounds.width+bounds.height);
    // A complete hint wins over proximity. When space is tight, keep as much of it as possible.
    const score=(fits?10:coverage)-distance*.1;
    if(score>bestScore){bestScore=score;best={x,y,width,height};}
  }
  return best;
}

function safeViewport():Box {
  const visual=window.visualViewport,style=getComputedStyle(document.documentElement);
  const inset=(side:string)=>Math.max(0,parseFloat(style.getPropertyValue('--safe-'+side))||0);
  const left=(visual?.offsetLeft??0)+inset('left')+8,top=(visual?.offsetTop??0)+inset('top')+8;
  return {x:left,y:top,width:Math.max(0,(visual?.width??window.innerWidth)-inset('left')-inset('right')-16),height:Math.max(0,(visual?.height??window.innerHeight)-inset('top')-inset('bottom')-16)};
}

let detailsSequence=0;
/** Non-modal presentation only: it never chooses cards or sends a game command. */
export function mountNoviceGuideView(options:NoviceGuideOptions):NoviceGuideHandle {
  const root=document.createElement('div'),rings=document.createElement('div'),panel=document.createElement('section');
  const header=document.createElement('div'),heading=document.createElement('div'),progress=document.createElement('span'),title=document.createElement('strong'),closeButton=document.createElement('button');
  const body=document.createElement('p'),footer=document.createElement('div'),skipButton=document.createElement('button'),detailsButton=document.createElement('button'),detailsBody=document.createElement('div'),actionButton=document.createElement('button'),reopenButton=document.createElement('button');
  root.className='novice-guide';root.dataset.noviceGuide='';root.dataset.reducedMotion=String(!!options.reducedMotion);
  rings.className='novice-guide-rings';rings.setAttribute('aria-hidden','true');
  panel.className='novice-guide-panel';panel.setAttribute('aria-label','新手引导');panel.dataset.noviceGuidePanel='';
  header.className='novice-guide-header';heading.className='novice-guide-heading';heading.setAttribute('role','status');heading.setAttribute('aria-live','polite');heading.setAttribute('aria-atomic','true');
  progress.className='novice-guide-progress';title.className='novice-guide-title';body.className='novice-guide-body';heading.append(progress,title,body);
  closeButton.type='button';closeButton.className='novice-guide-close';closeButton.textContent='×';closeButton.setAttribute('aria-label','收起引导');closeButton.title='收起引导';closeButton.dataset.noviceGuideClose='';
  footer.className='novice-guide-actions';
  skipButton.type='button';skipButton.className='novice-guide-skip';skipButton.textContent='跳过';skipButton.setAttribute('aria-label','跳过教学并开始普通游戏，之后可在菜单重看');skipButton.title='跳过教学并开始普通游戏，之后可在菜单重看';skipButton.dataset.noviceGuideSkip='';skipButton.hidden=!options.onSkip;
  const detailsId='novice-guide-details-'+(++detailsSequence);
  detailsButton.type='button';detailsButton.className='novice-guide-details-toggle';detailsButton.textContent='技能与路线';detailsButton.dataset.noviceGuideDetailsToggle='';detailsButton.id=detailsId+'-toggle';detailsButton.setAttribute('aria-controls',detailsId);
  detailsBody.className='novice-guide-details';detailsBody.id=detailsId;detailsBody.dataset.noviceGuideDetails='';detailsBody.setAttribute('role','region');detailsBody.setAttribute('aria-labelledby',detailsButton.id);
  actionButton.type='button';actionButton.className='novice-guide-action';actionButton.dataset.noviceGuideAction='';
  header.append(heading,skipButton,actionButton,closeButton);
  footer.append(detailsButton);panel.append(header,body,footer,detailsBody);
  reopenButton.type='button';reopenButton.className='novice-guide-reopen';reopenButton.textContent='查看引导';reopenButton.setAttribute('aria-label','查看新手引导');reopenButton.dataset.noviceGuideReopen='';reopenButton.hidden=true;
  root.append(rings,panel,reopenButton);(options.host??document.body).append(root);
  let step=options.step,closed=false,disposed=false,frame=0,detailsExpanded=false;
  const renderStep=()=>{
    root.dataset.noviceGuideStep=step.id;progress.textContent=step.progress??'';progress.hidden=!step.progress;title.textContent=step.title;body.textContent=step.body;
    if(!step.action&&document.activeElement===actionButton)closeButton.focus({preventScroll:true});
    actionButton.hidden=!step.action;actionButton.textContent=step.action?.label??'';
    const skipFocused=document.activeElement===skipButton;
    skipButton.hidden=!options.onSkip||step.id==='complete';
    if(skipButton.hidden&&skipFocused)(step.action?actionButton:closeButton).focus({preventScroll:true});
    if(!step.details&&document.activeElement===detailsButton)closeButton.focus({preventScroll:true});
    panel.classList.toggle('has-details',!!step.details);detailsButton.hidden=!step.details;detailsButton.setAttribute('aria-expanded',String(!!step.details&&detailsExpanded));
    detailsBody.hidden=!step.details||!detailsExpanded;detailsBody.textContent=step.details??'';
  };
  const position=()=>{
    if(disposed)return;
    const {highlights=[],avoid=[]}=options.getGeometry(),bounds=safeViewport(),visibleHighlights=highlights.filter(valid);
    const inline=options.getInlineHost?.();
    if(inline?.isConnected){if(root.parentElement!==inline)inline.prepend(root);root.classList.add('is-inline');}
    else {const host=options.host??document.body;if(root.parentElement!==host)host.append(root);root.classList.remove('is-inline');}
    rings.replaceChildren();
    if(!closed)for(const b of visibleHighlights){
      const ring=document.createElement('div');ring.className='novice-guide-ring';ring.dataset.noviceGuideHighlight='';
      Object.assign(ring.style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px'});rings.append(ring);
    }
    const protectedAreas=[...avoid,...visibleHighlights],element=closed?reopenButton:panel;
    if(inline?.isConnected&&!closed){
      Object.assign(panel.style,{left:'',top:'',width:'',maxHeight:'',visibility:'visible'});
      panel.classList.remove('is-constrained');panel.setAttribute('aria-label','新手引导');panel.removeAttribute('tabindex');return;
    }
    // Read the natural height at the likely width, then remeasure once if a narrow free region wraps the text.
    element.style.maxHeight='none';element.style.width=closed?'auto':Math.min(320,bounds.width)+'px';
    let rect=element.getBoundingClientRect();
    let placement=placeNoviceGuide(bounds,protectedAreas,{width:closed?Math.max(88,rect.width):rect.width,height:Math.max(44,rect.height)},visibleHighlights[0]);
    if(placement&&!closed&&placement.width<rect.width-.5){
      element.style.width=placement.width+'px';rect=element.getBoundingClientRect();
      placement=placeNoviceGuide(bounds,protectedAreas,{width:placement.width,height:Math.max(44,rect.height)},visibleHighlights[0]);
    }
    // If no 44px target can fit, do not place an invisible blocker on top of gameplay.
    element.style.visibility=placement?'visible':'hidden';
    if(!placement)return;
    Object.assign(element.style,{left:placement.x+'px',top:placement.y+'px',width:placement.width+'px',maxHeight:placement.height+'px'});
    const constrained=!closed&&rect.height>placement.height+.5;
    panel.classList.toggle('is-constrained',constrained);
    panel.setAttribute('aria-label',constrained?'新手引导，可滚动查看':'新手引导');
    if(constrained)panel.tabIndex=0;else panel.removeAttribute('tabindex');
  };
  const schedule=()=>{if(disposed)return;if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;position();});};
  const setClosed=(next:boolean,notify:boolean)=>{
    if(disposed||closed===next)return;
    const focused=next?panel.contains(document.activeElement):document.activeElement===reopenButton;
    closed=next;panel.hidden=closed;reopenButton.hidden=!closed;position();
    if(focused)(closed?reopenButton:closeButton).focus({preventScroll:true});
    if(notify)(closed?options.onClose:options.onReopen)?.();
  };
  closeButton.onclick=()=>setClosed(true,true);
  reopenButton.onclick=()=>setClosed(false,true);
  skipButton.onclick=()=>{if(disposed)return;setClosed(true,false);options.onSkip?.();};
  detailsButton.onclick=()=>{
    if(disposed||closed||!step.details)return;
    detailsExpanded=!detailsExpanded;renderStep();position();
    if(detailsExpanded){const outer=panel.getBoundingClientRect(),inner=detailsBody.getBoundingClientRect();panel.scrollTop+=Math.max(0,inner.top-(outer.bottom-36));}
  };
  actionButton.onclick=()=>{if(!disposed&&!closed)step.action?.run();};
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setClosed(true,true);}
    // A focused, scrollable panel is not a card target. Let its native scrolling
    // work without also delivering the same keys to the scene's window handler.
    else if(event.target===panel&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','PageUp','PageDown','Home','End'].includes(event.key))event.stopPropagation();
  });
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(schedule);observer?.observe(panel);
  renderStep();position();
  return {
    update(next){if(disposed)return;if(next.id!==step.id||!next.details)detailsExpanded=false;step=next;renderStep();position();},
    refresh(){if(!disposed)position();},
    close(){setClosed(true,true);},
    reopen(){setClosed(false,true);},
    unmount(){
      if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);
      closeButton.onclick=null;reopenButton.onclick=null;skipButton.onclick=null;detailsButton.onclick=null;actionButton.onclick=null;root.remove();
    },
  };
}
