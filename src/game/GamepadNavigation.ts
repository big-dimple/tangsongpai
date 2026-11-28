import type Phaser from 'phaser';
import {GamepadInput,controllerButtonLabels,type PadAction,type PadDirection} from '../platform/GamepadInput';
import {AudioEngine} from '../audio/AudioEngine';
import {cssViewport} from '../platform/Viewport';
import {nextControllerTarget,type FocusBox} from './ControllerFocus';
import {controllerScene,type ControllerAnchor,type ControllerSceneState,type ControllerTarget} from './ControllerScene';
import './GamepadNavigation.css';

interface Target extends ControllerTarget {element?:HTMLElement}
type BadgeRole='confirm'|'back'|'play'|'discard'|'shoulder'|'trigger'|'detail'|'menu';
interface BadgeSpec {role:BadgeRole;text:string;x:number;y:number;dim:boolean;}
interface PillItem {role:BadgeRole;key:string;text:string;}
const directions=new Set<string>(['left','right','up','down']);
const selector='button,input:not([type=hidden]),select,textarea,a[href],summary,[tabindex="0"]';

export function visibleControllerControl(element:HTMLElement):boolean {
  return !element.matches(':disabled')&&!element.closest('[hidden],[inert],[aria-hidden="true"]')&&
    element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
}

