import {expect,it} from 'vitest';
import {keepChinesePunctuation} from '../src/game/ChineseTextWrap';

it('keeps a closing mark with its text while respecting the available width',()=>{
  const wrap=(text:string)=>text.match(/.{1,4}/gu)?.join('\n')??'';
  const fits=(line:string)=>Array.from(line).length<=4;
  expect(keepChinesePunctuation('山河入画卷。',wrap,fits)).toBe('山河入画\n卷。');
  expect(keepChinesePunctuation('山河入画。再开',wrap,fits)).toBe('山河入\n画。再开');
  expect(keepChinesePunctuation('山河入画\n。再开局',wrap,fits)).toBe('山河入画\n。再开局');
});
