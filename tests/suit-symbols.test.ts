import {afterEach,describe,expect,it,vi} from 'vitest';
import {observeSuitSymbols,suitTextParts,SUIT_TEXT_INK} from '../src/game/SuitSymbols';
afterEach(()=>vi.unstubAllGlobals());

describe('readable suit references',()=>{
 it('preserves copied rules and suit identities, including text/emoji selectors',()=>{
  const text='保留 ♠️A、♣︎K；♥Q / ♦J。花色本身不改变点数。';
  const parts=suitTextParts(text);
  expect(parts.map(p=>p.text).join('')).toBe(text);
  expect(parts.filter(p=>p.suit).map(p=>[p.text,p.suit])).toEqual([['♠️','spades'],['♣︎','clubs'],['♥','hearts'],['♦','diamonds']]);
  expect(suitTextParts('无花色的说明')).toEqual([{text:'无花色的说明'}]);
  expect(suitTextParts('')).toEqual([]);
 });
 it('keeps normal small symbols readable on the existing paper and primary-button colors',()=>{
  const luminance=(hex:string)=>{const rgb=hex.match(/[a-f\d]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for(const paper of ['#FFF9EE','#E2E8E5','#F0D3C7','#F3EADB','#EEE9DF'])for(const ink of [SUIT_TEXT_INK.black,SUIT_TEXT_INK.red])expect(contrast(ink,paper)).toBeGreaterThanOrEqual(4.5);
  for(const ink of [SUIT_TEXT_INK.darkBlack,SUIT_TEXT_INK.darkRed])expect(contrast(ink,'#B8473A')).toBeGreaterThanOrEqual(4.5);
 });
 it('places a named colored suit outside native options, updates it on change and removes its listener on close',()=>{
  vi.stubGlobal('NodeFilter',{SHOW_TEXT:4});const doc:any={};
  const element=()=>{const n:any={ownerDocument:doc,textContent:'',className:'',dataset:{},children:[],setAttribute:vi.fn(),append:(...nodes:any[])=>n.children.push(...nodes),replaceChildren:()=>{n.children=[];}};n.classList={add:(s:string)=>{n.className+=' '+s;},contains:(s:string)=>n.className.split(' ').includes(s)};return n;};
  Object.assign(doc,{createTreeWalker:()=>({nextNode:()=>null}),createElement:element,createTextNode:(text:string)=>({textContent:text})});
  const red={textContent:'♥ 红桃',style:{}},black={textContent:'♠ 黑桃',style:{}},select:any={...element(),options:[red,black],selectedOptions:[red],nextElementSibling:null,after:(n:any)=>{select.nextElementSibling=n;}};
  let change!:()=>void;const remove=vi.fn(),host={ownerDocument:doc,querySelectorAll:()=>[select],addEventListener:(_n:string,f:()=>void)=>{change=f;},removeEventListener:remove},stop=observeSuitSymbols(host as unknown as HTMLElement),preview=select.nextElementSibling;
  expect(preview.hidden).toBe(false);expect(preview.children.find((n:any)=>n.dataset?.suit==='hearts').className).toContain('suit-symbol--red');expect(preview.children.map((n:any)=>n.textContent).join('')).toContain('红桃');
  select.selectedOptions=[black];change();expect(select.nextElementSibling).toBe(preview);expect(preview.children.find((n:any)=>n.dataset?.suit==='spades').className).toContain('suit-symbol--black');
  select.selectedOptions=[{textContent:'全部'}];change();expect(preview.hidden).toBe(true);stop();expect(remove).toHaveBeenCalledWith('change',change);
 });
});
