import type {Box} from './layout';

/** Measure the complete result, then place it inside the safe reading viewport. */
export function resultPlacement(top:number,bottom:number,content:Pick<Box,'y'|'height'>,offset=0,anchorTop=false){
  const available=Math.max(1,bottom-top),overflow=Math.max(0,content.height-available);
  const scroll=Math.max(0,Math.min(overflow,offset));
  return {overflow,scroll,y:top+(anchorTop?0:Math.max(0,(available-content.height)/2))-content.y-scroll};
}

export function resultLayout(width:number,height:number,top:number,contentHeight:number,pc=false){
  if(pc){
    const margin=width<1500?32:48,w=Math.min(1640,width-margin*2),x=(width-w)/2;
    const gap=width<1500?36:56,sideWidth=Math.floor(w*.31),bodyY=top+72;
    // Coordinates are local to the top-anchored safe viewport, not the browser.
    const bodyHeight=Math.max(360,Math.min(740,height-210)),rightX=x+w-sideWidth;
    const score:Box={x,y:bodyY,width:w-sideWidth-gap,height:bodyHeight};
    const next:Box={x:rightX,y:bodyY+176,width:sideWidth,height:132};
    const primary:Box={x:rightX,y:Math.max(next.y+next.height+24,height-236),width:sideWidth,height:56};
    const auxY=primary.y+primary.height+8,auxWidth=(sideWidth-8)/2;
    return {x,w,top,short:false,portrait:false,tight:false,wide:true,pc:true,score,next,nextText:next,primary,
      left:{x:rightX,y:auxY,width:auxWidth,height:44},right:{x:rightX+auxWidth+8,y:auxY,width:auxWidth,height:44},noticeY:auxY+48};
  }
  if(width<700&&height>width){
    const x=12,w=width-24,bodyY=top+64,tight=height<700;
    const score:Box={x,y:bodyY,width:w,height:contentHeight};
    const next:Box={x,y:score.y+score.height+8,width:w,height:tight?52:68};
    const primary:Box={x,y:next.y+next.height+8,width:w,height:48},auxY=primary.y+52,auxWidth=(w-8)/2;
    return {x,w,top,short:false,portrait:true,tight,wide:false,pc:false,score,next,nextText:next,primary,
      left:{x,y:auxY,width:auxWidth,height:44},right:{x:x+auxWidth+8,y:auxY,width:auxWidth,height:44},noticeY:auxY+48};
  }
  const short=height<500,portrait=width<700&&height>width,tight=portrait&&height<=700;
  const wide=width>=1100&&!short,w=Math.min(wide?1120:900,width-(wide?96:24)),x=(width-w)/2;
  const bodyY=top+(short?54:portrait?64:80),sideWidth=wide?Math.min(312,w*.30):0;
  const score:Box={x,y:bodyY,width:wide?w-sideWidth-28:short?w*.64-12:w,height:contentHeight};
  const next:Box=wide?{x:x+w-sideWidth,y:bodyY+12,width:sideWidth,height:112}:
    short?{x:x+w*.64,y:bodyY,width:w*.36,height:94}:
    {x,y:score.y+score.height+16,width:w,height:portrait?86:116};
  const actionX=wide||short?next.x:portrait?x:x+w-288,actionWidth=wide||short?next.width:portrait?w:288;
  const actionY=wide||short||portrait?next.y+next.height+12:next.y+8;
  const primary:Box={x:actionX,y:actionY,width:actionWidth,height:portrait&&tight||short?48:56};
  const auxY=primary.y+primary.height+4,auxWidth=(actionWidth-8)/2;
  return {x,w,top,short,portrait,tight,wide,pc:false,score,next,
    nextText:{...next,width:wide||short||portrait?next.width:next.width-actionWidth-28},primary,
    left:{x:actionX,y:auxY,width:auxWidth,height:44},right:{x:actionX+auxWidth+8,y:auxY,width:auxWidth,height:44},
    noticeY:Math.max(next.y+next.height,auxY+44)+4};
}

