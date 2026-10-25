import {describe,expect,it} from 'vitest';
import {GamepadInput,controllerButtonLabels,type PadSnapshot} from '../src/platform/GamepadInput';
const pad=(pressed:number[]=[],axes=[0,0,0,0],id='Xbox'):PadSnapshot=>({index:0,id,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});
describe('controller input edges and navigation',()=>{
  it('requires neutral after connecting, reconnecting and returning from background',()=>{
    const input=new GamepadInput();expect(input.sample(pad([0]),0)).toBeUndefined();expect(input.sample(pad([0]),1000)).toBeUndefined();
    input.sample(pad(),1010);expect(input.sample(pad([0]),1020)).toBe('confirm');
    input.reset();expect(input.sample(pad([2]),2000)).toBeUndefined();input.sample(pad(),2010);expect(input.sample(pad([2]),2020)).toBe('play');
    expect(input.sample(pad([0],[0,0,0,0],'replacement'),2030)).toBeUndefined();
  });
  it.each([[0,'confirm'],[1,'back'],[2,'play'],[3,'discard'],[4,'previous'],[5,'next'],[6,'sort-rank'],[7,'sort-suit'],[8,'detail'],[9,'menu']] as const)('button %i acts once per press as %s', (index,action)=>{
    const input=new GamepadInput();input.sample(pad(),0);expect(input.sample(pad([index]),20)).toBe(action);
    expect(input.sample(pad([index]),400)).toBeUndefined();expect(input.sample(pad([index]),4000)).toBeUndefined();
    input.sample(pad(),4010);expect(input.sample(pad([index]),4020)).toBe(action);
  });
  it('repeats only movement, with a delay and a bounded rate even after a slow frame',()=>{
    const input=new GamepadInput();input.sample(pad(),0);expect(input.sample(pad([15]),20)).toBe('right');
    expect(input.sample(pad([15]),369)).toBeUndefined();expect(input.sample(pad([15]),370)).toBe('right');
    expect(input.sample(pad([15]),479)).toBeUndefined();expect(input.sample(pad([15]),480)).toBe('right');
    expect(input.sample(pad([15]),9000)).toBe('right');expect(input.sample(pad([15]),9001)).toBeUndefined();
  });
  it('filters stick drift and uses hysteresis until the stick returns to neutral',()=>{
    const input=new GamepadInput();input.sample(pad(),0);expect(input.sample(pad([],[.3,0]),20)).toBeUndefined();
    expect(input.sample(pad([],[.7,.1]),40)).toBe('right');expect(input.sample(pad([],[.4,.1]),400)).toBe('right');
    expect(input.sample(pad([],[.2,0]),420)).toBeUndefined();expect(input.sample(pad([],[0,-.7]),440)).toBe('up');
  });
  it('cannot confirm and submit from simultaneous face buttons',()=>{
    const input=new GamepadInput();input.sample(pad(),0);expect(input.sample(pad([0,2]),20)).toBe('confirm');expect(input.sample(pad([2]),30)).toBeUndefined();
  });
  it('also waits for a held right stick to rest before accepting input after focus returns',()=>{
    const input=new GamepadInput();input.sample(pad([],[0,0,0,.9]),0);expect(input.ready).toBe(false);
    expect(input.sample(pad([0],[0,0,0,.9]),20)).toBeUndefined();input.sample(pad(),40);expect(input.ready).toBe(true);expect(input.sample(pad([0]),60)).toBe('confirm');
  });
  it('rejects unknown layouts and disconnects rather than guessing destructive mappings',()=>{
    const input=new GamepadInput();input.sample(pad(),0);expect(input.sample({...pad([2]),mapping:''},20)).toBeUndefined();
    expect(input.sample({...pad([2]),connected:false},40)).toBeUndefined();expect(input.sample(pad([2]),60)).toBeUndefined();
  });
  it('labels Sony and Xbox controls by their actual face positions',()=>{
    expect(controllerButtonLabels('DualSense Wireless Controller').confirm).toBe('×');expect(controllerButtonLabels('Xbox').play).toBe('X');
  });
});
