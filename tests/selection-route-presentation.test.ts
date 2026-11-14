import {expect,it} from 'vitest';
import {selectionFinalGatherPoint,selectionFinalSealBox,selectionRouteSealSize} from '../src/game/SelectionEntryParticles';
import {selectionLayout} from '../src/game/SelectionLayout';

it('keeps each preview stamp legible relative to its card without changing its hit area',()=>{
 for(const [width,height] of [[320,640],[390,528],[390,844],[740,390],[1366,768],[1920,1080]]){
  const {routes}=selectionLayout(width,height,12,0,'route');
  for(const card of routes){const size=selectionRouteSealSize(card);expect(size).toBeGreaterThanOrEqual(20);expect(size).toBeLessThanOrEqual(Math.min(86,card.width*.68,card.height*.72));}
 }
});
it('keeps the final saved-choice seal large even when the portrait is small',()=>{
 for(const [width,height] of [[320,640],[390,528],[390,844],[740,390],[1366,768],[1920,1080]]){
  const b=selectionFinalSealBox({width,height});expect(b.width).toBeGreaterThanOrEqual(150);expect(b.height).toBe(b.width);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(height);
  for(let i=0;i<10;i++)for(let frame=0;frame<=100;frame++){const p=selectionFinalGatherPoint({width,height},frame/100,i);expect(p.x).toBeGreaterThanOrEqual(11);expect(p.y).toBeGreaterThanOrEqual(11);expect(p.x).toBeLessThanOrEqual(width-11);expect(p.y).toBeLessThanOrEqual(height-11);}
 }
});
