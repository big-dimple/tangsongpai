import {expect,it} from 'vitest';
import {tapUI} from '../harness/ui.mjs';

// Native mobile rows own their scroll and input; stale canvas pagination must fail here.
function offerPage(count=1){
 const selector='[data-ui="shop/offer/shop/0/joker/2"]',inputs=[];let frames=0;
 const offer={count:async()=>count,tap:async()=>inputs.push('offer/tap'),click:async()=>inputs.push('offer/click')};
 const page={
  locator:key=>{if(key!==selector)throw Error('Unexpected locator '+key);return offer;},
  evaluate:async fn=>{expect(String(fn)).toContain('poststep');frames++;},
  waitForFunction:async()=>{throw Error('Native offer cannot wait for a canvas object');},
  mouse:{click:async()=>{throw Error('Native row must use its actionable locator');}},
  touchscreen:{tap:async()=>{throw Error('Native row must use its actionable locator');}},
 };
 return {page,inputs,frames:()=>frames};
}
for(const touch of [false,true])it('opens the exact native offer by '+(touch?'tap':'click')+' before observing the next frame',async()=>{
 const ui=offerPage();await tapUI(ui.page,'shop','offer/shop/0/joker/2',touch);
 expect(ui.inputs).toEqual([touch?'offer/tap':'offer/click']);expect(ui.frames()).toBe(1);
});
it('rejects ambiguous native offer IDs before sending an input',async()=>{
 const ui=offerPage(2);await expect(tapUI(ui.page,'shop','offer/shop/0/joker/2',true)).rejects.toThrow('one native action');
 expect(ui.inputs).toEqual([]);expect(ui.frames()).toBe(0);
});
