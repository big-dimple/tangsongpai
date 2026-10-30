import {EventEmitter} from 'node:events';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {scheduleStageEntryCaption} from '../src/game/StageEntryCaption';

describe('stage entry caption cancellation',()=>{
 afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
 for(const interrupted of ['dialog','play'] as const)it(`does not appear after ${interrupted} opens and closes during the delay`,()=>{
  vi.useFakeTimers();
  let dialogOpen=false,valid=true;
  vi.stubGlobal('window',globalThis);
  vi.stubGlobal('document',{hidden:false,querySelector:()=>dialogOpen?{}:null});
  const events=new EventEmitter(),add={text:vi.fn()};
  const scene={events,add} as never,view={} as never;
  scheduleStageEntryCaption(scene,view,'entry',()=>valid,1250);
  if(interrupted==='dialog')dialogOpen=true;else valid=false;
  events.emit('update');
  dialogOpen=false;valid=true;
  vi.advanceTimersByTime(1500);
  expect(add.text).not.toHaveBeenCalled();
  expect(events.listenerCount('update')).toBe(0);
  expect(events.listenerCount('shutdown')).toBe(0);
 });
});
