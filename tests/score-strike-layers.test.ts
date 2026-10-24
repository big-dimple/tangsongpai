import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
import {drawStrikeContact,drawStrikeWake,strikeArtGlow} from '../src/game/ScoreStrikeLayers';
import {jokerScoreStrikeCue,prepareJokerScoreStrike} from '../src/game/JokerScoreStrike';
import {scorePhrase} from '../src/game/ScorePhrase';
import {scoreSourceProcessFixture} from '../harness/fixtures/score-source-process';
import {energySend} from '../harness/fixtures/score-energy';

afterEach(()=>vi.unstubAllGlobals());
it.each([{width:1180,height:844,portrait:false},{width:390,height:844,portrait:true},{width:320,height:568,portrait:true}])('native contact layers stay in their score cell and the source wake points toward it at $width px',spec=>{
 const f=nativeHeroRuntime({...spec,density:1,renderer:spec.portrait?1:2}),g=f.scene.add.graphics() as Phaser.GameObjects.Graphics,cell={x:spec.width*.5,y:100,width:spec.portrait?82:130,height:54},hit={x:cell.x+cell.width/2,y:127},from={x:spec.width*.3,y:400};
 const ellipses=vi.spyOn(g,'strokeEllipse'),lines=vi.spyOn(g,'lineBetween'),chips=vi.spyOn(g,'fillTriangle');
 for(let elapsed=0;elapsed<=280;elapsed+=7){g.clear();drawStrikeContact(g,hit,from,cell,elapsed,40,240,.26,0x247b93,true,spec.portrait,1);}
 expect(ellipses.mock.calls.length).toBeGreaterThan(0);expect(chips.mock.calls.length).toBeGreaterThan(0);
 for(const [x,y,width,height]of ellipses.mock.calls){expect(x-width/2).toBeGreaterThanOrEqual(cell.x);expect(x+width/2).toBeLessThanOrEqual(cell.x+cell.width);expect(y-height/2).toBeGreaterThanOrEqual(cell.y);expect(y+height/2).toBeLessThanOrEqual(cell.y+cell.height);}
 for(const points of [...lines.mock.calls,...chips.mock.calls])for(let i=0;i<points.length;i+=2){expect(points[i]).toBeGreaterThanOrEqual(cell.x);expect(points[i]).toBeLessThanOrEqual(cell.x+cell.width);expect(points[i+1]).toBeGreaterThanOrEqual(cell.y);expect(points[i+1]).toBeLessThanOrEqual(cell.y+cell.height);}
 lines.mockClear();g.clear();drawStrikeWake(g,from,hit,.7,9,0x247b93,spec.portrait,1);expect(g.commandBuffer.length).toBeGreaterThan(0);
 const dx=hit.x-from.x,dy=hit.y-from.y,length=dx*dx+dy*dy;for(const [x,y,x1,y1]of lines.mock.calls){const a=((x-from.x)*dx+(y-from.y)*dy)/length,b=((x1-from.x)*dx+(y1-from.y)*dy)/length;expect(a).toBeGreaterThanOrEqual(0);expect(b).toBeGreaterThanOrEqual(a);expect(b).toBeLessThan(1);}
 g.clear();drawStrikeContact(g,hit,from,cell,280,40,240,.26,0x247b93,true,spec.portrait,1);expect(g.commandBuffer).toHaveLength(0);f.root.destroy();g.destroy();
});

it('Phaser glow is local to one desktop copy and skipped on mobile/Canvas or missing FX support',()=>{
 const glow={active:true},fx={setPadding:vi.fn(),addGlow:vi.fn(()=>glow)},image={preFX:fx} as unknown as Phaser.GameObjects.Image,desktop={game:{renderer:{type:2}},sys:{renderer:{pipelines:{FX_PIPELINE:{}}}}} as unknown as Phaser.Scene;
 expect(strikeArtGlow(desktop,image,0x247b93,false)).toBe(glow);expect(fx.addGlow).toHaveBeenCalledOnce();expect(strikeArtGlow(desktop,image,0x247b93,true)).toBeUndefined();
 expect(strikeArtGlow({game:{renderer:{type:1}}} as Phaser.Scene,image,0x247b93,false)).toBeUndefined();expect(strikeArtGlow({game:{renderer:{type:2}},sys:{renderer:null}} as unknown as Phaser.Scene,image,0x247b93,false)).toBeUndefined();expect(fx.addGlow).toHaveBeenCalledOnce();
});

