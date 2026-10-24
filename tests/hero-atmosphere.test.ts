import {it,expect} from 'vitest';
import type Phaser from 'phaser';
import {heroAtmosphereStyle,drawHeroAtmosphere,HERO_ATMOSPHERE_BUDGET} from '../src/game/HeroCardAttachmentAtmosphere';
import {heroAttachmentIntensityFixture} from '../harness/fixtures/hero-attachment-intensity';
import {energySend} from '../harness/fixtures/score-energy';
import {savedHeroAttachment} from '../src/game/HeroAttachmentFacts';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';

it.each(['amo','erxiang','azao','xiemu','touye','laohuan'] as const)('%s uses the actual current affected-card contract',hero=>{
 const f=heroAttachmentIntensityFixture(hero);expect(readCheckpoint(makeCheckpoint(f.state,[])).ok).toBe(true);const after=energySend(f.state,f.action);
 if(hero==='laohuan'){expect(after.handOrder.filter(id=>!f.state.handOrder.includes(id))).toEqual(f.targetIds);expect(after.lastTrace).toEqual(f.state.lastTrace);return;}
 const cue=savedHeroAttachment(after.lastTrace!,hero)!;expect(cue).toBeDefined();if(hero==='amo'){expect(cue.event.reasonKey).toBe('amo.exile');expect(after.lastTrace!.assist).toBeUndefined();expect(after.lastTrace!.amoExile!.discardedIds).toHaveLength(6);expect(cue.targetIds).toEqual(after.lastTrace!.amoExile!.discardedIds);expect(cue.targetIds!.some(id=>after.lastTrace!.sets.playedIds.includes(id))).toBe(false);}
 if(hero==='touye')expect(cue.targetIds).toEqual(['clubs-8']);else if(hero!=='amo')expect(cue.targetIds).toEqual(f.targetIds);
});
it('six actual hero effects have distinct identities and legacy assist remains explicitly legacy',()=>{
 const reasons=['amo.exile','erxiang.handoff','azao.multiply-multiplier','xiemu.multiply-multiplier','touye.','laohuan.refill'];const profiles=reasons.map(releaseReason=>heroAtmosphereStyle({key:'k',targetId:'a',releaseReason}));expect(new Set(profiles.map(p=>p.key)).size).toBe(6);expect(new Set(profiles.map(p=>p.shape)).size).toBe(6);expect(heroAtmosphereStyle({key:'old',targetId:'a',releaseReason:'amo.assist.'}).key).toBe('legacy-assist');
});
it('keeps an analytic mobile budget and reduced motion draws static markers without particles or flowing paths',()=>{
 const fake=new Proxy({},{get:()=>()=>fake}) as unknown as Phaser.GameObjects.Graphics,targets=Array.from({length:9},(_,i)=>({x:i*90,y:100,width:70,height:100})),style=heroAtmosphereStyle({key:'k',targetId:'a',releaseReason:'amo.exile'});
 const full=drawHeroAtmosphere(fake,{style,clock:650,targets,protectedBoxes:[],full:true,alpha:1,costs:targets});expect(full.targets).toBe(5);expect(full.particles+full.costParticles).toBeLessThanOrEqual(HERO_ATMOSPHERE_BUDGET.particles);expect(full.segments).toBeLessThanOrEqual(720);
 const reduced=drawHeroAtmosphere(fake,{style,clock:650,targets,protectedBoxes:[],full:false,alpha:1});expect(reduced).toMatchObject({particles:0,segments:0,markers:20,targets:5,full:false});
});
