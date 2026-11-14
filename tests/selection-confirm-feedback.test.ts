import {afterEach,expect,it,vi} from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import {SelectionEntryParticles} from '../src/game/SelectionEntryParticles';

class FakeNode extends EventEmitter {
 active=true;visible=true;alpha=1;type='Container';name='';list:FakeNode[]=[];depth=0;
 setName(n:string){this.name=n;return this;} setData(){return this;} add(nodes:FakeNode|FakeNode[]){this.list.push(...(Array.isArray(nodes)?nodes:[nodes]));return this;}
 moveTo(){return this;} sort(){return this;} setBlendMode(){return this;} setPosition(){return this;} setDisplaySize(){return this;} setAlpha(a:number){this.alpha=a;return this;}
 setDepth(d:number){this.depth=d;return this;} setVisible(v:boolean){this.visible=v;return this;} setRotation(){return this;} setScale(){return this;} clearTint(){return this;} setTint(){return this;}
 setText(){return this;} setFontSize(){return this;} setOrigin(){return this;} getWorldTransformMatrix(){return{applyInverse:(x:number,y:number)=>({x,y})};}
 destroy(){this.active=false;for(const n of this.list)n.destroy();this.emit('destroy');}
}
class FakeGraphics extends FakeNode {
 fillPoints=vi.fn(()=>this); clear(){return this;} fillStyle(){return this;} fillRect(){return this;} lineStyle(){return this;} strokeCircle(){return this;}
 lineBetween(){return this;} fillRoundedRect(){return this;} strokeRoundedRect(){return this;}
}
function fixture(reduced=false){
 const target=()=>({addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const media={...target(),matches:false};vi.stubGlobal('window',{...target(),innerWidth:390,devicePixelRatio:1,matchMedia:()=>media});
 vi.stubGlobal('document',{...target(),hidden:false,body:{},querySelector:()=>null});
 vi.stubGlobal('MutationObserver',class{observe(){} disconnect(){}});vi.stubGlobal('IntersectionObserver',undefined);
 const events=new EventEmitter(),root=new FakeNode(),graphic=new FakeGraphics(),impact=vi.fn();let tween:any,timer:()=>void=()=>{};
 const scene={events,game:{canvas:{}},scale:{width:390,height:740,zoom:1},scene:{isActive:()=>true},textures:{exists:()=>true},
  add:{container:()=>new FakeNode(),image:()=>new FakeNode(),graphics:()=>graphic,text:()=>new FakeNode()},
  tweens:{add:(c:any)=>{tween=c;return{stop:vi.fn()};},killTweensOf:vi.fn()},time:{delayedCall:(_n:number,cb:()=>void)=>{timer=cb;return{remove:vi.fn()};}}};
 const layer=new SelectionEntryParticles(scene as unknown as Phaser.Scene,()=>reduced,impact);
 layer.mount(root as unknown as Phaser.GameObjects.Container,{x:20,y:90,width:160,height:200},0xb8473a);
 return{layer,impact,graphic,advance:(p:number)=>{tween.targets.progress=p;tween.onUpdate();},finish:()=>tween.onComplete(),timer:()=>timer()};
}
afterEach(()=>vi.unstubAllGlobals());

it('plays one landing cue at the visible final stamp without drawing the green sweep',async()=>{
 const f=fixture(),done=f.layer.confirm();f.advance(.30);f.advance(.459);expect(f.impact).not.toHaveBeenCalled();
 f.advance(.46);expect(f.impact).toHaveBeenCalledOnce();f.advance(.7);f.advance(.9);expect(f.impact).toHaveBeenCalledOnce();
 expect(f.graphic.fillPoints).not.toHaveBeenCalled();f.finish();await done;f.layer.destroy();
});
it('fires the landing cue once for the static reduced-motion stamp',async()=>{
 const f=fixture(true),done=f.layer.confirm();expect(f.impact).toHaveBeenCalledOnce();expect(f.graphic.fillPoints).not.toHaveBeenCalled();f.timer();await done;f.layer.destroy();
});
it('does not play a landing cue when the animation is interrupted before impact',async()=>{
 const f=fixture(),done=f.layer.confirm();f.advance(.3);f.layer.destroy();await done;expect(f.impact).not.toHaveBeenCalled();
});
