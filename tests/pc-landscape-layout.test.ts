import {expect,it} from 'vitest';
import {layout,intersects,type Box} from '../src/game/layout';
const safe={top:0,right:0,bottom:0,left:0};
it.each([[1920,1080],[1920,924],[1366,768],[1280,640],[1180,640]])('PC %sx%s footer keeps discard, sorting and play compact beneath the hand, with a separate skill',(width,height)=>{
 const l=layout({width,height},safe,undefined,{count:8},{pc:true}),{discard,play}=l.tableActions;
 expect(l.pc).toBeDefined();expect((discard.x+play.x+play.width)/2).toBe(l.hand.x+l.hand.width/2);
 expect(play.x+play.width-discard.x).toBe(546);
 expect(l.tools.x+l.tools.width/2).toBe(l.actions.x+l.actions.width/2);
 expect(l.tools.x-(discard.x+discard.width)).toBe(10);
 expect(play.x-(l.tools.x+l.tools.width)).toBe(10);
 expect(l.heroAction!.x-(play.x+play.width)).toBe(12);
 expect(l.heroAction!.x+l.heroAction!.width).toBeLessThanOrEqual(l.pc!.main.x+l.pc!.main.width);
 const controls=[discard,...Object.values(l.buttons),l.heroAction!,play];
 for(const [i,a] of controls.entries()){
  expect(a.width).toBeGreaterThanOrEqual(44);expect(a.height).toBeGreaterThanOrEqual(44);
  expect(intersects(a,l.hand)).toBe(false);
  for(const b of controls.slice(i+1))expect(intersects(a,b)).toBe(false);
 }
});
it.each([[1920,1080],[1920,924]])('PC %sx%s keeps a compact rack and a shared score/played band above the hand',(width,height)=>{
 const l=layout({width,height},safe,undefined,{count:8},{pc:true});expect(l.pc).toBeDefined();
 expect(l.pc!.short).toBe(false);
 const lanes=[l.jokers,l.scoreBoard,l.playedArea,l.hand,l.actions];
 expect(l.jokers.width).toBe(1100);expect(l.jokers.x+l.jokers.width/2).toBe(l.pc!.main.x+l.pc!.main.width/2);
 expect(l.scoreBoard.x+l.scoreBoard.width+24).toBe(l.playedArea.x);
 expect(l.scoreBoard.y).toBeGreaterThanOrEqual(l.playedArea.y);
 expect(l.scoreBoard.y+l.scoreBoard.height).toBeLessThanOrEqual(l.playedArea.y+l.playedArea.height);
 for(const lane of lanes)expect(lane.height).toBeGreaterThan(20);
 for(const [i,lane] of lanes.entries())for(const other of lanes.slice(i+1))expect(intersects(lane,other)).toBe(false);
 expect(l.playedArea.y+l.playedArea.height).toBeLessThanOrEqual(l.handLabel.y-8);
 const controls=[...Object.values(l.tableActions),...Object.values(l.buttons),l.heroAction!];
 for(const [i,b]of controls.entries()){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);for(const other of controls.slice(i+1))expect(intersects(b,other)).toBe(false);}
 for(const b of [...lanes,l.pc!.heroPortrait,...controls,...l.slots] as Box[]){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(height);}
 expect(l.hud.width).toBeLessThan(width*.21);expect(l.pc!.frame.width).toBe(1600);
 expect(l.pc!.frame.x+l.pc!.frame.width/2).toBe(width/2);
 expect(l.pc!.main.width).toBeGreaterThanOrEqual(1200);
});
it('1920 main composition spends the width on cards and keeps the hero subordinate',()=>{
 const l=layout({width:1920,height:1080},safe,undefined,{count:8},{pc:true});
 expect(l.cards[0].visual.width).toBeGreaterThanOrEqual(140);expect(l.slots[0].width).toBe(100);
 expect(l.pc!.heroPortrait.width).toBeLessThan(320);expect(l.playedArea.height).toBeGreaterThan(130);
});
it('does not enable PC composition for phones or primary coarse pointer callers',()=>{
 for(const [width,height] of [[390,844],[844,390],[1920,1080]])expect(layout({width,height},safe,undefined,{count:8},{pc:false}).pc).toBeUndefined();
});

