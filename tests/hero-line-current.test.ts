import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import {drawHeroLineCurrent} from '../src/game/HeroLineCurrent';
import {drawHeroOriginStream,heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';

function graphics(){
 const paths:{x:number;y:number}[][]=[];let path:{x:number;y:number}[]=[];
 const g={lineStyle(){return this;},beginPath(){path=[];return this;},moveTo(x:number,y:number){path.push({x,y});return this;},lineTo(x:number,y:number){path.push({x,y});return this;},lineBetween(){return this;},strokePath(){paths.push(path);return this;},clear(){return this;},fillStyle(){return this;},fillCircle(){return this;},fillEllipse(){return this;},fillPoints(){return this;}};
 return {g:g as unknown as Phaser.GameObjects.Graphics,paths};
}
it('moves along the original curve and excludes protected print with stroke clearance',()=>{
 const curve=(t:number)=>({x:100*t,y:20*t*t}),box={x:45,y:-10,width:10,height:40},a=graphics(),b=graphics();
 const first=drawHeroLineCurrent(a.g,curve,0,1,.12,[box],0xffaa44,1),next=drawHeroLineCurrent(b.g,curve,0,1,.19,[box],0xffaa44,1);
 expect(first.segments).toBeGreaterThan(0);expect(next.heads).not.toEqual(first.heads);
 for(const path of [...a.paths,...b.paths])for(const p of path){expect(Math.abs(p.y-20*(p.x/100)**2)).toBeLessThan(14);expect(p.x<42||p.x>58).toBe(true);}
 // The bolt has a zigzag body and actual fork paths, not a smooth highlight.
 expect(a.paths.some(path=>path.length===3)).toBe(true);
 expect(a.paths.some(path=>path.length>3&&path.some(p=>Math.abs(p.y-20*(p.x/100)**2)>2))).toBe(true);
 expect(drawHeroLineCurrent(a.g,curve,0,1,.2,[{x:-5,y:-5,width:110,height:40}],0xffaa44,1)).toEqual({segments:0,heads:[]});
});
it.each(['amo.exile','erxiang.handoff','azao.multiply-multiplier','xiemu.multiply-multiplier','touye.won','laohuan.refill'])('%s keeps moving current on the existing source stream',reason=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:reason}),target=[{x:220,y:80,width:50,height:80}],source={x:0,y:0},a=graphics(),b=graphics();
 const first=drawHeroOriginStream(a.g,source,target,style,.2,[],1),next=drawHeroOriginStream(b.g,source,target,style,.3,[],1);
 expect(first.electricSegments).toBeGreaterThan(0);expect(first.electricHeads.length).toBeGreaterThan(0);expect(first.electricHeads).not.toEqual(next.electricHeads);
});
