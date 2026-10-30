import {expect,it} from 'vitest';
import {R2_TOUYE_CORE_HASH,R2_TOUYE_CORE_VERSION} from '../src/domain/r2GroupUpgrade';
import {newRunIdentity} from '../src/game/RunLaunch';
import {touyeChoice} from '../src/game/TouyeWagerCopy';
import {touyeBet,touyeFixture,touyeSend} from './fixtures/touye-new-core';

const current={identity:newRunIdentity('touye','group')};
function pending(kind:Parameters<typeof touyeFixture>[0]) {
 const f=touyeFixture(kind,current),state=touyeSend(f.state,touyeBet(f.state,f.discard,f.target));
 return {...f,state};
}
const preview=(details:string)=>details.split('\n').find(line=>line.startsWith('当前选牌预览：'))??'';

it('identifies the scoring new card and its multiplier only as a current selection preview',()=>{
 const f=pending('mature-win'),before=structuredClone(f.state),choice=touyeChoice(f.state,f.play);
 expect(choice.status).toContain('当前两对 · 换来的1张牌计分 ×2');
 expect(preview(choice.details)).toContain('计分新牌：9♣');
 expect(preview(choice.details)).toContain('实际以确认出牌后为准');
 expect(f.state).toEqual(before);
 const actual=touyeSend(f.state,{type:'PlayHand',selectedIds:f.play});
 expect(actual.lastTrace?.touyeWager).toMatchObject({outcome:'won',multiplier:'2',core:{activeNewIds:f.incoming}});
});

it.each(['mature-accompanying','disabled-core'] as const)('%s does not present a non-scoring new card as a gain',kind=>{
 const f=pending(kind),choice=touyeChoice(f.state,f.play),line=preview(choice.details);
 expect(choice.status).toContain('当前两对 · 没有新牌有效计分 ×0.85');
 expect(line).not.toContain('计分新牌：');expect(line).not.toMatch(/×[234]/);
 const actual=touyeSend(f.state,{type:'PlayHand',selectedIds:f.play});
 expect(actual.lastTrace?.touyeWager).toMatchObject({outcome:'lost',multiplier:'0.85',core:{activeNewIds:[],lossReason:'new-core'}});
});

it('explains a target miss even when a new card actually scores',()=>{
 const f=pending('target-miss'),choice=touyeChoice(f.state,f.play),line=preview(choice.details);
 expect(choice.status).toContain('当前高牌 · 未达所押牌型 ×0.85');expect(line).toContain('计分新牌：4♥');expect(line).not.toMatch(/×[234]/);
 const actual=touyeSend(f.state,{type:'PlayHand',selectedIds:f.play});
 expect(actual.lastTrace?.touyeWager).toMatchObject({outcome:'lost',multiplier:'0.85',core:{activeNewIds:f.incoming,lossReason:'target'}});
});

it('counts a scoring new card with suppressed ordinary points, and never previews an invalid or absent selection',()=>{
 const f=pending('B02-zero'),choice=touyeChoice(f.state,f.play);expect(preview(choice.details)).toContain('计分新牌：9♣');expect(choice.status).toContain('×2');
 for(const ids of [[],['not-in-hand'],[f.play[0],f.play[0]]]){const c=touyeChoice(f.state,ids);expect(c.status).toBe('已押两对 · 出牌后结算');expect(preview(c.details)).toBe('');}
});

it('preserves previous saved-rule copy without inventing a scaled preview',()=>{
 const f=touyeFixture('mature-win',{identity:{contentVersion:R2_TOUYE_CORE_VERSION,contentHash:R2_TOUYE_CORE_HASH}}),state=touyeSend(f.state,touyeBet(f.state,f.discard,f.target));
 const c=touyeChoice(state,f.play);expect(c.status).toBe('已押两对 · 出牌后结算');expect(preview(c.details)).toBe('');
});
