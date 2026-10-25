import type {Box,Insets,HandWindow} from './layout';
import {handActionControls} from './HandActionControls';

const box=(x:number,y:number,width:number,height:number):Box=>({x,y,width,height});
export interface PcTableOptions {pc?:boolean}

/** Opt-in at the game scene only. Geometry stays pure; pointer capability is a caller concern. */
export function pcTableAreas(viewport:{width:number;height:number},safe:Insets,handWindow:HandWindow,enabled=false){
 const width=viewport.width-safe.left-safe.right,height=viewport.height-safe.top-safe.bottom;
 if(!enabled||width<1180||height<640||width<=height)return;
 const compact=height<800,margin=width<1500?32:48,vertical=compact?16:32;
 // The native menu still owns the right rail. The CSS app height already excludes
 // the controller hint bar; subtracting it here would reserve it twice.
 const railWidth=148,frameWidth=Math.min(1600,width-margin*2-railWidth);
 const frame=box(safe.left+margin+(width-margin*2-railWidth-frameWidth)/2,safe.top+vertical,frameWidth,height-vertical*2);
 const rail=box(viewport.width-safe.right-railWidth,safe.top,railWidth,height);
 const sidebarWidth=Math.max(208,Math.min(256,Math.round(frame.width*.18/8)*8)),gap=32;
 const main=box(frame.x+sidebarWidth+gap,frame.y,frame.width-sidebarWidth-gap,frame.height);
 // This is also the shared exclusion rectangle for score-source captions.
 // Cover the entire identity/context column, including rows below the portrait.
 const hud=box(frame.x,frame.y,sidebarWidth,frame.height);
 const count=Number.isSafeInteger(handWindow.count)&&handWindow.count>=0?handWindow.count:8;
 const status=box(main.x,frame.y+frame.height-20,main.width,20);
 const footer=handActionControls(box(main.x+main.width-Math.min(600,main.width),status.y-66,Math.min(600,main.width),58),'desktop');
 const cardWidth=compact?92:120,handHeight=cardWidth*1.4+22;
 const hand=box(main.x,footer.actions.y-8-handHeight,main.width,handHeight);
 const heroAction=box(main.x,hand.y-52,Math.min(176,main.width*.24),44);
 const handLabel=box(main.x+heroAction.width+16,hand.y-24,116,18),piles=box(handLabel.x+116,handLabel.y,Math.max(0,main.width-heroAction.width-132),18);
 // Tall desktops gain illustration, not larger distances between related data.
 const rackCardWidth=Math.min(compact?Math.min(104,88+(height-640)/8):140,(main.width-4*24)/5),rackWidth=rackCardWidth*5+4*24;
 const jokers=box(main.x,main.y,main.width,rackCardWidth*1.4);
 const slots=Array.from({length:5},(_,i)=>box(main.x+(main.width-rackWidth)/2+i*(rackCardWidth+24),jokers.y,rackCardWidth,rackCardWidth*1.4));
 const preview=box(main.x,jokers.y+jokers.height+16,main.width,heroAction.y-16-jokers.y-jokers.height-16);
 const scoreHeight=Math.min(128,Math.max(80,preview.height-112));
 // At low desktop heights, put the readout beside the landing lane instead
 // of squeezing five played faces into the remaining vertical sliver.
 const shortFocus=height<700,scoreWidth=shortFocus?320:main.width;
 const scoreBoard=box(main.x,preview.y,scoreWidth,shortFocus?preview.height:scoreHeight);
 const playedArea=shortFocus?box(scoreBoard.x+scoreWidth+16,preview.y,main.width-scoreWidth-16,preview.height):box(main.x,scoreBoard.y+scoreHeight+8,main.width,Math.max(0,preview.height-scoreHeight-8));
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
 const portraitHeight=compact?164:256,heroPortrait=box(hud.x+12,hud.y+96,hud.width-24,portraitHeight);
 const rowTop=heroPortrait.y+heroPortrait.height+8,row=(offset:number,tall:number)=>box(hud.x+12,rowTop+offset,hud.width-24,tall);
 const heroRows={status:row(0,36),stage:row(40,18),heat:row(64,30),target:row(100,18),gold:row(124,36),progress:row(164,5)};
 const utilities={inventory:box(hud.x+12,footer.actions.y-48,hud.width-24,44),help:box(hud.x+12,footer.actions.y,hud.width-24,44)};
 const eyeWidth=Math.min(176,heroPortrait.width),scoreEyes=box(heroPortrait.x+(heroPortrait.width-eyeWidth)/2,heroPortrait.y+(heroPortrait.height-eyeWidth*3/8)/2,eyeWidth,eyeWidth*3/8);
 // Legacy effect consumers still receive a bounded final-board anchor even
 // though the PC paper treatment does not draw the old fire decoration.
 const scoreFire=box(scoreBoard.x+8,scoreBoard.y+scoreBoard.height-24,scoreBoard.width-16,20);
 return {hud,jokers,slots,jokerLabels:slots,preview,scoreBoard,playedArea,scoreEyes,scoreFire,hand,handLabel,piles,status,heroAction,cards,handRows:1,handOverflow,visibleCardCount,handStart,labelHeight:18,inventoryEntry:utilities.inventory,helpEntry:utilities.help,...footer,
  handNavigation:{previous:box(hand.x,hand.y+(hand.height-44)/2,44,44),next:box(hand.x+hand.width-44,hand.y+(hand.height-44)/2,44,44)},
  pc:{frame,main,rail,heroPortrait,heroRows,utilities,compact}};
}
