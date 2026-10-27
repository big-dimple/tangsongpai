import {expect,it} from 'vitest';
import {wrapPcJokerSummary} from '../src/game/PcJokerSummary';

const measure=(text:string)=>[...text].length;
it('keeps signed heat and decimal multipliers whole across compact lines',()=>{
 const text=wrapPcJokerSummary('整手热度+90；倍率×1.5倍。',6,5,measure);
 expect(text.replaceAll('\n','')).toBe('整手热度+90；倍率×1.5倍。');
 expect(text).toContain('+90');expect(text).toContain('×1.5倍');
 for(const line of text.split('\n'))expect(measure(line)).toBeLessThanOrEqual(6);
});
it('omits an entire quantity if it cannot fit before the ellipsis',()=>{
 const text=wrapPcJokerSummary('热度+99999并继续计分',5,1,measure);
 expect(text).toBe('热度…');expect(text).not.toMatch(/\+\d/);
});
