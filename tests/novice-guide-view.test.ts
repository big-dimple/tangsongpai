import {describe,expect,it} from 'vitest';
import {intersects,layout,type Box} from '../src/game/layout';
import {noviceGuideCanvasBox,placeNoviceGuide} from '../src/game/NoviceGuideView';

const inside=(outer:Box,inner:Box)=>inner.x>=outer.x-.001&&inner.y>=outer.y-.001&&inner.x+inner.width<=outer.x+outer.width+.001&&inner.y+inner.height<=outer.y+outer.height+.001;

describe('novice guide placement',()=>{
  it('keeps the hint and reopen target out of hand, skill and utility controls at phone and PC sizes',()=>{
    for(const [width,height] of [[320,568],[320,640],[390,740],[390,844],[1280,720],[1920,1080]]){
      for(const safe of [{top:0,right:0,bottom:0,left:0},{top:12,right:8,bottom:24,left:8}]){
        const table=layout({width,height},safe,undefined,{count:8},{pc:width>=700});
        const bounds={x:safe.left+8,y:safe.top+8,width:width-safe.left-safe.right-16,height:height-safe.top-safe.bottom-16};
        const highlights=[table.cards[1].visual,table.cards[2].visual];
        const protectedAreas=[table.hud,table.scoreBoard,table.hand,table.actions,table.heroAction,table.inventoryEntry,table.helpEntry,...highlights].filter((box):box is Box=>!!box);
        for(const desired of [{width:Math.min(320,bounds.width),height:132},{width:88,height:44}]){
          const placed=placeNoviceGuide(bounds,protectedAreas,desired,highlights[0]);
          expect(placed,`${width}x${height}`).toBeDefined();
          expect(inside(bounds,placed!)).toBe(true);
          expect(placed!.width).toBeGreaterThanOrEqual(44);
          expect(placed!.height).toBeGreaterThanOrEqual(44);
          for(const area of protectedAreas)expect(intersects(placed!,area),`${width}x${height}`).toBe(false);
        }
      }
    }
  });
  it('prefers a complete hint over a closer region that would clip it',()=>{
    const result=placeNoviceGuide({x:0,y:0,width:320,height:500},[{x:0,y:130,width:320,height:80},{x:0,y:270,width:320,height:230}],{width:280,height:100},{x:0,y:210,width:20,height:20});
    expect(result).toBeDefined();expect(result!.y+result!.height).toBeLessThanOrEqual(130);expect(result!.height).toBe(100);
  });
  it('returns no hit target if no safe 44px area exists',()=>{
    expect(placeNoviceGuide({x:0,y:0,width:320,height:568},[{x:0,y:0,width:320,height:568}],{width:88,height:44})).toBeUndefined();
  });
  it('maps scene coordinates through the displayed canvas, including offsets and scaling',()=>{
    expect(noviceGuideCanvasBox({x:50,y:25,width:100,height:40},{left:10,top:20,width:400,height:200},{width:200,height:100}))
      .toEqual({x:110,y:70,width:200,height:80});
    expect(noviceGuideCanvasBox({x:1,y:1,width:2,height:2},{left:10,top:20,width:400,height:200},{width:0,height:0}))
      .toEqual({x:10,y:20,width:0,height:0});
  });
});
