import {afterEach,expect,it,vi} from 'vitest';
import {installRunMenu} from '../src/game/RunMenu';
import {showCatalog} from '../src/game/CatalogDialog';
import type {SavedRun} from '../src/application/SavedRun';
const {audio,fullscreen}=vi.hoisted(()=>({audio:{setVolume:vi.fn(),getVolume:()=>.5,select:vi.fn(),cancel:vi.fn(),unlock:vi.fn().mockResolvedValue(undefined)},fullscreen:{subscribe:vi.fn((fn:Function)=>{fn({active:false,pending:false,message:''});return ()=>{};}),dispose:vi.fn(),toggle:vi.fn().mockResolvedValue(undefined),getState:()=>({message:''})}}));
let notify:()=>void=()=>{};
const session={loaded:true,working:false,storageUnavailable:false,lease:{writable:false,elsewhere:false},notice:'',run:undefined as SavedRun|undefined,pendingRun:undefined as SavedRun|undefined,speed:1,reducedMotion:false,subscribe:(fn:()=>void)=>{notify=fn;return ()=>{};},preferences:vi.fn(),initialize:vi.fn().mockResolvedValue(undefined),retry:vi.fn().mockResolvedValue(true),cancelPending:vi.fn().mockImplementation(()=>{session.pendingRun=undefined;return true;}),takeOver:vi.fn().mockImplementation(async()=>{session.lease.writable=true;if(session.run)session.run.status='idle';return true;})};
vi.mock('../src/game/session',()=>({gameSession:()=>session}));
vi.mock('../src/game/LoadingScreen',()=>({prepareDestination:vi.fn().mockResolvedValue(true)}));
vi.mock('../src/game/DetailDialog',()=>({DetailDialog:class{close(){}}}));
vi.mock('../src/game/CatalogDialog',()=>({showCatalog:vi.fn()}));
vi.mock('../src/audio/AudioEngine',()=>({AudioEngine:{shared:audio}}));
vi.mock('../src/haptics/Haptics',()=>({Haptics:{shared:{stop:vi.fn(),dispose:vi.fn()}}}));
vi.mock('../src/haptics/HapticSetting',()=>({installHapticSetting:()=>()=>{}}));
vi.mock('../src/platform/Fullscreen',()=>({installFullscreen:()=>fullscreen}));
class Element extends EventTarget {
 children:Element[]=[];parentElement?:Element;className='';textContent='';hidden=false;disabled=false;open=false;scrollTop=0;isConnected=true;onclick?:()=>void;attrs=new Map<string,string>();dataset:Record<string,string>={};type='';value='';checked=false;oninput?:()=>void;onchange?:()=>void;
 classList={toggle:(_name:string,_value:boolean)=>{},contains:()=>false};
 constructor(readonly tagName:string){super();}
 append(...items:Element[]){for(const x of items){x.remove();x.parentElement=this;this.children.push(x);}}
 prepend(x:Element){x.remove();x.parentElement=this;this.children.unshift(x);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=undefined;}
 setAttribute(k:string,v:string){this.attrs.set(k,v);}removeAttribute(k:string){this.attrs.delete(k);}
 getBoundingClientRect(){return this.className==='run-menu-panel'?{left:620,right:980,top:64,bottom:500}:this.className==='run-menu-toggle'?{left:936,right:980,top:12,bottom:56}:{left:0,right:10,top:0,bottom:10};}
 closest(){return null;}focus(){const previous=dom.activeElement;if(previous)fire(dom,'focusout',{target:previous,relatedTarget:this});dom.activeElement=this;fire(dom,'focusin',{target:this,relatedTarget:previous});}click(){if(!this.disabled)this.onclick?.();}
 showModal(){this.open=true;(walk(this,e=>e.tagName==='button'&&!e.disabled&&!e.hidden)??this).focus();}close(){this.open=false;this.dispatchEvent(new Event('close'));}
}
let dom:EventTarget&{querySelectorAll:(selector:string)=>Element[];body:Element;activeElement:Element|undefined;createElement:(tag:string)=>Element;createTextNode:(text:string)=>Element};
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
function fire(surface:EventTarget,type:string,props:Record<string,unknown>={}){const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(props))Object.defineProperty(event,key,{value});surface.dispatchEvent(event);return event;}
class Media extends EventTarget {constructor(public matches:boolean){super();}set(value:boolean){this.matches=value;this.dispatchEvent(new Event('change'));}}
const all=(e:Element):Element[]=>[e,...e.children.flatMap(all)];
const walk=(e:Element,accept:(e:Element)=>boolean):Element|undefined=>accept(e)?e:e.children.map(x=>walk(x,accept)).find(Boolean);
function mount(pointer?:{primary:boolean;any:boolean;coarse:boolean}){
 const media={primary:new Media(pointer?.primary??false),any:new Media(pointer?.any??false),coarse:new Media(pointer?.coarse??false)};if(pointer)vi.stubGlobal('matchMedia',(query:string)=>query.includes('any-pointer: coarse')?media.coarse:query.includes('any-hover')?media.any:media.primary);
 session.notice='';session.storageUnavailable=false;session.working=false;session.loaded=true;session.run=undefined;session.pendingRun=undefined;session.lease.writable=false;vi.clearAllMocks();
 dom=Object.assign(new EventTarget(),{querySelectorAll:()=>all(dom.body).filter(e=>e.tagName==='dialog'&&e.open),body:new Element('body'),activeElement:undefined,createElement:(tag:string)=>new Element(tag),createTextNode:(text:string)=>{const e=new Element('text');e.textContent=text;return e;}});
 vi.stubGlobal('document',dom);vi.stubGlobal('HTMLElement',Element);
 let activeScene='game';const events={on:vi.fn(),off:vi.fn(),once:vi.fn()},actions={viewDeck:vi.fn(),viewRules:vi.fn(),viewLastHand:vi.fn()},game={events,canvas:new Element('canvas'),input:{enabled:true},scene:{stop:vi.fn(),start:vi.fn((key:string)=>{activeScene=key;}),isActive:()=>true,getScenes:()=>[{sys:{settings:{key:activeScene}}}]},registry:{events,get:(key:string)=>key==='runController'?session.run:undefined,set:vi.fn(),remove:vi.fn()}};
 installRunMenu(game as never,()=>actions);
 const host=dom.body.children[0],button=host.children.find(x=>x.className==='run-menu-toggle')!,modal=host.children.find(x=>x.tagName==='dialog')!;
 return {host,button,modal,game,actions,media,setScene:(key:string)=>{activeScene=key;},step:()=>events.on.mock.calls.find(c=>c[0]==='poststep')?.[1](),destroy:()=>events.once.mock.calls.find(c=>c[0]==='destroy')?.[1](),find:(text:string)=>walk(modal,e=>e.tagName==='button'&&e.textContent===text)!};
}
it('one fixed arrow repeatedly opens/closes the same panel and Escape restores its focus',()=>{
 const {host,button,modal}=mount();const caption=button.children.find(e=>e.className==='run-menu-caption')!;expect(caption.textContent).toBe('菜单');expect(button.tagName).toBe('button');expect(button.children[0].textContent).toBe('‹');expect(host.children).toContain(button);expect(button.attrs.get('aria-label')).toBe('展开菜单');
 for(let i=0;i<6;i++){notify();button.click();expect(modal.open).toBe(true);expect(caption.textContent).toBe('收起');expect(button.attrs.get('aria-expanded')).toBe('true');expect(button.attrs.get('aria-label')).toBe('收起菜单');expect(modal.children).toContain(button);button.click();expect(modal.open).toBe(false);expect(caption.textContent).toBe('菜单');expect(button.attrs.get('aria-expanded')).toBe('false');expect(button.attrs.get('aria-label')).toBe('展开菜单');expect(host.children).toContain(button);expect(button.hidden).toBe(false);}
 button.focus();button.click();modal.dispatchEvent(new Event('cancel',{cancelable:true}));expect(modal.open).toBe(false);expect(dom.activeElement).toBe(button);expect(button.attrs.get('aria-expanded')).toBe('false');
 session.notice='存储暂时不可用';session.storageUnavailable=true;notify();expect(modal.open).toBe(false);expect(button.hidden).toBe(false);expect(button.attrs.get('aria-label')).toBe('展开菜单，有进度提示待处理');
});
it('pointer/blur and state updates do not collapse an open panel; detail actions retain it',async()=>{
 const {button,modal,find,actions}=mount();button.click();modal.dispatchEvent(new Event('pointerdown'));modal.dispatchEvent(new Event('blur'));notify();expect(modal.open).toBe(true);
 await find('图鉴查询').onclick?.();expect(showCatalog).toHaveBeenCalledOnce();expect(modal.open).toBe(true);
 for(const [label,key] of [['查看牌组','viewDeck'],['规则 / 物品','viewRules'],['上手详情','viewLastHand']] as const){await find(label).onclick?.();expect(actions[key]).toHaveBeenCalledOnce();expect(modal.open).toBe(true);}
 notify();expect(button.attrs.get('aria-expanded')).toBe('true');button.click();expect(modal.open).toBe(false);
});
it('new-game and fullscreen keep real callbacks; changing scenes hands focus to the canvas',async()=>{
 const {button,modal,find,game}=mount();button.click();await find('开始新局').onclick?.();expect(game.scene.start).toHaveBeenCalledWith('character-select');expect(modal.open).toBe(false);expect(dom.activeElement).toBe(game.canvas);expect(game.input.enabled).toBe(true);
 button.click();await find('全屏游玩').onclick?.();await Promise.resolve();expect(fullscreen.toggle).toHaveBeenCalledOnce();expect(modal.open).toBe(false);expect(button.attrs.get('aria-expanded')).toBe('false');
});
it('continue preserves the current scene; retry/cancel/read buttons invoke their actual services',async()=>{
 const {button,find,game,modal}=mount();const saved={status:'idle',state:{phase:'shop',seed:'component'},flush:vi.fn().mockResolvedValue(true)} as unknown as SavedRun;session.run=saved;session.lease.writable=true;notify();button.click();await find('继续游戏').onclick?.();expect(modal.open).toBe(false);expect(game.scene.start).not.toHaveBeenCalled();expect(dom.activeElement).toBe(game.canvas);
 saved.status='readonly';session.lease.writable=false;notify();button.click();await find('在这里继续').onclick?.();expect(session.takeOver).toHaveBeenCalledOnce();expect(modal.open).toBe(false);
 saved.status='paused';notify();button.click();await find('重试保存').onclick?.();expect(session.retry).toHaveBeenCalledOnce();
 session.pendingRun={status:'paused'} as SavedRun;notify();if(!modal.open)button.click();await find('取消这次操作').onclick?.();expect(session.cancelPending).toHaveBeenCalledOnce();expect(session.run).toBe(saved);expect(session.pendingRun).toBeUndefined();
 session.notice='浏览器暂时无法读取进度，请重试。';session.storageUnavailable=true;notify();await find('重试读取').onclick?.();expect(session.initialize).toHaveBeenCalledOnce();
});
it('speed, reduced motion and both audio sliders keep their existing setting callbacks',()=>{
 const {button,modal}=mount();button.click();const speed=walk(modal,e=>e.tagName==='select')!,reduced=walk(modal,e=>e.type==='checkbox')!;speed.value='2';speed.onchange?.();expect(session.preferences).toHaveBeenLastCalledWith(2,false);reduced.checked=true;reduced.onchange?.();expect(session.preferences).toHaveBeenLastCalledWith(2,true);
 const music=walk(modal,e=>e.attrs.get('aria-label')==='背景音量')!,sfx=walk(modal,e=>e.attrs.get('aria-label')==='音效音量')!;music.value='0';music.oninput?.();expect(audio.setVolume).toHaveBeenCalledWith('music',0);sfx.value='30';sfx.oninput?.();expect(audio.setVolume).toHaveBeenCalledWith('sfx',.3);expect(audio.setVolume).toHaveBeenCalledWith('ui',.3);
});
it('common settings remain visible while current queries and fullscreen use the More disclosure',()=>{
 const {modal,find}=mount(),settings=walk(modal,e=>e.className==='run-menu-settings-tools')!,more=walk(modal,e=>e.className==='run-menu-more')!;
 expect(settings.tagName).toBe('div');expect(more.tagName).toBe('details');expect(more.children[0].textContent).toBe('更多');expect(more.open).toBe(false);
 for(const label of ['图鉴查询','查看牌组','规则 / 物品','上手详情','全屏游玩'])expect(walk(more,e=>e===find(label))).toBe(find(label));
});

