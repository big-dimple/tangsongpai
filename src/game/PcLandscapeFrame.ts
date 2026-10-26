import type {Box} from './layout';

/** Shared PC reading frame. Browser chrome changes height, not the horizontal hierarchy. */
export function pcLandscapeFrame(width:number,height:number,top=0,bottom=0,left=0,right=0){
 const compact=height-top-bottom<850,margin=width<1500?28:40,gap=width<1500?24:32;
 const sidebarWidth=width<1500?244:292;
 const frame:Box={x:left+margin,y:top+64,width:width-left-right-margin*2,height:height-top-bottom-88};
 const sidebar:Box={...frame,width:sidebarWidth};
 const main:Box={x:sidebar.x+sidebar.width+gap,y:frame.y,width:frame.width-sidebar.width-gap,height:frame.height};
 return {frame,sidebar,main,compact,gap,margin};
}
