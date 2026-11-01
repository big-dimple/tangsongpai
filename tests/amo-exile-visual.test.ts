import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
vi.mock('../src/game/session',()=>({gameSession:()=>({speed:1})}));
import {GameScene} from '../src/game/GameScene';
import {currentHeroReceipt} from './fixtures/current-hero-receipt';
import {scoreBeat} from '../src/game/scorePresentation';
import {heroPayoffs} from '../src/game/HeroPayoff';
import {amoExileChoice} from '../src/domain/r2AmoExile';

it('skill confirmation immediately prepares the real remainder; cancel and changed K eligibility clear it without changing the run',async()=>{
 const r=await currentHeroReceipt('amo'),run=structuredClone(r.before),before=structuredClone(run),preview=vi.fn(),prepare=vi.fn(),hint=vi.fn(),scene=Object.create(GameScene.prototype) as any;
 Object.assign(scene,{showSkillStage:vi.fn(async()=>{}),run,selectedIds:new Set(run.handOrder.slice(0,2)),amoExile:true,cardViews:[],targetAttachment:{preview,previewSushiKings:prepare},hintHeroCardBodies:hint});
 const choice=amoExileChoice(run,[...scene.selectedIds]);expect(choice.available).toBe(true);scene.syncHeroTargetAttachment();expect(prepare).toHaveBeenLastCalledWith(choice.discardedIds,3);expect(preview).not.toHaveBeenCalled();expect(hint).not.toHaveBeenCalled();
 scene.amoExile=false;scene.syncHeroTargetAttachment();expect(preview).toHaveBeenLastCalledWith(undefined);expect(hint).toHaveBeenLastCalledWith([],undefined);
 scene.amoExile=true;scene.selectedIds.add('spades-13');scene.syncHeroTargetAttachment();expect(prepare).toHaveBeenLastCalledWith(amoExileChoice(run,[...scene.selectedIds]).discardedIds,3);expect(prepare.mock.lastCall![0]).not.toContain('spades-13');
 scene.selectedIds=new Set(['spades-13','hearts-13']);scene.syncHeroTargetAttachment();expect(amoExileChoice(run,[...scene.selectedIds]).available).toBe(false);
 expect(prepare).toHaveBeenCalledTimes(2);expect(preview.mock.calls).toEqual([[undefined],[undefined]]);expect(run).toEqual(before);
});
function text(){const data=new Map<string,unknown>(),node:any={active:true,width:0,text:'',setText(value:string){node.text=value;return node;},setData(key:string,value:unknown){data.set(key,value);return node;},getData(key:string){return data.get(key);}};for(const key of ['setName','setVisible','setColor','setFontSize','setWordWrapWidth','setScale','setPosition','setOrigin'])node[key]=()=>node;return node;}
it.each([false,true])('saved exile retains exact multiplier copy in reduced/fallback rendering without portrait glow or key decoration (reduced=%s)',async reduced=>{
 const r=await currentHeroReceipt('amo'),event=r.trace.events.find(e=>e.reasonKey==='amo.exile')!,scene=Object.create(GameScene.prototype) as any,before=structuredClone(r.saved.state);
 Object.defineProperty(scene,'reducedMotion',{value:reduced});Object.assign(scene,{showSkillStage:vi.fn(async()=>{}),run:r.after,presentation:{state:r.after,score:r.trace,replay:false,gifts:[]},view:{layout:{mode:'portrait',status:{width:1000},scoreBoard:{x:0,y:0,width:366,height:132},hand:{y:500,height:100}}},scoreLabels:[text(),text(),text()],statusText:text(),resultText:text(),breakdownText:text(),scoreTotal:text(),scoreMult:text(),scoreHeat:text(),settledCards:new Map(),cardViews:[],jokerViews:new Map(),shownPayoffs:new Set(),audio:{scoreImpact:vi.fn(),sourceCue:vi.fn()},targetAttachment:{release:vi.fn(),impactSavedTargets:vi.fn()},heroPortraitMotion:{play:vi.fn()},ensureTraceSource:vi.fn(),animateRole:vi.fn(),bindHeroScorePose:vi.fn(),showKeyHighlight:vi.fn(),consumeScorePerformance:vi.fn(),setAccumulator:vi.fn(),wait:vi.fn(async()=>{}),transferToAccumulator:vi.fn(async()=>{}),rollAccumulator:vi.fn(async()=>{}),pulseAccumulator:vi.fn(async()=>{}),impactAccumulator:vi.fn(async()=>{})});
 await scene.showScoreEvent(event,0,scoreBeat(event),{generation:1,signal:new AbortController().signal},heroPayoffs(r.after,r.trace)[0]);
 expect(scene.bindHeroScorePose).not.toHaveBeenCalled();expect(scene.animateRole).not.toHaveBeenCalled();expect(scene.heroPortraitMotion.play).not.toHaveBeenCalled();expect(scene.showKeyHighlight).not.toHaveBeenCalled();
 if(reduced)expect(scene.targetAttachment.impactSavedTargets).not.toHaveBeenCalled();else expect(scene.targetAttachment.impactSavedTargets).toHaveBeenCalledWith(r.trace.sets.activeScoringIds,expect.anything());
 expect(scene.resultText.text).toContain('×'+event.value.n);expect(scene.resultText.getData('exactMultiplierCaption').text).toContain('实际 ×'+event.value.n);expect(scene.statusText.text).toContain(r.trace.amoExile!.beforeScore+' → '+r.trace.amoExile!.afterScore+'（×'+event.value.n+'）');expect(scene.setAccumulator).toHaveBeenLastCalledWith(event.after);expect(r.restore().state).toEqual(before);
});
