import type {Box,HandWindow} from './layout';

/** Drawing, hit tests and page arrows use the same visible window. */
export function handSeats(hand:Box,window:HandWindow,cardWidth:number,rows:number,minPitch:number,centerBand=false){
  const count=window.count;
  const capacity=(width:number)=>Math.max(1,Math.floor((width-cardWidth+1e-6)/minPitch)+1);
  const handOverflow=rows===1&&count>capacity(hand.width);
  const gutter=handOverflow?48:0;
  const available=hand.width-2*gutter;
  const visibleCardCount=rows===2?count:Math.min(count,capacity(available));
  const requested=Number.isSafeInteger(window.start)?window.start!:0;
  const handStart=Math.max(0,Math.min(count-visibleCardCount,requested));
  const columns=Math.ceil(visibleCardCount/rows),rowHeight=hand.height/rows;
  const band=centerBand?Math.min(available,columns*cardWidth+Math.max(0,columns-1)*8):available;
  const left=hand.x+(hand.width-band)/2;
  const pitch=columns>1?(band-cardWidth)/(columns-1):0;
  const cards=Array.from({length:count},(_,i)=>{
    const row=rows===2?Math.floor(i/columns):0;
    const col=rows===2?i%columns:i-handStart;
    const x=left+(columns===1?(band-cardWidth)/2:col*pitch),y=hand.y+row*rowHeight;
    const last=col===columns-1||i===count-1;
    return {visible:i>=handStart&&i<handStart+visibleCardCount,
      visual:{x,y:y+22,width:cardWidth,height:cardWidth*1.4},
      hit:{x,y,width:last?cardWidth:Math.min(cardWidth,pitch),height:rowHeight}};
  });
  const arrowY=hand.y+(hand.height-44)/2;
  const handNavigation={previous:{x:hand.x,y:arrowY,width:44,height:44},next:{x:hand.x+hand.width-44,y:arrowY,width:44,height:44}};
  return {cards,handRows:rows,handOverflow,visibleCardCount,handStart,handNavigation};
}
