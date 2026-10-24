import {expect,it} from 'vitest';
import {layout,intersects} from '../src/game/layout';
import {shopLayout,shopPortraitHeader} from '../src/game/ShopLayout';

const safe={top:12,right:16,bottom:34,left:8};
const menuAt=(width:number)=>({x:width-safe.right-12-44,y:safe.top+12,width:44,height:44});
it.each([[320,568],[390,740],[844,300]])('keeps the compact menu in the existing header at %ix%i instead of a reserved boss row',(width,height)=>{
 const table=layout({width,height},safe),menu=menuAt(width);
 // Current ShopScene passes a 56px boss-preparation reserve; a fixed DOM menu remains at safe+12.
 const p=shopLayout(width,height,table.hud.y+56,safe.bottom,3,false,false,safe.left,safe.right,0,menu);
 expect(p.top).toBeLessThanOrEqual(menu.y);expect(menu.y-p.top).toBeLessThan(menu.height);
 if(p.portrait){
  const h=shopPortraitHeader(p);expect(h.purse.y).toBe(menu.y);expect(intersects(h.purse,menu)).toBe(false);
  for(const b of [h.purse,h.inventory,h.reroll]){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBe(44);expect(b.x).toBeGreaterThanOrEqual(p.x);}
 }
});
it('preserves normal header placement and PC layout when the anchor already shares the top area',()=>{
 const menu=menuAt(390),normal=shopLayout(390,740,20,34,3,false,false,8,16,0,menu);expect(normal.top).toBe(20);
 const pc=shopLayout(1180,757,24,0,3,false,false,0,0,0,{x:1124,y:12,width:44,height:44});expect(pc.top).toBe(24);expect(pc.pc).toBeTruthy();
});
