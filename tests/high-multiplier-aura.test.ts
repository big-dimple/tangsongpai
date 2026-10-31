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
    expect(peakBuffer).not.toEqual(earlyBuffer);expect(peak.map(p=>p.color)).toContain(0x6c3bd0);
    expect(peak.map(p=>p.color)).toContain(0xa273ec);expect(peak.map(p=>p.color)).toContain(0xf5e7ff);
    expect(new Set(peak.filter(p=>p.color===0xa273ec).map(p=>p.alpha.toFixed(3))).size).toBeGreaterThan(3);
    expect(peak.some(p=>p.points.length>20)).toBe(true);expect(early.every(p=>p.alpha>=0&&p.alpha<=1)).toBe(true);
    f.step(1000);const fading=painted(ink);expect(Math.max(...fading.map(p=>p.alpha))).toBeLessThan(Math.max(...peak.map(p=>p.alpha)));
    expect(f.ink()).toBe(ink);f.step(299);expect(f.ink()).toBe(ink);f.step(1);
    expect(f.ink()).toBeUndefined();expect(ink.active).toBe(false);expect(random).not.toHaveBeenCalled();
    expect(f.scene.events.listenerCount('postupdate')).toBe(0);
  });

  it('changes the actual tips independently between 600ms and 1000ms, beyond opacity or common movement',()=>{
    const f=fixture(),board={x:300,y:300,width:250,height:100};f.setBoard(board);f.play();
    const narrowTip=(paths:Painted[],left:number,right:number)=>{
      const candidates=paths.filter(path=>{
        if(path.color!==0xa273ec)return false;
        const xs=path.points.map(p=>p.x),min=Math.min(...xs),max=Math.max(...xs);
        return max-min<16&&(min+max)/2>board.x+left&&(min+max)/2<board.x+right;
      });
      expect(candidates).toHaveLength(1);return candidates[0].points;
    };
    f.step(600);const before=painted(f.ink()!),leftBefore=narrowTip(before,40,60),rightBefore=narrowTip(before,172,195);
    f.step(400);const after=painted(f.ink()!),leftAfter=narrowTip(after,40,60),rightAfter=narrowTip(after,172,195);
    const tipChange=(a:Point[],b:Point[])=>{
      expect(b.length).toBe(a.length);
      const top=a.reduce((best,p,i)=>p.y<a[best].y?i:best,0),base=a.reduce((best,p,i)=>p.y>a[best].y?i:best,0);
      return {x:(b[top].x-b[base].x)-(a[top].x-a[base].x),y:(b[top].y-b[base].y)-(a[top].y-a[base].y)};
    };
    const left=tipChange(leftBefore,leftAfter),right=tipChange(rightBefore,rightAfter);
    // The tips bend in opposite directions relative to their own bases; this
    // cannot pass from an alpha change, whole-contour shift, or shared sway.
    expect(left.x).toBeLessThan(-1);expect(right.x).toBeGreaterThan(1);
    expect(Math.abs(left.y)+Math.abs(right.y)).toBeGreaterThan(.5);
  });

  it.each([
    [390,844,1],[390,844,2],[360,800,1],[360,800,2],[320,568,1],[320,568,2]
  ])('keeps all flame contours whole and moving on a %sx%s phone in renderer %s',(width,height,renderer)=>{
    const f=fixture({width,height,density:1,renderer}),board=f.table.scoreBoard;
    f.play();
    // Sample counts describe the ten complete source silhouettes, including
    // their curved tips. A viewport or drawing-region cut adds/removes vertices
    // even though all resulting pixels would still lie inside the screen.
    const complete=[45,26,50,38,14,14,32,50,33,26];
    const sample=(delta:number)=>{
      f.step(delta);const paths=painted(f.ink()!),bodies=paths.filter(path=>path.color===0x7952d7);
      expect(bodies.map(path=>path.points.length)).toEqual(complete);
      expect(paths.filter(path=>path.color===0xf5e7ff)).toHaveLength(6);
      for(const path of paths){
        expect(within(path.points,{x:6.5,y:6.5,width:width-13,height:height-13})).toBe(true);
        expect(path.points.every(p=>p.y<=board.y-2.5+1e-6)).toBe(true);
      }
      for(const index of [0,8]){
        const xs=bodies[index].points.map(p=>p.x),ys=bodies[index].points.map(p=>p.y);
        expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(7);
        expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(12);
      }
      return bodies;
    };
    sample(250);sample(150);const before=sample(200);
    const extent=(path:Painted,axis:'x'|'y')=>Math.max(...path.points.map(p=>p[axis]))-Math.min(...path.points.map(p=>p[axis]));
    // The phone arrangement keeps the original curved contours but avoids
    // two long horizontal bars and a pair of equal-height corner flames.
    expect(extent(before[3],'x')).toBeLessThan(32);expect(extent(before[6],'x')).toBeLessThan(32);
    expect(extent(before[2],'y')).toBeGreaterThan(extent(before[7],'y')*1.15);
    expect(before[2].alpha).toBeGreaterThan(.6);expect(before[7].alpha).toBeGreaterThan(.6);
    expect(painted(f.ink()!).filter(path=>path.color===0xf5e7ff).every(path=>path.alpha>.7)).toBe(true);
    const after=sample(400);sample(400);sample(150);
    const tipChange=(index:number)=>{
      const a=before[index].points,b=after[index].points;
      const tip=a.reduce((best,p,i)=>p.y<a[best].y?i:best,0),base=a.reduce((best,p,i)=>p.y>a[best].y?i:best,0);
      return {x:(b[tip].x-b[base].x)-(a[tip].x-a[base].x),y:(b[tip].y-b[base].y)-(a[tip].y-a[base].y)};
    };
    const left=tipChange(0),right=tipChange(8);
    expect(Math.hypot(left.x,left.y)).toBeGreaterThan(1);expect(Math.hypot(right.x,right.y)).toBeGreaterThan(1);
    expect(Math.hypot(left.x-right.x,left.y-right.y)).toBeGreaterThan(1);
  });

  it.each([[-10,1],[-10,2],[10,1],[10,2]])('preserves complete phone contours at %s degrees in renderer %s',(angle,renderer)=>{
    const f=fixture({width:320,height:568,density:1,renderer}),board=f.table.scoreBoard;
    const cx=board.x+board.width/2,cy=board.y+board.height/2,r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    f.root.setPosition(cx-(c*cx-s*cy),cy-(s*cx+c*cy)).setRotation(r);
    f.play();
    for(const delta of [600,400,400]){
      f.step(delta);const m=f.root.getWorldTransformMatrix(),paths=painted(f.ink()!),bodies=paths.filter(p=>p.color===0x7952d7);
      const remaining=[45,26,50,38,14,14,32,50,33,26];
      expect(bodies.length).toBeGreaterThanOrEqual(6);
      for(const body of bodies){const i=remaining.indexOf(body.points.length);expect(i).toBeGreaterThanOrEqual(0);remaining.splice(i,1);}
      for(const path of paths){
        expect(path.points.every(p=>p.y<=board.y-2.5+1e-6)).toBe(true);
        expect(within(path.points.map(p=>m.transformPoint(p.x,p.y)),{x:6.5,y:6.5,width:307,height:555})).toBe(true);
      }
    }
  });

  it('moves or omits whole flames at a tip guard without splitting unrelated contours',()=>{
    const f=fixture({width:320,height:568,density:1,renderer:2}),guard={x:15,y:115,width:8,height:12};
    f.play();f.step(600);
    const bodies=()=>painted(f.ink()!).filter(p=>p.color===0x7952d7),before=bodies();
    const far=before.find(path=>path.points.every(p=>p.x>80&&p.x<110));expect(far).toBeDefined();
    f.setGuards([guard]);f.step(0);const all=painted(f.ink()!),after=bodies();
    const remaining=[45,26,50,38,14,14,32,50,33,26];
    expect(after.length).toBeGreaterThanOrEqual(6);
    for(const body of after){const i=remaining.indexOf(body.points.length);expect(i).toBeGreaterThanOrEqual(0);remaining.splice(i,1);}
    expect(after.some(path=>JSON.stringify(path.points)===JSON.stringify(far!.points))).toBe(true);
    for(const path of all)expect(separated(path.points,guard)).toBe(true);
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
        expect(separated(path.points,board)).toBe(true);
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
      expect(separated(path.points,board)).toBe(true);expect(separated(world,guard)).toBe(true);
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
