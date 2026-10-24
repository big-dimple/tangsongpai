import type Phaser from 'phaser';
import type {CharacterId} from './characters';
import type {Box} from './layout';
import type {EffectContext} from '../core/EffectQueue';
import {heroEyesKey} from './portraits';
import {heroSkillName} from './HeroSkillPresentation';
import {UI_FONT} from './theme';

const colors:Record<CharacterId,number>={amo:0xb88632,erxiang:0x9b3d46,laohuan:0x287f79,touye:0x635141,azao:0x427e83,xiemu:0xb37c32};
/** A saved skill owns one paper stage inside its existing, temporarily locked hit.
 * The cue carries no rule state. All motion, listeners and images share the queue abort. */
export async function playHeroSkillStage(scene:Phaser.Scene,root:Phaser.GameObjects.Container,box:Box,hero:CharacterId,eventId:string,context:EffectContext,reduced:()=>boolean,speed:number,stageBox:Box=box):Promise<void>{
 if(context.signal.aborted||!root.active)return;
 const w=stageBox.width,h=stageBox.height,c=colors[hero],group=scene.add.container(stageBox.x+w/2,stageBox.y+h/2).setName('hero/skill-stage').setData('eventId',eventId).setData('heroId',hero);root.add(group);
 const paper=scene.add.graphics(),ink=scene.add.graphics();group.add(paper);
 const texture=heroEyesKey(hero),eye=scene.textures.exists(texture)?scene.add.image(0,-2,texture).setDisplaySize(w-12,h-8).setName('hero/skill-stage-eyes'):undefined;if(eye)group.add(eye);
 group.add(ink);
 const title=scene.add.text(w/2-10,1,heroSkillName(hero),{fontFamily:UI_FONT,fontSize:Math.min(32,w*.15)+'px',fontStyle:'bold',color:'#302c27',stroke:'#f4e6c9',strokeThickness:3}).setOrigin(1,.5);group.add(title);
 const cursor={t:0};let tween:Phaser.Tweens.Tween|undefined,done=false,resolve!:()=>void;
 const promise=new Promise<void>(r=>resolve=r);
 const cleanup=()=>{if(done)return;done=true;tween?.remove();context.signal.removeEventListener('abort',cleanup);scene.events.off('shutdown',cleanup);document.removeEventListener('visibilitychange',hidden);group.off('destroy',cleanup);if(group.active)group.destroy();resolve();};
 const hidden=()=>{if(document.hidden)cleanup();};
 const polygon=(points:{x:number;y:number}[],fill:number)=>{ink.fillStyle(fill).fillPoints(points,true).lineStyle(2,0x302c27).strokePoints(points,true);};
 const draw=()=>{
  if(done)return;
  const t=cursor.t,still=reduced(),charge=Math.min(1,t/.32),strike=Math.max(0,Math.min(1,(t-.36)/.22)),settle=Math.max(0,(t-.68)/.32),p=still?1:strike;
  group.setData('phase',t<.36?'charge':t<.7?'strike':'settle');
  // One anticipation, one impact and a damped return; no loops or flashes.
  const recoil=still?0:t<.36?-3*Math.sin(charge*Math.PI/2):4*Math.sin(strike*Math.PI)*(1-settle);
  const rise=still?1:Math.min(1,t/.22),ease=1-(1-rise)**3;
  group.setPosition(box.x+box.width/2+(stageBox.x+w/2-box.x-box.width/2)*ease,box.y+box.height/2+(stageBox.y+h/2-box.y-box.height/2)*ease+recoil).setScale(still?1:(.68+.32*ease)*(t<.36?1-.055*charge:1+.045*Math.sin(strike*Math.PI)));
  group.setAlpha(t>.84?(1-t)/.16:1);
  paper.clear().fillStyle(0x302c27,.23).fillRect(-w/2+3,-h/2+4,w,h).fillStyle(0xf4e6c9).fillPoints([{x:-w/2,y:-h/2+2},{x:w/2-5,y:-h/2},{x:w/2,y:h/2-3},{x:-w/2+3,y:h/2}],true).lineStyle(3,c).strokeRect(-w/2+2,-h/2+2,w-4,h-4);
  if(eye){eye.setAlpha(still?.35:1-strike*.55).setX(still?0:-12*(1-charge));}
  title.setAlpha(still?1:strike).setX(w/2-10+(still?0:12*(1-strike)));
  ink.clear();
  if(t>=.32){for(let i=0;i<3;i++){const len=(w*.14+i*6)*(1-strike*.3);ink.lineStyle(3-i*.6,c,.65).lineBetween(-w/2+6,-h/2+7+i*5,-w/2+6+len,-h/2+4+i*5).lineBetween(w/2-6-len,h/2-4-i*5,w/2-6,h/2-7-i*5);}}
  if(!still&&t<.32){for(let i=0;i<3;i++)ink.lineStyle(3-i*.5,c,.8).lineBetween(-w/2+4,-h/2+6+i*6,-w/2+8+charge*(18+i*5),-h/2+6+i*6);return;}
  ink.setAlpha(still?1:Math.min(1,strike*4));
  const x=-w/2+Math.max(29,w*.23),y=0,r=Math.min(37,h*.33),travel=still?0:(1-p)*22;
  if(hero==='azao'){
   // Two silk lengths meet in a real contract seal, wide enough to read on phones.
   for(const side of [-1,1])polygon([{x:x+side*(r+travel),y:-r*.8},{x:x+side*3,y:-r*.32},{x:x+side*3,y:r*.5},{x:x+side*(r+travel),y:r}],side===-1?0x88b5b3:0xd6b46e);
   ink.fillStyle(0x9d4041).fillRect(x-r*.42*p,y-r*.5*p,r*.84*p,r*p).lineStyle(2,0xf4e6c9).strokeRect(x-r*.2*p,y-r*.25*p,r*.4*p,r*.5*p);
  }else if(hero==='touye'){
   for(const side of [-1,1]){const end=x+side*(r*(1-p)+5);ink.lineStyle(7,0x302c27).lineBetween(x+side*(r+travel),-r,end,r);ink.lineStyle(3,0xc8ad72).lineBetween(x+side*(r+travel),-r,end,r);ink.lineStyle(3,c).lineBetween(end-5,r-4,end+5,r-4);}
  }else if(hero==='erxiang'){
   for(const side of [-1,1]){const xx=x+side*(r*.52+travel);ink.fillStyle(side<0?0xc7b18c:0xa04e53).fillRect(xx-r*.45,-r*.7,r*.9,r*1.4).lineStyle(2,0x302c27).strokeRect(xx-r*.45,-r*.7,r*.9,r*1.4);ink.lineStyle(2,0xf4e6c9).lineBetween(xx-4,-4,xx+4,-4).lineBetween(xx-4,2,xx+4,2);}
   ink.lineStyle(3,c).lineBetween(x-7,9,x+9,9).lineBetween(x+5,5,x+9,9).lineBetween(x+5,13,x+9,9);
  }else if(hero==='xiemu'){
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5-.5+p*.35,rr=r*.62+travel;ink.fillStyle(i%2?0xc98281:0xe4b9a4).fillEllipse(x+Math.cos(a)*rr,y+Math.sin(a)*rr,r*.6,r*.85);}
   ink.fillStyle(0xd4ab52).fillCircle(x,y,r*.5).lineStyle(2,0x6e522d).strokeCircle(x,y,r*.5).fillStyle(0x302c27).fillRect(x-3,y-3,6,6);
  }else if(hero==='amo'){
   ink.lineStyle(6,0x302c27).lineBetween(x-r-travel,-r*.6,x+r,0).lineBetween(x-r,5,x+r+travel,r*.7);ink.lineStyle(2,c).lineBetween(x-r,-r*.6,x+r,0);
  }else{
   const open=still?1:.35+.65*p;polygon([{x:x-r-travel,y:0},{x,y:-r*.7*open},{x:x+r+travel,y:0},{x,y:r*.7*open}],0xe1d3a7);ink.fillStyle(c).fillCircle(x,y,7).fillStyle(0x302c27).fillCircle(x,y,3);
  }
 };
 context.signal.addEventListener('abort',cleanup,{once:true});scene.events.once('shutdown',cleanup);document.addEventListener('visibilitychange',hidden);group.once('destroy',cleanup);
 draw();tween=scene.tweens.add({targets:cursor,t:1,duration:reduced()?260:1280/Math.max(1,speed),ease:'Linear',onUpdate:draw,onComplete:cleanup});await promise;
}
