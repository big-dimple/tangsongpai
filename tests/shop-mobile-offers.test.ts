import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
vi.mock('../src/game/CardArtZoomModal',()=>({openCardArtZoom:vi.fn(()=>({close:vi.fn()}))}));
import {mountShopMobileOffers,type MobileShopOffer} from '../src/game/ShopMobileOffers';
import {openCardArtZoom} from '../src/game/CardArtZoomModal';
import {ShopScene} from '../src/game/ShopScene';
import {workshopLayoutFixture} from '../harness/fixtures/workshop-layout';
import {detailArt,decodeArtImage,invalidateArt} from '../src/game/DetailArt';
import {goodsArtUrl} from '../src/game/GoodsArt';

class Element {
 className='';textContent='';src='';dataset:Record<string,string>={};disabled=false;scrollTop=184;isConnected=true;parent?:Element;children:Element[]=[];onclick:(()=>void)|null=null;onerror:(()=>void)|null=null;
 constructor(readonly tag:string){}
 append(...nodes:Element[]){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(){}
 classList={add:vi.fn(),remove:vi.fn()};
 focus=vi.fn();
 click(){let n:Element|undefined=this;while(n){if(n.disabled)return;n.onclick?.();n=n.parent;}}
 find(tag:string):Element|undefined{return this.children.find(n=>n.tag===tag)??this.children.map(n=>n.find(tag)).find(Boolean);}
 findClass(name:string):Element|undefined{return this.children.find(n=>n.className===name)??this.children.map(n=>n.findClass(name)).find(Boolean);}
}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
function mount(consumed=false,patch:Partial<MobileShopOffer>={}){
 vi.stubGlobal('document',{createElement:(tag:string)=>new Element(tag)});const host=new Element('section'),open=vi.fn(),gate={active:true},row:MobileShopOffer={id:'offer/mobile',definitionId:'b07',name:'测试唐宋牌',identity:'珍奇·多彩',summary:'当前实际效果',extra:'倍率×1.5',price:7,consumed,thumbnailUrl:'/preview.webp',...patch};
 const stop=mountShopMobileOffers(host as unknown as HTMLElement,[row],()=>gate.active,open);return {host,open,gate,stop,main:host.findClass('shop-mobile-offer-main')!,zoom:host.findClass('shop-mobile-offer-zoom')!};
}
it('image, name, rarity and real price open the same single quote path, while appreciation is independent',()=>{
 const ui=mount();expect(ui.main.dataset.ui).toBe('shop/offer/offer/mobile');for(const node of [ui.host.find('img')!,ui.host.find('strong')!,ui.host.findClass('shop-mobile-offer-identity')!,ui.host.findClass('shop-mobile-offer-price')!])node.click();
 expect(ui.open.mock.calls).toEqual(Array.from({length:4},()=>['offer/mobile']));expect(ui.main.focus).toHaveBeenCalledWith({preventScroll:true});expect(ui.host.findClass('shop-mobile-offer-price')!.textContent).toBe('7 金 · 详情 ›');expect(ui.host.findClass('shop-mobile-offer-identity')!.textContent).toBe('珍奇·多彩');expect(ui.host.scrollTop).toBe(184);
 ui.zoom.click();expect(openCardArtZoom).toHaveBeenCalledOnce();expect(ui.open).toHaveBeenCalledTimes(4);ui.stop();
});
it('disabled, inactive and disposed rows cannot open quotes, including retained callbacks',()=>{
 const used=mount(true);used.main.click();expect(used.open).not.toHaveBeenCalled();used.stop();const ui=mount(),click=ui.main.onclick!,zoom=ui.zoom.onclick!;ui.gate.active=false;click();expect(ui.open).not.toHaveBeenCalled();ui.gate.active=true;ui.stop();click();zoom();expect(ui.open).not.toHaveBeenCalled();expect(openCardArtZoom).not.toHaveBeenCalled();
});
it.each([['T12','tool-card'],['U01','item-card']] as const)('recovers a failed mobile %s face when appreciation decodes the same detail, without refetching or publishing after teardown',async(id,category)=>{
 const url=goodsArtUrl(id,category,'detail')!,fetch=vi.fn().mockRejectedValueOnce(Error('network')).mockImplementation(async()=>new Response(new Blob(['art'])));vi.stubGlobal('fetch',fetch);vi.stubGlobal('createImageBitmap',async()=>({width:615,height:768,close(){}}));
 vi.stubGlobal('Image',class{src='';naturalWidth=615;naturalHeight=768;onerror=null;decode(){return Promise.resolve();}removeAttribute(){this.src='';}});
 const ui=mount(false,{definitionId:id,detailUrl:url}),image=ui.host.find('img')!;await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());for(let i=0;i<20;i++)await Promise.resolve();expect(image.src).toBe('/preview.webp');
 // The appreciation path shares these same transfer/decode functions after an explicit retry.
 const src=await detailArt(url);await decodeArtImage(src);expect(image.src).toBe(src);expect(fetch).toHaveBeenCalledTimes(2);expect(ui.open).not.toHaveBeenCalled();
 ui.stop();invalidateArt(url,src);await decodeArtImage(await detailArt(url));expect(image.src).toBe(src);expect(fetch).toHaveBeenCalledTimes(3);
});
it.each([true,false])('opening a quote preserves the native list/opener only in portrait=%s and does not submit or change state',portrait=>{
 const run=workshopLayoutFixture(0).state,before=structuredClone(run),scene=Object.create(ShopScene.prototype) as any,open=vi.fn(()=>{throw Error('quote-opened');}),render=vi.fn(),send=vi.fn();
 Object.assign(scene,{run,busy:false,shelfKind:'tools',pcPages:{},geometry:()=>({portrait,pc:null}),render,purchaseReason:()=>undefined,textures:{exists:()=>false},dialog:{open},send});Object.defineProperty(scene,'audio',{value:{select:vi.fn()}});
 expect(()=>scene.inspectOffer(run.shop!.toolOffers[0].offerId)).toThrow('quote-opened');expect(open).toHaveBeenCalledOnce();expect(render).toHaveBeenCalledTimes(portrait?0:1);expect(send).not.toHaveBeenCalled();expect(run).toEqual(before);
});

it('the scene scopes native contact to its live shelf and removes the guard handoff on teardown',()=>{
 const host=Object.assign(new EventTarget(),{style:{},dataset:{},setAttribute:vi.fn(),querySelectorAll:()=>[],append:vi.fn(),getBoundingClientRect:()=>({top:0,bottom:400})}),noteNativeInteraction=vi.fn();
 vi.stubGlobal('document',{createElement:()=>host,getElementById:()=>({getBoundingClientRect:()=>({x:0,y:0,width:390,height:844})}),body:{append:vi.fn()}});
 const scene=Object.assign(Object.create(ShopScene.prototype),{view:{layout:{width:390,height:844},noteNativeInteraction},scene:{isActive:()=>true},run:{},shelfKind:'jokers',busy:false,workshopSelected:false,shelfOffers:()=>[]});
 scene.drawMobileOffers({x:12,y:120,width:366,height:400});host.dispatchEvent(new Event('pointerdown'));expect(noteNativeInteraction).toHaveBeenCalledOnce();
 scene.busy=true;host.dispatchEvent(new Event('pointerdown'));expect(noteNativeInteraction).toHaveBeenCalledOnce();scene.busy=false;
 scene.mobileOffers.dispose();host.dispatchEvent(new Event('pointerdown'));expect(noteNativeInteraction).toHaveBeenCalledOnce();
});
