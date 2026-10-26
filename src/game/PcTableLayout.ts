import type {Box,Insets,HandWindow} from './layout';
import {handActionControls} from './HandActionControls';

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
 const compact=height<800,margin=width<1500?28:44,vertical=compact?18:28;
 const menuRail=148,frameWidth=Math.min(1680,width-margin*2-menuRail);
 const frame=box(safe.left+margin+(width-margin*2-menuRail-frameWidth)/2,safe.top+vertical,frameWidth,height-vertical*2);
 const rail=box(viewport.width-safe.right-menuRail,safe.top,menuRail,height);
 const sidebarWidth=Math.max(248,Math.min(292,Math.round(frame.width*.2/8)*8)),gap=28;
 const main=box(frame.x+sidebarWidth+gap,frame.y,frame.width-sidebarWidth-gap,frame.height);
 const hud=box(frame.x,frame.y,sidebarWidth,frame.height);
 const count=Number.isSafeInteger(handWindow.count)&&handWindow.count>=0?handWindow.count:8;

 const status=box(main.x,frame.y+frame.height-22,main.width,22);
 const actionHeight=compact?58:64;
 const footer=handActionControls(box(main.x+main.width-Math.min(700,main.width),status.y-actionHeight-12,Math.min(700,main.width),actionHeight),'desktop');
 const cardWidth=compact?96:122,handHeight=cardWidth*1.4+24;
 const hand=box(main.x,footer.actions.y-12-handHeight,main.width,handHeight);
 const heroAction=box(main.x,hand.y-50,Math.min(208,main.width*.27),44);
 const handLabel=box(main.x+heroAction.width+18,hand.y-24,116,18);
 const piles=box(handLabel.x+116,handLabel.y,Math.max(0,main.width-heroAction.width-134),18);

 const headerY=main.y+10;
 const buildWidth=Math.min(main.width*.58,main.width-310);
 const rackCardWidth=Math.min(compact?100:124,(buildWidth-4*22)/5),rackWidth=rackCardWidth*5+4*22;
 const headerHeight=Math.max(compact?172:206,rackCardWidth*1.4+30);
 const jokers=box(main.x,headerY,buildWidth,headerHeight);
 const slots=Array.from({length:5},(_,i)=>box(main.x+(buildWidth-rackWidth)/2+i*(rackCardWidth+22),jokers.y+26,rackCardWidth,rackCardWidth*1.4));
 const scoreWidth=Math.min(340,Math.max(286,main.width-buildWidth-20));
 const scoreBoard=box(main.x+main.width-scoreWidth,headerY,scoreWidth,headerHeight);
 const stageX=main.x,stageY=headerY+headerHeight+16,stageWidth=main.width-scoreWidth-20;
 const stageHeight=Math.max(108,hand.y-stageY-20);
 const playedArea=box(stageX,stageY,stageWidth,stageHeight);
 const preview=box(main.x,headerY,main.width,hand.y-headerY-12);

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

 const portraitHeight=compact?300:348,heroPortrait=box(hud.x+16,hud.y+76,hud.width-32,portraitHeight);
 const rowTop=heroPortrait.y+heroPortrait.height+8,row=(offset:number,tall:number)=>box(hud.x+16,rowTop+offset,hud.width-32,tall);
 const heroRows={status:row(0,36),stage:row(40,18),heat:row(64,30),target:row(100,18),gold:row(124,36),progress:row(164,5)};
 const utilities={inventory:box(hud.x+16,frame.y+frame.height-106,hud.width-32,44),help:box(hud.x+16,frame.y+frame.height-56,hud.width-32,44)};
 const eyeWidth=Math.min(188,heroPortrait.width),scoreEyes=box(heroPortrait.x+(heroPortrait.width-eyeWidth)/2,heroPortrait.y+(heroPortrait.height-eyeWidth*3/8)/2,eyeWidth,eyeWidth*3/8);
 const scoreFire=box(scoreBoard.x+8,scoreBoard.y+scoreBoard.height-24,scoreBoard.width-16,20);
 return {hud,jokers,slots,jokerLabels:slots,preview,scoreBoard,playedArea,scoreEyes,scoreFire,hand,handLabel,piles,status,heroAction,cards,handRows:1,handOverflow,visibleCardCount,handStart,labelHeight:18,inventoryEntry:utilities.inventory,helpEntry:utilities.help,...footer,
  handNavigation:{previous:box(hand.x,hand.y+(hand.height-44)/2,44,44),next:box(hand.x+hand.width-44,hand.y+(hand.height-44)/2,44,44)},
  pc:{frame,main,rail,heroPortrait,heroRows,utilities,compact,stage:playedArea,build:jokers,entry:box(main.x,main.y,main.width,34)}};
}
