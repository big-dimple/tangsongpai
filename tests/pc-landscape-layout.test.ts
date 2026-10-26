import {expect,it} from 'vitest';
import {layout,intersects,type Box} from '../src/game/layout';
const safe={top:0,right:0,bottom:0,left:0};
it.each([[1920,1080],[1920,924],[1366,768]])('PC %sx%s keeps the build, score, played hand, hand and actions in a single reading column',(width,height)=>{
 const l=layout({width,height},safe,undefined,{count:8},{pc:true});expect(l.pc).toBeDefined();
 const lanes=[l.jokers,l.scoreBoard,l.playedArea,l.hand,l.actions];
 for(const lane of lanes){expect(lane.x).toBe(l.pc!.main.x);expect(lane.width).toBe(l.pc!.main.width);expect(lane.height).toBeGreaterThan(20);}
 for(const [i,lane] of lanes.entries())for(const other of lanes.slice(i+1))expect(intersects(lane,other)).toBe(false);
 expect(l.playedArea.y+l.playedArea.height).toBeLessThanOrEqual(l.handLabel.y-8);
 const controls=[...Object.values(l.tableActions),...Object.values(l.buttons),l.heroAction!];
 for(const [i,b]of controls.entries()){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);for(const other of controls.slice(i+1))expect(intersects(b,other)).toBe(false);}
 for(const b of [...lanes,l.pc!.heroPortrait,...controls,...l.slots] as Box[]){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(height);}
 expect(l.hud.width).toBeLessThan(width*.21);expect(l.pc!.main.width).toBeGreaterThan(width*.73);
});
it('1920 main composition spends the width on cards and keeps the hero subordinate',()=>{
 const l=layout({width:1920,height:1080},safe,undefined,{count:8},{pc:true});
 expect(l.cards[0].visual.width).toBeGreaterThanOrEqual(140);expect(l.slots[0].width).toBeGreaterThanOrEqual(130);
 expect(l.pc!.heroPortrait.width).toBeLessThan(320);expect(l.playedArea.height).toBeGreaterThan(130);
});
it('does not enable PC composition for phones or primary coarse pointer callers',()=>{
 for(const [width,height] of [[390,844],[844,390],[1920,1080]])expect(layout({width,height},safe,undefined,{count:8},{pc:false}).pc).toBeUndefined();
});

it.each([[1180,640],[1280,640],[1280,720],[1920,700],[1920,710]])('short PC %sx%s gives real played cards room above every hand hit',(width,height)=>{
 const l=layout({width,height},safe,undefined,{count:8},{pc:true});
 expect(l.pc?.short).toBe(true);
 expect(l.scoreBoard.y).toBe(l.playedArea.y);
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
it('short-PC breakpoint uses height remaining after browser safe insets',()=>{
 const l=layout({width:1280,height:740},{...safe,top:50,bottom:50},undefined,{count:8},{pc:true});
 expect(l.pc?.short).toBe(true);expect(l.playedArea.height).toBeGreaterThanOrEqual(100);
 for(const card of l.cards)expect(intersects(l.playedArea,card.hit)).toBe(false);
});
