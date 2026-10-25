import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import type Phaser from 'phaser';
vi.mock('phaser',()=>({default:{}}));
vi.mock('../src/platform/Viewport',()=>({alignViewportCamera:()=>{}}));
vi.mock('../src/game/DetailDialog',()=>({modalBlocksCanvas:()=>false}));
import {SceneView} from '../src/game/SceneView';
import {controllerScene,registerControllerScene} from '../src/game/ControllerScene';
afterEach(()=>vi.unstubAllGlobals());
function setup(){
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',new EventTarget());
  const events=new EventEmitter(),scene={events,input:Object.assign(new EventEmitter(),{enabled:true}),game:{canvas:new EventTarget()},scale:new EventEmitter(),add:{container:()=>({setName(){return this;}})}} as unknown as Phaser.Scene;
  const view=new SceneView(scene,()=>{}),tap=vi.fn();
  const object=Object.assign(new EventEmitter(),{active:true,visible:true,name:'',input:{enabled:true},parentContainer:undefined as {active:boolean;visible:boolean}|undefined,
    setName(name:string){this.name=name;return this;},setInteractive(){return this;},getData:()=>false,getBounds:()=>({x:20,y:40,width:120,height:44})});
  view.target(object as unknown as Phaser.GameObjects.Rectangle,'action/play',{tap});
  return {scene,events,view,object,tap};
}
it('registers full hit geometry and invokes the same guarded action once',()=>{
  const {scene,object,tap}=setup(),target=controllerScene(scene)!.targets()[0];expect(target.box).toEqual({x:20,y:40,width:120,height:44});
  target.activate();expect(tap).toHaveBeenCalledOnce();object.input.enabled=false;target.activate();expect(tap).toHaveBeenCalledOnce();
});
it('omits disabled, hidden, destroyed and covered-parent scene targets',()=>{
  const {scene,object}=setup(),provider=controllerScene(scene)!;
  object.input.enabled=false;expect(provider.targets()).toEqual([]);object.input.enabled=true;
  object.visible=false;expect(provider.targets()).toEqual([]);object.visible=true;
  object.active=false;expect(provider.targets()).toEqual([]);object.active=true;
  object.parentContainer={active:true,visible:false};expect(provider.targets()).toEqual([]);
});
it('routes scene semantics and unregisters them on shutdown',()=>{
  const {scene,view,events}=setup();view.controllerAction=action=>action==='back';
  expect(controllerScene(scene)!.action?.('back','action/play')).toBe(true);expect(controllerScene(scene)!.action?.('confirm','action/play')).toBe(false);
  events.emit('shutdown');expect(controllerScene(scene)).toBeUndefined();
});
it('an old provider cannot unregister a newer scene generation',()=>{
  const scene={} as Phaser.Scene,old=registerControllerScene(scene,{targets:()=>[]}),current={targets:()=>[]};registerControllerScene(scene,current);old();expect(controllerScene(scene)).toBe(current);
});
