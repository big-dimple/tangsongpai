import {afterEach,expect,it,vi} from 'vitest';
import {mountNoviceGestureDemo,NOVICE_GESTURE_TIMING,sampleNoviceGesture} from '../src/game/NoviceGestureDemo';

class Node extends EventTarget {
 className='';innerHTML='';hidden=false;removed=false;dataset:Record<string,string>={};style:Record<string,string>={};
 attributes=new Map<string,string>();children=new Map<string,Node>();
 setAttribute(key:string,value:string){this.attributes.set(key,value);}remove(){this.removed=true;}
 querySelector(selector:string){return this.children.get(selector);}
}
function setup(){
 let now=0,next=0,gameReduced=false,points:{x:number;y:number}[]|undefined=[{x:40,y:100},{x:100,y:100}];
 const root=new Node(),hand=new Node(),contact=new Node(),line=new Node(),arrow=new Node();
 root.children.set('.novice-gesture-hand',hand);root.children.set('.novice-gesture-contact',contact);
 root.children.set('polyline',line);root.children.set('.novice-gesture-route path',arrow);
 const media=Object.assign(new EventTarget(),{matches:false});
 const win=Object.assign(new EventTarget(),{matchMedia:()=>media}),doc=Object.assign(new EventTarget(),{hidden:false,body:{append:vi.fn()},createElement:()=>root});
 const frames=new Map<number,FrameRequestCallback>();
 vi.stubGlobal('window',win);vi.stubGlobal('document',doc);
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++next,fn);return next;});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));vi.spyOn(performance,'now').mockImplementation(()=>now);
 const dismissed=vi.fn(),demo=mountNoviceGestureDemo({mode:'hold-drag',points:()=>points,reducedMotion:()=>gameReduced,onDismiss:dismissed});
 return {root,hand,contact,line,arrow,media,win,doc,frames,dismissed,demo,
  step(time:number){now=time;const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(time);},
  points(value:typeof points){points=value;},reduced(value:boolean){gameReduced=value;}};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('shows a genuine hold, moves only along real endpoints, then releases',()=>{
 const a={x:40,y:100},b={x:100,y:100};
 expect(sampleNoviceGesture('hold-drag',0,[a,b])).toEqual({phase:'press',point:a});
 expect(sampleNoviceGesture('hold-drag',500,[a,b])).toEqual({phase:'hold',point:a});
 expect(sampleNoviceGesture('hold-drag',NOVICE_GESTURE_TIMING['hold-drag'].hold,[a,b])).toEqual({phase:'move',point:a});
 const middle=sampleNoviceGesture('hold-drag',1625,[a,b]);expect(middle.phase).toBe('move');expect(middle.point.x).toBeCloseTo(70);
 expect(sampleNoviceGesture('hold-drag',2300,[a,b])).toEqual({phase:'release',point:b});
 expect(sampleNoviceGesture('hold-drag',2800,[a,b])).toEqual({phase:'rest',point:b});
});

it('sweeps past the actual movement threshold before a stationary hold could open details',()=>{
 for(const [distance,threshold] of [[12,10],[30,10],[60,20],[90,30]]){
  const points=[{x:0,y:0},{x:distance,y:0}],sample=sampleNoviceGesture('sweep',235,points,threshold);
  expect(sample.phase).toBe('move');expect(sample.point.x).toBeGreaterThan(threshold);
  expect(235).toBeLessThan(350);
 }
});

it('uses actual live geometry, hides invalid paths, and restarts when real points return',()=>{
 const f=setup();try{
  expect(f.root.attributes.get('aria-hidden')).toBe('true');expect(f.root.style.pointerEvents).toBe('none');
  expect(f.root.dataset).toMatchObject({mode:'hold-drag',phase:'press',x:'40.00',y:'100.00'});
  f.step(500);expect(f.root.dataset.phase).toBe('hold');
  f.points(undefined);f.step(800);expect(f.root.hidden).toBe(true);
  f.points([{x:50,y:120},{x:110,y:120}]);f.step(5000);
  expect(f.root.hidden).toBe(false);expect(f.root.dataset).toMatchObject({phase:'press',x:'50.00',y:'120.00'});
  f.step(6625);expect(f.root.dataset).toMatchObject({phase:'move',x:'80.00',y:'120.00'});
 }finally{f.demo.destroy();}
});

it('responds to system and game reduced-motion preferences with a static real path',()=>{
 const f=setup();try{
  f.step(1500);expect(f.root.dataset.phase).toBe('move');
  f.media.matches=true;f.media.dispatchEvent(new Event('change'));f.step(1516);
  expect(f.root.dataset).toMatchObject({phase:'static',reduced:'true',x:'40.00',y:'100.00'});
  expect(f.line.attributes.get('points')).toBe('40,100 100,100');expect(f.arrow.attributes.get('d')).toBeTruthy();
  f.step(9000);expect(f.root.dataset).toMatchObject({phase:'static',x:'40.00'});
  f.media.matches=false;f.reduced(true);f.step(9016);expect(f.root.dataset.reduced).toBe('true');
  f.reduced(false);f.media.dispatchEvent(new Event('change'));f.step(9032);expect(f.root.dataset).toMatchObject({phase:'press',reduced:'false'});
 }finally{f.demo.destroy();}
});

it('disappears at real pointerdown without canceling it, and cleans every listener and frame',()=>{
 const f=setup(),input=vi.fn();f.win.addEventListener('pointerdown',input);
 const event=new Event('pointerdown',{cancelable:true});f.win.dispatchEvent(event);
 expect(f.root.removed).toBe(true);expect(f.dismissed).toHaveBeenCalledOnce();expect(input).toHaveBeenCalledOnce();expect(event.defaultPrevented).toBe(false);
 expect(f.frames.size).toBe(0);f.win.dispatchEvent(new Event('keydown'));expect(f.dismissed).toHaveBeenCalledOnce();
 f.demo.destroy();expect(f.frames.size).toBe(0);
});

it('cleans on page visibility loss without waiting for another animation frame',()=>{
 const f=setup();f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));
 expect(f.root.removed).toBe(true);expect(f.dismissed).toHaveBeenCalledOnce();expect(f.frames.size).toBe(0);
});

it('disappears before the real controller action continues, without consuming it',()=>{
 const f=setup(),input=vi.fn();f.win.addEventListener('tangsongpai-controller-input',input);
 const event=new Event('tangsongpai-controller-input',{cancelable:true});f.win.dispatchEvent(event);
 expect(f.root.removed).toBe(true);expect(f.dismissed).toHaveBeenCalledOnce();expect(input).toHaveBeenCalledOnce();
 expect(event.defaultPrevented).toBe(false);expect(f.frames.size).toBe(0);
 f.demo.destroy();
});
