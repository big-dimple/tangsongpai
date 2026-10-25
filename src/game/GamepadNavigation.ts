import type Phaser from 'phaser';
import {GamepadInput,controllerButtonLabels,type PadAction,type PadDirection} from '../platform/GamepadInput';
import {AudioEngine} from '../audio/AudioEngine';
import {cssViewport} from '../platform/Viewport';
import {nextControllerTarget} from './ControllerFocus';
import {controllerScene,type ControllerTarget} from './ControllerScene';
import './GamepadNavigation.css';

interface Target extends ControllerTarget {element?:HTMLElement}
const directions=new Set<string>(['left','right','up','down']);
const selector='button,input:not([type=hidden]),select,textarea,a[href],summary,[tabindex="0"]';

export function visibleControllerControl(element:HTMLElement):boolean {
  return !element.matches(':disabled')&&!element.closest('[hidden],[inert],[aria-hidden="true"]')&&
    element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
}

/** A select/range remains operable without opening a platform picker that the pad cannot drive. */
export function adjustControllerControl(element:HTMLElement,delta:-1|1):boolean {
  if(element instanceof HTMLSelectElement){
    const options=[...element.options].filter(option=>!option.disabled&&!option.parentElement?.matches('optgroup:disabled'));
    const index=options.findIndex(option=>option.index===element.selectedIndex),next=options[Math.max(0,Math.min(options.length-1,index+delta))];
    if(next&&next.index!==element.selectedIndex){element.selectedIndex=next.index;element.dispatchEvent(new Event('change',{bubbles:true}));}
    return true;
  }
  if(element instanceof HTMLInputElement&&element.type==='range'){
    if(delta<0)element.stepDown();else element.stepUp();
    element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  return false;
}

/** Polls real devices; scene actions reuse the same guarded callbacks as mouse/touch. */
export function installGamepadNavigation(game:Phaser.Game):()=>void {
  const input=new GamepadInput(),remembered=new WeakMap<object,string>(),nativeIdentities=new WeakMap<HTMLElement,string>();
  const ring=document.createElement('div'),hint=document.createElement('div');
  ring.className='controller-focus-ring';ring.setAttribute('aria-hidden','true');ring.hidden=true;
  hint.className='controller-hints';hint.setAttribute('aria-label','手柄操作');hint.hidden=true;
  let active=false,connected=false,nativeOrdinal=0,context:object|undefined,focusId:string|undefined,targets:Target[]=[],scene:Phaser.Scene|undefined,modal:HTMLDialogElement|undefined;
  let refreshAt=0,destroyed=false,focusedElement:HTMLElement|undefined;
  let labels=controllerButtonLabels(''),lastPoll=0;
  let canvasBlur:(()=>void)|undefined;
  const setMode=(value:boolean)=>{
    if(active===value)return;active=value;document.body.toggleAttribute('data-controller-active',value);
    if(!value){canvasBlur?.();canvasBlur=undefined;ring.hidden=true;focusedElement?.removeAttribute('data-controller-focus');focusedElement=undefined;}
  };
  const setConnected=(value:boolean)=>{if(connected===value)return;connected=value;document.body.toggleAttribute('data-controller-connected',value);hint.hidden=!value;refreshAt=0;if(!value)setMode(false);};
  const clearFocus=()=>{canvasBlur?.();canvasBlur=undefined;focusedElement?.removeAttribute('data-controller-focus');focusedElement=undefined;ring.hidden=true;};
  const refresh=()=>{
    modal=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
    scene=[...game.scene.getScenes(true)].reverse().find(candidate=>controllerScene(candidate));
    const provider=scene?controllerScene(scene):undefined;
    const nextContext=modal??scene??game;
    if(context!==nextContext){clearFocus();context=nextContext;focusId=remembered.get(context);}
    const parent=modal??document.body;
    if(ring.parentElement!==parent)parent.append(ring);if(hint.parentElement!==parent)parent.append(hint);
    const root=modal??document.body;
    const controls=[...root.querySelectorAll<HTMLElement>(selector)].filter(element=>visibleControllerControl(element)&&
      (modal||!element.closest('dialog,.run-menu,.hand-input-surface,.shop-owned-input'))&&element!==game.canvas);
    const native=controls.map((element):Target=>{
      let identity=nativeIdentities.get(element);if(!identity){identity=`dom/${++nativeOrdinal}/${element.getAttribute('aria-label')??element.textContent?.trim().slice(0,80)??element.tagName}`;nativeIdentities.set(element,identity);}
      const r=element.getBoundingClientRect(),id=element.dataset.ui??identity;
      return {id,element,box:{x:r.x,y:r.y,width:r.width,height:r.height},primary:element.classList.contains('dialog-primary')||element.classList.contains('home-primary'),
        activate:()=>{if(visibleControllerControl(element)){if(!adjustControllerControl(element,1))element.click();}},
        focus:()=>{element.focus({preventScroll:true});element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}};
    });
    const nativeIds=new Set(native.map(target=>target.id));
    const canvas:Target[]=modal||!scene?[]:(provider?.targets()??[]).filter(target=>!nativeIds.has(`${scene!.sys.settings.key}/${target.id}`)).map(target=>{
      const viewport=cssViewport(scene!),r=game.canvas.getBoundingClientRect(),b=target.box;
      return {...target,box:{x:r.x+b.x*r.width/viewport.width,y:r.y+b.y*r.height/viewport.height,width:b.width*r.width/viewport.width,height:b.height*r.height/viewport.height}};
    });
    targets=[...canvas,...native];
    // A saved hand's animation temporarily disables its targets. Keep the hand focus until it settles.
    if((modal||!provider?.busy?.())&&!targets.some(target=>target.id===focusId)){
      const nativeFocus=native.find(target=>target.element===document.activeElement);
      focusId=(nativeFocus??targets.find(target=>target.id.startsWith('card/'))??targets.find(target=>target.id.startsWith('character/'))??targets.find(target=>target.primary)??targets[0])?.id;
    }
    if(context&&focusId)remembered.set(context,focusId);
    hint.hidden=!connected;
    const table=!modal&&scene?.sys.settings.key==='game';
    const text=table?`✚ 移动 · ${labels.confirm} 选牌 · ${labels.back} 取消 · ${labels.play} 出牌 · ${labels.discard} 弃牌 · ${labels.shoulders} 调序 · ${labels.triggers} 整理 · ${labels.detail} 详情 · ${labels.menu} 菜单`:
      `✚ 移动 · ${labels.confirm} 确认 · ${labels.back} 返回 · 左右 调整选项 · 右摇杆 滚动 · ${labels.menu} 菜单`;
    if(hint.textContent!==text)hint.textContent=text;
  };
  const focus=(target:Target|undefined)=>{
    clearFocus();if(!target)return;focusId=target.id;if(context)remembered.set(context,focusId);
    if(target.element){focusedElement=target.element;focusedElement.setAttribute('data-controller-focus','');}
    else {game.canvas.focus({preventScroll:true});canvasBlur=target.blur;}
    target.focus?.();paint();
  };
  const paint=()=>{
    const target=targets.find(candidate=>candidate.id===focusId);
    ring.dataset.targetId=focusId??'';
    ring.hidden=!active||!target||!!target.element;
    if(!ring.hidden&&target)Object.assign(ring.style,{left:target.box.x+'px',top:target.box.y+'px',width:target.box.width+'px',height:target.box.height+'px'});
    if(active&&target?.element&&focusedElement!==target.element){focusedElement?.removeAttribute('data-controller-focus');focusedElement=target.element;focusedElement.setAttribute('data-controller-focus','');}
    if(Array.isArray(game.registry.get('uiDiagnostics')))game.registry.set('controllerNavigation',{focusId,scene:scene?.sys.settings.key,modal:!!modal,targets:targets.map(({id,box,primary})=>({id,box,primary}))});
  };
  const back=()=>{
    if(!modal)return false;
    const button=modal.querySelector<HTMLButtonElement>('.dialog-close');
    if(button){if(!button.disabled)button.click();return true;}
    const event=new Event('cancel',{cancelable:true});if(modal.dispatchEvent(event))modal.close();return true;
  };
  const menu=()=>window.dispatchEvent(new Event('tangsongpai-controller-menu'));
  const dispatch=(action:PadAction)=>{
    refresh();const target=targets.find(candidate=>candidate.id===focusId);
    if(action==='menu'){if(!modal||modal.classList.contains('run-menu-modal'))menu();return;}
    const handled=!modal&&scene?controllerScene(scene)?.action?.(action,focusId):false;
    if(handled){if(typeof handled==='string'){refresh();focus(targets.find(candidate=>candidate.id===handled));}return;}
    if(directions.has(action)){
      if((action==='left'||action==='right')&&target?.element&&adjustControllerControl(target.element,action==='left'?-1:1))return;
      focus(nextControllerTarget(targets,focusId,action as PadDirection));return;
    }
    if(modal){
      if(action==='back'){back();return;}
      if(action==='confirm')focus(target),target?.activate();
      else if(action==='previous'||action==='next'){
        const index=targets.findIndex(candidate=>candidate.id===focusId);focus(targets[(index+(action==='previous'?-1:1)+targets.length)%targets.length]);
      }
      return; // Shortcuts never reach a covered scene.
    }
    if(action==='back'){menu();return;}
    if(action==='confirm'){focus(target);target?.activate();}
    else if(action==='detail')target?.detail?.();
    else if(action==='previous'||action==='next'){
      const index=targets.findIndex(candidate=>candidate.id===focusId);focus(targets[(index+(action==='previous'?-1:1)+targets.length)%targets.length]);
    }
    else {
      const id=({'play':'action/play','discard':'action/discard','sort-rank':'action/sort-rank','sort-suit':'action/sort-suit'} as Partial<Record<PadAction,string>>)[action];
      if(id)targets.find(candidate=>candidate.id===id)?.activate();
    }
  };
  const interrupt=()=>{input.reset();clearFocus();};
  const nativeInput=(event:Event)=>{if(event.isTrusted){input.reset();setMode(false);if(context)remembered.delete(context);focusId=undefined;}};
  const poll=()=>{
    if(destroyed)return;
    if(document.hidden||!document.hasFocus()){interrupt();return;}
    let pads:(Gamepad|null)[];
    try{pads=Array.from(navigator.getGamepads?.()??[]);}catch{input.reset();setConnected(false);return;}
    const pad=pads.find(candidate=>candidate?.connected&&candidate.mapping==='standard')??undefined;
    if(!pad){input.reset();setConnected(false);return;}
    setConnected(true);
    const now=performance.now(),elapsed=Math.min(50,lastPoll?now-lastPoll:16);lastPoll=now;labels=controllerButtonLabels(pad.id);const action=input.sample(pad,now);
    if(action){
      setMode(true);window.dispatchEvent(new Event('tangsongpai-controller-input'));
      // Some browsers allow a pad gesture to unlock audio; preserve the normal click-to-unlock fallback.
      if(AudioEngine.shared.needsGestureUnlock)void AudioEngine.shared.unlock();
      dispatch(action);refreshAt=0;
    }
    if(now>=refreshAt){refresh();paint();refreshAt=now+80;}
    const scroll=pad.axes[3]??0;
    if(active&&input.ready&&Math.abs(scroll)>.35){
      const target=targets.find(candidate=>candidate.id===focusId)?.element;
      const scroller=target?.closest('.dialog-scroll,.run-menu-panel,.shop-mobile-offers')??modal?.querySelector('.dialog-scroll,.run-menu-panel');
      if(scroller)scroller.scrollTop+=scroll*elapsed*.7;
      else if(!modal&&scene)controllerScene(scene)?.scroll?.(scroll*elapsed*.7);
    }
  };
  window.addEventListener('blur',interrupt);document.addEventListener('visibilitychange',interrupt);
  window.addEventListener('pointerdown',nativeInput,true);window.addEventListener('keydown',nativeInput,true);
  game.events.on('poststep',poll);
  const dispose=()=>{
    if(destroyed)return;destroyed=true;game.events.off('poststep',poll);game.events.off('destroy',dispose);
    window.removeEventListener('blur',interrupt);document.removeEventListener('visibilitychange',interrupt);
    window.removeEventListener('pointerdown',nativeInput,true);window.removeEventListener('keydown',nativeInput,true);
    setConnected(false);setMode(false);clearFocus();ring.remove();hint.remove();
  };
  game.events.once('destroy',dispose);return dispose;
}
