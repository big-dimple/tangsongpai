import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
vi.mock('phaser',()=>({default:{}}));
vi.mock('../src/platform/Viewport',()=>({alignViewportCamera:()=>{},cssViewport:()=>({width:390,height:740})}));
import {DetailDialog,modalBlocksCanvas} from '../src/game/DetailDialog';
import {SceneView} from '../src/game/SceneView';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(){
 let now=2948,open=true;vi.spyOn(performance,'now').mockImplementation(()=>now);
 const native=new EventEmitter(),page=Object.assign(new EventTarget(),{hidden:false,querySelector:()=>open?{}:null}),canvas=Object.assign(new EventTarget(),{getBoundingClientRect:()=>({left:0,top:0,width:390,height:740})});
 vi.stubGlobal('window',{addEventListener:(type:string,fn:(...args:any[])=>void)=>native.on(type,fn),removeEventListener:(type:string,fn:(...args:any[])=>void)=>native.off(type,fn)});vi.stubGlobal('document',page);
 const input=new EventEmitter(),events=new EventEmitter(),trace:any[]=[],scene:any={input,events,registry:{get:()=>trace},sys:{settings:{key:'shop'}},game:{canvas},scale:Object.assign(new EventEmitter(),{width:390,height:740}),scene:{isActive:()=>true},cameras:{main:{}},add:{container:()=>({setName(){return this;}})}};
 const object:any=Object.assign(new EventEmitter(),{name:'',input:{enabled:true},setName(n:string){this.name=n;return this;},setInteractive(){return this;},getBounds:()=>({contains:()=>true})}),view=new SceneView(scene,()=>{}),tap=vi.fn();view.target(object,'action/start-stage',{tap});
 const dialog=new DetailDialog();Object.assign(dialog,{dialog:{close:()=>{open=false;},remove:()=>{}},lastPointer:{x:195,y:637}});
 const press=(id:number,at:number,type='touch')=>({pointerId:id,pointerType:type,timeStamp:at,type:'pointerdown',isTrusted:true,isPrimary:true,button:0,buttons:1});
 const pointer=(at:number,type='touch',eventType=type==='touch'?'touchstart':'mousedown')=>({id:type==='touch'?1:0,x:195,y:660,wasTouch:type==='touch',downTime:at,upTime:at,isDown:true,event:{type:eventType,isTrusted:true,timeStamp:at},positionToCamera:()=>({x:195,y:660})});
 const close=()=>{now=3010.3;dialog.close();},time=(value:number)=>{now=value;};
 return{native,input,object,view,tap,trace,events,press,pointer,close,time};
}
it('the closing gesture and its later bubbling or synthetic tails cannot activate the exposed canvas button',()=>{
 const f=fixture(),old=f.press(21,2948),p=f.pointer(2948);f.native.emit('pointerdown',old);f.input.emit('pointerdown',p,[f.object]);expect(f.tap).not.toHaveBeenCalled();f.close();f.time(3080.4);
 f.input.emit('pointerdown',p,[f.object]);f.input.emit('pointerup',p);expect(f.tap).not.toHaveBeenCalled();expect(f.trace).toContainEqual(expect.objectContaining({stage:'modal-gate',reason:'dismissed-point',blocked:true}));
 f.native.emit('pointerup',old);
 for(const type of ['click','touchend','mousedown']){const tail=f.pointer(3048.9,type==='mousedown'?'mouse':'touch',type);f.input.emit('pointerdown',tail,[f.object]);f.input.emit('pointerup',tail);}expect(f.tap).not.toHaveBeenCalled();expect(modalBlocksCanvas(195,660)).toBe(true);f.events.emit('shutdown');
});
it.each(['touch','mouse','pen'])('an independent new %s down/up after close enters at the exact CI23px position within350ms',type=>{
 const f=fixture(),old=f.press(21,2948,type);f.native.emit('pointerdown',old);f.native.emit('pointerup',old);f.close();f.time(3080.4);
 const fresh=f.press(type==='touch'?22:21,3048.9,type),p=f.pointer(3048.9,type);f.native.emit('pointerdown',fresh);f.input.emit('pointerdown',p,[f.object]);f.native.emit('pointerup',fresh);f.input.emit('pointerup',{...p,isDown:false});
 expect(f.tap).toHaveBeenCalledOnce();expect(f.trace).toContainEqual(expect.objectContaining({stage:'tap-dispatch',object:'action/start-stage'}));expect(f.trace).toContainEqual(expect.objectContaining({stage:'modal-gate',blocked:false,freshPress:true}));
 expect(modalBlocksCanvas(195,660)).toBe(true);f.input.emit('pointerup',p);expect(f.tap).toHaveBeenCalledOnce();f.events.emit('shutdown');
});
