import {expect,it,vi} from 'vitest';
import {advanceEntryParticleField,createEntryParticleField,deriveEntryProjection,entryParticleVisible,paintEntryParticleBrush,spawnEntryParticle,ENTRY_PARTICLE_BUDGET,ENTRY_HERO_TINTS} from '../src/game/EntryDepthParticles';
it('retains the fixed-source projection and bounded spawn variance',()=>{
 expect(deriveEntryProjection(.25)).toEqual({fov:650,perspectiveDistance:275,depthRange:100});expect(deriveEntryProjection(-2)).toEqual(deriveEntryProjection(0));expect(deriveEntryProjection(9)).toEqual(deriveEntryProjection(1));
 const p=spawnEntryParticle(100,200,5,.3,()=>.5);expect(p).toMatchObject({angle:Math.PI,radius:120,y:0,size:5,angularSpeed:.002,opacity:.3});
 expect(new Set(Object.values(ENTRY_HERO_TINTS)).size).toBe(6);
});
it.each([390,767,768,1366])('caps the %ipx field in CSS space, with ordered side/hero bands and sparse identity color',width=>{
 const anchor={x:80,y:120,width:160,height:240},field=createEntryParticleField(width,844,width,anchor,0xb8473a,()=>.5);expect(field.particles).toHaveLength(width<768?32:64);expect(field.particles.filter(p=>p.color===0xb8473a).length).toBeLessThan(field.particles.length/3);expect(new Set(field.particles.map(p=>p.color))).toEqual(new Set([0xc19a52,0x4b9c9f,0xb8473a]));expect(field.particles.every(p=>p.cx===width*.12||p.cx===width*.88||p.cx===72||p.cx===248)).toBe(true);expect(field.particles.filter(p=>p.bright).length).toBeLessThanOrEqual(6);expect(ENTRY_PARTICLE_BUDGET.maxDpr).toBe(2);
});
it('moves at the same rate on 60Hz and 120Hz displays, while a long interruption cannot produce an unbounded jump',()=>{
 const a=createEntryParticleField(390,844,390,undefined,undefined,()=>.5),b=structuredClone(a);for(let i=0;i<60;i++)advanceEntryParticleField(a,1000/60);for(let i=0;i<120;i++)advanceEntryParticleField(b,1000/120);for(let i=0;i<a.particles.length;i++){expect(a.particles[i].screenX).toBeCloseTo(b.particles[i].screenX,8);expect(a.particles[i].screenY).toBeCloseTo(b.particles[i].screenY,8);}const before=a.particles[0].y;advanceEntryParticleField(a,60000);expect(before-a.particles[0].y).toBeCloseTo(a.particles[0].drift*6);
});
it('keeps reduced motion static and suppresses an entire soft mote near portrait/text or outside the viewport',()=>{
 const field=createEntryParticleField(390,844,390,undefined,undefined,()=>.5),p=field.particles[0],angle=p.angle,y=p.y;advanceEntryParticleField(field,1000,true);expect(p.angle).toBe(angle);expect(p.y).toBe(y);Object.assign(p,{screenX:100,screenY:100,size:5,projectedScale:1});expect(entryParticleVisible(p,field,[])).toBe(true);expect(entryParticleVisible(p,field,[{x:105,y:90,width:40,height:20}])).toBe(false);p.screenX=410;expect(entryParticleVisible(p,field,[])).toBe(false);
});
it('builds a tiny precolored soft brush, with the optional bright core using no blur filters',()=>{
 const stops=vi.fn(),fill=vi.fn(),c={createRadialGradient:()=>({addColorStop:stops}),fillRect:fill,fillStyle:''};paintEntryParticleBrush(c as unknown as CanvasRenderingContext2D,0x4b9c9f,true);expect(stops).toHaveBeenCalledWith(0,'rgba(75,156,159,.95)');expect(fill.mock.calls[0]).toEqual([0,0,32,32]);expect(fill).toHaveBeenCalledTimes(3);expect('filter'in c).toBe(false);
});
