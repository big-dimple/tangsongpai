import {expect,it} from 'vitest';
import {nextControllerTarget,type FocusTarget} from '../src/game/ControllerFocus';
const target=(id:string,x:number,y:number,width=80,height=100):FocusTarget=>({id,box:{x,y,width,height}});
it('moves across a lifted overlapping hand before entering another row',()=>{
  const targets=[target('first',0,200),target('second',24,180),target('third',48,200),target('play',250,340)];
  expect(nextControllerTarget(targets,'first','right')?.id).toBe('second');expect(nextControllerTarget(targets,'second','right')?.id).toBe('third');
  expect(nextControllerTarget(targets,'third','down')?.id).toBe('play');
});
it('prefers a neighbouring column, and stays put at an edge without activating anything',()=>{
  const targets=[target('first',0,0),target('second',120,0),target('lower',0,150),target('far',500,100)];
  expect(nextControllerTarget(targets,'first','down')?.id).toBe('lower');expect(nextControllerTarget(targets,'first','left')?.id).toBe('first');
  expect(nextControllerTarget(targets,'gone','right')?.id).toBe('first');expect(nextControllerTarget([],'gone','right')).toBeUndefined();
});