it.each([[1180,640],[1280,640],[1280,720],[1920,700],[1920,710],[1366,768]])('short PC %sx%s gives real played cards room above every hand hit',(width,height)=>{
 const l=layout({width,height},safe,undefined,{count:8},{pc:true});
 expect(l.pc?.short).toBe(true);
 expect(l.scoreBoard.y).toBeGreaterThanOrEqual(l.playedArea.y);
 expect(l.playedArea.x).toBeGreaterThanOrEqual(l.scoreBoard.x+l.scoreBoard.width+24);
 expect(l.playedArea.height).toBeGreaterThanOrEqual(100);
 expect(l.playedArea.width).toBeGreaterThanOrEqual(480);
 expect(l.playedArea.y+l.playedArea.height).toBeLessThanOrEqual(l.handLabel.y-8);
 for(const card of l.cards)expect(intersects(l.playedArea,card.hit)).toBe(false);
 for(const a of [l.scoreBoard,l.playedArea])for(const b of [l.jokers,l.hand,l.actions])expect(intersects(a,b)).toBe(false);
 // The actual landing allocator leaves 14px padding and uses a 5:7 card.
 expect((l.playedArea.height-14)/1.4).toBeGreaterThanOrEqual(64);
 for(const button of [...Object.values(l.tableActions),...Object.values(l.buttons)])expect(button.height).toBeGreaterThanOrEqual(44);
});
it('switches layout when the stacked landing area falls below the readable card height',()=>{
 const layouts=[safe,{top:24,right:12,bottom:34,left:12}].flatMap(insets=>
  Array.from({length:285},(_,i)=>layout({width:1366,height:640+i+insets.top+insets.bottom},insets,undefined,{count:8},{pc:true})));
 expect(layouts.some(l=>l.pc!.short)).toBe(true);
 expect(layouts.some(l=>!l.pc!.short)).toBe(true);
 for(const l of layouts)expect((l.playedArea.height-14)/1.4).toBeGreaterThanOrEqual(64);
});
it('uses spare height for the build without shrinking the played cards',()=>{
 const short=layout({width:1366,height:768},safe,undefined,{count:8},{pc:true});
 const tight=layout({width:1280,height:640},safe,undefined,{count:8},{pc:true});
 expect(short.slots[0].width).toBeGreaterThan(96);
 expect(tight.slots[0].width).toBeGreaterThanOrEqual(64);
 expect(tight.slots[0].width).toBeLessThan(65);
 for(const l of [short,tight])expect(l.playedArea.height).toBeGreaterThanOrEqual(64*1.4+14-1e-9);
});
it('short-PC breakpoint uses height remaining after browser safe insets',()=>{
 const l=layout({width:1280,height:740},{...safe,top:50,bottom:50},undefined,{count:8},{pc:true});
 expect(l.pc?.short).toBe(true);expect(l.playedArea.height).toBeGreaterThanOrEqual(100);
 for(const card of l.cards)expect(intersects(l.playedArea,card.hit)).toBe(false);
});

it('keeps the complete compact actions and skill within the main column at minimum usable size with safe insets',()=>{
 const inset={top:24,bottom:34,left:12,right:12};
 const l=layout({width:1204,height:698},inset,undefined,{count:8},{pc:true});
 expect(l.pc).toBeDefined();
 const {discard,play}=l.tableActions;
 expect(play.x+play.width-discard.x).toBe(546);
 expect(l.heroAction.x-(play.x+play.width)).toBe(12);
 expect(l.heroAction.width).toBeGreaterThanOrEqual(140);
 expect(l.heroAction.x+l.heroAction.width).toBeLessThanOrEqual(l.pc!.main.x+l.pc!.main.width);
 for(const a of [discard,play,...Object.values(l.buttons),l.heroAction])for(const card of l.cards)expect(intersects(a,card.hit)).toBe(false);
});