it('new run is the first direct action before status and settings, and reopening resets the scroll',()=>{
 const {button,modal,find}=mount(),panel=walk(modal,e=>e.className==='run-menu-panel')!,primary=walk(modal,e=>e.className==='run-menu-primary')!,more=walk(modal,e=>e.className==='run-menu-more')!,start=find('开始新局'),status=walk(modal,e=>e.className==='run-menu-status')!;
 expect(primary.children[0]).toBe(start);expect(panel.children.indexOf(primary)).toBeLessThan(panel.children.indexOf(status));expect(primary.parentElement).toBe(panel);expect(start.hidden).toBe(false);expect(start.disabled).toBe(false);
 button.click();panel.scrollTop=450;more.open=true;button.click();button.click();expect(panel.scrollTop).toBe(0);expect(more.open).toBe(false);expect(primary.children[0]).toBe(start);
});
it('with a running game, new run stays first while continue owns initial focus and progress is only flushed',async()=>{
 const {button,modal,find,game}=mount(),saved={status:'idle',state:{phase:'shop',runId:'menu-run',seed:'component'},flush:vi.fn().mockResolvedValue(true)} as unknown as SavedRun;session.run=saved;session.lease.writable=true;notify();button.click();
 const primary=walk(modal,e=>e.className==='run-menu-primary')!;expect(primary.children[0]).toBe(find('开始新局'));expect(dom.activeElement).toBe(find('继续游戏'));
 await find('开始新局').onclick?.();expect(saved.flush).toHaveBeenCalledOnce();expect(session.run).toBe(saved);expect(game.scene.start).toHaveBeenCalledWith('character-select');expect(modal.open).toBe(false);
});
it('failed save and a pending operation keep the player in the current game',async()=>{
 const {button,modal,find,game}=mount(),saved={status:'idle',state:{phase:'shop'},flush:vi.fn().mockResolvedValue(false)} as unknown as SavedRun;session.run=saved;session.lease.writable=true;notify();button.click();await find('开始新局').onclick?.();expect(game.scene.start).not.toHaveBeenCalled();expect(modal.open).toBe(true);
 session.pendingRun=saved;notify();expect(find('开始新局').disabled).toBe(true);expect(session.run).toBe(saved);
});

