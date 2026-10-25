/** A card's copy and padding open its existing action; nested controls retain their own behaviour. */
export function wholeActionSurface(surface:HTMLElement,button:HTMLButtonElement):()=>void {
  surface.classList.add('whole-action-surface');
  const click=(event:MouseEvent)=>{
    if(button.disabled||event.defaultPrevented||!surface.isConnected)return;
    const target=event.target instanceof Element?event.target:undefined;
    if(target?.closest('button,a,input,select,textarea,label,summary,details,[contenteditable]'))return;
    // Dragging across explanatory text must remain an ordinary text selection.
    if(globalThis.getSelection?.()?.toString())return;
    button.click();
  };
  surface.addEventListener('click',click);
  return ()=>{surface.removeEventListener('click',click);surface.classList.remove('whole-action-surface');};
}
