import {afterEach,describe,expect,it,vi} from 'vitest';
import {SEAL_BEAT,SEAL_LAND_AT,SEAL_TEXT,SEAL_TOTAL,ensureSealTexture,mountSealStamp,sealBounds,sealPlacement,sealReach,sealStampPose,staticSealStamp} from '../src/game/SealStamp';

afterEach(()=>vi.unstubAllGlobals());
const overlaps=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function context(){return new Proxy({} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:()=>{},set:(t,k:string,v)=>{t[k]=v;return true;}});}
function fakeScene(){
  const store=new Map<string,any>(),tweens:any[]=[],listeners:Record<string,(()=>void)[]>={};
  const image=(key:string,frame:string)=>{const handlers:Record<string,(()=>void)[]>={},o:any={type:'Image',key,frame,active:true,alpha:1,data:{} as Record<string,unknown>,displayWidth:0,displayHeight:0,angle:0};
    for(const name of ['setName','setOrigin'])o[name]=()=>o;
    o.setAngle=(a:number)=>{o.angle=a;return o;};o.setAlpha=(a:number)=>{o.alpha=a;return o;};o.setFrame=(f:string)=>{o.frame=f;return o;};
    o.setDisplaySize=(w:number,h:number)=>{o.displayWidth=w;o.displayHeight=h;return o;};o.setData=(k:string,v:unknown)=>{o.data[k]=v;return o;};
    o.once=(name:string,fn:()=>void)=>{(handlers[name]??=[]).push(fn);return o;};o.destroy=()=>{if(!o.active)return;o.active=false;handlers.destroy?.forEach(fn=>fn());};return o;};
  const scene:any={
    events:{once:(n:string,fn:()=>void)=>{(listeners[n]??=[]).push(fn);},off:(n:string,fn:()=>void)=>{listeners[n]=(listeners[n]??[]).filter(f=>f!==fn);}},
    textures:{exists:(k:string)=>store.has(k),createCanvas:vi.fn((k:string)=>{const t={key:k,frames:[] as string[],getContext:()=>context(),add:(name:string)=>{t.frames.push(name);},refresh:vi.fn()};store.set(k,t);return t;})},
    add:{image:vi.fn((_x:number,_y:number,k:string,frame:string)=>image(k,frame)),
      container:()=>{const handlers:(()=>void)[]=[],g:any={active:true,list:[] as any[],setName:()=>g,add:(items:any[])=>{g.list.push(...items);return g;},once:(_n:string,fn:()=>void)=>{handlers.push(fn);return g;},
        destroy:()=>{if(!g.active)return;handlers.forEach(fn=>fn());g.active=false;g.list.forEach((child:any)=>child.destroy());}};return g;}},
    tweens:{add:vi.fn((config:any)=>{const tween={config,removed:false,remove(){tween.removed=true;}};tweens.push(tween);return tween;})}};
  const root:any={active:true,x:0,y:0,list:[] as any[],add(items:any){root.list.push(...(Array.isArray(items)?items:[items]));},setPosition(x:number,y:number){root.x=x;root.y=y;return root;}};
  const advance=(ms:number)=>{const tween=tweens[tweens.length-1];tween.config.targets.ms=ms;tween.config.onUpdate();if(ms>=tween.config.duration)tween.config.onComplete();};
  return {scene,root,store,tweens,advance,shutdown:()=>listeners.shutdown?.slice().forEach(fn=>fn())};
}
const options=(extra={})=>({kind:'clear' as const,board:{x:400,y:300,width:300,height:110},keep:[{x:420,y:330,width:250,height:44}],viewport:{width:1920,height:1080},reduced:()=>false,...extra});