function visibleDomBox(element:HTMLElement):boolean {
  return !element.closest('[hidden],[inert],[aria-hidden="true"]')&&
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
  const ring=document.createElement('div'),glyphLayer=document.createElement('div'),cardPill=document.createElement('div');
  ring.className='controller-focus-ring';ring.setAttribute('aria-hidden','true');ring.hidden=true;
  glyphLayer.className='controller-glyph-layer';glyphLayer.setAttribute('aria-hidden','true');glyphLayer.hidden=true;
  cardPill.className='controller-card-pill';cardPill.setAttribute('aria-hidden','true');cardPill.hidden=true;
  let active=false,connected=false,pointerUsed=false,nativeOrdinal=0,context:object|undefined,focusId:string|undefined;
  let targets:Target[]=[],anchors:ControllerAnchor[]=[],sceneState:ControllerSceneState={};
  let scene:Phaser.Scene|undefined,modal:HTMLDialogElement|undefined;
  let refreshAt=0,destroyed=false,focusedElement:HTMLElement|undefined;
  let labels=controllerButtonLabels(''),lastPoll=0,lastBadgeKey='',lastPillKey='',lastPillPos='';
  let canvasBlur:(()=>void)|undefined;
  const showBadges=()=>connected&&(active||!pointerUsed);
  const setMode=(value:boolean)=>{
    if(value)pointerUsed=false;
    if(active===value)return;active=value;document.body.toggleAttribute('data-controller-active',value);
    if(!value){canvasBlur?.();canvasBlur=undefined;ring.hidden=true;cardPill.hidden=true;focusedElement?.removeAttribute('data-controller-focus');focusedElement=undefined;}
  };
  const setConnected=(value:boolean)=>{
    if(connected===value)return;connected=value;document.body.toggleAttribute('data-controller-connected',value);
    if(value)pointerUsed=false;else{setMode(false);glyphLayer.hidden=true;cardPill.hidden=true;lastBadgeKey='';lastPillKey='';}
    refreshAt=0;
  };
  const clearFocus=()=>{canvasBlur?.();canvasBlur=undefined;focusedElement?.removeAttribute('data-controller-focus');focusedElement=undefined;ring.hidden=true;};
  const mapCanvasBox=(box:FocusBox):FocusBox=>{
    if(!scene)return box;
    const viewport=cssViewport(scene),r=game.canvas.getBoundingClientRect();
    return {x:r.x+box.x*r.width/viewport.width,y:r.y+box.y*r.height/viewport.height,width:box.width*r.width/viewport.width,height:box.height*r.height/viewport.height};
  };
  const refresh=()=>{
    modal=[...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
    scene=[...game.scene.getScenes(true)].reverse().find(candidate=>controllerScene(candidate));
    const provider=scene?controllerScene(scene):undefined;
    const nextContext=modal??scene??game,contextChanged=context!==nextContext;
    if(contextChanged){clearFocus();context=nextContext;focusId=remembered.get(context);}
    const parent=modal??document.body;
    if(ring.parentElement!==parent)parent.append(ring);
    if(glyphLayer.parentElement!==parent)parent.append(glyphLayer);
    if(cardPill.parentElement!==parent)parent.append(cardPill);
    const root=modal??document.body;
    const shopCardModal=!!modal&&['purchase','sale','held'].includes(modal.dataset.shopContext??'');
    const controls=[...root.querySelectorAll<HTMLElement>(selector)].filter(element=>visibleControllerControl(element)&&
      (modal||!element.closest('dialog,.run-menu,.hand-input-surface,.shop-owned-input'))&&
      !element.hasAttribute('data-pc-keyboard-action')&&!element.hasAttribute('data-controller-skip')&&
      !(shopCardModal&&(element.matches('.dialog-art-original,.dialog-card-zoom-trigger')||!!element.closest('.card-rules')))&&
      element!==game.canvas);
    const native=controls.map((element):Target=>{
      let identity=nativeIdentities.get(element);if(!identity){identity=`dom/${++nativeOrdinal}/${element.getAttribute('aria-label')??element.textContent?.trim().slice(0,80)??element.tagName}`;nativeIdentities.set(element,identity);}
      const r=element.getBoundingClientRect(),id=element.dataset.ui??identity;
      return {id,element,box:{x:r.x,y:r.y,width:r.width,height:r.height},primary:element.classList.contains('dialog-primary')||element.classList.contains('home-primary'),
        activate:()=>{if(visibleControllerControl(element)){if(!adjustControllerControl(element,1))element.click();}},
        focus:()=>{element.focus({preventScroll:true});element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}};
    });
    const nativeIds=new Set(native.map(target=>target.id));
    const canvas:Target[]=modal||!scene?[]:(provider?.targets()??[]).filter(target=>!nativeIds.has(`${scene!.sys.settings.key}/${target.id}`)).map(target=>({...target,box:mapCanvasBox(target.box)}));
    anchors=modal||!scene?[]:(provider?.anchors?.()??[]).map(anchor=>({...anchor,box:mapCanvasBox(anchor.box)}));
    sceneState=modal||!scene?{}:(provider?.state?.()??{});
    targets=[...canvas,...native];
    // A saved hand's animation temporarily disables its targets. Keep the hand focus until it settles.
    if((modal||!provider?.busy?.())&&!targets.some(target=>target.id===focusId)){
      if(modal){
        const initial=targets.find(target=>target.primary)
          ||(modal.dataset.shopContext==='held'?targets.find(target=>target.element?.textContent?.trim()==='出售'):undefined)
          ||targets.find(target=>!target.element?.classList.contains('dialog-close'))
          ||targets[0];
        focusId=initial?.id;
        if(active&&initial){
          clearFocus();
          if(initial.element){focusedElement=initial.element;focusedElement.setAttribute('data-controller-focus','');}
          initial.focus?.();
        }
      }else{
        const nativeFocus=native.find(target=>target.element===document.activeElement);
        focusId=(nativeFocus??targets.find(target=>target.id.startsWith('card/'))??targets.find(target=>target.id.startsWith('character/'))??targets.find(target=>target.id.startsWith('offer/')||target.id.startsWith('shop/offer/'))??targets.find(target=>target.primary)??targets[0])?.id;
        if(contextChanged&&active&&focusId){
          const initial=targets.find(target=>target.id===focusId);
          if(initial?.element){focusedElement=initial.element;focusedElement.setAttribute('data-controller-focus','');initial.focus?.();}
          else if(initial){game.canvas.focus({preventScroll:true});initial.focus?.();}
        }
      }
    }
    if(context&&focusId)remembered.set(context,focusId);
  };
  const computeBadges=():BadgeSpec[]=>{
    if(!showBadges())return [];
    const list:BadgeSpec[]=[],vw=window.innerWidth,vh=window.innerHeight;
    const place=(box:FocusBox,corner:'tr'|'tl'|'br'|'bl')=>{
      const rawX=corner.endsWith('l')?box.x+3:box.x+box.width-3,rawY=corner.startsWith('b')?box.y+box.height-3:box.y+3;
      return {x:Math.round(Math.max(14,Math.min(vw-14,rawX))),y:Math.round(Math.max(12,Math.min(vh-12,rawY)))};
    };
    const pushDom=(element:HTMLElement|null|undefined,role:BadgeRole,text:string,corner:'tr'|'tl'|'br'|'bl')=>{
      if(!element||!visibleDomBox(element))return;
      const r=element.getBoundingClientRect();
      if(r.width<=0||r.height<=0)return;
      list.push({role,text,...place({x:r.x,y:r.y,width:r.width,height:r.height},corner),dim:element.matches(':disabled')});
    };
    const pushAnchor=(anchor:ControllerAnchor|undefined,role:BadgeRole,text:string,corner:'tr'|'tl'|'br'|'bl')=>{
      if(!anchor)return;
      list.push({role,text,...place(anchor.box,corner),dim:!anchor.enabled});
    };
    const firstVisible=(root:ParentNode,sel:string)=>[...root.querySelectorAll<HTMLElement>(sel)].find(visibleDomBox);
    if(modal){
      const closeEl=firstVisible(modal,'.dialog-close');
      const focusedEl=active?targets.find(candidate=>candidate.id===focusId)?.element:undefined;
      const confirmEl=focusedEl&&focusedEl!==closeEl&&!focusedEl.classList.contains('dialog-close')
        ?focusedEl
        :firstVisible(modal,'.dialog-primary');
      pushDom(confirmEl,'confirm',labels.confirm,'tr');
      pushDom(closeEl,'back',labels.back,'tr');
      return list;
    }
    pushDom(firstVisible(document,'.run-menu-toggle'),'menu',labels.menuShort,'tl');
    const key=scene?.sys.settings.key;
    if(key==='game'){
      pushAnchor(anchors.find(a=>a.id==='action/skip-score')??anchors.find(a=>a.id==='action/play'),'play',labels.play,'tr');
      pushAnchor(anchors.find(a=>a.id==='action/discard'),'discard',labels.discard,'tr');
      const clearAnchor=anchors.find(a=>a.id==='action/clear-hand');
      if(clearAnchor?.enabled)pushAnchor(clearAnchor,'back',labels.back,'tr');
      pushAnchor(anchors.find(a=>a.id==='action/sort-rank'),'trigger',labels.lt,'bl');
      pushAnchor(anchors.find(a=>a.id==='action/sort-suit'),'trigger',labels.rt,'br');
    }else if(key==='shop'){
      pushAnchor(anchors.find(a=>a.id==='action/shelf-jokers'),'shoulder',labels.lb,'tl');
      pushAnchor(anchors.find(a=>a.id==='action/shelf-items'),'shoulder',labels.rb,'tr');
      pushAnchor(anchors.find(a=>a.id==='action/reroll'),'discard',labels.discard,'tl');
      pushAnchor(anchors.find(a=>a.id==='action/start-stage'),'play',labels.play,'tr');
      if(focusId?.startsWith('offer/')){
        const buyAnchor=anchors.find(a=>a.id==='action/buy-offer/'+focusId!.slice(6));
        if(buyAnchor)pushAnchor(buyAnchor,'confirm',labels.confirm,'tr');
        else{
          const focusedOffer=targets.find(candidate=>candidate.id===focusId&&!candidate.element);
          if(focusedOffer)list.push({role:'confirm',text:labels.confirm,...place(focusedOffer.box,'tr'),dim:false});
        }
      }else if(focusId?.startsWith('shop/offer/')){
        const focusedEl=targets.find(candidate=>candidate.id===focusId)?.element;
        pushDom(focusedEl,'confirm',labels.confirm,'tr');
      }
    }else if(key==='character-select'){
      pushAnchor(anchors.find(a=>a.id==='action/cancel-character'),'back',labels.back,'tl');
      pushAnchor(anchors.find(a=>a.id==='action/confirm-character'),'play',labels.play,'tr');
    }else if(key==='intermission'){
      pushAnchor(anchors.find(a=>a.primary),'play',labels.play,'tr');
    }else if(key==='title'||!key){
      pushDom(firstVisible(document,'.home-primary'),'confirm',labels.confirm,'tr');
    }
    return list;
  };
  const paintBadges=()=>{
    const badges=computeBadges();
    if(!badges.length){if(!glyphLayer.hidden){glyphLayer.hidden=true;lastBadgeKey='';}return;}
    const key=labels.style+'|'+badges.map(b=>`${b.role},${b.text},${b.x},${b.y},${b.dim?1:0}`).join(';');
    if(key!==lastBadgeKey){
      lastBadgeKey=key;
      glyphLayer.dataset.padStyle=labels.style;
      while(glyphLayer.children.length<badges.length){const span=document.createElement('span');glyphLayer.append(span);}
      while(glyphLayer.children.length>badges.length)glyphLayer.lastElementChild?.remove();
      badges.forEach((b,index)=>{
        const el=glyphLayer.children[index] as HTMLSpanElement;
        el.className='controller-badge'+(b.dim?' is-dim':'');
        el.dataset.role=b.role;
        if(el.textContent!==b.text)el.textContent=b.text;
        el.style.left=b.x+'px';
        el.style.top=b.y+'px';
      });
    }
    glyphLayer.hidden=false;
  };
  const paintCardPill=(target:Target|undefined)=>{
    if(!active||modal||!target||target.element||(!target.id.startsWith('card/')&&!target.id.startsWith('joker/'))){
      if(!cardPill.hidden){cardPill.hidden=true;lastPillKey='';lastPillPos='';}
      return;
    }
    const items:PillItem[]=[];
    if(target.id.startsWith('card/')){
      const isSelected=!!sceneState.selectedIds?.has(target.id.slice(5)),selectedCount=sceneState.selectedCount??0;
      items.push({role:'confirm',key:labels.confirm,text:isSelected?'放下':'选牌'});
      if(selectedCount>0)items.push({role:'back',key:labels.back,text:window.innerWidth<460?'全放':'全部放下'});
      items.push({role:'shoulder',key:labels.shoulders,text:'移位'});
      if(window.innerWidth>=600)items.push({role:'detail',key:labels.detailShort,text:'详情'});
    }else{
      items.push({role:'confirm',key:labels.confirm,text:'详情'});
      items.push({role:'shoulder',key:labels.shoulders,text:'调序'});
    }
    const contentKey=labels.style+'|'+items.map(i=>`${i.role}:${i.key}:${i.text}`).join('|');
    if(contentKey!==lastPillKey){
      lastPillKey=contentKey;
      cardPill.dataset.padStyle=labels.style;
      cardPill.textContent='';
      for(const item of items){
        const group=document.createElement('span');group.className='controller-card-pill-item';
        const badge=document.createElement('span');badge.className='controller-badge is-inline';badge.dataset.role=item.role;badge.textContent=item.key;
        const caption=document.createElement('span');caption.textContent=item.text;
        group.append(badge,caption);cardPill.append(group);
      }
    }
    cardPill.hidden=false;
    const halfW=(cardPill.offsetWidth||160)/2;
    const left=Math.round(Math.max(halfW+8,Math.min(window.innerWidth-halfW-8,target.box.x+target.box.width/2)));
    const top=Math.round(Math.max(30,target.box.y-10));
    const pos=`${left},${top}`;
    if(pos!==lastPillPos){lastPillPos=pos;cardPill.style.left=left+'px';cardPill.style.top=top+'px';}
  };
  const focus=(target:Target|undefined)=>{
    const glide=active&&!ring.hidden&&!!target&&!target.element;
    clearFocus();if(!target)return;focusId=target.id;if(context)remembered.set(context,focusId);
    if(target.element){focusedElement=target.element;focusedElement.setAttribute('data-controller-focus','');}
    else {game.canvas.focus({preventScroll:true});canvasBlur=target.blur;}
    target.focus?.();paint(glide);
  };
  const paint=(glide=true)=>{
    const target=targets.find(candidate=>candidate.id===focusId);
    ring.dataset.targetId=focusId??'';
    const showRing=active&&!!target&&!target.element;
    if(!showRing){ring.hidden=true;}
    else{
      const snap=!glide||ring.hidden;
      ring.classList.toggle('is-snap',snap);
      Object.assign(ring.style,{left:target.box.x+'px',top:target.box.y+'px',width:target.box.width+'px',height:target.box.height+'px'});
      ring.hidden=false;
      if(snap)requestAnimationFrame(()=>{if(!destroyed)ring.classList.remove('is-snap');});
    }
    if(active&&target?.element&&focusedElement!==target.element){focusedElement?.removeAttribute('data-controller-focus');focusedElement=target.element;focusedElement.setAttribute('data-controller-focus','');}
    paintBadges();
    paintCardPill(target);
    if(Array.isArray(game.registry.get('uiDiagnostics')))game.registry.set('controllerNavigation',{focusId,scene:scene?.sys.settings.key,modal:!!modal,targets:targets.map(({id,box,primary})=>({id,box,primary}))});
  };
  const back=()=>{
    if(!modal)return false;
    const button=modal.querySelector<HTMLButtonElement>('.dialog-close');
    if(button){if(!button.disabled)button.click();return true;}
    const event=new Event('cancel',{cancelable:true});if(modal.dispatchEvent(event))modal.close();return true;
  };
  const menu=()=>window.dispatchEvent(new Event('tangsongpai-controller-menu'));
  const playFocusTick=(previousFocus:string|undefined)=>{if(focusId&&focusId!==previousFocus)AudioEngine.shared.hoverTick();};
  const dispatch=(action:PadAction)=>{
    refresh();const previousFocus=focusId,target=targets.find(candidate=>candidate.id===focusId);
    if(action==='menu'){if(!modal||modal.classList.contains('run-menu-modal'))menu();return;}
    const handled=!modal&&scene?controllerScene(scene)?.action?.(action,focusId):false;
    if(handled){
      if(typeof handled==='string'){refresh();focus(targets.find(candidate=>candidate.id===handled));playFocusTick(previousFocus);}
      return;
    }
    if(directions.has(action)){
      if((action==='left'||action==='right')&&target?.element&&adjustControllerControl(target.element,action==='left'?-1:1))return;
      focus(nextControllerTarget(targets,focusId,action as PadDirection));playFocusTick(previousFocus);return;
    }
    if(modal){
      if(action==='back'){back();return;}
      if(action==='confirm')focus(target),target?.activate();
      else if(action==='detail'){
        const rules=modal.querySelector<HTMLDetailsElement>('.card-rules');
        if(rules){rules.open=!rules.open;if(rules.open)rules.scrollIntoView({block:'nearest',behavior:'instant'});}
      }
      else if(action==='previous'||action==='next'){
        const index=targets.findIndex(candidate=>candidate.id===focusId);
        if(targets.length){focus(targets[(index+(action==='previous'?-1:1)+targets.length)%targets.length]);playFocusTick(previousFocus);}
      }
      return; // Shortcuts never reach a covered scene.
    }
    if(action==='confirm'){focus(target);target?.activate();}
    else if(action==='detail')target?.detail?.();
    else if(action==='previous'||action==='next'){
      const index=targets.findIndex(candidate=>candidate.id===focusId);
      if(targets.length){focus(targets[(index+(action==='previous'?-1:1)+targets.length)%targets.length]);playFocusTick(previousFocus);}
    }
    else {
      const id=({'play':'action/play','discard':'action/discard','sort-rank':'action/sort-rank','sort-suit':'action/sort-suit'} as Partial<Record<PadAction,string>>)[action];
      if(id)targets.find(candidate=>candidate.id===id)?.activate();
    }
  };
  const interrupt=()=>{input.reset();clearFocus();};
  const nativeInput=(event:Event)=>{
    if(event.isTrusted){
      pointerUsed=true;input.reset();setMode(false);
      glyphLayer.hidden=true;cardPill.hidden=true;lastBadgeKey='';lastPillKey='';
      if(context)remembered.delete(context);focusId=undefined;
    }
  };
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
      const scrollSelector='.dialog-scroll,.run-menu-panel,.shop-mobile-offers,.blind-select-dialog > .dialog-content,.tool-workspace';
      const scroller=target?.closest(scrollSelector)??modal?.querySelector(scrollSelector);
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
    setConnected(false);setMode(false);clearFocus();ring.remove();glyphLayer.remove();cardPill.remove();
  };
  game.events.once('destroy',dispose);return dispose;
}
