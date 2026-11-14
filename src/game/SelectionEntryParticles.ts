import type Phaser from 'phaser';
import type {Box} from './layout';
import {cssViewport} from '../platform/Viewport';
import {advanceEntryParticleField,createEntryParticleField,entryParticleVisible,paintEntryParticleBrush,ENTRY_PARTICLE_BUDGET,ENTRY_PARTICLE_SOURCE,type EntryParticleField} from './EntryDepthParticles';

/** The same MIT projection drives a fixed pool of Phaser Images; no second engine or update loop. */
export class SelectionEntryParticles {
 private back?:Phaser.GameObjects.Container;private front?:Phaser.GameObjects.Container;
 private nodes:Phaser.GameObjects.Image[]=[];private field?:EntryParticleField;private protected:Box[]=[];
 private root?:Phaser.GameObjects.Container;private elapsed=0;private listening=false;private blurred=false;private onScreen=true;private destroyed=false;
 private anchor?:Box;private feedback?:Phaser.GameObjects.Graphics;private seal?:Phaser.GameObjects.Text;
 private routeCue?:Phaser.GameObjects.Graphics;private routeCueBoxes:Box[]=[];
 private motion?:Phaser.Tweens.Tween;private finishFeedback?:()=>void;private gathering:number[]=[];private trailing:number[]=[];private ambientTime=0;
 private activeKind?:'switch'|'route'|'confirm';private routeBox?:Box;private skipRequested=false;private staticTimer?:Phaser.Time.TimerEvent;
 private buttonWrap?:Phaser.GameObjects.Container;private button?:{art:Phaser.GameObjects.Container;label:Phaser.GameObjects.Text;box:Box};
 private readonly media=window.matchMedia('(prefers-reduced-motion: reduce)');
 private readonly observer:MutationObserver;private readonly intersection?:IntersectionObserver;
 private readonly changed=()=>this.sync();
 private readonly blur=()=>{this.blurred=true;this.sync();};
 private readonly focus=()=>{this.blurred=false;this.sync();};
 private readonly tick=(_time:number,delta:number)=>{if(!this.running()){this.sync();return;}this.elapsed+=delta;const hz=cssViewport(this.scene).width<ENTRY_PARTICLE_BUDGET.breakpoint?ENTRY_PARTICLE_BUDGET.mobileHz:ENTRY_PARTICLE_BUDGET.desktopHz;if(this.elapsed<1000/hz)return;this.ambientTime+=Math.min(100,this.elapsed);advanceEntryParticleField(this.field!,this.elapsed);this.elapsed=0;this.paint();};
 constructor(private readonly scene:Phaser.Scene,private readonly reduced:()=>boolean,private readonly onConfirmImpact:()=>void=()=>{}){
  document.addEventListener('visibilitychange',this.changed);window.addEventListener('blur',this.blur);window.addEventListener('focus',this.focus);window.addEventListener('tangsongpai-presentation',this.changed);this.media.addEventListener('change',this.changed);
  this.observer=new MutationObserver(this.changed);this.observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  if(typeof IntersectionObserver!=='undefined'){this.intersection=new IntersectionObserver(([e])=>{if(e){this.onScreen=e.isIntersecting;this.sync();}});this.intersection.observe(scene.game.canvas);}
  for(const event of ['pause','resume','sleep','wake'])scene.events.on(event,this.changed);scene.events.once('shutdown',this.destroy,this);scene.events.once('destroy',this.destroy,this);
 }
 mount(root:Phaser.GameObjects.Container,anchor:Box|undefined,identity:number,button?:Phaser.GameObjects.Rectangle,routeCueBoxes?:Box[]):void {
  this.release();this.root=root;this.anchor=anchor;const viewport=cssViewport(this.scene);this.field=createEntryParticleField(viewport.width,viewport.height,viewport.width,anchor,identity);
  // Selection-only pale paper flecks; the shared Loading/Boss field and budgets stay untouched.
  this.field.particles.forEach((p,i)=>{
   if(i%16===15)p.color=0xe6e2cd;
   if(anchor&&i%4!==0){const left=i%2===0;p.cx=left?anchor.x-10:anchor.x+anchor.width+16;p.cy=anchor.y+anchor.height*(.46+.14*Math.sin(i*2.3));p.span=Math.min(12,anchor.width*.06);p.radius=Math.min(p.radius,p.span*1.2);p.height=anchor.height*.6;p.y=Math.max(-p.height,Math.min(p.height,p.y));p.front=i%5===0;p.size=p.front?3.6:1.8+(i%3)*.35;p.opacity=p.front?.42:.28;p.drift=.12+(i%4)*.055;}
  });
  // Protect the fitted portrait even while a late image is replacing its loading placeholder.
  if(anchor)this.protected.push({x:anchor.x-6,y:anchor.y-6,width:anchor.width+12,height:anchor.height+12});
  // The portrait's tap area includes wide empty padding on desktop; protect the actual image,
  // all text and action buttons, so that padding can carry a few exterior motes.
  const inverse=root.getWorldTransformMatrix();const walk=(list:Phaser.GameObjects.GameObject[])=>{for(const object of list){const o=object as Phaser.GameObjects.Container;if(!o.active||!o.visible||o.alpha<=0)continue;if(o.type==='Text'||o.type==='Image'||o.input?.enabled&&o.name!=='opening/portrait-full'){const b=(o as unknown as Phaser.GameObjects.Text).getBounds(),points=[[b.x,b.y],[b.right,b.y],[b.x,b.bottom],[b.right,b.bottom]].map(([x,y])=>inverse.applyInverse(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));this.protected.push({x:x-6,y:y-6,width:Math.max(...points.map(p=>p.x))-x+12,height:Math.max(...points.map(p=>p.y))-y+12});}if(o.list)walk(o.list);}};walk(root.list);
  this.back=this.scene.add.container(0,0).setName('opening/particles/back').setData('source',ENTRY_PARTICLE_SOURCE);this.front=this.scene.add.container(0,0).setName('opening/particles/front');root.add([this.back,this.front]);root.moveTo(this.back,1);
  for(const p of this.field.particles){const key='entry-depth-'+p.color.toString(16)+'-'+Number(p.bright);if(!this.scene.textures.exists(key)){const brush=this.scene.textures.createCanvas(key,ENTRY_PARTICLE_BUDGET.brush,ENTRY_PARTICLE_BUDGET.brush);if(!brush){this.release();return;}paintEntryParticleBrush(brush.getContext(),p.color,p.bright);brush.refresh();}
   const image=this.scene.add.image(0,0,key).setName('opening/particle').setBlendMode('NORMAL');(p.front?this.front:this.back).add(image);this.nodes.push(image);
  }
  if(routeCueBoxes?.length){this.routeCueBoxes=routeCueBoxes.map(b=>({...b}));this.routeCue=this.scene.add.graphics().setName('opening/route-cue');root.add(this.routeCue);}
  if(button){const art=button.getData('buttonArt') as Phaser.GameObjects.Container,label=button.getData('label') as Phaser.GameObjects.Text,box=button.getData('buttonBounds') as Box;
   if(art?.active&&label?.active&&box){this.button={art,label,box};this.buttonWrap=this.scene.add.container(0,0).setName('opening/confirm-button-body');this.buttonWrap.add([art,label]);root.add(this.buttonWrap);}
  }
  this.paint(true);this.sync();
 }
 /** Browsing never stamps a choice. A new mount or interruption settles the previous one-shot. */
 switchHero():void {void this.playFeedback('switch');}
 /** A transient preview stamp does not save or start a run. */
 switchRoute(box:Box):void {this.routeBox={...box};void this.playFeedback('route');}
 /** Called only after the real new-run save succeeds, never by a hero/route preview. */
 confirm():Promise<void> {return this.playFeedback('confirm');}
 /** Presentation only: a second deliberate action can finish after the readable landing. */
 skipConfirm():void {if(this.activeKind!=='confirm')return;if(this.staticTimer)this.stopFeedback();else this.skipRequested=true;}
 private playFeedback(kind:'switch'|'route'|'confirm'):Promise<void> {
  this.stopFeedback();if((kind==='switch'&&!this.anchor)||(kind==='route'&&!this.routeBox)||!this.visible()||(kind!=='confirm'&&!this.running()))return Promise.resolve();
  const animated=this.running();this.activeKind=kind;
  if(!this.feedback){
   this.feedback=this.scene.add.graphics().setName('opening/choice-feedback');
   this.seal=this.scene.add.text(0,0,'定',{fontFamily:'Georgia, "Noto Serif SC", SimSun, serif',fontSize:'26px',fontStyle:'bold',color:'#FFF0CF'}).setOrigin(.5).setVisible(false);
   this.root!.add([this.feedback,this.seal]);
  }
  const anchor=this.anchor??{x:0,y:0,width:1,height:1},viewport=cssViewport(this.scene),g=this.feedback,clock={progress:0},inkRibbon=kind==='switch'?createSelectionInkRibbon(anchor):undefined;
  const finalBox=selectionFinalSealBox(viewport);
  if(kind==='confirm')this.seal!.setText('定章').setFontSize(Math.floor(finalBox.width*.38));
  else if(kind==='route')this.seal!.setText('已选').setFontSize(Math.floor(selectionRouteSealSize(this.routeBox!)*.30));
  const gold=this.field!.particles.flatMap((p,i)=>p.color===0xc19a52?[i]:[]);
  // Reuse the pool for ten directional flecks plus a local soft brush, or six broken ink tips.
  if(animated){if(kind==='confirm')this.gathering=gold.slice(0,11);else if(kind==='switch')this.trailing=gold.slice(0,6);}
  for(const i of [...this.gathering,...this.trailing])this.front?.add(this.nodes[i]);
  let confirmImpactFired=false;
  return new Promise(resolve=>{
   this.finishFeedback=resolve;
   const draw=()=>{
    g.clear();const t=clock.progress;
    if(kind==='switch'){
     // Continuous filled ribbons have no square line caps or crosswise seams.
     const head=1-(1-Math.min(1,t/.64))**2,tail=Math.max(0,(t-.28)/.72),fade=Math.min(1,(1-t)/.24),brush=Math.min(23,Math.max(12,anchor.width*.06));
     const ribbon=(offset:number,width:number,color:number,alpha:number,start=tail,end=head)=>{
      g.fillStyle(color,alpha*fade).fillPoints(inkRibbon!(start,end,offset,width),true);
     };
     ribbon(0,brush+3,0xe9dbb1,.7);ribbon(0,brush,0x183b36,.95);
     ribbon(-brush*.2,1.6,0xc6ac6c,.9,Math.max(tail,.12),head);
     // Three irregular longitudinal dry-brush splits, never a transverse grid.
     for(let k=0;k<3;k++){const start=Math.max(tail,.12+k*.18),end=Math.min(head,start+.2);if(end>start)ribbon(brush*(k-1)*.19,1,0xe9dbb1,.48,start,end);}
     for(const [j,index]of this.trailing.entries()){
      const age=Math.max(0,Math.min(1,(t-.36-j*.025)/.54)),u=Math.max(.03,Math.min(.94,tail+.025*j)),p=selectionInkPoint(anchor,u),q=selectionInkPoint(anchor,Math.min(1,u+.01));
      const x=Math.max(anchor.x+8,Math.min(anchor.x+anchor.width-8,p.x+age*(7+j))),y=Math.max(anchor.y+8,Math.min(anchor.y+anchor.height-8,p.y-age*(5+j*2)));
      const angle=Math.atan2(q.y-p.y,q.x-p.x),alpha=.88*Math.sin(Math.PI*age),visible=t>.36+j*.025&&age<1,dx=Math.cos(angle)*(5-age*2),dy=Math.sin(angle)*(5-age*2);
      this.nodes[index].setVisible(visible).setPosition(x,y).setRotation(angle).setDisplaySize(7-age*3,2.5).setTint(0xb9a66b).setAlpha(alpha);
      if(visible){g.lineStyle(3.4,0xf3e4be,alpha*.65).lineBetween(x-dx,y-dy,x+dx,y+dy);g.lineStyle(1.7,0x28463e,alpha).lineBetween(x-dx,y-dy,x+dx,y+dy);}
     }
    }else if(kind==='route'){
     const b=this.routeBox!;const cx=b.x+b.width/2,cy=b.y+b.height/2,base=selectionRouteSealSize(b),landing=Math.min(1,t/.24),scale=landing<1?2.1-1.1*(1-(1-landing)**3):1,fade=1-Math.max(0,(t-.72)/.28),alpha=Math.min(1,t/.05)*fade,size=base*scale,sx=cx-size/2,sy=cy-size/2;
     // Preview only: a big, noninteractive seal lands on the card, then reveals its persistent selected border.
     const burst=Math.max(0,1-Math.abs(t-.24)/.24);
     g.lineStyle(3,0xe9c16b,burst*.85).strokeRoundedRect(b.x+3,b.y+3,b.width-6,b.height-6,5);
     for(let j=0;j<8;j++){const a=j*Math.PI/4,r=base*(.58+.25*t),length=base*.18*burst;g.lineStyle(3,0xb8473a,burst).lineBetween(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*(r+length),cy+Math.sin(a)*(r+length));}
     g.fillStyle(0xb63f30,.96*alpha).fillRoundedRect(sx,sy,size,size,4).lineStyle(2,0xffedca,.9*alpha).strokeRoundedRect(sx+5,sy+5,size-10,size-10,2);
     this.seal?.setPosition(cx,cy).setScale(scale).setRotation(-.06).setVisible(alpha>0).setAlpha(alpha);
    }else{
     const b=finalBox,cx=b.x+b.width/2,cy=b.y+b.height/2,impact=Math.max(0,Math.min(1,(t-.30)/.16)),fade=1-Math.max(0,(t-.82)/.18),alpha=Math.min(1,impact*4)*fade,scale=impact<1?2.15-1.15*(1-(1-impact)**3):1,size=b.width*scale,sx=cx-size/2,sy=cy-size/2;
     // Keep the existing stamp and flash; the landing shares the hero-entrance cue.
     const flash=Math.max(0,1-Math.abs(t-.46)/.16);
     g.fillStyle(0x152a29,.28*fade*Math.min(1,t/.2)).fillRect(0,0,viewport.width,viewport.height);
     if(!confirmImpactFired&&t>=.46){confirmImpactFired=true;try{this.onConfirmImpact();}catch{/* Sound is optional; it must not block the saved choice. */}}
     g.lineStyle(4,0xf1cf83,flash*.9).strokeCircle(cx,cy,b.width*(.55+flash*.25));
     for(let j=0;j<12;j++){const a=j*Math.PI/6,r=b.width*(.62+.18*(1-flash)),len=b.width*.24*flash;g.lineStyle(j%2?3:5,j%2?0xf6d58a:0xb8473a,flash).lineBetween(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));}
     g.fillStyle(0xb63f30,.98*alpha).fillRoundedRect(sx,sy,size,size,8).lineStyle(Math.max(2,size*.025),0xffedca,.9*alpha).strokeRoundedRect(sx+size*.08,sy+size*.08,size*.84,size*.84,4);
     this.seal?.setPosition(cx,cy).setScale(scale).setRotation(-.035).setVisible(alpha>0).setAlpha(alpha);
     if(animated&&this.buttonWrap?.active&&this.button){const bb=this.button.box,pose=selectionButtonPose(t,bb.height),pivotX=bb.x+bb.width/2,pivotY=bb.y+bb.height;this.buttonWrap.setScale(pose.sx,pose.sy).setPosition(pivotX*(1-pose.sx),pivotY*(1-pose.sy)+pose.dy);}
     for(const [j,index]of this.gathering.slice(0,10).entries()){
      const node=this.nodes[index],point=selectionFinalGatherPoint(viewport,t,j),previous=selectionFinalGatherPoint(viewport,Math.max(0,t-.055),j),burst=Math.max(0,Math.min(1,(t-.48)/.3)),gather=t<.30&&j<6,a=gather?.95*Math.sin(Math.PI*Math.min(1,t/.30)):t>=.48?.95*(1-burst):0,angle=Math.atan2(point.y-cy,point.x-cx);
      node.setVisible(a>0).setPosition(point.x,point.y).setRotation(angle).setDisplaySize(gather?12:18-8*burst,4).setAlpha(a);
      if(a>0){g.lineStyle(5,0x152b26,a).lineBetween(previous.x,previous.y,point.x,point.y);g.lineStyle(3,0xffdc88,a).lineBetween(previous.x,previous.y,point.x,point.y);}
     }
     const glow=this.nodes[this.gathering[10]];if(glow)glow.setVisible(flash>0).setPosition(cx,cy).setDisplaySize(b.width*2,b.width*2).setTint(0xd59a4b).setAlpha(.4*flash);
    }
    if(kind==='confirm'&&this.skipRequested&&t>=.7)this.stopFeedback();
   };
   if(!animated){clock.progress=.61;draw();this.staticTimer=this.scene.time.delayedCall(260,()=>this.stopFeedback());}
   else {this.motion=this.scene.tweens.add({targets:clock,progress:1,duration:kind==='switch'?820:kind==='route'?900:1450,onUpdate:draw,onComplete:()=>this.stopFeedback()});draw();}
  });
 }
 private stopFeedback():void {
  this.motion?.stop();this.motion=undefined;this.staticTimer?.remove(false);this.staticTimer=undefined;this.activeKind=undefined;this.skipRequested=false;this.feedback?.active&&this.feedback.clear();this.seal?.active&&this.seal.setVisible(false).setScale(1).setRotation(0);
  if(this.buttonWrap)this.buttonWrap.setScale(1).setPosition(0,0);
  if(this.button){const {art,label,box}=this.button;this.scene.tweens.killTweensOf([art,label]);if(art.active)art.setScale(1).setPosition(box.x,box.y);if(label.active)label.setScale(1).setPosition(box.x+box.width/2,box.y+box.height/2-1);}
  for(const i of [...this.gathering,...this.trailing])if(this.nodes[i]?.active){this.nodes[i].clearTint().setRotation(0);(this.field?.particles[i].front?this.front:this.back)?.add(this.nodes[i]);}
  this.gathering=[];this.trailing=[];this.paint(true);
  const finish=this.finishFeedback;this.finishFeedback=undefined;finish?.();
 }
 private visible():boolean {return !this.destroyed&&!this.blurred&&this.onScreen&&!document.hidden&&this.scene.scene.isActive()&&!!this.root?.active&&this.root.visible&&!document.querySelector('dialog[open]')&&!!this.field;}
 private running():boolean {return this.visible()&&!this.reduced()&&!this.media.matches;}
 private sync():void {const running=this.running();this.routeCue?.setVisible(this.visible());if(!running&&(!this.staticTimer||!this.visible()))this.stopFeedback();if(running!==this.listening){this.listening=running;this.elapsed=0;if(running)this.scene.events.on('update',this.tick);else this.scene.events.off('update',this.tick);}if(!running&&this.visible())this.paint(true);}
 private paint(staticFrame=false):void {const field=this.field;if(!field)return;if(staticFrame)advanceEntryParticleField(field,0,true);if(this.routeCue){const g=this.routeCue,alpha=staticFrame ? .7 : .48+.32*(.5+.5*Math.sin(this.ambientTime*Math.PI/900));g.clear();for(const b of this.routeCueBoxes)g.lineStyle(2,0xd39342,alpha).strokeRoundedRect(b.x+3,b.y+3,b.width-6,b.height-6,4);}
  for(const [i,p]of field.particles.entries()){const node=this.nodes[i];if(!node?.active||this.gathering.includes(i)||this.trailing.includes(i))continue;const r=p.size*p.projectedScale,twinkle=p.bright?.78+.22*(.5+.5*Math.sin(this.ambientTime/1400+i*1.73)):1;node.setVisible(entryParticleVisible(p,field,this.protected)).setPosition(p.screenX,p.screenY).setDisplaySize(r*2,r*2).setAlpha(p.opacity*twinkle).setDepth(p.projectedScale);}this.back?.sort('depth');this.front?.sort('depth');}
 private release():void {this.stopFeedback();if(this.routeCue?.active)this.routeCue.destroy();this.routeCue=undefined;this.routeCueBoxes=[];if(this.buttonWrap?.active)this.buttonWrap.destroy(true);this.buttonWrap=undefined;this.button=undefined;if(this.feedback?.active)this.feedback.destroy();if(this.seal?.active)this.seal.destroy();this.feedback=this.seal=undefined;this.anchor=undefined;if(this.listening)this.scene.events.off('update',this.tick);this.listening=false;this.elapsed=0;if(this.back?.active)this.back.destroy(true);if(this.front?.active)this.front.destroy(true);this.back=this.front=undefined;this.nodes=[];this.field=undefined;this.protected=[];this.root=undefined;}
 destroy():void {if(this.destroyed)return;this.destroyed=true;this.release();this.observer.disconnect();this.intersection?.disconnect();document.removeEventListener('visibilitychange',this.changed);window.removeEventListener('blur',this.blur);window.removeEventListener('focus',this.focus);window.removeEventListener('tangsongpai-presentation',this.changed);this.media.removeEventListener('change',this.changed);for(const event of ['pause','resume','sleep','wake'])this.scene.events.off(event,this.changed);this.scene.events.off('shutdown',this.destroy,this);this.scene.events.off('destroy',this.destroy,this);}
}

