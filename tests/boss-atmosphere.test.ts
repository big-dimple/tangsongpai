import {afterEach,expect,it,vi} from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import {applyCommand,type R2RunState} from '../src/domain/run';
import {workshopBossTransition,workshopLayoutFixture} from '../harness/fixtures/workshop-layout';
import {advanceEntryParticleField} from '../src/game/EntryDepthParticles';
import {intersects,layout} from '../src/game/layout';
import {bossAtmosphereKey,bossGhostArea,bossParticleCount,bossParticleVisible,createBossParticleField} from '../src/game/BossAtmosphereModel';
import {detailArt,decodeArtImage} from '../src/game/DetailArt';
import {shopLayout,shopPortraitHeader} from '../src/game/ShopLayout';
import {clearBossAtmosphere,installBossGhostTexture,syncBossAtmosphere} from '../src/game/BossAtmosphere';
vi.mock('../src/game/DetailArt',()=>({detailArt:vi.fn(()=>new Promise(()=>{})),decodeArtImage:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
function enter(run:R2RunState){let state=run;for(const action of [{type:'LeaveShop'},{type:'EnterStage'}] as const){const result=applyCommand(state,{runId:state.runId,commandId:'boss-atmosphere/'+state.commandSeq,expectedSeq:state.commandSeq,action});expect(result.ok).toBe(true);if(!result.ok)throw Error(result.code);state=result.state;}return state;}
it('follows the real current shop visit and entered Boss stage, never a stale Boss, ordinary shop, loading or won state',()=>{
 const {before,won,after}=workshopBossTransition(),saved=structuredClone(before);expect(bossAtmosphereKey(before,'preparation')).toBeTruthy();expect(bossAtmosphereKey(before,'battle')).toBeUndefined();
 expect(bossAtmosphereKey({...before,shop:{...before.shop!,visitIndex:1}},'preparation')).toBeUndefined();for(const state of [won,after,workshopLayoutFixture(0).state])for(const mode of ['preparation','battle'] as const)expect(bossAtmosphereKey(state,mode)).toBeUndefined();
 const active=enter(before);expect(bossAtmosphereKey(active,'battle')).toBeTruthy();expect(bossAtmosphereKey({...active,stageIndex:active.stageIndex+1},'battle')).toBeUndefined();expect(before).toEqual(saved);
});
it('bounds four dark edge bands, low-device count and complete brush footprints away from protected text/actions',()=>{
 expect([bossParticleCount(390),bossParticleCount(1366),bossParticleCount(390,4)]).toEqual([12,24,6]);
 for(const [width,height]of [[320,568],[390,740],[1366,768]]){const field=createBossParticleField(width,height,bossParticleCount(width),()=>.35),protectedBoxes=[{x:12,y:40,width:width-24,height:height-80}];let visible=0;
  for(let frame=0;frame<120;frame++){advanceEntryParticleField(field,50);for(const p of field.particles)if(bossParticleVisible(p,field,protectedBoxes)){visible++;const r=p.size*p.projectedScale*1.3;expect(intersects({x:p.screenX-r,y:p.screenY-r,width:r*2,height:r*2},protectedBoxes[0])).toBe(false);expect(p.screenX+r<=16||p.screenX-r>=width-16||p.screenY+r<=16||p.screenY-r>=height-16).toBe(true);}}
  expect(visible).toBeGreaterThan(0);
 }
 const blocked=[{x:0,y:0,width:390,height:252}];expect(bossGhostArea(390,740,blocked)).toBeUndefined();const area=bossGhostArea(1366,768,[])!;expect(area.width/area.height).toBe(2);expect(bossGhostArea(390,740,blocked,{x:20,y:20,width:200,height:100})).toBeUndefined();
});
class Target extends EventEmitter {addEventListener(k:string,f:()=>void){this.on(k,f);}removeEventListener(k:string,f:()=>void){this.off(k,f);}}
class Node extends EventEmitter {
 active=true;visible=true;alpha=1;name='';type='Container';list:Node[]=[];data:Record<string,unknown>={};input=undefined;x=0;y=0;width=0;height=0;depth=0;
 setName(n:string){this.name=n;return this;}setDepth(d:number){this.depth=d;return this;}setData(k:string,v:unknown){this.data[k]=v;return this;}setVisible(v:boolean){this.visible=v;return this;}setAlpha(a:number){this.alpha=a;return this;}setPosition(x:number,y:number){this.x=x;this.y=y;return this;}setDisplaySize(w:number,h:number){this.width=w;this.height=h;return this;}setOrigin(){return this;}setCrop(x:number,y:number,width:number,height:number){this.data.crop={x,y,width,height};return this;}setScale(n:number){this.data.scale=n;return this;}setBlendMode(){return this;}add(n:Node){this.list.push(n);return this;}getBounds(){return{x:this.x,y:this.y,width:this.width,height:this.height};}destroy(){if(!this.active)return;this.active=false;for(const n of this.list)n.destroy();this.emit('destroy');}
}
function fixture(width=390,height=740){
 const media=Object.assign(new Target(),{matches:false}),window=Object.assign(new Target(),{matchMedia:()=>media}),document=Object.assign(new Target(),{hidden:false,body:{},dialog:false,getElementById:()=>({getBoundingClientRect:()=>({x:0,y:0,width,height})}),querySelector:()=>document.dialog?{}:null,querySelectorAll:()=>[]}),observers:{cb:()=>void;disconnect:ReturnType<typeof vi.fn>}[]=[],intersections:{cb:(entries:{isIntersecting:boolean}[])=>void;disconnect:ReturnType<typeof vi.fn>}[]=[];
 vi.stubGlobal('window',window);vi.stubGlobal('document',document);vi.stubGlobal('navigator',{hardwareConcurrency:8,deviceMemory:8});vi.stubGlobal('MutationObserver',class{disconnect=vi.fn();observe(){}constructor(readonly cb:()=>void){observers.push(this);}});vi.stubGlobal('IntersectionObserver',class{disconnect=vi.fn();observe(){}constructor(readonly cb:(entries:{isIntersecting:boolean}[])=>void){intersections.push(this);}});
 const timers:{callback:()=>void;remove:ReturnType<typeof vi.fn>}[]=[];const events=new EventEmitter(),gameEvents=new EventEmitter(),nodes:Node[]=[],textures=Object.assign(new EventEmitter(),{cache:new Map<string,{width:number;height:number}>(),exists:(key:string)=>textures.cache.has(key),get:(key:string)=>({getSourceImage:()=>textures.cache.get(key)}),createCanvas:(key:string,w:number,h:number)=>{textures.cache.set(key,{width:w,height:h});textures.emit('addtexture',key);return{getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}}),refresh(){}};}}),make=(type:string)=>{const n=new Node();n.type=type;nodes.push(n);return n;},scene={events,time:{delayedCall:(_ms:number,callback:()=>void)=>{const timer={callback,remove:vi.fn()};timers.push(timer);return timer;}},game:{events:gameEvents,canvas:{}},scale:{width,height,zoom:1},scene:{isActive:()=>true},textures,add:{container:()=>make('Container'),image:()=>make('Image'),text:()=>make('Text')}},root=new Node();let run=workshopBossTransition().before,reduced=false;
 const sync=()=>syncBossAtmosphere(scene as unknown as Phaser.Scene,root as unknown as Phaser.GameObjects.Container,()=>run,'preparation',{reduced:()=>reduced});return{scene:scene as unknown as Phaser.Scene,events,gameEvents,nodes,textures,root,document,window,media,observers,intersections,timers,sync,setRun:(s:R2RunState)=>{run=s;},reduce:(v:boolean)=>{reduced=v;window.emit('tangsongpai-presentation');},layer:()=>nodes.find(n=>n.name==='boss/atmosphere'&&n.active)!,particles:()=>nodes.filter(n=>n.name==='boss/edge-particle'&&n.active)};
}
it('allocates nothing for ordinary shops, injects no placeholder, keeps a fixed pool and resumes without new render loops',()=>{
 const f=fixture();f.setRun(workshopLayoutFixture(0).state);f.sync();expect(f.nodes).toHaveLength(0);expect(f.events.listenerCount('update')).toBe(0);
 f.setRun(workshopBossTransition().before);f.sync();expect(f.particles()).toHaveLength(12);expect(f.layer().data.ghostStatus).toBe('missing-art');expect(f.nodes.some(n=>n.name==='boss/ghost')).toBe(false);f.sync();expect(f.particles()).toHaveLength(12);expect(f.events.listenerCount('update')).toBe(1);expect(f.nodes.every(n=>!n.input)).toBe(true);
 f.document.hidden=true;f.document.emit('visibilitychange');expect(f.events.listenerCount('update')).toBe(0);expect(f.layer().visible).toBe(false);f.document.hidden=false;f.document.emit('visibilitychange');expect(f.events.listenerCount('update')).toBe(1);
 f.document.dialog=true;f.observers[0].cb();expect(f.events.listenerCount('update')).toBe(0);f.document.dialog=false;f.observers[0].cb();f.intersections[0].cb([{isIntersecting:false}]);expect(f.events.listenerCount('update')).toBe(0);f.intersections[0].cb([{isIntersecting:true}]);expect(f.events.listenerCount('update')).toBe(1);
 f.reduce(true);expect(f.particles()).toHaveLength(0);expect(f.events.listenerCount('update')).toBe(0);f.reduce(false);expect(f.particles()).toHaveLength(12);vi.stubGlobal('navigator',{hardwareConcurrency:4,deviceMemory:8});f.sync();expect(f.particles()).toHaveLength(6);expect(f.events.listenerCount('update')).toBe(1);clearBossAtmosphere(f.scene);expect(f.nodes.every(n=>!n.active)).toBe(true);
});
it('uses only the real2:1 texture with a safe head/shoulder camera, and cleans every owner on exit',()=>{
 const f=fixture(1366,768);f.sync();f.textures.cache.set('real-user-png',{width:2048,height:1024});installBossGhostTexture(f.scene.game,'real-user-png');const ghost=f.nodes.find(n=>n.name==='boss/ghost'&&n.active)!;expect(ghost).toBeTruthy();expect(ghost.data.crop).toEqual({x:778,y:0,width:512,height:399});expect(Number(ghost.data.scale)).toBeGreaterThan(0);expect(ghost.alpha).toBe(.18);expect(ghost.input).toBeUndefined();
 f.reduce(true);expect(ghost.active).toBe(true);expect(f.particles()).toHaveLength(0);f.setRun(workshopBossTransition().after);f.sync();expect(f.nodes.every(n=>!n.active)).toBe(true);expect(f.events.eventNames()).toHaveLength(0);expect(f.gameEvents.eventNames()).toHaveLength(0);expect(f.textures.eventNames()).toHaveLength(0);expect(f.document.eventNames()).toHaveLength(0);expect(f.window.eventNames()).toHaveLength(0);expect(f.media.eventNames()).toHaveLength(0);expect([...f.observers,...f.intersections].every(o=>o.disconnect.mock.calls.length===1)).toBe(true);
 f.events.emit('shutdown');f.events.emit('destroy');clearBossAtmosphere(f.scene);
});

