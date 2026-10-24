import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {playSushiDiscardExit} from '../src/game/SushiDiscardExit';

afterEach(()=>vi.unstubAllGlobals());
async function fixture(reduced=false){
 const saved=await currentHeroReceipt('amo'),trace=saved.trace,f=nativeHeroRuntime(),abort=new AbortController();
 const faces=trace.cards.map((card,i)=>{const container=f.card(card.id,{x:100+i*70,y:500,width:64,height:90});return{id:card.id,container,remove:vi.fn(()=>container.destroy())};}),costs=faces.filter(c=>trace.amoExile!.discardedIds.includes(c.id)),main=faces.filter(c=>trace.sets.playedIds.includes(c.id)),configs:Phaser.Types.Tweens.TweenBuilderConfig[]=[],finishes:(()=>void)[]=[];
 let arrive!:()=>void;const arrival=new Promise<void>(resolve=>arrive=resolve),animate=vi.fn((config:Phaser.Types.Tweens.TweenBuilderConfig,context:{signal:AbortSignal})=>new Promise<void>(resolve=>{configs.push(config);finishes.push(resolve);context.signal.addEventListener('abort',()=>resolve(),{once:true});})),context={generation:2,signal:abort.signal},promise=playSushiDiscardExit(trace,saved.eventId,faces,context,arrival,600,reduced,animate);
 return{...f,saved,trace,faces,costs,main,animate,abort,context,promise,arrive,configs,finish:()=>finishes.forEach(resolve=>resolve())};
}
it.each([false,true])('real saved costs wait for event arrival, then use normal discard; main faces stay intact (reduced=%s)',async reduced=>{
 const f=await fixture(reduced),before=structuredClone(f.saved.saved.state);
 try{
  for(let i=0;i<120;i++)f.step(i*16,16);expect(f.animate).not.toHaveBeenCalled();expect(f.faces.every(c=>c.container.active&&c.container.alpha===1)).toBe(true);
  f.arrive();await Promise.resolve();await Promise.resolve();expect(f.configs).toHaveLength(f.costs.length);
  expect(f.configs.map(c=>c.targets)).toEqual(f.costs.map(c=>c.container));expect(f.configs.every(c=>c.y===790&&c.angle===-26&&c.alpha===0&&c.ease==='Cubic.easeIn'&&c.duration===(reduced?20:210)&&!c.onUpdate)).toBe(true);
  expect(f.configs.map(c=>c.delay)).toEqual(f.costs.map((_,i)=>reduced?0:i*38));expect(f.costs.every(c=>c.container.active)).toBe(true);
  f.finish();await f.promise;expect(f.costs.every(c=>!c.container.active&&c.remove.mock.calls.length===1)).toBe(true);expect(f.main.every(c=>c.container.active&&c.container.alpha===1&&c.remove.mock.calls.length===0)).toBe(true);
  expect(f.saved.restore().state).toEqual(before);expect(f.emitters).toHaveLength(0);
 }finally{f.abort.abort();f.root.destroy();}
});
it.each(['before-arrival','discard'] as const)('cancel during %s settles and removes only committed costs; late arrival cannot animate again',async phase=>{
 const f=await fixture();try{
  if(phase==='discard'){f.arrive();await Promise.resolve();await Promise.resolve();}
  f.abort.abort();await f.promise;const calls=f.animate.mock.calls.length;f.arrive();await Promise.resolve();expect(f.animate).toHaveBeenCalledTimes(calls);
  expect(f.costs.every(c=>!c.container.active&&c.remove.mock.calls.length===1)).toBe(true);expect(f.main.every(c=>c.container.active&&c.container.alpha===1)).toBe(true);expect(f.saved.restore().state).toEqual(f.saved.saved.state);
 }finally{f.abort.abort();f.root.destroy();}
});
it('an unrecorded event or an already destroyed cost cannot move unrelated faces',async()=>{
 const f=await fixture();try{
  await playSushiDiscardExit(f.trace,'unrecorded',f.faces,f.context,Promise.resolve(),600,false,f.animate);expect(f.animate).not.toHaveBeenCalled();expect(f.faces.every(c=>c.container.active)).toBe(true);
  f.costs[0].container.destroy();f.arrive();await Promise.resolve();await Promise.resolve();expect(f.configs).toHaveLength(f.costs.length-1);f.finish();await f.promise;expect(f.main.every(c=>c.container.active)).toBe(true);
 }finally{f.abort.abort();f.root.destroy();}
});
