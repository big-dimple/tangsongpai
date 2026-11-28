import type Phaser from 'phaser';
import type {Box} from './layout';
import {asPaperSheet,paperRandom} from './PaperStock';

/**
 * The stage seal: a vermilion relief seal pressed onto the corner of the score sheet when a
 * stage is cleared, and echoed (already dry) beside the settlement title. Presentation only:
 * it reads a finished result, never delays navigation and owns no input.
 *
 * Three beats: lift, fall, hold. Values are shared with the sibling title and must not drift.
 */
export const SEAL_BEAT={lift:120,liftScale:1.15,fall:70,squash:45,squashX:1.04,squashY:.96,shake:180,shakePixels:5,hold:600,bleed:300,reducedFade:120,angle:-5.5} as const;
export const SEAL_LAND_AT=SEAL_BEAT.lift+SEAL_BEAT.fall;
export const SEAL_TOTAL=SEAL_LAND_AT+SEAL_BEAT.hold;
export type SealKind='clear'|'finale';
/** Reading order of a seal: right column first, top to bottom. */
export const SEAL_TEXT:Record<SealKind,readonly string[]>={clear:['过','关'],finale:['压','轴','过','关']};
const FRAME=256,FACE=208,INK='#b63f30',PAPER='#fbf1dc';
const SEAL_FONT='"Tangsongpai Song","Songti SC","Noto Serif CJK SC","STKaiti","KaiTi",SimSun,serif';
const key=(kind:SealKind)=>'seal-stamp/'+kind;
const clamp=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

export interface SealPose {alpha:number;scaleX:number;scaleY:number;contact:boolean;bleed:number;shakeX:number;shakeY:number;landed:boolean}
/** Pure pose at an elapsed presentation time. Reduced motion fades the dry seal in place. */
export function sealStampPose(ms:number,reduced=false):SealPose {
  const t=Math.max(0,Number.isFinite(ms)?ms:0);
  if(reduced)return {alpha:clamp(t/SEAL_BEAT.reducedFade),scaleX:1,scaleY:1,contact:false,bleed:clamp(t/SEAL_BEAT.reducedFade),shakeX:0,shakeY:0,landed:true};
  if(t<SEAL_BEAT.lift){const p=t/SEAL_BEAT.lift,scale=1+(SEAL_BEAT.liftScale-1)*(1-(1-p)**3);return {alpha:.86*clamp(p*2),scaleX:scale,scaleY:scale,contact:false,bleed:0,shakeX:0,shakeY:0,landed:false};}
  if(t<SEAL_LAND_AT){const p=(t-SEAL_BEAT.lift)/SEAL_BEAT.fall,scale=SEAL_BEAT.liftScale+(1-SEAL_BEAT.liftScale)*p**3;return {alpha:.86+.14*p,scaleX:scale,scaleY:scale,contact:false,bleed:0,shakeX:0,shakeY:0,landed:false};}
  const since=t-SEAL_LAND_AT,pressed=since<SEAL_BEAT.squash,amplitude=since<SEAL_BEAT.shake?SEAL_BEAT.shakePixels*Math.exp(-since/45):0;
  return {alpha:1,scaleX:pressed?SEAL_BEAT.squashX:1,scaleY:pressed?SEAL_BEAT.squashY:1,contact:pressed,bleed:clamp(since/SEAL_BEAT.bleed),
    shakeX:amplitude?amplitude*Math.cos(since*.13+.6):0,shakeY:amplitude?amplitude*Math.sin(since*.13+.6):0,landed:true};
}

export interface SealPlacement {x:number;y:number;size:number;angle:number}
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
/** Half extent of the rotated square's bounding box. */
export function sealReach(size:number,angle:number=SEAL_BEAT.angle):number {const r=Math.abs(angle)*Math.PI/180;return size*(Math.cos(r)+Math.sin(r))/2;}
export const sealBounds=(p:SealPlacement):Box=>{const reach=sealReach(p.size,p.angle);return {x:p.x-reach,y:p.y-reach,width:reach*2,height:reach*2};};
/**
 * A corner seal on the lower right of the score sheet: about 70% of the sheet's height,
 * biting its edge, and never over the figures it signs (it slides down, then right, to clear them).
 */
export function sealPlacement(board:Box,keep:readonly Box[],viewport:{width:number;height:number}):SealPlacement {
  const size=clamp(board.height*.7,40,132),reach=sealReach(size),right=board.x+board.width,bottom=board.y+board.height,bite=6;
  const place:SealPlacement={x:right-size*.3,y:bottom-size*.05,size,angle:SEAL_BEAT.angle};
  const blocked=()=>{const box=sealBounds(place);return keep.some(k=>overlaps(box,k));};
  const maxY=Math.min(bottom+reach-bite,viewport.height-reach-2),maxX=Math.min(right+reach-bite,viewport.width-reach-2);
  for(;blocked()&&place.y<maxY;)place.y=Math.min(maxY,place.y+2);
  for(;blocked()&&place.x<maxX;)place.x=Math.min(maxX,place.x+2);
  place.x=Math.min(place.x,Math.max(reach+2,viewport.width-reach-2));place.y=Math.min(place.y,Math.max(reach+2,viewport.height-reach-2));
  return place;
}