it('real precise entry hovers across the gap to panel items and click pins/unpins without flashing',()=>{
 vi.useFakeTimers();const {button,modal,find}=mount({primary:true,any:true,coarse:false});fire(button,'pointerenter',{pointerType:'mouse'});expect(modal.open).toBe(true);expect(button.attrs.get('aria-pressed')).toBe('false');
 fire(dom,'pointermove',{pointerType:'mouse',clientX:900,clientY:60});vi.advanceTimersByTime(300);expect(modal.open).toBe(true);fire(dom,'pointermove',{pointerType:'mouse',clientX:700,clientY:180,target:find('开始新局')});vi.advanceTimersByTime(300);expect(modal.open).toBe(true);
 button.click();expect(button.attrs.get('aria-pressed')).toBe('true');fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(500);expect(modal.open).toBe(true);
 fire(dom,'pointermove',{pointerType:'mouse',clientX:950,clientY:30});button.click();expect(button.attrs.get('aria-pressed')).toBe('false');expect(modal.open).toBe(true);fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(220);expect(modal.open).toBe(false);
});
it('native hover autofocus does not pin the menu; deliberate keyboard focus holds until Escape',()=>{
 vi.useFakeTimers();const {button,modal}=mount({primary:true,any:true,coarse:false});fire(button,'pointerenter',{pointerType:'mouse'});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(220);expect(modal.open).toBe(false);
 fire(button,'pointerenter',{pointerType:'mouse'});fire(dom,'keydown',{key:'Tab',target:button});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(500);expect(modal.open).toBe(true);modal.dispatchEvent(new Event('cancel',{cancelable:true}));expect(modal.open).toBe(false);expect(button.attrs.get('aria-pressed')).toBe('false');
});
it('a mixed coarse/fine device keeps the named touch entry and uses actual pointer identity',()=>{
 vi.useFakeTimers();const {host,button,modal}=mount({primary:false,any:true,coarse:true});expect(host.dataset.input).toBe('click');expect(host.dataset.touchCapable).toBe('true');expect(button.children.some(e=>e.textContent==='菜单')).toBe(true);fire(button,'pointerenter',{pointerType:'touch'});expect(modal.open).toBe(false);fire(dom,'pointerdown',{pointerType:'touch',target:button});button.click();fire(dom,'pointerup');vi.advanceTimersByTime(500);expect(modal.open).toBe(true);button.click();expect(modal.open).toBe(false);
 fire(button,'pointerenter',{pointerType:'mouse'});expect(modal.open).toBe(true);expect(host.dataset.input).toBe('hover');expect(host.dataset.touchCapable).toBe('true');fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(220);expect(modal.open).toBe(false);
});
it('detail dialogs protect hover and restoring menu focus keeps the return usable',async()=>{
 vi.useFakeTimers();const {button,modal,find,actions}=mount({primary:true,any:true,coarse:false});const detail=new Element('dialog'),closeButton=new Element('button');detail.append(closeButton);actions.viewDeck.mockImplementation(()=>{dom.body.append(detail);detail.showModal();});
 fire(button,'pointerenter',{pointerType:'mouse'});await find('查看牌组').onclick?.();fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(500);expect(modal.open).toBe(true);detail.close();find('查看牌组').focus();vi.advanceTimersByTime(500);expect(modal.open).toBe(true);modal.dispatchEvent(new Event('cancel',{cancelable:true}));expect(modal.open).toBe(false);
});
it('range dragging protects the menu until pointer release outside the whole region',()=>{
 vi.useFakeTimers();const {button,modal}=mount({primary:true,any:true,coarse:false});fire(button,'pointerenter',{pointerType:'mouse'});const range=walk(modal,e=>e.attrs.get('aria-label')==='背景音量')!;fire(dom,'pointerdown',{pointerType:'mouse',target:range,clientX:700,clientY:200});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(500);expect(modal.open).toBe(true);fire(dom,'pointerup');vi.advanceTimersByTime(220);expect(modal.open).toBe(false);
});
it('scene transitions and destroy clear a pinned menu and any delayed closing work',()=>{
 vi.useFakeTimers();const {button,modal,host,setScene,step,destroy}=mount({primary:true,any:true,coarse:false});const outside=new Element('input');dom.body.append(outside);outside.focus();setScene('character-select');step();expect(dom.activeElement).toBe(outside);fire(button,'pointerenter',{pointerType:'mouse'});button.click();setScene('shop');step();expect(modal.open).toBe(false);expect(button.attrs.get('aria-pressed')).toBe('false');
 fire(button,'pointerenter',{pointerType:'mouse'});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});destroy();vi.advanceTimersByTime(500);expect(modal.open).toBe(false);expect(host.parentElement).toBeUndefined();fire(button,'pointerenter',{pointerType:'mouse'});expect(modal.open).toBe(false);
});
it('loss of hover capability preserves the open menu for explicit touch-style closing',()=>{
 vi.useFakeTimers();const {button,modal,host,media}=mount({primary:true,any:true,coarse:false});fire(button,'pointerenter',{pointerType:'mouse'});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});media.primary.set(false);media.any.set(false);vi.advanceTimersByTime(500);expect(host.dataset.input).toBe('click');expect(modal.open).toBe(true);button.click();expect(modal.open).toBe(false);
});
it('keyboard Escape restores focus without protecting the next mouse hover from closing',()=>{
 vi.useFakeTimers();const {button,modal}=mount({primary:true,any:true,coarse:false});button.focus();fire(dom,'keydown',{key:'Enter',target:button});button.click();fire(dom,'keydown',{key:'Escape',target:button});modal.dispatchEvent(new Event('cancel',{cancelable:true}));expect(modal.open).toBe(false);expect(dom.activeElement).toBe(button);
 fire(button,'pointerenter',{pointerType:'mouse'});fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(220);expect(modal.open).toBe(false);
});
it('a pending save action holds hover until its result returns without changing scenes',async()=>{
 vi.useFakeTimers();const {button,modal,find,game}=mount({primary:true,any:true,coarse:false});let finish!:(saved:boolean)=>void;const flushed=new Promise<boolean>(resolve=>{finish=resolve;});session.run={status:'idle',state:{phase:'shop'},flush:()=>flushed} as SavedRun;session.lease.writable=true;notify();
 fire(button,'pointerenter',{pointerType:'mouse'});const pending=find('开始新局').onclick?.();fire(dom,'pointermove',{pointerType:'mouse',clientX:100,clientY:700});vi.advanceTimersByTime(500);expect(modal.open).toBe(true);expect(game.scene.start).not.toHaveBeenCalled();finish(false);await pending;vi.advanceTimersByTime(220);expect(modal.open).toBe(false);expect(game.scene.start).not.toHaveBeenCalled();
});
