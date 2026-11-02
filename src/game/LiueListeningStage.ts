import type Phaser from 'phaser';
import type {Box} from './layout';
import type {EffectContext} from '../core/EffectQueue';
import type {ScoreBeat} from './scorePresentation';
import {heroEyesKey} from './portraits';

const INK=0x513f35,GOLD=0xc19a59,PAPER=0xf4e6c9;
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.width+6&&a.x+a.width>b.x-6&&a.y<b.y+b.height+6&&a.y+a.height>b.y-6;
/** First use an unoccupied upper-table pocket. A full rack keeps its real faces;
 * the existing measured spare stage is the fallback, never the score band. */
export function liueListeningSlot(upper:Box,obstacles:readonly Box[],fallback:Box):Box {
 for(const height of [136,112,96,84])for(const width of [420,360,300,260,220]){
  if(width>upper.width-8||height>upper.height)continue;
  const xs=[upper.x+(upper.width-width)/2,...Array.from({length:Math.ceil((upper.width-width)/12)+1},(_,i)=>upper.x+4+i*12)];
  for(let y=upper.y;y+height<=upper.y+upper.height;y+=8)for(const x of xs){const box={x,y,width,height};if(x+width<=upper.x+upper.width-4&&!obstacles.some(b=>overlaps(box,b)))return box;}
 }
 return fallback;
}
const curve=(start:number[],segments:number[][])=>{
 const points=[{x:start[0],y:start[1]}];let [x,y]=start;
 for(const [a,b,c,d,e,f]of segments){for(let i=1;i<=12;i++){const t=i/12,u=1-t;points.push({x:u*u*u*x+3*u*u*t*a+3*u*t*t*c+t*t*t*e,y:u*u*u*y+3*u*u*t*b+3*u*t*t*d+t*t*t*f});}[x,y]=[e,f];}return points;
};
// A single ink-and-wash silhouette. The open interior strokes and the wave
// fronts use the same rounded brush treatment at every viewport size.
const outer=curve([19,66],[[9,56,7,37,12,23],[17,8,30,4,41,10],[53,16,55,31,50,44],[47,53,40,58,38,67],[37,75,38,84,30,87],[21,90,15,81,19,72],[20,70,20,68,19,66]]);
const helix=curve([17,47],[[14,34,17,20,27,16],[37,12,46,20,46,30],[46,39,40,44,36,49]]);
const antihelix=curve([24,54],[[22,46,20,36,25,29],[29,24,37,26,39,32],[41,38,36,42,31,44]]);
const concha=curve([22,58],[[28,54,34,57,33,63],[32,69,26,69,26,77]]);
function brush(g:Phaser.GameObjects.Graphics,points:{x:number;y:number}[],width:number,color:number,alpha:number):void {
 g.lineStyle(width,color,alpha).strokePoints(points,false).fillStyle(color,alpha);
 for(const p of [points[0],points[points.length-1]])g.fillCircle(p.x,p.y,width/2);
}
export function drawLiueListeningEar(g:Phaser.GameObjects.Graphics,cx:number,cy:number,height:number):void {
 const scale=height/94,points=(p:readonly {x:number;y:number}[])=>p.map(v=>({x:cx+(v.x-32)*scale,y:cy+(v.y-45)*scale}));
 g.fillStyle(0xb88d65,.22).fillPoints(points(outer).map(p=>({x:p.x+2*scale,y:p.y+3*scale})),true);
 g.fillStyle(0xeacda8).fillPoints(points(outer),true);
 g.fillStyle(0xc98774,.34).fillEllipse(cx-2*scale,cy+10*scale,18*scale,25*scale);
 brush(g,points(outer),3*scale,INK,.95);
 for(const p of [helix,antihelix,concha])brush(g,points(p),2.5*scale,INK,.88);
}
export interface LiueListeningView {step:(elapsed:number)=>void;dispose:()=>void}
/** Saved handoff only. The existing queue owns the prelude; the existing real
 * card strike clock owns release and impact. No input, rule state or extra loop. */
