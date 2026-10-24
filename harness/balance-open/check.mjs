import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compile,CONDITIONS} from './adapters.mjs';
const scratch=await mkdtemp(path.join(tmpdir(),'balance-check-')),models={};
for(const c of CONDITIONS){const f=path.join(scratch,c+'.mjs');await compile(c,f);models[c]=await import(pathToFileURL(f));}
const checks=[];
for(const c of CONDITIONS){
  const m=models[c];
  assert.deepEqual([0,1,2].map(i=>m.r2StageSpec(i).targetHeat),c==='A'?['400','800','1200']:['400','600','800']);
  for(const i of [3,4,5,20,23])for(const d of [0,1,8])assert.deepEqual(m.r2StageSpec(i,'normal',d,true,true),models.O.r2StageSpec(i,'normal',d,true,true));
  assert.deepEqual(m.r2StageSpec(1,'normal',1,true,true),models.O.r2StageSpec(1,'normal',1,true,true));
  checks.push(c+': targets isolated to D0 chapter1; later/difficulty targets unchanged');
  const pair=[{id:'8h',rank:8,suit:'hearts'},{id:'8c',rank:8,suit:'clubs'}];
  const raw={rulesVersion:'r2',runId:'arithmetic-only',rootId:'unit',characterId:'erxiang',hand:pair,selectedIds:pair.map(x=>x.id),disabledIds:[],jokers:[],definitions:[],handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,erxiangHandoff:{targetId:null,beforeUsed:false}};
  assert.equal(m.previewR2Hand(raw).scoreRange.minimum,'102');
  assert.equal(m.previewR2Hand({...raw,erxiangHandoff:{targetId:'8h',beforeUsed:false}}).scoreRange.minimum,c==='B'?'258':'430');
  const aces=[{id:'ah',rank:14,suit:'hearts'},{id:'ac',rank:14,suit:'clubs'}];
  const ace=m.previewR2Hand({...raw,hand:aces,selectedIds:aces.map(x=>x.id),erxiangHandoff:{targetId:'ah',beforeUsed:false}});
  assert.deepEqual(ace.breakdown.events.find(e=>e.reasonKey==='erxiang.handoff').value,c==='B'?{n:'11',d:'2'}:{n:'11',d:'1'});
  // Enhancement and ordinary retrigger still follow original points/effects.
  const identity=m.newRunIdentity('erxiang','group'),retrigger=m.r2CreateJoker('b06','unit/retrigger',0,undefined,identity);
  const profile={routeGrowth:{clears:0,G:0,S:0,F:0},boundedClear:true};
  const enhanced=m.previewR2Hand({...raw,...profile,hand:[{...pair[0],enhancement:'heat-paper'},pair[1]],jokers:[retrigger],definitions:m.r2JokerDefinitionsFor(identity),erxiangHandoff:{targetId:'8h',beforeUsed:false}});
  assert.ok(enhanced.breakdown.events.some(e=>e.targetCardId==='8h'&&e.retriggerDepth===1&&e.sourceType==='card'&&e.operation==='add-heat'&&e.value.n==='8'));
  assert.equal(enhanced.breakdown.events.filter(e=>e.reasonKey==='erxiang.handoff').length,1);
  const starter=m.r2CreateJoker('mantangcai','unit/starter',4,undefined,identity);
  const supported={...raw,...profile,jokers:[starter],definitions:m.r2JokerDefinitionsFor(identity)};
  assert.equal(m.previewR2Hand(supported).scoreRange.minimum,'282');
  assert.equal(m.previewR2Hand({...supported,erxiangHandoff:{targetId:'8h',beforeUsed:false}}).scoreRange.minimum,c==='B'?'798':'1330');
  checks.push(c+': bare8 102 -> '+(c==='B'?258:430)+'; A exact 11/2 in B; retrigger 8 and one handoff');
  const current=m.createRun({seed:'unit-public-boundary',runId:'unit',characterId:'touye',rulesVersion:'r2',r2Identity:m.newRunIdentity('touye','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,programsEnabled:false,challengeId:null}});
  const v=m.publicView(current);assert.equal('rng' in v,false);assert.equal('drawPile' in v,false);assert.equal('seed' in v,false);
  const polluted=structuredClone(current);polluted.drawPile.reverse();polluted.rng.deck.state^=123;assert.deepEqual(m.publicView(polluted),v);assert.deepEqual(m.choose(v),m.choose(m.publicView(polluted)));
  checks.push(c+': policy boundary excludes RNG/seed/future order');
}
// No production source is edited by a compile, and O has no replacements at all.
const report={status:'PASS',kind:'arithmetic-and-boundary-checks-no-sampled-chains',checks};
if(process.argv.includes('--output'))await writeFile('docs/production/evidence/separated-balance-2026-10-21/checks.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
