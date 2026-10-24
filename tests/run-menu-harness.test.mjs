import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {openRunMenu,openMenuSection,tapMenuAction,toggleRunMenu} from '../harness/ui.mjs';
import {createRunMenuInteraction} from '../src/game/RunMenuInteraction';

beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
// Browser-free adapter drives the production hover/pin state machine with native-input-shaped events.
// Unknown selectors, accessible names and unfinished transitions fail instead of silently passing.
function menuPage({attention=false,hover=true}={}){
  const modal={open:false},more={tagName:'DETAILS',open:false},settings={tagName:'DIV'},inputs=[];
  let expandedOverride,labelOverride;
  const interaction=createRunMenuInteraction({hoverCapable:hover,initialHover:hover,protected:()=>false,open:()=>{modal.open=true;},close:()=>{modal.open=false;},change:()=>{}});
  const label=()=>labelOverride??(modal.open?(interaction.state().mode==='click'?'收起菜单':interaction.state().pinned?'菜单已固定，点击解除固定':'菜单已展开，点击固定'):attention?'展开菜单，有进度提示待处理':'展开菜单');
  const arrow={
    count:async()=>1,getAttribute:async key=>key==='aria-expanded'?expandedOverride??String(modal.open):key==='aria-pressed'?interaction.state().mode==='hover'?String(interaction.state().pinned):null:key==='aria-label'?label():null,
    click:async()=>{inputs.push('arrow/click');interaction.enterMouse();interaction.input('mouse');interaction.focusKeyboard(false);interaction.pointerInside(true);interaction.click();},
    tap:async()=>{inputs.push('arrow/tap');interaction.input('touch');interaction.focusKeyboard(false);interaction.click();},
  };
  const summary={click:async()=>{inputs.push('more/click');more.open=!more.open;},tap:async()=>{inputs.push('more/tap');more.open=!more.open;}};
  const inspect={click:async()=>{expect(modal.open&&more.open).toBe(true);inputs.push('inspect/click');},tap:async()=>{expect(modal.open&&more.open).toBe(true);inputs.push('inspect/tap');}};
  vi.stubGlobal('document',{querySelector:selector=>{expect(selector).toBe('.run-menu-modal');return modal;}});
  const page={
    mouse:{move:async(x,y)=>{expect([x,y]).toEqual([0,0]);inputs.push('pointer/leave');interaction.pointerInside(false);}},
    waitForFunction:async(fn,arg)=>{if(!fn(arg))await vi.advanceTimersByTimeAsync(220);expect(fn(arg),'native interaction reaches the requested actual dialog state').toBe(true);},
    locator:selector=>{
      if(selector==='.run-menu-toggle')return arrow;
      if(selector==='.run-menu-modal')return {evaluate:async fn=>fn(modal)};
      if(selector==='.run-menu-settings-tools')return {evaluate:async fn=>fn(settings)};
      if(selector==='.run-menu-more')return {evaluate:async fn=>fn(more),locator:selector=>{expect(selector).toBe('summary');return summary;}};
      throw Error('Unexpected selector: '+selector);
    },
    getByRole:(role,{name,exact})=>{
      expect(role).toBe('button');expect(exact).toBe(true);
      if(typeof name==='string'?name===label():name.test(label()))return arrow;
      if(name==='查看牌组')return inspect;
      throw Error('No accessible button named '+name);
    },
  };
  return {page,modal,more,inputs,interaction,hover:()=>interaction.enterMouse(),breakArrowState:()=>{expandedOverride='true';},breakArrowLabel:()=>{labelOverride='old menu label';}};
}

for(const touch of [false,true])it(`current menu opens and closes repeatedly with ${touch?'tap':'mouse hover, pin and leave'}`,async()=>{
  const {page,modal,inputs,interaction}=menuPage({attention:touch,hover:!touch});
  for(let i=0;i<3;i++){
    await openRunMenu(page,touch);expect(modal.open).toBe(true);if(!touch)expect(interaction.state().pinned).toBe(true);
    const count=inputs.length;await openRunMenu(page,touch);expect(inputs).toHaveLength(count);
    await toggleRunMenu(page,touch);expect(modal.open).toBe(false);
  }
  expect(inputs).toEqual(Array.from({length:3},()=>touch?['arrow/tap','arrow/tap']:['arrow/click','arrow/click','pointer/leave']).flat());
});
it('opening an already hovered panel pins it through the actual arrow before reaching menu actions',async()=>{
 const {page,modal,inputs,hover,interaction}=menuPage();hover();expect(modal.open).toBe(true);expect(interaction.state().pinned).toBe(false);
 await openRunMenu(page);expect(interaction.state().pinned).toBe(true);expect(inputs).toEqual(['arrow/click']);
});
it('closing an unpinned hover panel leaves its envelope without accidentally pinning it',async()=>{
 const {page,modal,inputs,hover,interaction}=menuPage();hover();await toggleRunMenu(page);expect(modal.open).toBe(false);expect(interaction.state().pinned).toBe(false);expect(inputs).toEqual(['pointer/leave']);
});
it('hybrid input closes a mouse-pinned menu with a real touch and can return to mouse pinning',async()=>{
 const {page,modal,interaction}=menuPage();await openRunMenu(page);await toggleRunMenu(page,true);expect(modal.open).toBe(false);expect(interaction.state().mode).toBe('click');
 await openRunMenu(page);expect(modal.open).toBe(true);expect(interaction.state().pinned).toBe(true);await toggleRunMenu(page);expect(modal.open).toBe(false);
});
it('settings stay directly visible; actual inspection opens More before its button',async()=>{
  const {page,more,inputs}=menuPage();await openMenuSection(page,'settings');expect(more.open).toBe(false);expect(inputs).toEqual(['arrow/click']);
  await tapMenuAction(page,'查看牌组',true);await tapMenuAction(page,'查看牌组',true);
  expect(inputs).toEqual(['arrow/click','more/tap','inspect/tap','inspect/tap']);
});
it('a stale aria-expanded contract fails before an input instead of silently passing',async()=>{
  const {page,inputs,breakArrowState}=menuPage();breakArrowState();
  await expect(toggleRunMenu(page)).rejects.toThrow('arrow describes the actual panel state');expect(inputs).toEqual([]);
});
it('a stale accessible label still fails before input even though the helper uses a stable selector',async()=>{
 const {page,inputs,breakArrowLabel}=menuPage();breakArrowLabel();await expect(toggleRunMenu(page)).rejects.toThrow();expect(inputs).toEqual([]);
});
