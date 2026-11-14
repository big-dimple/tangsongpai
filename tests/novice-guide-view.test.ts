import {describe,expect,it} from 'vitest';
import {intersects,layout,type Box} from '../src/game/layout';
import {noviceGuideCanvasBox,placeNoviceGuide} from '../src/game/NoviceGuideView';
import {idlePlayedArea} from '../src/game/ScoreTableLayout';

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
  it('fits the compact 320px lesson beside every actual selected-card preview',()=>{
    const table=layout({width:320,height:568},{top:0,right:0,bottom:0,left:0},undefined,{count:8});
    const bounds={x:8,y:8,width:304,height:552},area=idlePlayedArea(table);
    const controls=[table.hud,table.scoreBoard,table.hand,table.actions,table.heroAction,table.inventoryEntry,table.helpEntry,...Object.values(table.buttons)].filter((box):box is Box=>!!box);
    for(const count of [1,2,5]){
      const height=Math.max(24,area.height-14),width=Math.min(64,height/1.4,(area.width-24-8*(count-1))/count),total=count*width+(count-1)*8;
      const previews=Array.from({length:count},(_,index)=>({x:area.x+(area.width-total)/2+index*(width+8)-2,y:area.y+(area.height-width*1.4)/2-2,width:width+4,height:width*1.4+4}));
      const placed=placeNoviceGuide(bounds,[...controls,...previews],{width:304,height:88},table.cards[6].hit);
      expect(placed).toMatchObject({width:304,height:88});expect(inside(bounds,placed!)).toBe(true);
      for(const box of [...controls,...previews])expect(intersects(placed!,box),`selected ${count}: ${JSON.stringify({placed,box})}`).toBe(false);
    }
  });
  it('remeasures a compact full-width guide before considering a side sliver',()=>{
    const table=layout({width:320,height:568},{top:0,right:0,bottom:0,left:0},undefined,{count:8});
    const bounds={x:8,y:8,width:304,height:552};
    const controls=[table.hud,table.scoreBoard,table.hand,table.actions,table.heroAction,table.inventoryEntry,table.helpEntry,...Object.values(table.buttons)].filter((box):box is Box=>!!box);
    // A single played card divides the otherwise vacant lower band into two
    // narrow columns. The full-width band above the score is 88.64px high.
    const selectedPreview={x:126,y:217.84,width:68,height:93.6};
    const caption={x:8,y:196.64,width:42,height:16};
    const protectedAreas=[...controls,selectedPreview,caption];
    const anchor=table.cards[6].hit;
    expect(placeNoviceGuide(bounds,protectedAreas,{width:304,height:103},anchor,{requireFit:true})).toBeUndefined();
    const compact=placeNoviceGuide(bounds,protectedAreas,{width:304,height:86},anchor,{requireFit:true});
    expect(compact).toBeDefined();expect(compact!.width).toBe(304);expect(compact!.height).toBe(86);
    expect(compact!.y).toBeGreaterThanOrEqual(table.hud.y+table.hud.height);
    expect(compact!.y+compact!.height).toBeLessThanOrEqual(table.scoreBoard.y);
    for(const area of protectedAreas)expect(intersects(compact!,area)).toBe(false);
    // If content really cannot fit, the scroll fallback keeps the full-width
    // region and is bounded by it, instead of spilling out over the hand.
    const fallback=placeNoviceGuide(bounds,protectedAreas,{width:304,height:130},anchor,{minWidth:240});
    expect(fallback!.width).toBe(304);expect(fallback!.height).toBeLessThan(130);
    for(const area of protectedAreas)expect(intersects(fallback!,area)).toBe(false);
  });
  it('keeps the full compact sort prompt above the hero control',()=>{
    const table=layout({width:320,height:568},{top:0,right:0,bottom:0,left:0},undefined,{count:8});
    const bounds={x:8,y:8,width:304,height:552};
    const controls=[table.hud,table.scoreBoard,table.hand,table.actions,table.heroAction,table.inventoryEntry,table.helpEntry,...Object.values(table.buttons)].filter((box):box is Box=>!!box);
    expect(placeNoviceGuide(bounds,controls,{width:304,height:115},table.buttons.suit,{requireFit:true})).toBeUndefined();
    const compact=placeNoviceGuide(bounds,controls,{width:304,height:84},table.buttons.suit,{requireFit:true});
    expect(compact).toBeDefined();expect(compact!.width).toBe(304);expect(compact!.height).toBe(84);
    for(const area of controls)expect(intersects(compact!,area)).toBe(false);
  });
  it('prefers a complete hint over a closer region that would clip it',()=>{
    const result=placeNoviceGuide({x:0,y:0,width:320,height:500},[{x:0,y:130,width:320,height:80},{x:0,y:270,width:320,height:230}],{width:280,height:100},{x:0,y:210,width:20,height:20});
    expect(result).toBeDefined();expect(result!.y+result!.height).toBeLessThanOrEqual(130);expect(result!.height).toBe(100);
  });
  it('places a complete hint beside the current hand instead of a distant top banner',()=>{
    const result=placeNoviceGuide({x:0,y:0,width:390,height:700},[{x:0,y:80,width:390,height:110},{x:0,y:490,width:390,height:210}],{width:300,height:100},{x:40,y:500,width:60,height:90});
    expect(result).toBeDefined();expect(result!.y).toBeGreaterThanOrEqual(190);expect(result!.y+result!.height).toBeLessThanOrEqual(490);
    expect(Math.abs(result!.y+50-545)).toBeLessThan(200);
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
