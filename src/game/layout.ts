import {handActionControls} from './HandActionControls';
import {handSeats} from './HandSeats';
import {pcTableAreas,type PcTableOptions} from './PcTableLayout';
import {continuousScoreAreas} from './ScoreTableLayout';
export interface Box {x:number;y:number;width:number;height:number}
export interface Insets {top:number;right:number;bottom:number;left:number}
export type LayoutMode='portrait'|'landscape'|'desktop';
export interface HandWindow {count:number;start?:number}
type Viewport={width:number;height:number};
// Shared edges are not overlaps; tolerate floating-point rounding below a CSS subpixel.
export const intersects=(a:Box,b:Box):boolean=>a.x<b.x+b.width-1e-6&&b.x<a.x+a.width-1e-6&&a.y<b.y+b.height-1e-6&&b.y<a.y+a.height-1e-6;
const box=(x:number,y:number,width:number,height:number):Box=>({x,y,width,height});

/** A short landscape keeps the score and played cards side by side. */
function shortTableAreas(viewport:Viewport,safe:Insets,window:HandWindow){
  const x=safe.left+12,y=safe.top+12,w=viewport.width-safe.left-safe.right-24,h=viewport.height-safe.top-safe.bottom-24;
  const side=Math.min(160,w*.26),cx=x+side+16,cw=w-side-16;
  const centered=(limit:number,top:number,height:number)=>box(cx+(cw-Math.min(cw,limit))/2,top,Math.min(cw,limit),height);
  const hud=box(x,y,side,h-32),status=box(x,y+h-28,side,28);
  const actions=centered(744,y+h-52,52),mainHeight=actions.y-4-y;
  const shortLandscape=mainHeight-72-122-22-44-16<80;
  const labelHeight=mainHeight<300?0:22;
  const available=mainHeight-80-labelHeight-(shortLandscape?8:60);
  const rackHeight=Math.min(72,Math.max(44,available-122));
  const handHeight=Math.min(122,Math.max(64,available-rackHeight));
  const jokers=box(cx,y-4,cw-144,rackHeight+4);
  const slotWidth=Math.min(60,jokers.height/1.4,(jokers.width-40)/5);
  const rackX=jokers.x+(jokers.width-5*slotWidth-40)/2;
  const slots=Array.from({length:5},(_,i)=>box(rackX+i*(slotWidth+10),jokers.y,slotWidth,slotWidth*1.4));
  const hand=centered(1100,actions.y-4-handHeight,handHeight);
  const cardWidth=Math.min(132,(handHeight-22)/1.4,hand.width-7*36);
  const handLabel=box(hand.x,hand.y-labelHeight,Math.min(116,hand.width*.3),labelHeight||18);
  const piles=box(hand.x+handLabel.width,handLabel.y,hand.width-handLabel.width,handLabel.height);
  const top=jokers.y+jokers.height+4,bottom=hand.y-labelHeight-(shortLandscape?4:52);
  const preview=centered(1100,top,bottom-top);
  const scoreBoard=box(preview.x,top,preview.width*.5-4,preview.height);
  const playedArea=box(scoreBoard.x+scoreBoard.width+8,top,preview.width-scoreBoard.width-8,preview.height);
  return {hud,status,actions,jokers,slots,hand,handLabel,piles,preview,scoreBoard,playedArea,labelHeight,shortLandscape,
    heroAction:box(hud.x+76,hud.y+64,hud.width-88,44),...handSeats(hand,window,cardWidth,1,36)};
}

