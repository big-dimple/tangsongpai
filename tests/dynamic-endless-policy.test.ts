import {describe,expect,it} from 'vitest';
import {dynamicEndlessAdvanceAnchor,dynamicEndlessBossTarget,dynamicEndlessInitialAnchor} from '../src/domain/r2DynamicEndless';
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
 it('enforces the score length boundary after exact integer arithmetic',()=>{
  const max='9'.repeat(MAX_INTEGER_DIGITS);expect(()=>dynamicEndlessAdvanceAnchor(max,'1','1')).toThrow('numeric-length-limit');
  expect(()=>dynamicEndlessInitialAnchor('1','1'.repeat(MAX_INTEGER_DIGITS+1))).toThrow('numeric-length-limit');
 });
});
