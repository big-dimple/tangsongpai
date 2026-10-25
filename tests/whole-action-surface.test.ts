import {afterEach,expect,it,vi} from 'vitest';
import {wholeActionSurface} from '../src/game/WholeActionSurface';
class Node extends EventTarget {
  isConnected=true;disabled=false;interactive=false;click=vi.fn();classList={add:vi.fn(),remove:vi.fn()};
  closest(){return this.interactive?this:null;}
}
afterEach(()=>vi.unstubAllGlobals());
function setup(){
  vi.stubGlobal('Element',Node);vi.stubGlobal('getSelection',()=>({toString:()=>''}));
  const surface=new Node(),button=new Node(),copy=new Node();button.interactive=true;
  const stop=wholeActionSurface(surface as unknown as HTMLElement,button as unknown as HTMLButtonElement);
  const click=(target=copy,prevented=false)=>{const event=new Event('click',{cancelable:true});Object.defineProperty(event,'target',{value:target});if(prevented)event.preventDefault();surface.dispatchEvent(event);};
  return {surface,button,copy,stop,click};
}
it('opens the existing action exactly once when its heading, description or padding is clicked',()=>{
  const {surface,button,click,stop}=setup();click();click(surface);expect(button.click).toHaveBeenCalledTimes(2);stop();click();expect(button.click).toHaveBeenCalledTimes(2);
});
it('keeps nested controls, disabled actions and cancelled events independent',()=>{
  const {button,copy,click}=setup();click(button);copy.interactive=true;click(copy);copy.interactive=false;click(copy,true);button.disabled=true;click();expect(button.click).not.toHaveBeenCalled();
});
it('does not activate a detached card or while copying its explanatory text',()=>{
  const {surface,button,click}=setup();surface.isConnected=false;click();surface.isConnected=true;
  vi.stubGlobal('getSelection',()=>({toString:()=> 'selected description'}));click();expect(button.click).not.toHaveBeenCalled();
});