/** Tablet and mid-width desktop fallback. The build, landing and hand share a column. */
function desktopTableAreas(viewport:Viewport,safe:Insets,window:HandWindow){
  const {width,height}=viewport,x=safe.left+12,w=width-safe.left-safe.right-24;
  const railWidth=width>=1180&&height>=600?148:0;
  const mainW=Math.min(1100,w-240-railWidth),mainX=x+240+(w-240-railWidth-mainW)/2;
  const hud=box(x,safe.top+8,224,250),status=box(mainX,height-safe.bottom-28,mainW,20);
  const actionWidth=Math.min(480,mainW),actions=box(mainX+(mainW-actionWidth)/2,status.y-60,actionWidth,56);
  const cardWidth=Math.min(104,Math.max(88,(height-safe.top-safe.bottom)*.13)),handHeight=cardWidth*1.4+22;
  const hand=box(mainX,actions.y-4-handHeight,mainW,handHeight);
  const jokers=box(mainX,safe.top+(railWidth?12:64),mainW,104*1.4+(railWidth?52:0));
  const slotWidth=Math.min(railWidth?140:104,(mainW-88)/5),rackX=mainX+(mainW-5*slotWidth-88)/2;
  const slots=Array.from({length:5},(_,i)=>box(rackX+i*(slotWidth+22),jokers.y,slotWidth,slotWidth*1.4));
  const heroAction=box(hand.x,hand.y-48,132,44),playedTop=jokers.y+jokers.height+22.4;
  const preview=box(mainX,playedTop,mainW,hand.y-4-playedTop);
  const playedArea={...preview,height:Math.max(0,heroAction.y-4-playedTop)};
  return {hud,status,actions,jokers,slots,hand,preview,playedArea,heroAction,labelHeight:0,shortLandscape:false,
    scoreBoard:box(x,hud.y+hud.height+12,224,164),handLabel:box(mainX,hand.y-18,116,18),piles:box(mainX+116,hand.y-18,mainW-116,18),
    ...handSeats(hand,window,cardWidth,1,36,true)};
}

