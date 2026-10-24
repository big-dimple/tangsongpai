import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
const shared=vi.hoisted(()=>({detail:vi.fn(),decode:vi.fn(),invalidate:vi.fn(),observe:vi.fn()}));
vi.mock('../src/game/DetailArt',()=>({detailArt:shared.detail,decodeArtImage:shared.decode,invalidateArt:shared.invalidate,observeDecodedArt:shared.observe}));
import {requestShopGalleryArt,requestShopJokerGalleryArt,shopJokerPictureKey,shopGoodsPictureKey} from '../src/game/ShopJokerGalleryArt';
import {jokerArtKey,jokerArtUrl} from '../src/game/jokerArt';
import {goodsArtUrl} from '../src/game/GoodsArt';
import {goodsArtKey} from '../src/game/GoodsArtLoading';
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(){
 const textures=new Map<string,unknown>(),listeners=new Map<string,Set<()=>void>>();
 const scene={textures:{exists:(k:string)=>textures.has(k),addImage:(k:string,i:unknown)=>textures.set(k,i),remove:(k:string)=>textures.delete(k)},sys:{settings:{active:true}},events:{once:(n:string,f:()=>void)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n)!.add(f);},off:(n:string,f:()=>void)=>listeners.get(n)?.delete(f)}};
 return {scene:scene as unknown as Phaser.Scene,textures,shutdown:()=>{scene.sys.settings.active=false;for(const f of [...listeners.get('shutdown')??[]])f();},listeners};
}
beforeEach(()=>{shared.detail.mockReset().mockResolvedValue('blob:detail');shared.decode.mockReset().mockResolvedValue({naturalWidth:615,naturalHeight:768});shared.invalidate.mockReset();shared.observe.mockReset().mockReturnValue(()=>{});});
afterEach(()=>vi.restoreAllMocks());
it('requests the real versioned detail before interaction, deduplicates redraws, publishes only after decode and keeps small faces on thumbnails',async()=>{
 const f=fixture(),refresh=vi.fn();let decoded!:(v:unknown)=>void;shared.decode.mockImplementation(()=>new Promise(r=>decoded=r));
 requestShopJokerGalleryArt(f.scene,['b07','b07'],refresh);requestShopJokerGalleryArt(f.scene,['b07'],refresh);await tick();expect(shared.detail).toHaveBeenCalledOnce();expect(shared.detail.mock.calls[0][0]).toBe(jokerArtUrl('b07'));expect(shopJokerPictureKey(f.scene,'b07',{width:288,height:360})).toBe(jokerArtKey('b07'));expect(refresh).not.toHaveBeenCalled();
 decoded({naturalWidth:615,naturalHeight:768});await tick();expect(shopJokerPictureKey(f.scene,'b07',{width:288,height:360})).toBe('shop-joker-detail/b07');expect(shopJokerPictureKey(f.scene,'b07',{width:64,height:80})).toBe(jokerArtKey('b07'));expect(refresh).toHaveBeenCalledOnce();f.shutdown();expect(f.textures.size).toBe(0);
});
it('keeps a useful thumbnail on failure and retries on a real category leave/reentry without a redraw loop',async()=>{
 const f=fixture(),refresh=vi.fn();f.textures.set(jokerArtKey('b07')!,{});shared.detail.mockRejectedValueOnce(Error('404'));
 requestShopJokerGalleryArt(f.scene,['b07'],refresh);await tick();requestShopJokerGalleryArt(f.scene,['b07'],refresh);expect(shared.detail).toHaveBeenCalledOnce();expect(refresh).not.toHaveBeenCalled();expect(shopJokerPictureKey(f.scene,'b07',{width:288,height:360})).toBe(jokerArtKey('b07'));
 requestShopJokerGalleryArt(f.scene,[],refresh);requestShopJokerGalleryArt(f.scene,['b07'],refresh);await tick();expect(shared.detail).toHaveBeenCalledTimes(2);expect(refresh).toHaveBeenCalledOnce();f.shutdown();expect(f.textures.has(jokerArtKey('b07')!)).toBe(true);
});
it('aborts replaced offers and shutdown leases; late completions cannot publish textures or refresh the scene',async()=>{
 const f=fixture(),refresh=vi.fn(),done=new Map<string,(v:string)=>void>();shared.detail.mockImplementation(url=>new Promise(r=>done.set(url,r)));
 requestShopJokerGalleryArt(f.scene,['b07'],refresh);const signal=shared.detail.mock.calls[0][2] as AbortSignal;requestShopJokerGalleryArt(f.scene,['c05'],refresh);expect(signal.aborted).toBe(true);done.get(jokerArtUrl('b07')!)!('blob:late');await tick();expect(f.textures.size).toBe(0);f.shutdown();done.get(jokerArtUrl('c05')!)!('blob:late');await tick();expect(f.textures.size).toBe(0);expect(refresh).not.toHaveBeenCalled();expect([...f.listeners.values()].every(s=>!s.size)).toBe(true);
});
it('rejects a decoded thumbnail masquerading as detail and preserves the ordinary thumbnail lease',async()=>{
 const f=fixture(),refresh=vi.fn();shared.decode.mockResolvedValue({naturalWidth:128,naturalHeight:160});requestShopJokerGalleryArt(f.scene,['b07'],refresh);await tick();expect(shared.invalidate).toHaveBeenCalledWith(jokerArtUrl('b07'),'blob:detail');expect(f.textures.size).toBe(0);expect(refresh).not.toHaveBeenCalled();f.shutdown();
});
it.each(['T12','U01'])('recovers a failed PC %s face from appreciation once and ignores old observers after category change',async id=>{
 const f=fixture(),refresh=vi.fn();shared.detail.mockRejectedValueOnce(Error('network'));requestShopGalleryArt(f.scene,[id],refresh);await tick();expect(shopGoodsPictureKey(f.scene,id)).toBe(goodsArtKey(id));
 const ready=(shared.observe.mock.calls[0]?.[2]??(()=>{})) as (src:string,image:unknown)=>void;ready('blob:appreciation',{naturalWidth:615,naturalHeight:768});expect(shopGoodsPictureKey(f.scene,id)).toBe('shop-goods-detail/'+id);ready('blob:appreciation',{naturalWidth:615,naturalHeight:768});expect(refresh).toHaveBeenCalledOnce();expect(shared.detail).toHaveBeenCalledOnce();
 requestShopGalleryArt(f.scene,[],refresh);ready('blob:late',{naturalWidth:615,naturalHeight:768});expect(f.textures.size).toBe(0);expect(refresh).toHaveBeenCalledOnce();f.shutdown();
});

it.each([['T12','tool-card'],['U01','item-card']] as const)('upgrades visible %s from the real detail after decode, releases it on category change and never requests unknown artwork',async(id,category)=>{
 const f=fixture(),refresh=vi.fn();let decoded!:(v:unknown)=>void;shared.decode.mockImplementation(()=>new Promise(r=>decoded=r));f.textures.set(goodsArtKey(id),{});
 requestShopGalleryArt(f.scene,[id,'unknown'],refresh);await tick();expect(shared.detail).toHaveBeenCalledOnce();expect(shared.detail.mock.calls[0][0]).toBe(goodsArtUrl(id,category,'detail'));expect(shopGoodsPictureKey(f.scene,id)).toBe(goodsArtKey(id));
 decoded({naturalWidth:615,naturalHeight:768});await tick();expect(shopGoodsPictureKey(f.scene,id)).toBe('shop-goods-detail/'+id);expect(refresh).toHaveBeenCalledOnce();
 requestShopGalleryArt(f.scene,[],refresh);expect(f.textures.has('shop-goods-detail/'+id)).toBe(false);expect(f.textures.has(goodsArtKey(id))).toBe(true);f.shutdown();
});