type Context=CanvasRenderingContext2D;
function squarePath(c:Context,x:number,y:number,size:number,radius:number,random?:()=>number):void {
  // A hand-cut edge: the outline wanders by a pixel or two instead of being ruled.
  const wobble=()=>random?(random()-.5)*size*.012:0,step=size/6;
  c.beginPath();c.moveTo(x+radius,y+wobble());
  for(let i=1;i<6;i++)c.lineTo(x+step*i,y+wobble());c.lineTo(x+size-radius,y+wobble());c.quadraticCurveTo(x+size,y,x+size+wobble(),y+radius);
  for(let i=1;i<6;i++)c.lineTo(x+size+wobble(),y+step*i);c.lineTo(x+size+wobble(),y+size-radius);c.quadraticCurveTo(x+size,y+size,x+size-radius,y+size+wobble());
  for(let i=5;i>0;i--)c.lineTo(x+step*i,y+size+wobble());c.lineTo(x+radius,y+size+wobble());c.quadraticCurveTo(x,y+size,x+wobble(),y+size-radius);
  for(let i=5;i>0;i--)c.lineTo(x+wobble(),y+step*i);c.lineTo(x+wobble(),y+radius);c.quadraticCurveTo(x,y,x+radius,y);c.closePath();
}
/** Vermilion ground, paper-white characters, an inner rule and worn edges: the cover and selection seals' family. */
function paintFace(c:Context,kind:SealKind,ox:number,seed:number):void {
  const random=paperRandom(seed),m=(FRAME-FACE)/2,x=ox+m,y=m;
  c.save();c.beginPath();c.rect(ox,0,FRAME,FRAME);c.clip();
  c.fillStyle=INK;squarePath(c,x,y,FACE,FACE*.07,random);c.fill();
  c.strokeStyle=PAPER;c.lineWidth=FACE*.022;squarePath(c,x+FACE*.075,y+FACE*.075,FACE*.85,FACE*.035);c.stroke();
  c.fillStyle=PAPER;c.textAlign='center';c.textBaseline='middle';
  const text=SEAL_TEXT[kind],inner=FACE*.8,cx=x+FACE/2,cy=y+FACE/2;
  if(kind==='clear'){
    c.font=`500 ${Math.round(inner*.47)}px ${SEAL_FONT}`;
    text.forEach((glyph,i)=>c.fillText(glyph,cx,cy+(i-.5)*inner*.48+inner*.015));
  }else{
    c.font=`500 ${Math.round(inner*.4)}px ${SEAL_FONT}`;c.fillRect(cx-FACE*.008,y+FACE*.11,FACE*.016,FACE*.78);c.fillRect(x+FACE*.11,cy-FACE*.008,FACE*.78,FACE*.016);
    // Right column first: 压 轴 | 过 关.
    text.forEach((glyph,i)=>c.fillText(glyph,cx+(i<2?1:-1)*inner*.245,cy+(i%2?1:-1)*inner*.245+inner*.012));
  }
  // Wear: nicks along the edge and a scatter of dry specks let the paper show through.
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<30;i++){const side=Math.floor(random()*4),along=random()*FACE,r=1.5+random()*5.5,px=side===0?x+along:side===1?x+FACE:side===2?x+along:x,py=side===0?y:side===1?y+along:side===2?y+FACE:y+along;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();}
  for(let i=0;i<70;i++){c.beginPath();c.arc(x+random()*FACE,y+random()*FACE,.5+random()*1.6,0,Math.PI*2);c.fill();}
  c.restore();
}
function paintSeal(c:Context,kind:SealKind):void {
  const seed=kind==='clear'?0x5ea1:0x5ea2;
  // Frame 0: first contact. Only the tooth of the paper has taken ink.
  paintFace(c,kind,0,seed);
  const tooth=paperRandom(seed+7);c.save();c.beginPath();c.rect(0,0,FRAME,FRAME);c.clip();c.globalCompositeOperation='destination-out';
  for(let i=0;i<2600;i++){c.beginPath();c.arc(tooth()*FRAME,tooth()*FRAME,.8+tooth()*2.6,0,Math.PI*2);c.fill();}
  c.restore();
  // Frame 1: the full impression.
  paintFace(c,kind,FRAME,seed);
  // Frame 2: oil seeping a little past the edge; the face itself is cut out.
  const m=(FRAME-FACE)/2,far=4096;c.save();c.beginPath();c.rect(FRAME*2,0,FRAME,FRAME);c.clip();
  c.shadowColor='rgba(182,63,48,.5)';c.shadowBlur=9;c.shadowOffsetX=far;c.fillStyle='#000';squarePath(c,FRAME*2+m-far,m,FACE,FACE*.07);c.fill();
  c.shadowColor='transparent';c.globalCompositeOperation='destination-out';squarePath(c,FRAME*2+m+2,m+2,FACE-4,FACE*.06);c.fill();c.restore();
}

