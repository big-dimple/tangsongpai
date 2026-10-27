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
 const grid=pcLandscapeFrame(viewport.width,viewport.height,safe.top,safe.bottom,safe.left,safe.right),{compact}=grid;
 // Keep a broad monitor from stretching the table and its card rack apart.
 const frame={...grid.frame,width:Math.min(1600,grid.frame.width)};
 frame.x=grid.frame.x+(grid.frame.width-frame.width)/2;
 const hud={...grid.sidebar,x:frame.x},main={...grid.main,x:frame.x+hud.width+grid.gap,width:frame.width-hud.width-grid.gap};
 const rail=box(viewport.width-safe.right-76,safe.top+8,64,44);
 const count=Number.isSafeInteger(handWindow.count)&&handWindow.count>=0?handWindow.count:8;
 const status=box(main.x,frame.y+frame.height-20,main.width,20);
 const actionHeight=64,actionY=status.y-actionHeight-12;
 // Keep the three main actions together beneath the centred hand, regardless
 // of the width of the surrounding table. The skill has its own adjacent hit.
 const actions=box(main.x,actionY,main.width,actionHeight),gap=10,actionWidth=164,sortWidth=198;
 const groupWidth=actionWidth*2+sortWidth+gap*2,groupX=main.x+(main.width-groupWidth)/2;
 const tools=box(groupX+actionWidth+gap,actionY,sortWidth,64);
 const buttons={rank:box(tools.x,tools.y+14,66,50),suit:box(tools.x+66,tools.y+14,66,50),ai:box(tools.x+132,tools.y+14,66,50)};
 const tableActions={discard:box(groupX,actionY,actionWidth,64),play:box(tools.x+tools.width+gap,actionY,actionWidth,64)};
 const footer={actions,tools,buttons,tableActions};
 const cardWidth=Math.min(142,Math.max(96,(height-420)/4)),handHeight=cardWidth*1.4+28;
 const hand=box(main.x,actionY-20-handHeight,main.width,handHeight);
 // The landing allocator needs 14px padding around a 64×89.6 card.
 // Use the conservative former stacked-space budget, including safe insets,
 // to choose a smaller rack before the landing band becomes constrained.
 const fullRackWidth=Math.min(100,Math.max(80,(height-350)/4.2));
 const stackedLandingHeight=hand.y-40-(main.y+fullRackWidth*1.4+32+16+(compact?92:112)+12);
 const short=stackedLandingHeight<64*1.4+14;
 const heroX=tableActions.play.x+tableActions.play.width+12;
 const heroAction=box(heroX,actionY+10,Math.min(160,main.x+main.width-heroX),44);
 const handLabel=box(main.x,hand.y-28,160,22);
 const piles=box(main.x+170,hand.y-28,main.width-170,22);
 // In the side-by-side layout, give the build the remaining height after a
 // readable landing card, its padding, the hand gap and rack labels.
 const shortRackBudget=(hand.y-40-main.y-28-12-104)/1.4;
 const rackCardWidth=short?Math.min(fullRackWidth,Math.max(64,shortRackBudget)):fullRackWidth;
 const rackLabelHeight=short?28:32,headerHeight=rackCardWidth*1.4+rackLabelHeight;
 const rackWidth=Math.min(1100,main.width),rackX=main.x+(main.width-rackWidth)/2;
 const jokers=box(rackX,main.y,rackWidth,headerHeight);
 const slots=Array.from({length:5},(_,i)=>box(rackX+16+i*rackWidth/5,jokers.y+rackLabelHeight,rackCardWidth,rackCardWidth*1.4));
 // A single central band keeps scoring beside the played cards at every PC height.
 const middleY=main.y+headerHeight+(short?12:16),middleHeight=hand.y-40-middleY;
 const scoreWidth=Math.min(360,main.width*.4),scoreHeight=Math.min(middleHeight,compact?110:130);
 const scoreBoard=box(main.x,middleY+(middleHeight-scoreHeight)/2,scoreWidth,scoreHeight);
 const playedArea=box(main.x+scoreWidth+24,middleY,main.width-scoreWidth-24,middleHeight);
 const preview=box(main.x,middleY,main.width,middleHeight);
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