it.each([1180,390])('saved joker strike at %s px uses one native layer clock, reduces live and leaves no late decoration after abort',async width=>{
 const saved=scoreSourceProcessFixture('chain'),trace=energySend(saved.state,{type:'PlayHand',selectedIds:saved.selectedIds}).lastTrace!,event=trace.events.find(e=>jokerScoreStrikeCue(trace,e)?.contributions.some(c=>c.kind==='multiply'))!,cue=jokerScoreStrikeCue(trace,event)!;
 const f=nativeHeroRuntime({width,height:844,density:1,renderer:width<600?1:2}),abort=new AbortController(),beat=scorePhrase(trace.events,'100',4,trace).get(event.eventId)!,marker=f.scene.add.container(width*.25,70).setData('frame',{width:64,height:90});marker.add(f.scene.add.image(0,0,'joker-art').setDisplaySize(64,90));f.root.add(marker);f.scene.textures.createCanvas=()=>undefined;
 const cells={H:{x:width*.1,y:150,width:width*.3,height:50},M:{x:width*.55,y:150,width:width*.3,height:50}},readout=(key:'H'|'M')=>{const b=cells[key],text=f.scene.add.text(b.x+b.width/2-8,b.y+16,'35');text.alpha=1;text.canvas={width:50,height:20};text.setAlpha=(a:number)=>{text.alpha=a;return text;};f.root.add(text);return text;},H=readout('H'),M=readout('M');
 const ticks:{config:Phaser.Types.Tweens.TweenBuilderConfig;finish:()=>void}[]=[];let enabled=true;const rebound=vi.fn();
 const animate=(config:Phaser.Types.Tweens.TweenBuilderConfig,context:{signal:AbortSignal})=>new Promise<void>(finish=>{ticks.push({config,finish});context.signal.addEventListener('abort',()=>finish(),{once:true});});
 const strike=prepareJokerScoreStrike(f.scene,f.root,marker,cue,{context:{generation:7,signal:abort.signal},beat,textureKey:'joker-art',artBounds:{x:-32,y:-45,width:64,height:90},portrait:width<600,liftRoom:18,targets:{H,M},cells,animate,effects:()=>enabled,onRebound:rebound,refresh:()=>{for(const text of [H,M])text.setScale(Number(text.getData('scorePulseScale')??1));}})!;
 const tick=(i:number,t:number)=>{const c=ticks[i].config;(c.targets as {t:number}).t=t;(c.onUpdate as ()=>void)();},finish=async(i:number)=>{tick(i,1);ticks[i].finish();await Promise.resolve();};
 await finish(0);await strike.windup;const flight=strike.fly(),group=f.root.getByName('score/strike') as Phaser.GameObjects.Container,wake=group.getByName('score/strike-wake') as Phaser.GameObjects.Graphics,contact=group.getByName('score/strike-hit') as Phaser.GameObjects.Graphics;
 tick(1,.7);expect(wake.commandBuffer.length).toBeGreaterThan(0);expect(group.getByName('score/strike-card')).toBeDefined();const copies=(group.getByName('score/image-afterimages') as Phaser.GameObjects.Container).list as Phaser.GameObjects.Image[];expect(copies.length).toBeGreaterThan(0);expect(copies.every(c=>c.texture.key==='joker-art')).toBe(true);enabled=false;wake.clear();const empty=[...wake.commandBuffer];tick(1,.8);expect(wake.commandBuffer).toEqual(empty);expect(copies.every(c=>c.alpha===0)).toBe(true);
 await finish(1);await flight;enabled=true;const landing=strike.land();expect(group.getByName('score/image-afterimages')).toBeNull();expect(contact.commandBuffer.length).toBeGreaterThan(0);expect(M.alpha).toBe(0);tick(2,.6);expect(M.alpha).toBe(1);expect(M.scaleX).toBeGreaterThan(1);expect(rebound).toHaveBeenCalledOnce();expect(group.getByName('score/image-afterimages')).toBeNull();
 enabled=false;contact.clear();const quiet=[...contact.commandBuffer];tick(2,.7);expect(contact.commandBuffer).toEqual(quiet);abort.abort();await landing;const count=rebound.mock.calls.length;tick(2,1);expect(rebound).toHaveBeenCalledTimes(count);expect(group.active).toBe(false);expect(f.root.getByName('score/strike')).toBeNull();expect([marker.x,marker.y,M.alpha,M.scaleX]).toEqual([width*.25,70,1,1]);f.root.destroy();f.step(100,16);expect(f.scene.sys.updateList.getActive()).toHaveLength(0);
});