export async function playLiueListeningStage(scene:Phaser.Scene,root:Phaser.GameObjects.Container,skill:Box,slot:Box,eventId:string,targetId:string,context:EffectContext,reduced:()=>boolean,speed:number,beat:ScoreBeat,charge?:(progress:number)=>void):Promise<LiueListeningView|undefined> {
 if(context.signal.aborted||!root.active)return;
 const group=scene.add.container(0,0).setName('hero/liue-listening-stage').setData('eventId',eventId).setData('targetId',targetId).setData('bounds',slot);root.add(group);
 const aura=scene.add.graphics().setName('hero/liue-sound-waves'),currentInk=scene.add.graphics().setName('hero/liue-sound-current'),ear=scene.add.graphics().setName('hero/liue-listening-ear'),gaze=scene.add.container(skill.x+skill.width/2,skill.y+skill.height/2).setName('hero/liue-skill-gaze');group.add([aura,currentInk,ear,gaze]);
 const key=heroEyesKey('erxiang');if(scene.textures.exists(key)){const image=scene.add.image(0,0,key),source=image.frame;const scale=Math.min((skill.width-8)/source.width,(skill.height-6)/source.height);image.setScale(scale);gaze.add(image);}
 const cx=slot.x+slot.width/2,cy=slot.y+slot.height/2,earHeight=Math.min(112,slot.height-10),radius=slot.width*.47;
 drawLiueListeningEar(ear,cx,cy,earHeight);ear.setData('anatomyScale',earHeight/94).setData('bounds',{x:cx-earHeight*.3,y:cy-earHeight*.5,width:earHeight*.6,height:earHeight});
 let disposed=false,groupClosing=false,tween:Phaser.Tweens.Tween|undefined,finish:(()=>void)|undefined;
 const groupDestroyed=()=>{groupClosing=true;dispose();};
 const dispose=()=>{if(disposed)return;disposed=true;tween?.remove();tween=undefined;context.signal.removeEventListener('abort',dispose);scene.events.off('shutdown',dispose);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',dispose);group.off('destroy',groupDestroyed);if(group.active&&!groupClosing)group.destroy();finish?.();finish=undefined;};
 const hidden=()=>{if(document.hidden)dispose();};
 context.signal.addEventListener('abort',dispose,{once:true});scene.events.once('shutdown',dispose);document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',dispose);group.once('destroy',groupDestroyed);
 const paint=(charge:number,release:number,phase:string)=>{
  if(disposed)return;const still=reduced();group.setData('phase',phase).setData('release',release);ear.setAlpha(Math.min(1,charge*3)*(1-release*.5));gaze.setAlpha(Math.max(0,1-charge*1.7));
  aura.clear();currentInk.clear();const opacity=Math.min(1,charge*3)*(1-release),electricHeads:{x:number;y:number}[]=[];let electricSegments=0;
  aura.fillStyle(PAPER,.83*opacity).fillEllipse(cx,cy,slot.width*.96,slot.height*.94);
  // Broad, separated wave fronts converge once, then open out on the saved
  // target's release. Their changing radius supplies force; the ear stays still.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const base=earHeight*.38,gap=(radius-base-24)/3,r=base+i*gap+(still?0:(1-charge)*gap*1.6+release*gap*2),rx=Math.min(radius-24,r),ry=Math.min(slot.height*.43,earHeight*(.22+i*.14));
   const points=Array.from({length:25},(_,j)=>{const a=-.95+j/24*1.9;return{x:cx+side*(20+Math.cos(a)*rx),y:cy+Math.sin(a)*ry};});
   brush(aura,points,6.5,PAPER,.9*opacity);
   brush(aura,points,2.7,INK,(.88-i*.1)*opacity);
   if(!still&&i===1){
    const head=Math.min(points.length-1,Math.floor(((charge+release)*1.8%1)*(points.length-1))),tail=Math.max(0,head-4),stroke=points.slice(tail,head+1);
    if(stroke.length>1){brush(currentInk,stroke,3.8,INK,opacity);electricSegments+=stroke.length-1;electricHeads.push(stroke[stroke.length-1]);}
   }
  }
  currentInk.setData('electricSegments',electricSegments).setData('electricHeads',electricHeads);
  aura.lineStyle(2,GOLD,.6*opacity).strokeEllipse(cx,cy,earHeight*.77,earHeight+6);
 };
 const cursor={t:0};paint(0,0,'charge');charge?.(0);
 await new Promise<void>(resolve=>{finish=resolve;tween=scene.tweens.add({targets:cursor,t:1,duration:reduced()?220:1120/Math.max(1,speed),ease:'Linear',onUpdate:()=>{paint(cursor.t,0,cursor.t<.72?'charge':'listen');charge?.(cursor.t);},onComplete:()=>{charge?.(1);tween=undefined;finish=undefined;resolve();}});});
 if(disposed)return;
 return {dispose,step:elapsed=>{
  const arrival=beat.windup+beat.flight,release=Math.max(0,Math.min(1,(elapsed-beat.windup)/Math.max(1,beat.flight+beat.impact)));
  paint(1,release,elapsed<beat.windup?'listen':elapsed<arrival?'release':'impact');
 }};
}
