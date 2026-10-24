import {SUIT_SYMBOL,type Suit} from '../cards/types';

const SUIT_FOR_GLYPH:Record<string,Suit>={'♠':'spades','♣':'clubs','♥':'hearts','♦':'diamonds'};
export const SUIT_TEXT_INK={black:'#26313A',red:'#9F3228',darkBlack:'#FFF9EE',darkRed:'#FFEDE3'} as const;
export const SUIT_TEXT_NAMES:Record<Suit,string>={spades:'黑桃',hearts:'红桃',clubs:'梅花',diamonds:'方块'};
export function suitTextParts(text:string):{text:string;suit?:Suit}[]{
 return text.split(/([♠♣♥♦][\uFE0E\uFE0F]?)/).filter(Boolean).map(text=>({text,...(SUIT_FOR_GLYPH[text[0]]?{suit:SUIT_FOR_GLYPH[text[0]]}:{})}));
}
function symbol(doc:Document,suit:Suit,text:string):HTMLSpanElement {
 const span=doc.createElement('span');span.className='suit-symbol '+(suit==='hearts'||suit==='diamonds'?'suit-symbol--red':'suit-symbol--black');span.dataset.suit=suit;span.textContent=text;return span;
}
/** Only suit glyphs receive suit ink; surrounding prose keeps the parent's typography. */
export function setSuitText(host:HTMLElement,text:string):void {
 const doc=host.ownerDocument??document;host.replaceChildren();
 for(const part of suitTextParts(text))host.append(part.suit?symbol(doc,part.suit,part.text):doc.createTextNode(part.text));
}
/** Color glyphs inside this dialog only; retain ordinary text, accessible labels and input nodes. */
export function observeSuitSymbols(host:HTMLElement):()=>void {
 const doc=host.ownerDocument;if(!doc?.createTreeWalker)return ()=>{};
 let observer:MutationObserver|undefined;
 const paint=()=>{
  observer?.disconnect();
  const walker=doc.createTreeWalker(host,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
  for(let node=walker.nextNode();node;node=walker.nextNode())if(/[♠♣♥♦]/.test(node.textContent??'')&&!node.parentElement?.closest('.suit-symbol,.candidate-card-face,script,style,textarea,option,[contenteditable]'))nodes.push(node as Text);
  for(const node of nodes){const fragment=doc.createDocumentFragment();
   for(const part of suitTextParts(node.data))fragment.append(part.suit?symbol(doc,part.suit,part.text):doc.createTextNode(part.text));
   node.replaceWith(fragment);
  }
  // Native options cannot contain rich spans. Only isolated suit labels get this scoped color.
  for(const select of host.querySelectorAll('select'))if([...select.options].some(o=>/[♠♣♥♦]/.test(o.textContent??''))){
   select.classList.add('suit-select');select.dataset.suit=SUIT_FOR_GLYPH[select.selectedOptions[0]?.textContent?.match(/[♠♣♥♦]/)?.[0]??'']??'';
   for(const option of select.options){const suit=SUIT_FOR_GLYPH[option.textContent?.match(/[♠♣♥♦]/)?.[0]??''];if(suit)option.style.color=suit==='hearts'||suit==='diamonds'?SUIT_TEXT_INK.red:SUIT_TEXT_INK.black;}
   // Platform option styling varies; a selected suit remains visible outside the native popup.
   let preview=select.nextElementSibling as HTMLElement|null;
   if(!preview?.classList.contains('suit-select-preview')){preview=doc.createElement('span');preview.className='suit-select-preview';preview.setAttribute('aria-live','polite');select.after(preview);}
   const suit=select.dataset.suit as Suit|'',copy=suit?'已选 '+SUIT_SYMBOL[suit]+' '+SUIT_TEXT_NAMES[suit]:'';preview.hidden=!suit;if(preview.textContent!==copy)setSuitText(preview,copy);
  }
  observer?.observe(host,{childList:true,characterData:true,subtree:true});
 };
 if(typeof MutationObserver!=='undefined')observer=new MutationObserver(paint);
 paint();host.addEventListener('change',paint);
 return ()=>{observer?.disconnect();host.removeEventListener('change',paint);};
}
