import {afterEach,describe,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {mountHighMultiplierAura,type HighMultiplierAuraOptions} from '../src/game/HighMultiplierAura';
import {layout,type Box} from '../src/game/layout';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

type Point={x:number;y:number};
type Painted={color:number;alpha:number;points:Point[]};

/** Read the real Phaser Graphics command buffer, not a mock drawing recipe. */
function painted(ink:Phaser.GameObjects.Graphics):Painted[]{
  const commands=ink.commandBuffer,result:Painted[]=[];
  let color=0,alpha=0,points:Point[]=[];
  for(let i=0;i<commands.length;){
    const op=commands[i++];
    if(op===7){color=commands[i++];alpha=commands[i++];}
    else if(op===1)points=[];
    else if(op===4||op===5)points.push({x:commands[i++],y:commands[i++]});
    else if(op===8)result.push({color,alpha,points});
    else throw new Error(`Unexpected Phaser graphics command ${op}`);
  }
  return result;
}
function separated(points:readonly Point[],box:Box,epsilon=1e-6):boolean {
  return points.every(p=>p.x<=box.x+epsilon)||points.every(p=>p.x>=box.x+box.width-epsilon)||
    points.every(p=>p.y<=box.y+epsilon)||points.every(p=>p.y>=box.y+box.height-epsilon);
}
function within(points:readonly Point[],box:Box):boolean {
  return points.every(p=>p.x>=box.x-1e-6&&p.x<=box.x+box.width+1e-6&&p.y>=box.y-1e-6&&p.y<=box.y+box.height+1e-6);
}
function fixture(spec={width:1280,height:720,density:1,renderer:2}){
  const f=nativeHeroRuntime(spec),signal=new AbortController();
  const table=layout({width:spec.width,height:spec.height},{top:0,left:0,right:0,bottom:0},spec.width<600?'portrait':'desktop',{count:8},{pc:spec.width>=600});
  let board:Box|undefined=table.scoreBoard,viewport:Box|undefined={x:0,y:0,width:spec.width,height:spec.height},guards:readonly Box[]|undefined=[];
  let reduced=false,current=true,clock=0;
  const opts:HighMultiplierAuraOptions={root:f.root,eventId:'saved/hand/event-4',signal:signal.signal,
    getBoard:()=>board,getViewport:()=>viewport,getGuards:()=>guards,reduced:()=>reduced,isCurrent:()=>current};
  const play=()=>mountHighMultiplierAura(f.scene,opts);
  const step=(delta:number)=>{clock+=delta;f.scene.events.emit('postupdate',clock,delta);};
  const ink=()=>f.root.list.find(o=>o.name==='score/high-multiplier-aura') as Phaser.GameObjects.Graphics|undefined;
  return {...f,signal,table,opts,play,step,ink,setBoard:(value:Box|undefined)=>board=value,
    setViewport:(value:Box|undefined)=>viewport=value,setGuards:(value:readonly Box[]|undefined)=>guards=value,
    setReduced:(value:boolean)=>reduced=value,setCurrent:(value:boolean)=>current=value};
}

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('high-multiplier visual on actual Phaser Graphics',()=>{
  it('animates individually staggered curved purple tongues with bright cores, then removes them at 1.7s',()=>{
    const f=fixture(),random=vi.spyOn(Math,'random');f.play();const ink=f.ink()!;
    expect(ink).toBeTruthy();expect(ink.input).toBeNull();expect(ink.getData('eventId')).toBe('saved/hand/event-4');
    f.step(120);const early=painted(ink),earlyCount=ink.getData('visibleSegments'),earlyBuffer=[...ink.commandBuffer];
    f.step(280);const peak=painted(ink),peakCount=ink.getData('visibleSegments'),peakBuffer=[...ink.commandBuffer];
    expect(ink.getData('elapsed')).toBe(400);expect(earlyCount).toBeGreaterThan(0);expect(peakCount).toBeGreaterThan(earlyCount);
    expect(peakBuffer).not.toEqual(earlyBuffer);expect(peak.map(p=>p.color)).toContain(0x793bc9);
    expect(peak.map(p=>p.color)).toContain(0x7943c9);expect(peak.map(p=>p.color)).toContain(0xffeaff);
    expect(new Set(peak.filter(p=>p.color===0x7943c9).map(p=>p.alpha.toFixed(3))).size).toBeGreaterThan(3);
    expect(peak.some(p=>p.points.length>20)).toBe(true);expect(early.every(p=>p.alpha>=0&&p.alpha<=1)).toBe(true);
    f.step(1000);const fading=painted(ink);expect(Math.max(...fading.map(p=>p.alpha))).toBeLessThan(Math.max(...peak.map(p=>p.alpha)));
    expect(f.ink()).toBe(ink);f.step(299);expect(f.ink()).toBe(ink);f.step(1);
    expect(f.ink()).toBeUndefined();expect(ink.active).toBe(false);expect(random).not.toHaveBeenCalled();
    expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });

  it('curls individual flame tips over time, beyond opacity or common movement',()=>{
    const f=fixture();f.play();
    const bodies=()=>painted(f.ink()!).filter(path=>path.color===0x7943c9);
    f.step(600);const before=bodies();f.step(400);const after=bodies();f.step(200);const later=bodies();
    expect(before).toHaveLength(6);expect(after).toHaveLength(6);expect(later).toHaveLength(6);
    const change=(first:Painted[],second:Painted[],index:number)=>{
      const a=first[index].points,b=second[index].points;expect(b).toHaveLength(a.length);
      const tip=a.reduce((best,p,i)=>p.y<a[best].y?i:best,0),base=a.reduce((best,p,i)=>p.y>a[best].y?i:best,0);
      return {x:(b[tip].x-b[base].x)-(a[tip].x-a[base].x),y:(b[tip].y-b[base].y)-(a[tip].y-a[base].y)};
    };
    const left=change(before,after,1),right=change(before,after,4),rightNext=change(after,later,4);
    expect(Math.hypot(left.x,left.y)).toBeGreaterThan(.5);expect(Math.hypot(rightNext.x,rightNext.y)).toBeGreaterThan(.5);
    expect(Math.hypot(left.x-right.x,left.y-right.y)).toBeGreaterThan(.5);
  });

  it.each([[320,568],[390,844],[1280,720]])('starts across the bottom of the %sx%s score board', (width,height)=>{
    const f=fixture({width,height,density:1,renderer:2}),board=f.table.scoreBoard;f.play();f.step(600);
    const bodies=painted(f.ink()!).filter(path=>path.color===0x7943c9);
    expect(bodies).toHaveLength(6);
    for(const body of bodies){
      expect(Math.max(...body.points.map(point=>point.y))).toBeGreaterThan(board.y+board.height-10);
      expect(Math.min(...body.points.map(point=>point.y))).toBeLessThan(board.y+board.height-10);
    }
    expect(bodies.filter(body=>{
      const x=body.points.reduce((sum,point)=>sum+point.x,0)/body.points.length;
      return x>board.x+board.width*.2&&x<board.x+board.width*.8;
    }).length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    [390,844,1],[390,844,2],[360,800,1],[360,800,2],[320,568,1],[320,568,2]
  ])('keeps layered, complete flames inside the score panel and viewport on a %sx%s phone, renderer %s',(width,height,renderer)=>{
    const f=fixture({width,height,density:1,renderer}),board=f.table.scoreBoard;f.play();
    const sample=(delta:number)=>{
      f.step(delta);const paths=painted(f.ink()!),bodies=paths.filter(path=>path.color===0x7943c9);
      expect(bodies).toHaveLength(6);expect(paths.filter(path=>path.color===0xffeaff)).toHaveLength(6);
      expect(paths.every(path=>path.points.length===35)).toBe(true);
      for(const path of paths){
        expect(within(path.points,{x:6.5,y:6.5,width:width-13,height:height-13})).toBe(true);
        expect(path.points.every(p=>p.y>=board.y+2.5-1e-6&&p.y<=board.y+board.height-2.5+1e-6)).toBe(true);
      }
      return bodies;
    };
    sample(250);const rising=sample(150),peak=sample(200);sample(400);sample(400);sample(150);
    const extent=(path:Painted,axis:'x'|'y')=>Math.max(...path.points.map(p=>p[axis]))-Math.min(...path.points.map(p=>p[axis]));
    expect(extent(peak[1],'y')).toBeGreaterThan(10);expect(extent(peak[4],'y')).toBeGreaterThan(10);
    expect(extent(rising[1],'y')).toBeGreaterThan(8);
    expect(peak[1].alpha).toBeGreaterThan(.5);expect(peak[4].alpha).toBeGreaterThan(.5);
  });

  it.each([[-10,1],[-10,2],[10,1],[10,2]])('preserves complete phone contours at %s degrees in renderer %s',(angle,renderer)=>{
    const f=fixture({width:320,height:568,density:1,renderer}),board=f.table.scoreBoard;
    const cx=board.x+board.width/2,cy=board.y+board.height/2,r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    f.root.setPosition(cx-(c*cx-s*cy),cy-(s*cx+c*cy)).setRotation(r);f.play();
    for(const delta of [600,400,400]){
      f.step(delta);const m=f.root.getWorldTransformMatrix(),paths=painted(f.ink()!),bodies=paths.filter(p=>p.color===0x7943c9);
      expect(bodies.length).toBeGreaterThanOrEqual(4);expect(paths.every(path=>path.points.length===35)).toBe(true);
      for(const path of paths){
        expect(path.points.every(p=>p.y>=board.y+2.5-1e-6&&p.y<=board.y+board.height-2.5+1e-6)).toBe(true);
        expect(within(path.points.map(p=>m.transformPoint(p.x,p.y)),{x:6.5,y:6.5,width:307,height:555})).toBe(true);
      }
    }
  });

  it('moves or omits whole flames at a tip guard without splitting unrelated contours',()=>{
    const f=fixture({width:320,height:568,density:1,renderer:2});f.play();f.step(600);
    const bodies=()=>painted(f.ink()!).filter(p=>p.color===0x7943c9),before=bodies();
    const tip=before[0].points.reduce((a,p)=>p.y<a.y?p:a),guard={x:tip.x-3,y:tip.y-3,width:6,height:6};
    const far=before[5];f.setGuards([guard]);f.step(0);const all=painted(f.ink()!),after=bodies();
    expect(after.length).toBeGreaterThanOrEqual(2);expect(all.every(path=>path.points.length===35)).toBe(true);
    expect(after.some(path=>JSON.stringify(path.points)===JSON.stringify(far.points))).toBe(true);
    for(const path of all)expect(separated(path.points,guard)).toBe(true);
    // The formerly troublesome, unrelated guard must not split any contour.
    f.setGuards([{x:15,y:115,width:8,height:12}]);f.step(0);
    expect(bodies()).toHaveLength(6);expect(painted(f.ink()!).every(path=>path.points.length===35)).toBe(true);
  });

  it.each([1,2])('keeps the five-card rack, five played faces and score ink clear, renderer %s',renderer=>{
    const f=fixture({width:390,height:844,density:1,renderer}),board=f.table.scoreBoard;
    // Bounds sampled from a real five-joker, five-card scoring presentation.
    const scoreInk:Box[]=[{x:111,y:232,width:15,height:26},{x:214,y:232,width:15,height:26},
      {x:135,y:176,width:120,height:16},{x:53,y:198,width:28,height:16},{x:156,y:198,width:28,height:16},
      {x:270,y:198,width:56,height:16},{x:45,y:229,width:43,height:31},{x:155,y:229,width:29,height:31},{x:268,y:231,width:61,height:30}];
    const rack=f.table.slots.map(b=>({...b})),played=Array.from({length:5},(_,i)=>({x:23+i*70,y:313,width:64,height:90}));
    const guards=[...scoreInk,...rack,...played,...Object.values(f.table.buttons),...Object.values(f.table.tableActions)];
    f.setGuards(guards);f.play();
    for(const delta of [200,200,200,400,400]){
      f.step(delta);const paths=painted(f.ink()!);expect(f.ink()?.getData('visibleSegments')).toBeGreaterThan(0);
      expect(paths.every(path=>path.points.length===35&&within(path.points,board))).toBe(true);
      for(const path of paths)for(const guard of guards)expect(separated(path.points,guard)).toBe(true);
    }
  });

  it.each([[320,568,1],[320,568,2],[390,844,1],[390,844,2]])(
    'protects long and moving numbers entirely inside the %sx%s score panel, renderer %s',(width,height,renderer)=>{
    const f=fixture({width,height,density:1,renderer}),board=f.table.scoreBoard;
    f.play();f.step(400);const ink=f.ink()!;
    expect(ink.getData('visibleSegments')).toBe(6);
    // These represent a number growing toward either edge. All of the bounds
    // remain inside the panel, so a board-interior exemption would fail here.
    const left:Box={x:board.x+3,y:board.y+20,width:75,height:board.height-24};
    const right:Box={x:board.x+board.width-78,y:board.y+20,width:75,height:board.height-24};
    const entire:Box={x:board.x+1,y:board.y+1,width:board.width-2,height:board.height-2};
    for(const guard of [left,right,entire,left]){
      f.setGuards([guard]);f.step(16);const paths=painted(ink),visible=ink.getData('visibleSegments');
      if(guard===entire)expect(visible).toBe(0);
      else {expect(visible).toBeGreaterThan(0);expect(visible).toBeLessThan(6);}
      expect(paths.every(path=>path.points.length===35&&within(path.points,board)&&separated(path.points,guard))).toBe(true);
    }
  });

  it.each([1,2])('clips current phone card, control, viewport and score bounds for renderer %s',renderer=>{
    const f=fixture({width:390,height:844,density:1,renderer}),board=f.table.scoreBoard;
    const card=f.card('played/card',{x:board.x+18,y:board.y-35,width:48,height:72});
    const control={x:board.x+board.width-35,y:board.y-36,width:55,height:45};
    f.opts.getGuards=()=>[card.getBounds(),control,...f.table.cards.filter(c=>c.visible).map(c=>c.visual),...Object.values(f.table.buttons),...Object.values(f.table.tableActions)];
    f.play();f.step(400);const ink=f.ink()!;
    for(const [shift,delta] of [[0,200],[17,400],[38,100]]){
      card.x+=shift;f.step(delta);const paths=painted(ink),bounds=card.getBounds();
      expect(ink.getData('visibleSegments')).toBeGreaterThan(0);
      for(const path of paths){
        expect(within(path.points,board)).toBe(true);
        expect(separated(path.points,bounds)).toBe(true);
        expect(separated(path.points,control)).toBe(true);
        expect(within(path.points,{x:0,y:0,width:390,height:844})).toBe(true);
      }
    }
  });

  it('clips in world space even when the root is translated, rotated, and scaled',()=>{
    const f=fixture(),board=f.table.scoreBoard;f.root.setPosition(30,20).setScale(.87).setRotation(.08);
    const matrix=f.root.getWorldTransformMatrix(),corner=matrix.transformPoint(board.x,board.y),guard={x:corner.x-12,y:corner.y-28,width:35,height:32};
    f.setGuards([guard]);f.play();f.step(500);const paths=painted(f.ink()!);
    expect(paths.length).toBeGreaterThan(0);
    for(const path of paths){
      const world=path.points.map(p=>matrix.transformPoint(p.x,p.y));
      expect(within(path.points,board)).toBe(true);expect(separated(world,guard)).toBe(true);
      expect(within(world,{x:0,y:0,width:1280,height:720})).toBe(true);
    }
  });

  it('fails closed when bounds or guard collection are unavailable and uses fresh guards on recovery',()=>{
    const f=fixture();f.play();f.step(350);const ink=f.ink()!;expect(painted(ink).length).toBeGreaterThan(0);
    f.setGuards(undefined);f.step(16);expect(ink.commandBuffer).toHaveLength(0);expect(ink.getData('visibleSegments')).toBe(0);
    f.setGuards([{x:NaN,y:0,width:1,height:1}]);f.step(16);expect(ink.commandBuffer).toHaveLength(0);
    f.setGuards(Array.from({length:257},()=>({x:0,y:0,width:1,height:1})));f.step(16);expect(ink.commandBuffer).toHaveLength(0);
    f.setGuards([]);f.setViewport(undefined);f.step(16);expect(ink.commandBuffer).toHaveLength(0);
    f.setViewport({x:0,y:0,width:1280,height:720});f.setBoard(undefined);f.step(16);expect(ink.commandBuffer).toHaveLength(0);
    f.setBoard(f.table.scoreBoard);f.step(16);expect(painted(ink).length).toBeGreaterThan(0);
  });

  it('does not create reduced-motion cues and disposes if the setting changes',()=>{
    const f=fixture();f.setReduced(true);f.play();expect(f.ink()).toBeUndefined();expect(f.scene.events.listenerCount('postupdate')).toBe(0);
    f.setReduced(false);f.play();f.step(400);expect(f.ink()).toBeTruthy();f.setReduced(true);f.step(16);expect(f.ink()).toBeUndefined();
  });

  it('starts audio only on first visible ink with the remaining time, and releases it once on abort',()=>{
    const f=fixture(),disposed=vi.fn(),visible=vi.fn(()=>f.signal.abort());
    f.opts.onVisibleOnce=visible;f.opts.onDispose=disposed;f.setGuards([{x:0,y:0,width:1280,height:720}]);
    const stop=f.play();f.step(400);expect(visible).not.toHaveBeenCalled();
    f.setGuards([]);f.step(16);expect(visible).toHaveBeenCalledExactlyOnceWith(1284);
    expect(disposed).toHaveBeenCalledOnce();expect(f.ink()).toBeUndefined();expect(f.scene.events.listenerCount('postupdate')).toBe(0);
    stop();expect(disposed).toHaveBeenCalledOnce();
  });

  it('does not start audio when a visual cue is rejected before mounting',()=>{
    const f=fixture(),visible=vi.fn(),disposed=vi.fn();f.opts.onVisibleOnce=visible;f.opts.onDispose=disposed;
    f.setReduced(true);f.play();f.step(400);expect(f.ink()).toBeUndefined();expect(visible).not.toHaveBeenCalled();expect(disposed).not.toHaveBeenCalled();
  });

  it.each([1,2,4] as const)('advances and cleans up at presentation speed %sx',speed=>{
    const f=fixture();f.opts.speed=()=>speed;f.play();
    f.step(400/speed);expect(f.ink()?.getData('elapsed')).toBe(400);
    f.step(1299/speed);expect(f.ink()).toBeTruthy();f.step(1/speed);
    expect(f.ink()).toBeUndefined();expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });

  it('uses the live presentation speed on each frame',()=>{
    const f=fixture();let speed:1|2|4=1;f.opts.speed=()=>speed;f.play();f.step(100);
    speed=4;f.step(100);expect(f.ink()?.getData('elapsed')).toBe(500);
    speed=2;f.step(100);expect(f.ink()?.getData('elapsed')).toBe(700);f.signal.abort();
  });

  it('aborts and allows the owner to replace a cue without stale listeners or clearing the replacement',()=>{
    const f=fixture(),dispose=f.play();f.step(400);const old=f.ink()!;dispose();dispose();expect(old.active).toBe(false);
    f.opts.eventId='saved/hand/event-5';const stop=f.play();f.step(16);const next=f.ink()!;expect(next.getData('eventId')).toBe('saved/hand/event-5');
    dispose();expect(f.ink()).toBe(next);f.signal.abort();expect(f.ink()).toBeUndefined();expect(f.scene.events.listenerCount('postupdate')).toBe(0);
    stop();const before=f.root.list.length;f.play();expect(f.root.list.length).toBe(before);
  });

  it.each(['shutdown','destroy','sleep','pause'] as const)('cleans the current cue on scene %s',event=>{
    const f=fixture();f.play();f.step(300);const ink=f.ink()!;f.scene.events.emit(event);
    expect(ink.active).toBe(false);expect(f.ink()).toBeUndefined();expect(f.scene.events.listenerCount('postupdate')).toBe(0);
    f.signal.abort();
  });

  it('cleans the cue when the root is destroyed or the owner switches presentation',()=>{
    const f=fixture();f.play();f.step(200);f.setCurrent(false);f.step(16);expect(f.ink()).toBeUndefined();
    f.setCurrent(true);f.play();f.step(16);const ink=f.ink()!;f.root.destroy();expect(ink.active).toBe(false);expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });

  it('cleans up immediately if the view clears or detaches the graphics while the root survives',()=>{
    const f=fixture();f.play();f.step(200);const first=f.ink()!;f.root.removeAll(true);
    expect(first.active).toBe(false);expect(f.scene.events.listenerCount('postupdate')).toBe(0);
    f.play();f.step(16);const second=f.ink()!;f.root.remove(second,false);f.step(16);
    expect(second.active).toBe(false);expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });

  it('removes a cue on tab hidden or window blur',()=>{
    const f=fixture(),win=new EventTarget(),doc=Object.assign(new EventTarget(),{hidden:false});
    vi.stubGlobal('window',win);vi.stubGlobal('document',doc);
    f.play();f.step(200);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));expect(f.ink()).toBeUndefined();
    doc.hidden=false;f.play();f.step(16);win.dispatchEvent(new Event('blur'));expect(f.ink()).toBeUndefined();
    expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });
});