/** An open travelling brush below the face, with room for the widest wet nib. */
export function selectionInkPoint(b:Box,t:number):{x:number;y:number} {
 const u=Math.max(0,Math.min(1,t));return{x:b.x+b.width*(.09+.82*u),y:b.y+b.height*(.88+.055*Math.sin(u*Math.PI*2)-.19*u)};
}
/** Reuse scratch points and identical centre lines, retaining the original 64-segment outline
 * and floating-point operation order. Graphics copies coordinates into its cleared buffer. */
export function createSelectionInkRibbon(anchor:Box):(start:number,end:number,offset:number,width:number)=>{x:number;y:number}[] {
 const count=64,points=Array.from({length:2*(count+1)},()=>({x:0,y:0}));
 const samples=Array.from({length:count+1},(_,i)=>({index:i,taper:Math.pow(Math.sin(Math.PI*(i/64)),.8),x:0,y:0,nx:0,ny:0,roughness:0}));
 let lastStart=NaN,lastEnd=NaN;
 return(start,end,offset,width)=>{
  if(!Object.is(start,lastStart)||!Object.is(end,lastEnd)){for(const s of samples){const u=start+(end-start)*s.index/64,p=selectionInkPoint(anchor,u),q=selectionInkPoint(anchor,Math.min(1,u+.002)),angle=Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2;s.x=p.x;s.y=p.y;s.nx=Math.cos(angle);s.ny=Math.sin(angle);s.roughness=.82+.18*Math.sin(u*13);}lastStart=start;lastEnd=end;}
  for(const [i,s]of samples.entries()){const half=width*s.taper*s.roughness/2,left=points[i],right=points[points.length-1-i];left.x=s.x+s.nx*(offset+half);left.y=s.y+s.ny*(offset+half);right.x=s.x+s.nx*(offset-half);right.y=s.y+s.ny*(offset-half);}
  return points;
 };
}
export function selectionFeedbackRegion(b:Box):Box {return{x:b.x+6,y:b.y+b.height*.54,width:b.width-12,height:b.height*.46-6};}
export function selectionSealBox(b:Box):Box {
 const region=selectionFeedbackRegion(b),size=Math.min(102,Math.max(48,b.width*.34),region.height*.64);return{x:region.x+region.width/2-size/2,y:region.y+region.height/2-size/2,width:size,height:size};
}
/** Inward gathering, then uneven outward strokes, wholly inside the existing portrait. */
export function selectionGatherPoint(anchor:Box,t:number,index:number):{x:number;y:number} {
 const region=selectionFeedbackRegion(anchor),b=selectionSealBox(anchor),cx=b.x+b.width/2,cy=b.y+b.height/2,angle=.23+index*Math.PI/5,dx=Math.cos(angle),dy=Math.sin(angle),safe=Math.max(0,Math.min((dx>0?region.x+region.width-9-cx:cx-region.x-9)/Math.abs(dx),(dy>0?region.y+region.height-9-cy:cy-region.y-9)/Math.abs(dy))),burst=Math.max(0,Math.min(1,(t-.61)/.25));
 const r=t<.61?safe*(1-Math.min(1,Math.max(0,t)/.47))**1.8:safe*(1-(1-burst)**3);
 return{x:cx+dx*r,y:cy+dy*r};
}
/** Transform the visual shell about its bottom edge; the independent hit rectangle never moves. */
export function selectionButtonPose(t:number,height=56):{sx:number;sy:number;dy:number} {
 const lift=height<50?15:22,drop=height<50?1:2;
 if(t<.28){const u=(Math.max(0,t)/.28)**.7;return{sx:1-.12*u,sy:1-.42*u,dy:0};}
 if(t<.4){const u=1-(1-(t-.28)/.12)**3;return{sx:.88+.02*u,sy:.58+.2*u,dy:-lift*u};}
 if(t<.44)return{sx:.9,sy:.78,dy:-lift};
 if(t<.5){const u=((t-.44)/.06)**3;return{sx:.9+.135*u,sy:.78-.18*u,dy:-lift+(lift+drop)*u};}
 // Brief contact hold, then a single damped recovery: no persistent bounce.
 if(t<.555)return{sx:1.035,sy:.6,dy:drop};
 if(t<.7){const u=1-(1-(t-.555)/.145)**3;return{sx:1.035-.035*u,sy:.6+.4*u,dy:drop*(1-u)};}
 return{sx:1,sy:1,dy:0};
}

/** Preview and final impressions live in CSS viewport space, independently of portrait size. */
export function selectionRouteSealSize(b:Box):number {return Math.max(20,Math.min(86,b.width*.68,b.height*.72));}
export function selectionFinalSealBox(viewport:{width:number;height:number}):Box {
 const size=Math.min(210,viewport.width*.58,viewport.height*.40);return{x:(viewport.width-size)/2,y:(viewport.height-size)/2,width:size,height:size};
}
export function selectionFinalGatherPoint(viewport:{width:number;height:number},t:number,index:number):{x:number;y:number} {
 const b=selectionFinalSealBox(viewport),cx=b.x+b.width/2,cy=b.y+b.height/2,a=.23+index*Math.PI/5,dx=Math.cos(a),dy=Math.sin(a),safe=Math.min((viewport.width/2-12)/Math.max(.01,Math.abs(dx)),(viewport.height/2-12)/Math.max(.01,Math.abs(dy)),b.width*1.45),burst=Math.max(0,Math.min(1,(t-.48)/.30));
 const r=t<.48?safe*(1-Math.min(1,Math.max(0,t)/.3))**1.8:safe*(1-(1-burst)**3);return{x:cx+dx*r,y:cy+dy*r};
}
