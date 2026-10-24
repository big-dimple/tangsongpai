export interface RunMenuInteractionState {open:boolean;pinned:boolean;mode:'hover'|'click';inside:boolean;keyboardFocus:boolean}
interface Options {hoverCapable:boolean;initialHover:boolean;protected:()=>boolean;open:(source:'hover'|'click')=>void;close:()=>void;change:(state:Readonly<RunMenuInteractionState>)=>void}
/** Pointer identity, explicit pinning and keyboard ownership stay independent of save state. */
export function createRunMenuInteraction(options:Options){
 let state:RunMenuInteractionState={open:false,pinned:false,mode:options.initialHover?'hover':'click',inside:false,keyboardFocus:false},hoverCapable=options.hoverCapable,timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
 const change=()=>options.change({...state});
 const clear=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
 const dismiss=()=>{clear();const wasOpen=state.open;state={...state,open:false,pinned:false,inside:false,keyboardFocus:false};if(wasOpen)options.close();change();};
 const eligible=()=>state.open&&state.mode==='hover'&&!state.pinned&&!state.inside&&!state.keyboardFocus&&!options.protected();
 const refresh=()=>{if(disposed)return;if(!eligible()){clear();return;}if(timer===undefined)timer=setTimeout(()=>{timer=undefined;if(eligible())dismiss();},220);};
 const show=(source:'hover'|'click')=>{clear();if(!state.open){state.open=true;options.open(source);}change();};
 return {
  state:()=>({...state}),
  input(pointerType:string){if(disposed)return;state.mode=pointerType==='mouse'&&hoverCapable?'hover':'click';if(state.mode==='click')state.pinned=false;clear();change();},
  capabilities(capable:boolean){hoverCapable=capable;if(!capable){state.mode='click';state.pinned=false;}change();refresh();},
  enterMouse(){if(disposed||!hoverCapable)return;state.mode='hover';state.inside=true;show('hover');},
  pointerInside(inside:boolean){if(disposed||state.mode!=='hover')return;state.inside=inside;change();refresh();},
  focusKeyboard(inside:boolean){if(disposed)return;state.keyboardFocus=inside;change();refresh();},
  click(){if(disposed)return;if(state.mode==='click'){if(state.open)dismiss();else show('click');return;}state.pinned=!state.pinned;if(state.pinned)show('click');else {change();refresh();}},
  show(){if(disposed)return;state.pinned=state.mode==='hover';show('click');},
  dismiss,refresh,
  dispose(){if(disposed)return;dismiss();disposed=true;clear();},
 };
}
