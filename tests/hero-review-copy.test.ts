import {describe,it,expect} from 'vitest';
import {sixNewRunPlans,sixSend} from '../harness/fixtures/six-new-run-plans';
import {heroAttachmentFixture} from '../harness/fixtures/hero-attachments';
import {formatScoreReview} from '../src/game/ScoreReview';
import {characterForRun,heroSkillTitleForRun} from '../src/game/CharacterRunCopy';
import {heroSkillGuide} from '../src/game/HeroSkillGuide';
import {createRun} from '../src/domain/run';
import {r2ScoreContext} from '../src/domain/r2Run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {savedSkillName} from '../src/game/SettlementHighlights';
import type {PlayingCard} from '../src/cards/types';
const visible=(r:ReturnType<typeof formatScoreReview>)=>[r.title,r.summary,...r.cards.map(c=>c.title+'\n'+c.body)].join('\n');
const plans=sixNewRunPlans();
describe('saved hero review follows real rule identity and events',()=>{
 for(const p of plans)it(p.hero+' shares its current saved ability name and keeps rule data unchanged',()=>{
  const s=p.hero==='laohuan'?sixSend(p.skillAfter,p.next):p.skillAfter,t=s.lastTrace!,before=JSON.stringify(s),c=characterForRun(s),review=formatScoreReview(s,t),text=visible(review);
  expect(heroSkillTitleForRun(s)).toBe(c.name+' · '+c.passiveName);
  if(p.hero==='laohuan'){expect(t.events.some(e=>e.reasonKey==='laohuan.find')).toBe(true);expect(text).toContain('辛弃疾 · 寻得');}
  else{const event=t.events.find(e=>e.sourceType==='character')!;expect(text).toContain(heroSkillTitleForRun(s));expect(savedSkillName(s,t,event)).toBe(c.passiveName);}
  if(p.hero==='amo'){expect(text).toContain('苏轼 · 贬谪');expect(text).not.toContain('余音袅袅');expect(text).toContain('本次得分 ×3');expect(text).toContain('贬谪：78 ×3 = 234');expect(review.diagnostics).toContain('贬谪前整数得分 78 ×3 = 234');}
  expect([c.detailRules,c.passiveDescription,heroSkillGuide(p.skillBefore).risk].join('\n')).not.toMatch(/保存成功|成功保存|提交保存|同一事务|角色时点/);
  expect(JSON.stringify(s)).toBe(before);for(const event of t.events)expect(review.diagnostics).toContain(JSON.stringify(event));
 });
 it('a historical assist save retains its own displayed skill and effect',()=>{
  const f=heroAttachmentFixture('amo'),s=sixSend(f.state,f.action),t=s.lastTrace!,text=visible(formatScoreReview(s,t));expect(t.assist).toBeTruthy();expect(text).toContain('苏轼 · 余音袅袅');expect(text).not.toContain('贬谪');
 });
});
function routeScore(hand:PlayingCard[],selectedIds:string[],counts:{clears:number;G:number;S:number;F:number}){
 const s=createRun({seed:'review-route',runId:'review-route',characterId:'xiemu',rulesVersion:'r2',r2Identity:newRunIdentity('xiemu','flush'),openingRoute:'flush'});
 const t=scoreR2Hand({rulesVersion:'r2',runId:s.runId,rootId:s.runId+'/hand',hand,selectedIds,disabledIds:[],jokers:[],definitions:r2JokerDefinitionsFor(s),handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:s.rng.rule,...r2ScoreContext(s,hand,selectedIds),routeGrowth:counts});return {s,t,review:formatScoreReview(s,t)};
}
it('opening flush route still permits an actual pair family; a normal flush never reads group history',()=>{
 const pair:PlayingCard[]=[{id:'a',rank:7,suit:'hearts'},{id:'b',rank:7,suit:'clubs'}],a=routeScore(pair,['a','b'],{clears:5,G:5,S:0,F:0}),event=a.t.events.find(e=>e.operation==='route-factor')!;
 expect(event.routeFamily).toBe('G');expect(visible(a.review)).toContain('过关加成');expect(visible(a.review)).toContain('对子、三条等牌型');expect(visible(a.review)).toContain('与开局所选路线无关');
 const flush:PlayingCard[]=[2,5,8,11,13].map((rank,i)=>({id:String(i),rank:rank as PlayingCard['rank'],suit:'hearts'})),b=routeScore(flush,flush.map(c=>c.id),{clears:5,G:5,S:0,F:0});expect(b.t.events.filter(e=>e.operation==='route-factor').map(e=>e.routeFamily)).toEqual(['F']);
 expect(b.review.cards.some(c=>c.title==='过关加成 · 本手计分')).toBe(false);expect(b.review.diagnostics).toContain('route-growth.F.factor');
});