it('announces once per real Boss shop visit and cancels its local notice on shutdown',()=>{
 const f=fixture();f.sync();expect(f.nodes.filter(n=>n.name==='boss/arrival'&&n.active)).toHaveLength(1);expect(f.timers).toHaveLength(1);f.sync();expect(f.timers).toHaveLength(1);f.timers[0].callback();f.sync();expect(f.nodes.filter(n=>n.name==='boss/arrival'&&n.active)).toHaveLength(0);clearBossAtmosphere(f.scene);f.sync();expect(f.timers).toHaveLength(1);clearBossAtmosphere(f.scene);
});

it('optional Boss art never reserves a separate line above the phone shop controls',()=>{
 for(const [width,height] of [[320,568],[390,740]]){
  const p=shopLayout(width,height,layout({width,height},{top:0,right:0,bottom:0,left:0}).hud.y,0,3,false,false,0,0,0),header=p.portrait?Object.values(shopPortraitHeader(p)).filter((b):b is {x:number;y:number;width:number;height:number}=>!!b):[p.chapter,p.items,p.build,p.reroll],area={x:p.x,y:p.top-52,width:Math.min(320,p.w-72),height:44};
  expect(bossGhostArea(width,height,[...header,p.tabs,p.play],area)).toBeUndefined();
 }
});
it('late optional art cannot install a texture or revive a retired shop owner',async()=>{
 let ready!:(src:string)=>void;vi.mocked(detailArt).mockImplementationOnce(()=>new Promise(resolve=>ready=resolve));vi.mocked(decodeArtImage).mockResolvedValueOnce({width:1774,height:887} as HTMLImageElement);
 const f=fixture();f.sync();clearBossAtmosphere(f.scene);ready('blob:late');for(let i=0;i<8;i++)await Promise.resolve();expect(f.textures.cache.has('boss/general-95008f17')).toBe(false);expect(f.nodes.every(n=>!n.active)).toBe(true);expect(f.events.listenerCount('update')).toBe(0);
});

it.each([[1180,1,168],[1180,5,80],[1920,5,168]])('PC Boss art uses only the spare upper rail (%s wide, %s held)',(width,owned,minimum)=>{
 const p=shopLayout(width,757,8,0,3,false,false,0,0,owned,{x:width-76,y:12,width:64,height:44}),pc=p.pc!;
 const heading={x:pc.ownedRail.x,y:p.top+12,width:Math.max(160,p.build.x-pc.ownedRail.x-8),height:40};
 const protectedBoxes=[pc.left,heading,...p.slots.slice(0,owned),p.build,pc.inventoryEntry,p.reroll,p.tabs,pc.shared,p.play,p.menu!].map(b=>({x:b.x-4,y:b.y-4,width:b.width+8,height:b.height+8}));
 const area=bossGhostArea(width,757,protectedBoxes)!;expect(area).toBeDefined();expect(area.width).toBeGreaterThanOrEqual(minimum);expect(area.height).toBeGreaterThanOrEqual(minimum/2);
 for(const b of protectedBoxes)expect(intersects(area,b)).toBe(false);
});
