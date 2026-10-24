import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import preset from '../src/game/presets/lempo-sword-slash.json';
import {SUSHI_SLASH_LIFETIME_MS,SUSHI_SWORD_SLASH,drawSushiSwordSlash,sushiSlashColor,sushiSwordSlashSamples} from '../src/game/SushiSwordSlash';
import {sushiLocalSlash,drawSushiDiscardCard} from '../src/game/SushiDiscardCardPresentation';
type Point={x:number;y:number};
function ink(){const polygons:Point[][]=[];const g={clear(){polygons.length=0;return this;},setBlendMode(){return this;},fillStyle(){return this;},fillPoints(points:Point[]){polygons.push(points);return this;}};return{g:g as unknown as Phaser.GameObjects.Graphics,polygons};}
it('retains the fixed full Sword Slash palette, width, opacity, lifetime and placeholder metadata without a texture runtime',()=>{
 expect(SUSHI_SLASH_LIFETIME_MS).toBe(220);expect(SUSHI_SWORD_SLASH).toMatchObject({maxPoints:40,minDist:2,smoothing:4,widthStart:30,widthEnd:0,widthMult:1,taperHead:true,taperTail:true,intensity:1.8,coreWidth:.35,coreColor:'#ffffff',edgeColor:'#55b8ff',edgeSoftness:.6,glowWidth:2.2,glowAlpha:.35});expect(SUSHI_SWORD_SLASH.widthCurve).toEqual([[0,0,'smooth'],[.12,1,'smooth'],[.55,.55,'smooth'],[1,0,'smooth']]);expect(SUSHI_SWORD_SLASH.alphaStops).toEqual([[0,255],[.55,190],[1,0]]);expect(preset.texture).toBeNull();expect(preset.textureHiFi).toBe('slash_streak');expect(preset.demoMotion).toBe('arc_swing');
 for(const [t,color]of [[0,0xffffff],[.25,0xc4ecff],[.65,0x4aa8ff],[1,0x1f3fff]])expect(sushiSlashColor(t)).toBe(color);
});
it('keeps both tips tapered and every glow/core vertex inside one card, with at most40 points and the2px sample spacing',()=>{
 for(const width of [38,64,112])for(const height of [70,100,159])for(const age of [.1,.5,.9]){const samples=sushiSwordSlashSamples(width,height,sushiLocalSlash(width,height,age),age);expect(samples.length).toBeLessThanOrEqual(40);if(!samples.length)continue;expect(samples[0].width).toBe(0);expect(samples.at(-1)!.width).toBe(0);for(let i=0;i<samples.length;i++){const p=samples[i];if(i&&samples.length>2)expect(Math.hypot(p.x-samples[i-1].x,p.y-samples[i-1].y)).toBeGreaterThanOrEqual(2-1e-8);for(const sign of [-1,1]){expect(Math.abs(p.x+sign*p.normal.x*p.width*2.2/2)).toBeLessThanOrEqual(width/2-1+1e-8);expect(Math.abs(p.y+sign*p.normal.y*p.width*2.2/2)).toBeLessThanOrEqual(height/2-1+1e-8);}}}
});
it('clips whole ribbon pieces around printed text and never spans an intervening ordinary card',()=>{
 const f=ink(),print={x:-8,y:-6,width:16,height:12};drawSushiSwordSlash(f.g,112,159,sushiLocalSlash(112,159,.8),.8,[print]);expect(f.polygons.length).toBeGreaterThan(0);for(const poly of f.polygons){const x=Math.min(...poly.map(p=>p.x)),y=Math.min(...poly.map(p=>p.y)),r=Math.max(...poly.map(p=>p.x)),b=Math.max(...poly.map(p=>p.y));expect(x>=print.x+print.width+1||r<=print.x-1||y>=print.y+print.height+1||b<=print.y-1).toBe(true);}
 for(const center of [-120,120]){drawSushiSwordSlash(f.g,60,100,sushiLocalSlash(60,100,.7),.7,[]);for(const poly of f.polygons)for(const p of poly)expect(center+p.x<-25||center+p.x>25).toBe(true);f.polygons.length=0;}
});
it('follows the actual cut progress and clears at completion, without an independent empty-card tail',()=>{
 const f=ink();drawSushiDiscardCard(f.g,112,159,200,.7,false,[],true);expect(f.polygons.length).toBeGreaterThan(0);drawSushiDiscardCard(f.g,112,159,220,1,false,[],true);expect(f.polygons).toHaveLength(0);drawSushiDiscardCard(f.g,112,159,100,.5,true,[],true);expect(f.polygons).toHaveLength(0);
});
it('has a fixed four-band drawing bound and no residual geometry after expiry',()=>{
 const f=ink(),result=drawSushiSwordSlash(f.g,112,159,sushiLocalSlash(112,159,.65),.65,[]);expect(result.points).toBeLessThanOrEqual(40);expect(result.quads).toBeLessThanOrEqual(4*39);expect(sushiSwordSlashSamples(112,159,sushiLocalSlash(112,159,1),1)).toEqual([]);expect(sushiSwordSlashSamples(112,159,sushiLocalSlash(112,159,.5),-1)).toEqual([]);
});
