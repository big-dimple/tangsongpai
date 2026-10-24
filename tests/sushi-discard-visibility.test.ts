import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import type Phaser from 'phaser';
import {SushiDiscardCardPresentation} from '../src/game/SushiDiscardCardPresentation';
import {heroAttachmentIntensityFixture} from '../harness/fixtures/hero-attachment-intensity';
import {energySend} from '../harness/fixtures/score-energy';
const require=createRequire(import.meta.url),TransformMatrix=require('phaser/src/gameobjects/components/TransformMatrix.js') as new()=>Phaser.GameObjects.Components.TransformMatrix;
class Node extends EventEmitter {
 active=true;visible=true;alpha=1;name='';type='Container';x=0;y=0;rotation=0;scaleX=1;scaleY=1;parentContainer?:Node;list:Node[]=[];data:Record<string,unknown>={};
 setName(n:string){this.name=n;return this;}setData(k:string,v:unknown){this.data[k]=v;return this;}getData(k:string){return this.data[k];}setPosition(x:number,y:number){this.x=x;this.y=y;return this;}setRotation(r:number){this.rotation=r;return this;}setScale(x:number,y:number){this.scaleX=x;this.scaleY=y;return this;}setVisible(v:boolean){this.visible=v;return this;}
 add(n:Node){n.parentContainer=this;this.list.push(n);return this;}bringToTop(n:Node){this.list=this.list.filter(o=>o!==n);this.list.push(n);return this;}
 getWorldTransformMatrix():Phaser.GameObjects.Components.TransformMatrix {const m=new TransformMatrix().applyITRS(this.x,this.y,this.rotation,this.scaleX,this.scaleY);if(!this.parentContainer)return m;const world=new TransformMatrix();this.parentContainer.getWorldTransformMatrix().multiply(m,world);return world;}
 getBounds(){const m=this.getWorldTransformMatrix(),w=Number(this.data.width??14),h=Number(this.data.height??18),a=m.transformPoint(-w/2,-h/2),b=m.transformPoint(w/2,h/2);return{x:a.x,y:a.y,right:b.x,bottom:b.y,width:b.x-a.x,height:b.y-a.y};}
 destroy(){if(!this.active)return;this.active=false;this.emit('destroy');for(const n of [...this.list])n.destroy();if(this.parentContainer)this.parentContainer.list=this.parentContainer.list.filter(n=>n!==this);this.removeAllListeners();}
}
class Emitter extends Node {death:any;addDeathZone(z:unknown){this.death=z;return this;}addEmitZone(){return this;}start(){return this;}stop(){return this;}setParticleLifespan(){return this;}setParticleSpeed(){return this;}explode(){return this;}}
afterEach(()=>vi.unstubAllGlobals());
function setup(){
 vi.stubGlobal('document',{hidden:false});
 const graphics=()=>{const g=new Proxy(Object.assign(new Node(),{type:'Graphics'}),{get:(target,key):any=>key in target?Reflect.get(target,key):()=>g});return g;};
 const fixture=heroAttachmentIntensityFixture('amo'),trace=energySend(fixture.state,fixture.action).lastTrace!,ids=trace.amoExile!.discardedIds,root=new Node(),sources=new Map<string,Node>(),emitters:Emitter[]=[],scene={game:{renderer:{type:2}},scale:{width:780,height:1688,zoom:.5},textures:{exists:()=>true},add:{container:()=>new Node(),graphics,particles:()=>{const e=new Emitter();emitters.push(e);return e;}}};
 for(const [i,id]of ids.entries()){const c=new Node().setPosition(i?300+(i-1)*85:80,600).setData('cardFace',true).setData('cardId',id).setData('width',60).setData('height',100),text=Object.assign(new Node(),{type:'Text',name:'rank/K'});text.setPosition(-20,-35);c.add(text);root.add(c);sources.set(id,c);}
 const ordinary=new Node().setPosition(190,600).setData('cardFace',true).setData('width',60).setData('height',100);root.add(ordinary);const layer=new SushiDiscardCardPresentation(scene as unknown as Phaser.Scene,()=>root as unknown as Phaser.GameObjects.Container,id=>{const container=sources.get(id);return container?{id,container:container as unknown as Phaser.GameObjects.Container,width:60,height:100}:undefined;},()=>false,()=>({x:30,y:40})),abort=new AbortController();return{layer,trace,ids,root,sources,ordinary,emitters,abort,context:{generation:1,signal:abort.signal}};
}
it('keeps exact saved discarded-K proxies above reordered faces with local material and print/non-target protection',()=>{
 const f=setup();expect(f.layer.bindSaved(f.trace,f.context)).toBe(true);for(const source of f.sources.values())f.root.bringToTop(source);f.layer.step(50,true);const holders=f.root.list.filter(n=>n.name.startsWith('hero/sushi-discard/'));expect(holders).toHaveLength(f.ids.length);expect(holders.every(h=>f.root.list.indexOf(h)>f.root.list.indexOf(f.ordinary)&&[...f.sources.values()].every(s=>f.root.list.indexOf(h)>f.root.list.indexOf(s)))).toBe(true);
 const material=holders.flatMap(h=>h.list).find(n=>n.name==='hero/prepared-material'&&n.data.targetCardId===f.ids[1])!;expect(material).toBeTruthy();const patch=material.data.materialPatch as {x:number;y:number;width:number;height:number};expect(patch.x).toBeGreaterThan(-30);expect(patch.x+patch.width).toBeLessThan(30);expect(patch.y).toBeGreaterThan(-50);expect(patch.y+patch.height).toBeLessThan(50);expect(f.emitters).toHaveLength(0);f.layer.clear();expect(f.emitters.every(e=>!e.active)).toBe(true);
});
it('never paints an empty proxy after the actual face is removed, while the real impact/abort still closes its receipt',async()=>{
 const f=setup();expect(f.layer.bindSaved(f.trace,f.context)).toBe(true);const holder=f.root.list.find(n=>n.name==='hero/sushi-discard/'+f.ids[1])!;for(const source of f.sources.values())source.destroy();f.layer.step(50,true);expect(holder.active).toBe(false);expect(f.emitters.every(e=>!e.active)).toBe(true);
 let arrive!:()=>void;const arrival=new Promise<void>(resolve=>arrive=resolve),event=f.trace.events.find(e=>e.reasonKey==='amo.exile')!;f.layer.present(f.trace,event.eventId,f.context,arrival,300,100,{x:200,y:200});f.layer.step(500,true);expect(f.layer.active).toBe(true);arrive();await Promise.resolve();f.layer.step(100,true);expect(f.layer.active).toBe(false);expect(f.emitters.every(e=>!e.active)).toBe(true);
 const again=setup();again.layer.bindSaved(again.trace,again.context);again.abort.abort();expect(again.layer.active).toBe(false);expect(again.emitters.every(e=>!e.active)).toBe(true);
});
it.each(['offscreen','hidden','ancestor-hidden'] as const)('stops a saved proxy when the still-live real source becomes %s',kind=>{
 const f=setup();f.layer.bindSaved(f.trace,f.context);const id=f.ids[1],source=f.sources.get(id)!,holder=f.root.list.find(n=>n.name==='hero/sushi-discard/'+id)!,previous=f.emitters.filter(e=>e.data.targetCardId===id);if(kind==='offscreen')source.x=450;else if(kind==='hidden')source.visible=false;else{const parent=new Node();f.root.add(parent);f.root.list=f.root.list.filter(n=>n!==source);parent.add(source);parent.visible=false;}f.layer.step(50,true);expect(holder.visible).toBe(false);expect(previous.every(e=>!e.active)).toBe(true);f.layer.clear();
});
