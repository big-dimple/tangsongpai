import type {Edition} from '../cards/types';
import {cardArtSource} from './CardArtSource';
import {openCardArtZoom} from './CardArtZoomModal';
import {decodeArtImage,detailArt,invalidateArt,observeDecodedArt} from './DetailArt';
import {mountForgetTechniqueAttentionElement} from './ForgetTechniqueAttention';
import './ShopMobileOffers.css';

export interface MobileShopOffer {
 id:string;definitionId:string;name:string;identity:string;summary:string;extra?:string;price:number;reason?:string;consumed:boolean;edition?:Edition;
 thumbnailUrl?:string;detailUrl?:string;fallbackUrl?:string;
}
/** Native vertical scroll owns only presentation; the existing scene adapter opens every quote. */
export function mountShopMobileOffers(host:HTMLElement,rows:readonly MobileShopOffer[],active:()=>boolean,open:(id:string)=>void):()=>void {
 const controllers=new Set<AbortController>(),cleanups:(()=>void)[]=[],started=new Set<HTMLImageElement>();let disposed=false,zoom:HTMLDialogElement|undefined;
 const upgrade=async(image:HTMLImageElement,row:MobileShopOffer,main:HTMLButtonElement)=>{
  if(disposed||started.has(image)||!row.detailUrl)return;started.add(image);const controller=new AbortController();controllers.add(controller);let src:string|undefined;
  const publish=(src:string)=>{if(disposed||controller.signal.aborted||!image.isConnected)return;if(image.src!==src)image.src=src;image.hidden=false;main.classList.remove('without-art');};
  cleanups.push(observeDecodedArt(row.detailUrl,controller.signal,publish));
  try{src=await detailArt(row.detailUrl,true,controller.signal);await decodeArtImage(src,controller.signal);publish(src);}
  catch{if(src&&!controller.signal.aborted)invalidateArt(row.detailUrl,src);/* Keep the useful preview; revisiting the category may retry. */}
  finally{controllers.delete(controller);}
 };
 const demand=new Map<HTMLImageElement,{row:MobileShopOffer;main:HTMLButtonElement}>();
 const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const image=entry.target as HTMLImageElement,value=demand.get(image);if(value)void upgrade(image,value.row,value.main);observer?.unobserve(image);}},{root:host,rootMargin:'64px'});
 for(const row of rows){
  const article=document.createElement('article'),main=document.createElement('button'),copy=document.createElement('span'),name=document.createElement('strong'),identity=document.createElement('span'),summary=document.createElement('span'),price=document.createElement('span');
  article.className='shop-mobile-offer';article.dataset.offerId=row.id;main.type='button';main.className='shop-mobile-offer-main';main.dataset.ui='shop/offer/'+row.id;main.setAttribute('aria-haspopup','dialog');main.disabled=row.consumed;main.onclick=()=>{if(!disposed&&!main.disabled&&active()){main.focus({preventScroll:true});open(row.id);}};
  if(row.thumbnailUrl){const image=document.createElement('img');image.className='shop-mobile-offer-art';image.src=row.thumbnailUrl;image.alt=row.name;image.decoding='async';image.dataset.edition=row.edition??'none';image.dataset.offerId=row.id;let fallback=false;
   image.onerror=()=>{if(disposed)return;if(row.fallbackUrl&&!fallback){fallback=true;image.src=row.fallbackUrl;}else{image.hidden=true;main.classList.add('without-art');}};main.append(image);demand.set(image,{row,main});cleanups.push(()=>{image.onerror=null;});
  }else main.classList.add('without-art');
  const heading=document.createElement('span');heading.className='shop-mobile-offer-heading';copy.className='shop-mobile-offer-copy';name.textContent=row.name;identity.className='shop-mobile-offer-identity';identity.textContent=row.identity;summary.className='shop-mobile-offer-summary';summary.textContent=row.summary;heading.append(name,identity);copy.append(heading,summary);
  if(row.extra){const extra=document.createElement('span');extra.className='shop-mobile-offer-extra';extra.textContent=row.extra;copy.append(extra);}
  price.className='shop-mobile-offer-price';price.textContent=row.consumed?'已购':row.price+' 金 · 详情 ›';copy.append(price);
  if(row.reason&&!row.consumed){const reason=document.createElement('span');reason.className='shop-mobile-offer-reason';reason.textContent=row.reason;copy.append(reason);}
  main.append(copy);article.append(main);cleanups.push(mountForgetTechniqueAttentionElement(main,row.definitionId));
  if(cardArtSource(row.definitionId)){const view=document.createElement('button');view.type='button';view.className='shop-mobile-offer-zoom';view.textContent='看原图';view.title='看原图';view.setAttribute('aria-label','放大鉴赏'+row.name);view.setAttribute('aria-haspopup','dialog');view.onclick=()=>{if(disposed||!active())return;view.focus({preventScroll:true});zoom=openCardArtZoom(row.definitionId,row.name);};article.append(view);}
  host.append(article);
 }
 for(const [image,value]of demand)if(observer)observer.observe(image);else void upgrade(image,value.row,value.main);
 return()=>{disposed=true;observer?.disconnect();for(const controller of controllers)controller.abort();for(const stop of cleanups)stop();zoom?.close();};
}
