import type {Box} from './layout';
import {characterArt} from './CharacterArt';
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
  choices?:{id:string;label:string;cardIds:string[];selected?:boolean;run:()=>void}[];
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
  onDetails?:()=>void;
}
export interface NoviceGuideHandle {
  update(step:NoviceGuideStep):void;
  /** Call after scene layout or canvas geometry changes. */
  refresh():void;
  close():void;
  reopen():void;
  /** Whether the open panel is actually inside the visible viewport and scroll ancestors. */
  isVisible():boolean;
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
  const clipped=avoid.filter(valid).filter(b=>overlap(bounds,b)).map(b=>{
    const x=Math.max(bounds.x,b.x),y=Math.max(bounds.y,b.y);
    return {x,y,width:Math.min(right(bounds),right(b))-x,height:Math.min(bottom(bounds),bottom(b))-y};
  });
  // HUD / action containers already cover most child controls. Keeping their
  // nested boxes multiplies candidate regions without protecting anything new.
  const obstacles=clipped.filter((b,i)=>!clipped.some((outer,j)=>i!==j&&outer.x<=b.x&&outer.y<=b.y&&right(outer)>=right(b)&&bottom(outer)>=bottom(b)&&
    (outer.x<b.x||outer.y<b.y||right(outer)>right(b)||bottom(outer)>bottom(b)||j<i)));
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
    // Never trade a complete explanation for a clipped one. Among complete
    // placements, proximity is a primary cue: a remote top banner is easy to
    // miss while the player is looking at the bottom hand or a shop slot.
    const score=(fits?100:coverage)-distance*(fits?18:2);
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

const stepProgress:Readonly<Record<string,string>>={
  pair:'新手首战 · 认识牌型',discard:'新手首战 · 换牌（可选）',independent:'新手首战 · 自主出牌',
  shop:'新手首战 · 商店构筑',payoff:'新手首战 · 唐宋牌生效',skill:'新手首战 · 英雄技能',
  'skill-practice':'新手首战 · 自主实战',
  complete:'新手首战 · 已完成',replay:'新手首战 · 再练一次',
};
function emphasis(step:NoviceGuideStep):'score'|'reward'|'action' {
  if(step.id==='discard')return 'score';
  if(step.id==='complete')return 'reward';
  if(step.id==='skill'&&/筹码|倍率/.test(step.title))return 'reward';
  return 'action';
}

/** Non-modal presentation only: it never chooses cards or sends a game command. */
export function mountNoviceGuideView(options:NoviceGuideOptions):NoviceGuideHandle {
  const root=document.createElement('div'),rings=document.createElement('div'),panel=document.createElement('section');
  const focus=document.createElementNS('http://www.w3.org/2000/svg','svg'),focusPath=document.createElementNS('http://www.w3.org/2000/svg','path');
  const header=document.createElement('div'),heading=document.createElement('div'),controls=document.createElement('div'),progress=document.createElement('span'),title=document.createElement('strong'),announcement=document.createElement('span'),closeButton=document.createElement('button');
  const portrait=document.createElement('img'),speaker=document.createElement('span');
  const body=document.createElement('p'),choiceRow=document.createElement('div'),choices=document.createElement('div'),footer=document.createElement('div'),skipButton=document.createElement('button'),detailsButton=document.createElement('button'),actionButton=document.createElement('button'),reopenButton=document.createElement('button');
  root.className='novice-guide';root.dataset.noviceGuide='';root.dataset.reducedMotion=String(!!options.reducedMotion);
  focus.classList.add('novice-guide-focus');focus.setAttribute('aria-hidden','true');focusPath.setAttribute('fill','#142e31');focusPath.setAttribute('fill-opacity','.3');focusPath.setAttribute('fill-rule','evenodd');focus.append(focusPath);
  rings.className='novice-guide-rings';rings.setAttribute('aria-hidden','true');
  panel.className='novice-guide-panel';panel.setAttribute('aria-label','新手引导');panel.dataset.noviceGuidePanel='';
  header.className='novice-guide-header';heading.className='novice-guide-heading';
  portrait.className='novice-guide-portrait';portrait.alt='';portrait.src=characterArt('erxiang','avatar')?.url??'';speaker.className='novice-guide-speaker';speaker.textContent='刘娥 · 陪你入局';
  announcement.className='novice-guide-announcement';announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');
  progress.className='novice-guide-progress';title.className='novice-guide-title';body.className='novice-guide-body';heading.append(speaker,progress,title);
  closeButton.type='button';closeButton.className='novice-guide-close';closeButton.textContent='×';closeButton.setAttribute('aria-label','收起引导');closeButton.title='收起引导';closeButton.dataset.noviceGuideClose='';
  choiceRow.className='novice-guide-choice-row';choices.className='novice-guide-choices';choices.setAttribute('aria-label','选择要尝试的牌型');choiceRow.append(choices);
  footer.className='novice-guide-actions';
  skipButton.type='button';skipButton.className='novice-guide-skip';skipButton.textContent='跳过';skipButton.setAttribute('aria-label','跳过教学并开始普通游戏，之后可在菜单重看');skipButton.title='跳过教学并开始普通游戏，之后可在菜单重看';skipButton.dataset.noviceGuideSkip='';skipButton.hidden=!options.onSkip;
  detailsButton.type='button';detailsButton.className='novice-guide-details-toggle';detailsButton.textContent='计分与规则';detailsButton.dataset.noviceGuideDetailsToggle='';detailsButton.setAttribute('aria-haspopup','dialog');
  actionButton.type='button';actionButton.className='novice-guide-action';actionButton.dataset.noviceGuideAction='';
  // The explanation uses the full panel width below the 44px controls. This
  // keeps long score breakdowns legible without shrinking their touch targets.
  controls.className='novice-guide-controls';controls.append(skipButton,actionButton,closeButton);header.append(portrait,heading,controls);
  footer.append(detailsButton);panel.append(header,body,choiceRow,footer,announcement);
  reopenButton.type='button';reopenButton.className='novice-guide-reopen';reopenButton.textContent='查看引导';reopenButton.setAttribute('aria-label','查看新手引导');reopenButton.dataset.noviceGuideReopen='';reopenButton.hidden=true;
  root.append(focus,rings,panel,reopenButton);(options.host??document.body).append(root);
  let step=options.step,closed=false,disposed=false,frame=0,choiceIds='';
  let revision=0,lastPositionRevision=-1,lastPositionKey='',lastLayout=-Infinity,positionedVisible=false,lastFocusPath='';
  const ringNodes:HTMLDivElement[]=[];
  const renderStep=()=>{
    const label=step.progress??stepProgress[step.id]??'';
    root.dataset.noviceGuideStep=step.id;panel.dataset.emphasis=emphasis(step);progress.textContent=label;progress.hidden=!label;title.textContent=step.title;body.textContent=step.body;
    const message=[label,step.title,step.body].filter(Boolean).join('。');
    if(announcement.textContent!==message)announcement.textContent=message;
    if(!step.action&&document.activeElement===actionButton)closeButton.focus({preventScroll:true});
    actionButton.hidden=!step.action;actionButton.textContent=step.action?.label??'';
    const rows=step.choices??[],ids=JSON.stringify(rows.map(choice=>choice.id));
    choices.setAttribute('aria-label',step.id==='payoff'||step.id==='discard'?'新手引导下一步':'选择要尝试的牌型');
    if(ids!==choiceIds){
      choiceIds=ids;choices.replaceChildren(...rows.map(choice=>{
        const button=document.createElement('button');button.type='button';button.dataset.noviceGuideChoice=choice.id;
        button.onclick=()=>step.choices?.find(row=>row.id===choice.id)?.run();return button;
      }));
    }
    const hasChoices=rows.length>0;panel.classList.toggle('has-choices',hasChoices);choiceRow.hidden=!hasChoices;
    if(hasChoices&&skipButton.parentElement!==choiceRow)choiceRow.append(skipButton,closeButton);
    else if(!hasChoices&&skipButton.parentElement!==controls){controls.insertBefore(skipButton,actionButton);controls.append(closeButton);}
    rows.forEach((choice,index)=>{
      const button=choices.children[index] as HTMLButtonElement;
      button.textContent=choice.label;button.dataset.cardIds=JSON.stringify(choice.cardIds);
      if(choice.id==='flush-intro'||choice.id==='flush-sorted')button.removeAttribute('aria-pressed');
      else button.setAttribute('aria-pressed',String(!!choice.selected));
    });
    const skipFocused=document.activeElement===skipButton;
    skipButton.hidden=!options.onSkip||step.id==='complete';
    controls.hidden=![...controls.children].some(child=>!(child as HTMLElement).hidden);
    if(skipButton.hidden&&skipFocused)(step.action?actionButton:closeButton).focus({preventScroll:true});
    if(!step.details&&document.activeElement===detailsButton)closeButton.focus({preventScroll:true});
    const showDetails=!!step.details&&!!options.onDetails&&!hasChoices;
    panel.classList.toggle('has-details',showDetails);detailsButton.hidden=!showDetails;
  };
  const position=()=>{
    if(disposed)return;
    const {highlights=[],avoid=[]}=options.getGeometry(),bounds=safeViewport(),visibleHighlights=highlights.filter(valid);
    const inline=options.getInlineHost?.();
    if(inline?.isConnected){if(root.parentElement!==inline)inline.prepend(root);root.classList.add('is-inline');}
    else {const host=options.host??document.body;if(root.parentElement!==host)host.append(root);root.classList.remove('is-inline');}
    const showFocus=!closed&&!inline?.isConnected&&visibleHighlights.length>0,width=window.innerWidth,height=window.innerHeight;
    focus.toggleAttribute('hidden',!showFocus);focus.setAttribute('viewBox',`0 0 ${width} ${height}`);
    if(showFocus){
      const holes=visibleHighlights.map(b=>{
        const pad=5,x=b.x-pad,y=b.y-pad,w=b.width+pad*2,h=b.height+pad*2;
        return `M${x} ${y}h${w}v${h}h${-w}Z`;
      });
      const path=[`M0 0H${width}V${height}H0Z`,...holes].join(' ');
      if(path!==lastFocusPath){focusPath.setAttribute('d',path);lastFocusPath=path;}
    }else if(lastFocusPath){focusPath.removeAttribute('d');lastFocusPath='';}
    const ringCount=closed?0:visibleHighlights.length;
    while(ringNodes.length>ringCount)ringNodes.pop()!.remove();
    for(let i=0;i<ringCount;i++){
      const b=visibleHighlights[i];let ring=ringNodes[i];
      if(!ring){ring=document.createElement('div');ring.className='novice-guide-ring';ring.dataset.noviceGuideHighlight='';ringNodes.push(ring);rings.append(ring);}
      Object.assign(ring.style,{left:'0',top:'0',transform:`translate3d(${b.x}px,${b.y}px,0)`,width:b.width+'px',height:b.height+'px'});
    }
    const quantize=(b:Box)=>[Math.round(b.x/8),Math.round(b.y/8),Math.round(b.width/8),Math.round(b.height/8)];
    const positionKey=JSON.stringify([revision,closed,!!inline?.isConnected,bounds,avoid.map(quantize),visibleHighlights.map(quantize)]);
    if(positionKey===lastPositionKey)return;
    const now=performance.now();if(revision===lastPositionRevision&&now-lastLayout<100)return;
    lastPositionKey=positionKey;lastLayout=now;lastPositionRevision=revision;
    const protectedAreas=[...avoid,...visibleHighlights],element=closed?reopenButton:panel;
    if(inline?.isConnected&&!closed){
      Object.assign(panel.style,{left:'',top:'',width:'',maxHeight:'',visibility:'visible'});
      return;
    }
    // Read the natural height at the likely width, then remeasure once if a narrow free region wraps the text.
    const desiredWidth=emphasis(step)==='action'?360:420;
    panel.classList.remove('is-compact');
    element.style.maxHeight='none';element.style.width=closed?'auto':Math.min(desiredWidth,bounds.width)+'px';
    let rect=element.getBoundingClientRect();
    let placement=placeNoviceGuide(bounds,protectedAreas,{width:closed?Math.max(88,rect.width):rect.width,height:Math.max(44,rect.height)},visibleHighlights[0]);
    if(placement&&!closed&&placement.width<rect.width-.5){
      element.style.width=placement.width+'px';rect=element.getBoundingClientRect();
      placement=placeNoviceGuide(bounds,protectedAreas,{width:placement.width,height:Math.max(44,rect.height)},visibleHighlights[0]);
    }
    if(placement&&!closed&&placement.height<rect.height-.5){
      panel.classList.add('is-compact');rect=element.getBoundingClientRect();
      placement=placeNoviceGuide(bounds,protectedAreas,{width:rect.width,height:Math.max(44,rect.height)},visibleHighlights[0]);
    }
    // If no 44px target can fit, do not place an invisible blocker on top of gameplay.
    positionedVisible=!!placement;element.style.visibility=placement?'visible':'hidden';
    if(!placement)return;
    Object.assign(element.style,{left:placement.x+'px',top:Math.max(bounds.y,Math.min(placement.y,bottom(bounds)-rect.height))+'px',width:placement.width+'px',maxHeight:'none'});
  };
  const schedule=()=>{if(disposed)return;if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;position();});};
  const setClosed=(next:boolean,notify:boolean)=>{
    if(disposed||closed===next)return;
    const focused=next?panel.contains(document.activeElement):document.activeElement===reopenButton;
    closed=next;revision++;panel.hidden=closed;reopenButton.hidden=!closed;position();
    if(focused)(closed?reopenButton:closeButton).focus({preventScroll:true});
    if(notify)(closed?options.onClose:options.onReopen)?.();
  };
  closeButton.onclick=()=>setClosed(true,true);
  reopenButton.onclick=()=>setClosed(false,true);
  skipButton.onclick=()=>{if(disposed)return;setClosed(true,false);options.onSkip?.();};
  detailsButton.onclick=()=>{
    if(disposed||closed||!step.details)return;
    options.onDetails?.();
  };
  actionButton.onclick=()=>{if(!disposed&&!closed)step.action?.run();};
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setClosed(true,true);}
  });
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{lastPositionKey='';revision++;schedule();});observer?.observe(panel);
  renderStep();position();
  return {
    update(next){if(disposed)return;step=next;revision++;renderStep();position();},
    refresh(){if(!disposed)position();},
    close(){setClosed(true,true);},
    reopen(){setClosed(false,true);},
    isVisible(){
      if(disposed||closed||panel.hidden||document.hidden||!panel.isConnected)return false;
      if(panel.hasAttribute('data-novice-drag-obscured'))return false;
      if(!root.classList.contains('is-inline'))return positionedVisible;
      const r=panel.getBoundingClientRect(),visual=window.visualViewport;
      if(r.width<=0||r.height<=0)return false;
      let left=visual?.offsetLeft??0,top=visual?.offsetTop??0,right=left+(visual?.width??innerWidth),bottom=top+(visual?.height??innerHeight);
      for(let node:HTMLElement|null=panel;node;node=node.parentElement){
        const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
        if(node===panel)continue;
        const b=node.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}
        if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
      }
      return r.left>=left-.5&&r.top>=top-.5&&r.right<=right+.5&&r.bottom<=bottom+.5;
    },
    unmount(){
      if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);
      closeButton.onclick=null;reopenButton.onclick=null;skipButton.onclick=null;detailsButton.onclick=null;actionButton.onclick=null;root.remove();
    },
  };
}
