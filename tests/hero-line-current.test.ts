import {expect,it} from 'vitest';
import type Phaser from 'phaser';
import {drawHeroLineCurrent} from '../src/game/HeroLineCurrent';
import {drawHeroOriginStream,heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';

function graphics(){
 const paths:{x:number;y:number}[][]=[],styles:{width:number;color:number}[]=[];let path:{x:number;y:number}[]=[];
 const g={lineStyle(width:number,color:number){styles.push({width,color});return this;},beginPath(){path=[];return this;},moveTo(x:number,y:number){path.push({x,y});return this;},lineTo(x:number,y:number){path.push({x,y});return this;},lineBetween(){return this;},strokePath(){paths.push(path);return this;},clear(){return this;},fillStyle(){return this;},fillCircle(){return this;},fillEllipse(){return this;},fillPoints(){return this;}};
 return {g:g as unknown as Phaser.GameObjects.Graphics,paths,styles};
}
it('moves along the original curve and excludes protected print with stroke clearance',()=>{
 const curve=(t:number)=>({x:100*t,y:20*t*t}),box={x:45,y:-10,width:10,height:40},a=graphics(),b=graphics();
 const first=drawHeroLineCurrent(a.g,curve,0,1,.12,[box],0xffaa44,1),next=drawHeroLineCurrent(b.g,curve,0,1,.19,[box],0xffaa44,1);
 expect(first.segments).toBeGreaterThan(0);expect(next.heads).not.toEqual(first.heads);
 for(const path of [...a.paths,...b.paths])for(const p of path){expect(Math.abs(p.y-20*(p.x/100)**2)).toBeLessThan(14);expect(p.x<42||p.x>58).toBe(true);}
 // Fine blue-white current stays close to the original curve; no dark outline.
 expect(a.styles.slice(0,3).map(s=>s.color)).toEqual([0x48b6e7,0x168ed0,0xdafaff]);
 expect(a.styles.every(s=>[0x48b6e7,0x168ed0,0xdafaff].includes(s.color))).toBe(true);
 expect(a.styles.every(s=>s.width<=3.5)).toBe(true);
 expect(a.paths.flat().every(p=>Math.abs(p.y-20*(p.x/100)**2)<6.5)).toBe(true);
 expect(drawHeroLineCurrent(a.g,curve,0,1,.2,[{x:-5,y:-5,width:110,height:40}],0xffaa44,1)).toEqual({segments:0,heads:[]});
});
it('stops the whole source stream before a board rather than reappearing beyond it',()=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:'azao.multiply-multiplier'}),board={x:80,y:-100,width:40,height:200},base=graphics(),current=graphics();
 drawHeroOriginStream(base.g,{x:0,y:0},[{x:180,y:0,width:40,height:40}],style,.85,[board],1,current.g,[board]);
 expect(base.paths.length).toBeGreaterThan(0);expect(current.paths.length).toBeGreaterThan(0);
 expect([...base.paths,...current.paths].flat().every(p=>p.x<board.x-6)).toBe(true);
});
it.each([0,200])('keeps both source streams on their original side of the board from x=%s',x=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:'azao.multiply-multiplier'}),board={x:80,y:-100,width:40,height:200},base=graphics(),current=graphics(),targetX=x?0:180;
 drawHeroOriginStream(base.g,{x,y:0},[{x:targetX,y:-10,width:20,height:40},{x:targetX,y:20,width:20,height:40}],style,.65,[board],1,current.g,[board]);
 expect(base.paths.length).toBeGreaterThan(0);expect(current.paths.length).toBeGreaterThan(0);
 expect([...base.paths,...current.paths].flat().every(p=>x?p.x>board.x+board.width+6:p.x<board.x-6)).toBe(true);
});
it.each(['amo.exile','erxiang.handoff','azao.multiply-multiplier','xiemu.multiply-multiplier','touye.won','laohuan.refill'])('%s keeps moving current on the existing source stream',reason=>{
 const style=heroAtmosphereStyle({key:'k',targetId:'c',releaseReason:reason}),target=[{x:220,y:80,width:50,height:80}],source={x:0,y:0},a=graphics(),b=graphics();
 const first=drawHeroOriginStream(a.g,source,target,style,.2,[],1),next=drawHeroOriginStream(b.g,source,target,style,.3,[],1);
 expect(first.electricSegments).toBeGreaterThan(0);expect(first.electricHeads.length).toBeGreaterThan(0);expect(first.electricHeads).not.toEqual(next.electricHeads);
});
