import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const session=vi.hoisted(()=>({reducedMotion:false,speed:1 as 1|2|4}));
vi.mock('../src/game/session',()=>({gameSession:()=>session}));
import {PAPER_TRANSITION,beginPaperTransition,paperTransitionAllowed,paperTransitionPlan} from '../src/game/PaperTransition';

type Listener=(event?:unknown)=>void;
function emitter(){
  const listeners=new Map<string,Set<Listener>>();
  return {listeners,
    addEventListener:(name:string,fn:Listener)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},
    removeEventListener:(name:string,fn:Listener)=>{listeners.get(name)?.delete(fn);},
    emit:(name:string)=>{for(const fn of [...(listeners.get(name)??[])])fn();},
    count:()=>[...listeners.values()].reduce((n,set)=>n+set.size,0)};
}
function element(animate=true){
  const node:any={style:{},dataset:{},children:[] as any[],attributes:{} as Record<string,string>,removed:false,animations:[] as any[]};
  node.setAttribute=(k:string,v:string)=>{node.attributes[k]=v;};node.append=(...items:any[])=>{node.children.push(...items);};node.remove=()=>{node.removed=true;};
  if(animate)node.animate=vi.fn((frames:unknown,options:unknown)=>{const a:any={frames,options,cancelled:false,cancel(){a.cancelled=true;a.oncancel?.();}};node.animations.push(a);return a;});
  return node;
}
function world({animate=true,reduce=false,hidden=false}={}){
  const win=emitter(),doc=emitter(),media=emitter(),created:any[]=[],body=element();
  vi.stubGlobal('window',{...win,matchMedia:()=>({matches:reduce,...media})});
  vi.stubGlobal('document',{...doc,hidden,body,createElement:()=>{const node=element(animate);created.push(node);return node;}});
  const game=emitter(),scene:any={game:{renderer:{type:2},events:{once:game.addEventListener,off:game.removeEventListener}}};
  return {win,doc,media,game,scene,created,body,layer:()=>body.children[0]};
}
beforeEach(()=>{session.reducedMotion=false;session.speed=1;vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('paper transitions',()=>{
  it('covers within 90ms and is gone within 360ms; faster presentation shortens it',()=>{
    expect(PAPER_TRANSITION.total).toBeLessThanOrEqual(PAPER_TRANSITION.limit);expect(PAPER_TRANSITION.limit).toBe(360);expect(PAPER_TRANSITION.cover+PAPER_TRANSITION.leave).toBe(PAPER_TRANSITION.total);
    for(const kind of ['unroll','roll','page','ink'] as const){
      const plan=paperTransitionPlan(kind);expect(plan.duration).toBe(PAPER_TRANSITION.total);
      expect(plan.sheet[0]).toMatchObject({offset:0,opacity:0});expect(plan.sheet.map(f=>f.offset)).toEqual([...plan.sheet.map(f=>f.offset)].sort((a,b)=>Number(a)-Number(b)));
      expect(paperTransitionPlan(kind,2).duration).toBe(175);expect(paperTransitionPlan(kind,4).duration).toBe(88);
    }
  });
  it('gives each cut its own physical motion',()=>{
    const unroll=paperTransitionPlan('unroll'),roll=paperTransitionPlan('roll'),page=paperTransitionPlan('page'),ink=paperTransitionPlan('ink');
    // The scroll opens to the right and closes back to the left; each has its rod on the moving edge.
    expect(String(unroll.sheet.at(-1)!.transform)).toContain('translateX(101%)');expect(unroll.rod).toBe('left');
    expect(String(roll.sheet.at(-1)!.transform)).toContain('translateX(-101%)');expect(roll.rod).toBe('right');
    expect(String(page.sheet.at(-1)!.transform)).toContain('rotateY');expect(page.origin).toBe('0 50%');expect(page.rod).toBe('none');
    // Ink never fully covers the page and leaves by fading, not by sliding.
    expect(ink.ink).toBe(true);expect(Math.max(...ink.sheet.map(f=>Number(f.opacity)))).toBeLessThan(1);expect(ink.sheet.at(-1)!.opacity).toBe(0);
    for(const plan of [unroll,roll,page])expect(plan.sheet[1]).toMatchObject({opacity:1});
  });
  it('keeps the plain cut for reduced motion, the Canvas renderer, a hidden tab and missing animation support',()=>{
    let w=world();session.reducedMotion=true;expect(paperTransitionAllowed(w.scene)).toBe(false);beginPaperTransition(w.scene,'page');expect(w.created).toHaveLength(0);
    session.reducedMotion=false;w=world({reduce:true});beginPaperTransition(w.scene,'page');expect(w.created).toHaveLength(0);
    w=world();w.scene.game.renderer.type=1;beginPaperTransition(w.scene,'unroll');expect(w.created).toHaveLength(0);
    w=world({hidden:true});beginPaperTransition(w.scene,'roll');expect(w.created).toHaveLength(0);
    w=world({animate:false});beginPaperTransition(w.scene,'ink');expect(w.body.children).toHaveLength(0);expect(w.win.count()).toBe(0);
    vi.unstubAllGlobals();expect(()=>beginPaperTransition({game:{renderer:{type:2}}} as any,'page')()).not.toThrow();
  });
  it('lays one inert layer over the page and removes every listener when the sheet has left',()=>{
    const w=world();beginPaperTransition(w.scene,'unroll');const layer=w.layer(),sheet=layer.children[0],animation=sheet.animations[0];
    expect(layer.style).toMatchObject({position:'fixed',pointerEvents:'none',zIndex:'1000'});expect(layer.attributes['aria-hidden']).toBe('true');expect(layer.dataset.paperTransition).toBe('unroll');
    expect(animation.options).toMatchObject({duration:PAPER_TRANSITION.total});expect(sheet.children).toHaveLength(1);
    expect(w.win.count()).toBeGreaterThan(0);
    animation.onfinish();expect(layer.removed).toBe(true);expect(w.win.count()+w.doc.count()+w.media.count()+w.game.count()).toBe(0);
    vi.advanceTimersByTime(2000);expect(layer.removed).toBe(true);
  });
  it.each(['pointerdown','keydown','blur','resize','pagehide','tangsongpai-presentation'])('yields at once to %s',name=>{
    const w=world();beginPaperTransition(w.scene,'page');const layer=w.layer();
    w.win.emit(name);expect(layer.removed).toBe(true);expect(layer.children[0].animations[0].cancelled).toBe(true);expect(w.win.count()+w.doc.count()).toBe(0);
  });
  it('is removed by a hidden tab, a motion preference change, game teardown and the hard stop',()=>{
    let w=world();beginPaperTransition(w.scene,'roll');(document as any).hidden=true;w.doc.emit('visibilitychange');expect(w.layer().removed).toBe(true);
    w=world();beginPaperTransition(w.scene,'roll');w.media.emit('change');expect(w.layer().removed).toBe(true);
    w=world();beginPaperTransition(w.scene,'roll');w.game.emit('destroy');expect(w.layer().removed).toBe(true);
    w=world();beginPaperTransition(w.scene,'ink');vi.advanceTimersByTime(PAPER_TRANSITION.hardStop-1);expect(w.layer().removed).toBe(false);vi.advanceTimersByTime(1);expect(w.layer().removed).toBe(true);
  });
  it('keeps a single layer when cuts follow each other, and follows the presentation speed',()=>{
    const w=world();session.speed=4;const first=beginPaperTransition(w.scene,'unroll'),a=w.layer();
    beginPaperTransition(w.scene,'page');expect(a.removed).toBe(true);expect(w.body.children).toHaveLength(2);const b=w.body.children[1];expect(b.removed).toBe(false);
    expect(b.children[0].animations[0].options.duration).toBe(88);
    first();expect(b.removed).toBe(false);
  });
});
