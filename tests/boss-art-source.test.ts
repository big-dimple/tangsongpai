import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openingResources,sceneResources} from '../src/game/SceneResources';
it('retains the exact new transparent general PNG within the existing optional detail budget, outside entry gates',()=>{
 const bytes=readFileSync(new URL('../public/assets/boss/general-95008f17.png',import.meta.url));
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('95008f176817479497731891b6418a762c46b8ec53e32756a560a625e00eceb8');
 expect(bytes.subarray(1,4).toString()).toBe('PNG');expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20),bytes[25]]).toEqual([1774,887,6]);expect(bytes.length).toBeLessThan(2*1024*1024);expect(1774*887).toBeLessThanOrEqual(1600000);
 expect([...openingResources(),...sceneResources('title',undefined,true)].some(a=>a.url.includes('general-95008f17'))).toBe(false);
});
