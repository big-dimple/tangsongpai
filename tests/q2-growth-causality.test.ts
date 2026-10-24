import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {groupGrowthCausality} from '../src/game/JokerGrowthCausality';
import {applyCommand,createRun,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
const checkpoints=JSON.parse(gunzipSync(readFileSync('docs/production/evidence/q2-growth-2026-10-21/checkpoints.json.gz')).toString());
function state(key:string):R2RunState{const cp=structuredClone(checkpoints[key]);expect(readCheckpoint(cp).ok).toBe(true);return cp.state;}
const detail=(s:R2RunState,id:string)=>groupGrowthCausality(s,s.jokers.find(j=>j.definitionId===id)!)!;
describe('Q2 route card on-demand committed growth receipt',()=>{
 it.each([['straight','c04','热度','10'],['flush','c06','倍率','0.5']])('shows an actual zero read separately from the saved first %s gain',(route,id,unit,value)=>{
  const s=state('current-'+route+'-first-stage'),before=JSON.stringify(s),d=detail(s,id);
  expect(d.title).toContain(' · 加成从哪来');expect(d.body).toContain(`当前已攒${unit}加成：+${value}`);
  expect(d.body).toContain(`上次出牌实际用到${unit}加成：+0`);expect(d.body).toContain(`上次出牌结算后新增${unit}加成：+${value}`);
  expect(d.body).toContain('新增只从下次出牌生效');expect(d.body).not.toMatch(/这手|上手|下手|每手|预计/);expect(JSON.stringify(s)).toBe(before);
 });
 it('reads the old c04 value, never the newly saved balance, on the next paid-level hand',()=>{
  const s=state('current-straight-final'),d=detail(s,'c04');expect(d.body).toContain('上次出牌：顺子');expect(d.body).toContain('上次出牌实际用到热度加成：+10');expect(d.body).toContain('上次出牌结算后新增热度加成：+10');expect(d.body).toContain('上次出牌结算后已攒热度加成：+20');
 });
 it('a real high-card c06 read does not imply another flush growth trigger',()=>{
  const s=state('current-flush-final'),d=detail(s,'c06');expect(d.body).toContain('上次出牌：高牌');expect(d.body).toContain('上次出牌实际用到倍率加成：+0.5');expect(d.body).toContain('上次出牌结算后没有新增成长');expect(d.body).not.toContain('结算后新增倍率');
 });
 it('an absent read is not reported as a real +0 read (controlled missing-read receipt)',()=>{
  const s=state('current-flush-first-stage');s.lastTrace!.events=s.lastTrace!.events.filter(e=>!(e.sourceDefinitionId==='c06'&&e.operation==='read-growth'));
  const d=detail(s,'c06');expect(d.body).toContain('上次出牌未读取这张牌的成长加成');expect(d.body).not.toContain('实际用到倍率加成：+0');expect(d.body).toContain('结算后新增倍率加成：+0.5');
 });
 it.each([['straight','c04'],['flush','c06']])('a real purchase without history shows only current %s growth',(route,id)=>{
  const s=createRun({seed:route==='straight'?'policy-valid-groups':'policy-valid-suit',runId:'q2-empty/'+route,characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang',route as 'straight'|'flush'),openingRoute:route as 'straight'|'flush'});
  const o=s.shop!.offers.find(o=>o.definitionId===id)!;const out=applyCommand(s,{runId:s.runId,commandId:s.runId+'/buy',expectedSeq:s.commandSeq,action:{type:'BuyOffer',offerId:o.offerId}});if(!out.ok)throw Error(out.code);
  const before=JSON.stringify(out.state),d=detail(out.state,id);expect(d.body).toContain('还没有这张牌的出牌记录');expect(d.body).toContain('加成：+0');expect(d.body).not.toContain('上次出牌实际用到');expect(JSON.stringify(out.state)).toBe(before);
 });
 it('sold, re-created same-name or later transaction balances cannot borrow the prior receipt',()=>{
  const s=state('current-straight-shop'),old=s.jokers[0];s.jokers=[];expect(groupGrowthCausality(s,old)).toBeUndefined();
  s.jokers=[{...old,instanceId:old.instanceId+'/rebought',growth:{}}];expect(detail(s,'c04').body).toContain('还没有这张牌的出牌记录');expect(detail(s,'c04').body).not.toContain('上次出牌实际用到');
  s.jokers=[{...old,growth:{heat:{n:'15',d:'1'}}}];expect(detail(s,'c04').body).toContain('没有与当前已攒加成匹配');expect(detail(s,'c04').body).not.toContain('上次出牌实际用到');
 });
 it('a cold checkpoint recovery keeps the same receipt and does not create more growth',()=>{
  const s=state('current-straight-shop'),expected=detail(s,'c04');const read=readCheckpoint(JSON.parse(JSON.stringify(makeCheckpoint(s,[]))));if(!read.ok)throw Error(read.code);
  expect(detail(read.checkpoint.state,'c04')).toEqual(expected);expect(read.checkpoint.state.jokers).toEqual(s.jokers);
 });
 it('unknown identities and unrelated cards keep their existing gate',()=>{
  const s=state('current-straight-first-stage');s.contentHash='unknown';expect(groupGrowthCausality(s,s.jokers[0])).toBeUndefined();
 });
});
