import type {Box,Insets,HandWindow} from './layout';
import {pcLandscapeFrame} from './PcLandscapeFrame';

const box=(x:number,y:number,width:number,height:number):Box=>({x,y,width,height});
export interface PcTableOptions {pc?:boolean}

/**
 * The PC arena is deliberately authored as a wide composition rather than a
 * scaled version of the phone table. The left wing carries identity and
 * resources, the top row carries the build and target, the centre is the play
 * stage, and the hand/action rail anchors the next decision.
 */
export function pcTableAreas(viewport:{width:number;height:number},safe:Insets,handWindow:HandWindow,enabled=false){
 const width=viewport.width-safe.left-safe.right,height=viewport.height-safe.top-safe.bottom;
 if(!enabled||width<1180||height<640||width<=height)return;
 const {frame,sidebar:hud,main,compact}=pcLandscapeFrame(viewport.width,viewport.height,safe.top,safe.bottom,safe.left,safe.right);
 const rail=box(viewport.width-safe.right-76,safe.top+8,64,44);
 const count=Number.isSafeInteger(handWindow.count)&&handWindow.count>=0?handWindow.count:8;
 const status=box(main.x,frame.y+frame.height-20,main.width,20);
 const actionHeight=64,actionY=status.y-actionHeight-12;
 const actions=box(main.x,actionY,main.width,actionHeight),tools=box(main.x+main.width-198,actionY,198,64);
 const buttons={rank:box(tools.x,tools.y+14,66,50),suit:box(tools.x+66,tools.y+14,66,50),ai:box(tools.x+132,tools.y+14,66,50)};
 const actionWidth=compact?164:208;
 const tableActions={play:box(main.x,actionY,actionWidth,64),discard:box(main.x+actionWidth+16,actionY,actionWidth,64)};
 const footer={actions,tools,buttons,tableActions};
 const cardWidth=Math.min(142,Math.max(96,(height-420)/4)),handHeight=cardWidth*1.4+28;
 const hand=box(main.x,actionY-20-handHeight,main.width,handHeight);
 // The landing allocator needs 14px padding around a 64×89.6 card.
 // Decide from the actual space left by the stacked layout, including safe
 // insets and the compact score board, rather than a viewport breakpoint.
 const fullRackWidth=Math.min(138,Math.max(80,(height-350)/4.2));
 const stackedLandingHeight=hand.y-40-(main.y+fullRackWidth*1.4+32+16+(compact?92:112)+12);
 const short=stackedLandingHeight<64*1.4+14;
 const heroAction=box(main.x+2*(actionWidth+16),actionY+10,Math.min(224,tools.x-main.x-2*(actionWidth+16)-16),44);
 const handLabel=box(main.x,hand.y-28,160,22);
 const piles=box(main.x+170,hand.y-28,main.width-170,22);
 // In the side-by-side layout, give the build the remaining height after a
 // readable landing card, its padding, the hand gap and rack labels.
 const shortRackBudget=(hand.y-40-main.y-28-12-104)/1.4;
 const rackCardWidth=short?Math.min(fullRackWidth,Math.max(64,shortRackBudget)):fullRackWidth;
 const rackLabelHeight=short?28:32,headerHeight=rackCardWidth*1.4+rackLabelHeight;
 const jokers=box(main.x,main.y,main.width,headerHeight);
 const slots=Array.from({length:5},(_,i)=>box(main.x+16+i*main.width/5,jokers.y+rackLabelHeight,rackCardWidth,rackCardWidth*1.4));
 // When stacked content leaves too little landing space, the score and played
 // cards share a horizontal band.
 // Keep the hand/action sizes; spend less height on the build and use width.
 const middleY=main.y+headerHeight+(short?12:16),middleHeight=hand.y-40-middleY;
 const scoreWidth=short?Math.min(360,main.width*.4):main.width;
 const scoreBoard=box(main.x,middleY,scoreWidth,short?middleHeight:compact?92:112);
 const stageY=short?middleY:scoreBoard.y+scoreBoard.height+12;
 const playedArea=short?box(main.x+scoreWidth+24,middleY,main.width-scoreWidth-24,middleHeight):box(main.x,stageY,main.width,hand.y-40-stageY);
 const preview=box(main.x,scoreBoard.y,main.width,playedArea.y+playedArea.height-scoreBoard.y);
 const handOverflow=count>Math.floor((hand.width-cardWidth)/36)+1;
 const cardArea=handOverflow?box(hand.x+48,hand.y,hand.width-96,hand.height):hand;
 const visibleCardCount=Math.min(count,Math.max(1,Math.floor((cardArea.width-cardWidth)/36)+1));
 const handStart=Math.max(0,Math.min(count-visibleCardCount,Number.isSafeInteger(handWindow.start)?handWindow.start!:0));
 const bandWidth=Math.min(cardArea.width,cardWidth*visibleCardCount+8*Math.max(0,visibleCardCount-1));
 const bandX=cardArea.x+(cardArea.width-bandWidth)/2,pitch=visibleCardCount>1?(bandWidth-cardWidth)/(visibleCardCount-1):0;
 const cards=Array.from({length:count},(_,i)=>{
  const col=i-handStart,x=bandX+(visibleCardCount===1?(bandWidth-cardWidth)/2:col*pitch),last=col===visibleCardCount-1;
  return {visible:i>=handStart&&i<handStart+visibleCardCount,visual:box(x,hand.y+22,cardWidth,cardWidth*1.4),hit:box(x,hand.y,last?cardWidth:Math.min(cardWidth,pitch),handHeight)};
 });

 const row=(offset:number,tall:number)=>box(hud.x+12,hud.y+offset,hud.width-24,tall);
 const heroRows={status:row(94,34),stage:row(138,26),target:row(204,32),heat:row(252,54),gold:row(314,48),progress:row(366,5)};
 const utilities={inventory:box(hud.x+12,frame.y+frame.height-104,hud.width-24,44),help:box(hud.x+12,frame.y+frame.height-52,hud.width-24,44)};
 const heroPortrait=box(hud.x-8,hud.y+386,hud.width+16,Math.max(48,utilities.inventory.y-hud.y-398));
 const eyeWidth=Math.min(188,heroPortrait.width),scoreEyes=box(heroPortrait.x+(heroPortrait.width-eyeWidth)/2,heroPortrait.y+(heroPortrait.height-eyeWidth*3/8)/2,eyeWidth,eyeWidth*3/8);
 const scoreFire=box(scoreBoard.x+8,scoreBoard.y+scoreBoard.height-24,scoreBoard.width-16,20);
 return {hud,jokers,slots,jokerLabels:slots,preview,scoreBoard,playedArea,scoreEyes,scoreFire,hand,handLabel,piles,status,heroAction,cards,handRows:1,handOverflow,visibleCardCount,handStart,labelHeight:18,inventoryEntry:utilities.inventory,helpEntry:utilities.help,...footer,
  handNavigation:{previous:box(hand.x,hand.y+(hand.height-44)/2,44,44),next:box(hand.x+hand.width-44,hand.y+(hand.height-44)/2,44,44)},
  pc:{frame,main,rail,heroPortrait,heroRows,utilities,compact,short,stage:playedArea,build:jokers,entry:box(main.x,main.y,main.width,34)}};
}