/** Bake once per game and kind, while a scene is being set up: never during a presentation. */
export function ensureSealTexture(scene:Phaser.Scene,kind:SealKind):boolean {
  const textures=scene.textures;if(typeof textures?.createCanvas!=='function')return false;
  if(textures.exists(key(kind)))return true;
  const texture=textures.createCanvas(key(kind),FRAME*3,FRAME);if(!texture)return false;
  paintSeal(texture.getContext(),kind);
  ['contact','full','bleed'].forEach((name,i)=>texture.add(name,0,i*FRAME,0,FRAME,FRAME));texture.refresh();return true;
}
const displaySize=(size:number)=>size*FRAME/FACE;

/** The dry seal, for the settlement title. `bounds` keeps scroll measurement on the title's own line. */
export function staticSealStamp(scene:Phaser.Scene,kind:SealKind,place:SealPlacement,bounds?:Box):{face:Phaser.GameObjects.Image;bleed:Phaser.GameObjects.Image}|undefined {
  if(typeof scene.add?.image!=='function'||!ensureSealTexture(scene,kind))return;
  const make=(frame:string,name:string)=>{const image=asPaperSheet(scene.add.image(place.x,place.y,key(kind),frame)).setAngle(place.angle).setName(name).setData('kind',kind);image.setDisplaySize(displaySize(place.size),displaySize(place.size));if(bounds)image.setData('bounds',{...bounds});return image;};
  return {bleed:make('bleed','seal/bleed').setAlpha(.55),face:make('full','seal/stamp')};
}

export interface SealStampOptions {kind:SealKind;board:Box;keep:readonly Box[];viewport:{width:number;height:number};reduced:()=>boolean;onLand?:()=>void}
/** settle() jumps to the dry seal (a skip); dispose() removes it. Both are safe to repeat. */
export interface SealStampHandle {dispose():void;settle():void}
const NO_SEAL:SealStampHandle={dispose:()=>{},settle:()=>{}};
/**
 * Press the seal. The driver uses the scene's tween clock, so presentation speed applies.
 * Only `root` is nudged for the impact (never the camera or input mapping), and it is put
 * back on every exit path.
 */
export function mountSealStamp(scene:Phaser.Scene,root:Phaser.GameObjects.Container,options:SealStampOptions):SealStampHandle {
  if(!root?.active)return NO_SEAL;
  const place=sealPlacement(options.board,options.keep,options.viewport),seal=staticSealStamp(scene,options.kind,place);
  if(!seal)return NO_SEAL;
  const {face,bleed}=seal,size=displaySize(place.size),origin={x:root.x,y:root.y},clock={ms:0};
  // One owner in the table root: a redraw or scene change destroys the pair together.
  const group=scene.add.container(0,0).setName('seal/group');
  face.setData('placement',place);bleed.setAlpha(0);face.setAlpha(0);group.add([bleed,face]);root.add(group);
  let disposed=false,landed=false,tween:Phaser.Tweens.Tween|undefined;
  const rest=()=>{if(root.active)root.setPosition(origin.x,origin.y);};
  const apply=(ms:number)=>{
    if(disposed)return;
    if(!group.active||!root.active){dispose();return;}
    const pose=sealStampPose(ms,options.reduced());
    face.setFrame(pose.contact?'contact':'full').setAlpha(pose.alpha).setDisplaySize(size*pose.scaleX,size*pose.scaleY).setData('elapsed',ms);
    bleed.setAlpha(pose.bleed*.55);root.setPosition(origin.x+pose.shakeX,origin.y+pose.shakeY);
    if(pose.landed&&!landed){landed=true;options.onLand?.();}
  };
  const shutdown=()=>dispose();
  const stop=()=>{tween?.remove();tween=undefined;if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);scene.events?.off?.('shutdown',shutdown);};
  /** Hidden tabs skip straight to the dry seal; nothing keeps animating in the background. */
  const settle=()=>{if(disposed||!tween)return;stop();apply(SEAL_TOTAL);rest();};
  const hidden=()=>{if(document.hidden)settle();};
  function dispose(dying=false):void {
    if(disposed)return;disposed=true;stop();rest();
    // Never destroy an object from inside its own destroy event.
    if(!dying&&group.active)group.destroy();
  }
  group.once('destroy',()=>dispose(true));scene.events?.once?.('shutdown',shutdown);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  apply(0);
  tween=scene.tweens.add({targets:clock,ms:SEAL_TOTAL,duration:SEAL_TOTAL,ease:'Linear',onUpdate:()=>apply(clock.ms),onComplete:()=>{apply(SEAL_TOTAL);rest();stop();}});
  return {dispose:()=>dispose(),settle};
}