function phoneTableAreas(viewport:Viewport,safe:Insets,window:HandWindow){
  const {width,height}=viewport,net=height-safe.top-safe.bottom,count=window.count;
  const margin=width<380?8:12,x=safe.left+margin,w=width-safe.left-safe.right-2*margin;
  const gap=net<680?4:8,pitch=width<320||width<360&&count===9?30:36;
  const hud=box(x,safe.top+8,w,52),actions=box(x,height-safe.bottom-66,w,58);
  const utilityHeight=net>=700?52:44,scoreHeight=net<550?72:net<660?96:count>=10&&net<720?92:108;
  const preferredRack=Math.min(64,(w-48)/5),preferredLanding=net<620?60:88;
  // Reserve a readable hand first. On a notched 320px phone the rack and
  // landing can give up space while keeping five 44px targets and the caption.
  const flexible=actions.y-hud.y-hud.height-5*gap-scoreHeight-22-utilityHeight;
  const oneRowMinimum=52*1.4+22;
  const deficit=Math.max(0,oneRowMinimum+preferredLanding+preferredRack*1.4-flexible);
  const rackSavings=Math.min(deficit,Math.max(0,preferredRack-44)*1.4);
  const baseRack=preferredRack-rackSavings/1.4;
  const minLanding=Math.max(48,preferredLanding-(deficit-rackSavings));
  const maxHand=flexible-baseRack*1.4-minLanding;
  const rows=count>=10&&count<=14&&maxHand>=2*oneRowMinimum?2:1;
  const columns=rows===2?Math.ceil(count/2):count>9?8:count;
  const desiredWidth=rows===2?64:Math.max(52,Math.min(96,w-Math.max(0,columns-1)*pitch));
  const handHeight=Math.min(rows*(desiredWidth*1.4+22),maxHand),cardWidth=(handHeight/rows-22)/1.4;
  const slotGap=width<360?4:6,slotWidth=Math.min(76,(w-slotGap*4)/5,baseRack+Math.max(0,maxHand-handHeight)/1.4);
  const rackWidth=slotWidth*5+slotGap*4,jokers=box(x,hud.y+hud.height+gap,w,slotWidth*1.4);
  const slots=Array.from({length:5},(_,i)=>box(x+(w-rackWidth)/2+i*(slotWidth+slotGap),jokers.y,slotWidth,slotWidth*1.4));
  const scoreBoard=box(x,jokers.y+jokers.height+gap,w,scoreHeight),playedTop=scoreBoard.y+scoreBoard.height+22;
  const hand=box(x,actions.y-gap-handHeight,w,handHeight),utilityY=hand.y-gap-utilityHeight;
  const helpEntry=box(x+w-44,utilityY+(utilityHeight-44)/2,44,44),inventoryEntry=box(helpEntry.x-96,helpEntry.y,88,44);
  const heroAction=box(x,utilityY,inventoryEntry.x-x-8,utilityHeight);
  const playedArea=box(x,playedTop,w,Math.min(112,utilityY-gap-playedTop));
  return {hud,actions,jokers,slots,scoreBoard,playedArea,hand,heroAction,helpEntry,inventoryEntry,heroPortraitSlot:box(x+4,utilityY+3,38,utilityHeight-6),
    preview:box(x,scoreBoard.y,w,playedArea.y+playedArea.height-scoreBoard.y),status:box(x+10,scoreBoard.y+4,w-20,18),
    handLabel:box(x,hand.y-18,116,18),piles:box(x+116,hand.y-18,w-116,18),labelHeight:0,shortLandscape:false,...handSeats(hand,window,cardWidth,rows,pitch)};
}
/** Numeric cells share the total's fire base, rather than an equal-width table. */
export function scoreCells(s:Box){
  if(s.height<108){const secondary=s.width*.52;return [box(s.x+6,s.y+36,secondary/2-10,24),box(s.x+secondary/2+2,s.y+36,secondary/2-8,24),box(s.x+secondary+6,s.y+s.height-35,s.width-secondary-12,32)];}
  const narrow=s.width<260,split=narrow?.43:.38,secondary=s.width*split;
  return [box(s.x+8,s.y+43,secondary-12,24),box(s.x+8,s.y+Math.min(88,s.height-25),secondary-12,24),box(s.x+secondary+4,s.y+s.height-49,s.width-secondary-12,43)];
}
/** Opaque foreground protects the total; the fire is a continuous background. */
export function scorePedestal(s:Box):Box {
  const total=scoreCells(s)[2];return s.height<108?box(total.x-4,total.y-3,total.width+8,36):box(total.x-4,total.y-22,total.width+8,69);
}
export function layout(viewport:Viewport,safe:Insets,requested?:LayoutMode,handWindow:HandWindow={count:8},options:PcTableOptions={}){
  const {width,height}=viewport,usableWidth=width-safe.left-safe.right,usableHeight=height-safe.top-safe.bottom;
  const tabletPortrait=usableWidth>=700&&usableWidth<900&&usableHeight>=usableWidth*1.15;
  const mode=requested??(width<700&&height>width||tabletPortrait?'portrait':usableHeight<560?'landscape':'desktop');
  const window=Number.isSafeInteger(handWindow.count)&&handWindow.count>=0?handWindow:{...handWindow,count:8};
  const common={width,height,mode,safe,compact:mode==='portrait'&&(width<360||usableHeight<760),toolsInHud:false};
  const pc=mode==='desktop'?pcTableAreas(viewport,safe,window,options.pc):undefined;
  if(pc)return {...common,shortLandscape:false,heroPortraitSlot:undefined,...pc};
  const phone=mode==='portrait'?phoneTableAreas(viewport,safe,window):undefined;
  const areas=phone??(mode==='landscape'?shortTableAreas(viewport,safe,window):desktopTableAreas(viewport,safe,window));
  const table=continuousScoreAreas({...areas,mode});
  const s=table.scoreBoard,pedestal=scorePedestal(s),fireTop=s.y+(mode==='portrait'||s.height>=108?26:2);
  const scoreFire=box(pedestal.x,fireTop,pedestal.width,Math.max(0,pedestal.y+1-fireTop));
  return {...common,...areas,...handActionControls(areas.actions,mode),jokerLabels:areas.slots,scoreBoard:s,playedArea:table.playedArea,scoreEyes:table.eyes,scoreFire,
    helpEntry:phone?.helpEntry,inventoryEntry:phone?.inventoryEntry,heroPortraitSlot:phone?.heroPortraitSlot,pc:undefined};
}
export type TableLayout=ReturnType<typeof layout>;

/** Visual mat follows the five-card footprint; logical played area stays unchanged. */
export function playedFootprint(area:Box,portrait:boolean):Box {
 const scale=portrait?1:Math.min(1.25,Math.max(1,area.width/900),Math.max(1,area.height/500));
 const width=Math.min(area.width,portrait?316:Math.min(600,540*scale)),height=Math.min(area.height,portrait?100:160*scale);return box(area.x+(area.width-width)/2,area.y+(area.height-height)/2,width,height);
}

