import type Phaser from 'phaser';
import type {InkBox} from './AssistInkGeometry';

// Drawn as paper-sized vector strokes; no platform emoji or extra caption row.
const lines=[
 [[2,9],[2.2,6],[3.5,3.8],[5.6,2.3],[8.1,2],[10.8,2.5],[13,4],[14,6.3],[14,9],[13.3,11.1],[11.7,13],[9.7,14.7],[8.9,16.8],[8.3,18.8],[6.8,20],[5.2,20],[3.8,19.3],[3.1,17.8]],
 [[5.4,8.7],[5.8,6.6],[7.3,5.6],[9.1,5.8],[10.1,7.4],[9.7,9.2],[8,10.5],[6.7,12],[6.6,14]],
] as const;
/** The caller supplies an already-visible, unprinted patch on the genuine card. */
export function handoffEarInk(box:InkBox,pixels={x:1,y:1},clock=0){
 if(![box.x,box.y,box.width,box.height,pixels.x,pixels.y].every(Number.isFinite)||pixels.x<=0||pixels.y<=0||box.width*pixels.x<12||box.height*pixels.y<16)return;
 const scale=Math.min(1,box.width*pixels.x/16,box.height*pixels.y/22),width=16*scale/pixels.x,height=22*scale/pixels.y,x=box.x+(box.width-width)/2,y=box.y+(box.height-height)/2;
 const point=(px:number,py:number)=>({x:x+px*scale/pixels.x,y:y+py*scale/pixels.y}),phase=((clock%1440)+1440)%1440/1440;
 // Reserve paper above and below the small ear.  The old equal-weight triple
 // crests read like a pasted glyph; use a quiet, hand-drawn hierarchy instead:
 // one near wave and two receding traces that ease toward the ear.
 const waveAlpha=[.34,.22,.13] as const;
 const waves=[-1,1].flatMap(side=>Array.from({length:3},(_,i)=>{const p=(phase+i/3)%1,r=6.2-p*3.6,reach=4.55-p*3.9,tilt=(i-1)*.16;
  return{side,alpha:waveAlpha[i]+Math.sin(p*Math.PI)*.1,points:Array.from({length:13},(_,j)=>{const u=j/12,a=Math.PI*(.15+u*.7),ease=Math.sin(u*Math.PI);return point(8+Math.cos(a)*r+side*tilt*ease,(side<0?5:17)+side*(Math.sin(a)*reach+tilt*ease));})};
 }));
 return {bounds:{x,y,width,height},stroke:1.4*scale/Math.max(pixels.x,pixels.y),waveStroke:.52*scale/Math.max(pixels.x,pixels.y),wavePhase:phase,waves,lines:lines.map(line=>line.map(([px,py])=>point(px,4.3+py*.62)))};
}
export function drawHandoffEar(g:Phaser.GameObjects.Graphics,box:InkBox,label='听政目标：这张牌的首次普通点数改加倍率',pixels={x:1,y:1},clock=0):boolean {
 g.clear();const ink=handoffEarInk(box,pixels,clock);if(!ink)return false;
 g.lineStyle(ink.stroke,0x15539c,1);
 for(const line of ink.lines){g.beginPath().moveTo(line[0].x,line[0].y);for(const p of line.slice(1))g.lineTo(p.x,p.y);g.strokePath();}
 for(const wave of ink.waves){g.lineStyle(ink.waveStroke,0x4e8494,wave.alpha).beginPath().moveTo(wave.points[0].x,wave.points[0].y);for(const p of wave.points.slice(1))g.lineTo(p.x,p.y);g.strokePath();}
 g.setData('inkBounds',ink.bounds).setData('accessibleLabel',label).setData('wavePhase',ink.wavePhase);return true;
}