describe('stage seal',()=>{
  it('keeps the shared three-beat grammar: lift, fall, hold',()=>{
    expect(SEAL_BEAT.lift).toBe(120);expect(SEAL_BEAT.liftScale).toBeGreaterThanOrEqual(1.12);expect(SEAL_BEAT.liftScale).toBeLessThanOrEqual(1.18);
    expect(SEAL_BEAT.fall).toBeGreaterThanOrEqual(60);expect(SEAL_BEAT.fall).toBeLessThanOrEqual(80);
    expect(SEAL_BEAT.squash).toBeGreaterThanOrEqual(33);expect(SEAL_BEAT.squash).toBeLessThanOrEqual(50);
    expect(SEAL_BEAT.shakePixels).toBeGreaterThanOrEqual(4);expect(SEAL_BEAT.shakePixels).toBeLessThanOrEqual(6);expect(SEAL_BEAT.shake).toBe(180);
    expect(SEAL_BEAT.hold).toBeGreaterThanOrEqual(600);expect(SEAL_BEAT.bleed).toBe(300);
    expect(SEAL_BEAT.angle).toBeLessThanOrEqual(-4);expect(SEAL_BEAT.angle).toBeGreaterThanOrEqual(-7);
    // The whole seal fits inside the existing one-second stage-clear pause: navigation is never delayed.
    expect(SEAL_TOTAL).toBeLessThanOrEqual(1000);expect(SEAL_LAND_AT).toBe(190);
    expect(SEAL_TEXT.clear.join('')).toBe('过关');expect(SEAL_TEXT.finale.join('')).toBe('压轴过关');
  });
  it('lifts, falls on a cubic, squashes for a few frames, shakes out and then holds still',()=>{
    expect(sealStampPose(0).alpha).toBe(0);
    const lifted=sealStampPose(SEAL_BEAT.lift-.001);expect(lifted.scaleX).toBeCloseTo(SEAL_BEAT.liftScale,3);expect(lifted.landed).toBe(false);
    // Cubic ease-in: most of the fall happens late.
    const half=sealStampPose(SEAL_BEAT.lift+SEAL_BEAT.fall/2);expect(half.scaleX).toBeGreaterThan(1+(SEAL_BEAT.liftScale-1)*.8);
    const hit=sealStampPose(SEAL_LAND_AT);expect(hit).toMatchObject({landed:true,contact:true,scaleX:SEAL_BEAT.squashX,scaleY:SEAL_BEAT.squashY,alpha:1});
    expect(Math.hypot(hit.shakeX,hit.shakeY)).toBeGreaterThanOrEqual(4);expect(Math.hypot(hit.shakeX,hit.shakeY)).toBeLessThanOrEqual(6);
    expect(sealStampPose(SEAL_LAND_AT+SEAL_BEAT.squash).contact).toBe(false);
    let last=Infinity;for(let t=0;t<SEAL_BEAT.shake;t+=20){const p=sealStampPose(SEAL_LAND_AT+t),size=SEAL_BEAT.shakePixels*Math.exp(-t/45);expect(Math.hypot(p.shakeX,p.shakeY)).toBeLessThanOrEqual(size+1e-9);expect(size).toBeLessThan(last);last=size;}
    for(const t of [SEAL_BEAT.shake,400,SEAL_BEAT.hold]){const still=sealStampPose(SEAL_LAND_AT+t);expect(still).toMatchObject({shakeX:0,shakeY:0,scaleX:1,scaleY:1,alpha:1});}
    expect(sealStampPose(SEAL_LAND_AT+SEAL_BEAT.bleed/2).bleed).toBeCloseTo(.5);expect(sealStampPose(SEAL_TOTAL).bleed).toBe(1);
    expect(sealStampPose(Number.NaN).alpha).toBe(0);
  });
  it('reduced motion fades the dry seal in place: no scale, no shake',()=>{
    for(const t of [0,60,120,500]){const p=sealStampPose(t,true);expect(p).toMatchObject({scaleX:1,scaleY:1,shakeX:0,shakeY:0,contact:false});expect(p.alpha).toBeCloseTo(Math.min(1,t/SEAL_BEAT.reducedFade));}
  });
  it.each([
    ['pc',{x:494,y:407,width:367,height:132},[{x:520,y:470,width:300,height:44},{x:560,y:412,width:230,height:20}],{width:1920,height:1080}],
    ['phone',{x:12,y:172,width:366,height:108},[{x:24,y:210,width:340,height:40},{x:60,y:180,width:270,height:18}],{width:390,height:844}],
    ['small',{x:8,y:150,width:304,height:74},[{x:16,y:176,width:288,height:34}],{width:320,height:568}],
  ] as const)('%s: signs the lower right corner at about seventy percent of the sheet without covering the score',(_name,board,keep,viewport)=>{
    const place=sealPlacement(board,keep,viewport),box=sealBounds(place);
    expect(place.size).toBeCloseTo(Math.max(40,Math.min(132,board.height*.7)),5);expect(place.angle).toBe(SEAL_BEAT.angle);
    for(const k of keep)expect(overlaps(box,k)).toBe(false);
    // A corner seal: right half of the sheet, at or below its lower part, and still touching the sheet.
    expect(place.x).toBeGreaterThan(board.x+board.width/2);expect(place.y).toBeGreaterThan(board.y+board.height/2);
    expect(overlaps(box,board)).toBe(true);
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
    expect(sealReach(place.size)).toBeGreaterThan(place.size/2);
  });
  it('bakes one three-frame texture per kind and does nothing without canvases',()=>{
    const f=fakeScene();expect(ensureSealTexture(f.scene,'clear')).toBe(true);expect(ensureSealTexture(f.scene,'clear')).toBe(true);expect(ensureSealTexture(f.scene,'finale')).toBe(true);
    expect(f.scene.textures.createCanvas).toHaveBeenCalledTimes(2);expect(f.store.get('seal-stamp/clear').frames).toEqual(['contact','full','bleed']);
    const bare:any={textures:{exists:()=>false},add:{}};expect(ensureSealTexture(bare,'clear')).toBe(false);expect(staticSealStamp(bare,'clear',{x:0,y:0,size:50,angle:-5})).toBeUndefined();
    const root:any={active:true},none=mountSealStamp(bare,root,options());expect(()=>{none.dispose();none.settle();}).not.toThrow();
  });
  it('presses once, nudges only the root, signals the landing once and ends still',()=>{
    const f=fakeScene(),onLand=vi.fn();mountSealStamp(f.scene,f.root,options({onLand}));
    const [bleed,face]=f.root.list[0].list;expect(face.type).toBe('PaperSheet');expect(face.alpha).toBe(0);expect(bleed.alpha).toBe(0);expect(face.angle).toBe(SEAL_BEAT.angle);
    expect(f.tweens[0].config.duration).toBe(SEAL_TOTAL);expect(f.tweens[0].config.ease).toBe('Linear');
    f.advance(100);expect(onLand).not.toHaveBeenCalled();expect(f.root.x).toBe(0);
    f.advance(SEAL_LAND_AT);expect(onLand).toHaveBeenCalledOnce();expect(face.frame).toBe('contact');expect(Math.hypot(f.root.x,f.root.y)).toBeGreaterThan(3);
    f.advance(SEAL_LAND_AT+60);expect(face.frame).toBe('full');
    f.advance(SEAL_TOTAL);expect(onLand).toHaveBeenCalledOnce();expect([f.root.x,f.root.y]).toEqual([0,0]);expect(face.alpha).toBe(1);expect(bleed.alpha).toBeCloseTo(.55);expect(face.active).toBe(true);
  });
  it('a skip, a redraw or a scene shutdown removes the seal and puts the table back',()=>{
    for(const exit of ['dispose','destroy','shutdown'] as const){
      const f=fakeScene(),{dispose}=mountSealStamp(f.scene,f.root,options());const [bleed,face]=f.root.list[0].list;
      f.advance(SEAL_LAND_AT+10);expect(Math.hypot(f.root.x,f.root.y)).toBeGreaterThan(0);
      if(exit==='dispose')dispose();else if(exit==='destroy')f.root.list[0].destroy();else f.shutdown();
      expect([f.root.x,f.root.y]).toEqual([0,0]);expect(face.active).toBe(false);expect(bleed.active).toBe(false);expect(f.tweens[0].removed).toBe(true);
      expect(()=>{dispose();dispose();}).not.toThrow();
    }
  });
  it('a skip settles to the dry seal at once, sounding its landing a single time',()=>{
    const f=fakeScene(),onLand=vi.fn(),seal=mountSealStamp(f.scene,f.root,options({onLand}));const [bleed,face]=f.root.list[0].list;
    f.advance(60);seal.settle();
    expect(onLand).toHaveBeenCalledOnce();expect(f.tweens[0].removed).toBe(true);expect([f.root.x,f.root.y]).toEqual([0,0]);
    expect(face).toMatchObject({active:true,alpha:1,frame:'full'});expect(bleed.alpha).toBeCloseTo(.55);
    seal.settle();expect(onLand).toHaveBeenCalledOnce();seal.dispose();expect(face.active).toBe(false);
  });
  it('a hidden tab settles straight to the dry seal',()=>{
    const handlers:Record<string,()=>void>={},doc={hidden:false,addEventListener:(n:string,fn:()=>void)=>{handlers[n]=fn;},removeEventListener:vi.fn()};vi.stubGlobal('document',doc);
    const f=fakeScene(),onLand=vi.fn();mountSealStamp(f.scene,f.root,options({onLand}));const [,face]=f.root.list[0].list;
    f.advance(SEAL_LAND_AT+5);doc.hidden=true;handlers.visibilitychange();
    expect(f.tweens[0].removed).toBe(true);expect([f.root.x,f.root.y]).toEqual([0,0]);expect(face.alpha).toBe(1);expect(face.active).toBe(true);expect(doc.removeEventListener).toHaveBeenCalled();
  });
  it('the settlement echo is the dry seal and can keep the title measurement',()=>{
    const f=fakeScene(),seal=staticSealStamp(f.scene,'finale',{x:10,y:20,size:60,angle:-5.5},{x:1,y:2,width:3,height:4}) as any;
    expect(seal.face.frame).toBe('full');expect(seal.bleed.frame).toBe('bleed');expect(seal.face.data.bounds).toEqual({x:1,y:2,width:3,height:4});expect(seal.face.data.kind).toBe('finale');
    expect(seal.face.displayWidth).toBeCloseTo(60*256/208);
  });
});
