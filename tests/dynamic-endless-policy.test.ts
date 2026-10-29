import {describe,expect,it} from 'vitest';
import {dynamicEndlessAdvanceAnchor,dynamicEndlessBossTarget,dynamicEndlessInitialAnchor,dynamicEndlessStageTarget} from '../src/domain/r2DynamicEndless';
import {MAX_INTEGER_DIGITS} from '../src/domain/rational';

describe('unintegrated dynamic endless arithmetic',()=>{
 it('limits a single spike and catches sustained growth at the second real ordinary clear',()=>{
  const first=dynamicEndlessAdvanceAnchor('2000000','27642','10000000000','10000000');expect(first).toBe('4000000');
  expect(dynamicEndlessAdvanceAnchor(first,'27642','10000000000','10000000000')).toBe('3500000000');
 });
 it('cold start requires real evidence, low results never lower anchor, and precise rounding applies',()=>{
  expect(dynamicEndlessInitialAnchor('27642')).toBe('27642');expect(dynamicEndlessInitialAnchor('27642','3000000000')).toBe('300000000');
  expect(dynamicEndlessAdvanceAnchor('2000000','27642','1')).toBe('2100000');expect(dynamicEndlessAdvanceAnchor('3','1','1')).toBe('4');
 });
 it('applies the documented boss tiers and preserves the old static floor',()=>{
  expect(dynamicEndlessBossTarget('1000000','1','B09')).toBe('750000');expect(dynamicEndlessBossTarget('1000000','1','B14')).toBe('900000');expect(dynamicEndlessBossTarget('1000000','2000000','B03')).toBe('2000000');
 });
 it('applies each phase baseline once, preserving its original static floor',()=>{
  const boss={definitionId:'B09' as const,disabledSuit:null};
  expect([24,25,26].map(i=>dynamicEndlessStageTarget(i,0,'20000',boss))).toEqual(['27642','41462','55283']);
  expect([24,25,26].map(i=>dynamicEndlessStageTarget(i,0,'100000',boss))).toEqual(['100000','100000','75000']);
  expect(dynamicEndlessStageTarget(26,0,'100000',{definitionId:'B05',disabledSuit:null})).toBe('90000');
  expect(dynamicEndlessStageTarget(24,1,'20000',boss)).toBe('33170');
  expect(dynamicEndlessStageTarget(26,0,'100000',boss,false,'768000')).toBe('768000');
  expect(()=>dynamicEndlessStageTarget(23,0,'1',boss)).toThrow('invalid-dynamic-stage');
  expect(()=>dynamicEndlessStageTarget(26,0,'1',{definitionId:'B03',disabledSuit:null})).toThrow('invalid-dynamic-stage');
 });
 it('enforces the score length boundary after exact integer arithmetic',()=>{
  const max='9'.repeat(MAX_INTEGER_DIGITS);expect(()=>dynamicEndlessAdvanceAnchor(max,'1','1')).toThrow('numeric-length-limit');
  expect(()=>dynamicEndlessInitialAnchor('1','1'.repeat(MAX_INTEGER_DIGITS+1))).toThrow('numeric-length-limit');
 });
});
