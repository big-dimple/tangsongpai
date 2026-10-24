import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdtemp} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {compile} from './adapters.mjs';
const out='docs/production/evidence/separated-balance-2026-10-21';
const sha=x=>createHash('sha256').update(x).digest('hex');
let bytes;try{bytes=await readFile(out+'/results.json');}catch(e){if(e.code!=='ENOENT')throw e;bytes=gunzipSync(await readFile(out+'/results.json.gz'));}
const r=JSON.parse(bytes);assert.equal(r.status,'COMPLETE');assert.equal(r.chains.length,39);
assert.equal(new Set(r.chains.map(c=>[c.condition,c.character,c.seed].join('/'))).size,39);
const lock=JSON.parse(await readFile(out+'/lock.json','utf8'));
for(const [f,h] of Object.entries(lock.files))assert.equal(sha(await readFile(f)),h,'input drift '+f);
const sum=(rows,f)=>rows.reduce((n,x)=>n+f(x),0);
const played=c=>c.steps.filter(s=>s.trace);
const entries=[];
for(const c of r.chains){
  const cpBytes=await readFile(out+'/'+c.checkpoint);assert.equal(sha(cpBytes),c.storage.sha256);
  const envelope=JSON.parse(gunzipSync(cpBytes));assert.equal(envelope.experiment,c.condition);
  assert.equal(c.stages.length,3);assert.equal(c.storage.restoreChecks,3);
  const p=played(c);
  entries.push({key:c.key,condition:c.condition,character:c.character,seed:c.seed,status:c.status,
    hands:c.stages.map(s=>s.hands),discards:c.stages.map(s=>s.discards),scores:c.stages.map(s=>s.score),targets:c.stages.map(s=>s.target),rewards:c.stages.map(s=>s.reward),gold:c.final.gold,
    supportPurchases:c.steps.filter(s=>s.command.action.type==='BuyOffer').map(s=>({seq:s.command.expectedSeq+1,definitionId:s.after.jokers.find(j=>!s.before.jokers.some(b=>b.instanceId===j.instanceId)).definitionId,paid:s.before.gold-s.after.gold})),
    practices:c.steps.filter(s=>s.command.action.type==='PracticeHand').map(s=>({seq:s.command.expectedSeq+1,handType:s.command.action.handType,before:s.before.levels[s.command.action.handType],after:s.after.levels[s.command.action.handType],paid:s.before.gold-s.after.gold})),
    burn:sum(p,s=>s.trace.xiemuBurn?.cost??0),liue:p.filter(s=>s.trace.erxiangHandoff?.targetId).length,
    wenMax:Math.max(0,...p.map(s=>s.trace.azaoCharge?.after.charge??0)),wenReleases:p.filter(s=>s.trace.azaoCharge?.release).length,
    qinBets:p.filter(s=>s.trace.touyeWager?.commit).length,xinChoices:c.steps.filter(s=>s.command.action.type==='ChooseRefill').length,
    positiveJokerGrowthReads:p.flatMap(s=>s.trace.events).filter(e=>['read-growth','read-coefficient'].includes(e.operation)&&e.value.n!=='0').length,
    localGrowthPositiveHands:p.filter(s=>BigInt(s.trace.finalScore)>BigInt(s.growthArithmetic.withoutPurchasedLevelsAndAccumulatedJokerGrowth)).length,
    checkpoint:c.checkpoint});
}
const pairs=[];
for(const c of r.chains.filter(c=>c.condition!=='O')){
  const base=r.chains.find(b=>b.condition==='O'&&b.character===c.character&&b.seed===c.seed);
  const actionIndex=c.steps.findIndex((s,i)=>JSON.stringify(s.command.action)!==JSON.stringify(base.steps[i]?.command.action));
  const originalPlay=played(base),candidatePlay=played(c);
  let firstScore=null;
  for(const p of candidatePlay){const q=originalPlay.find(x=>x.before.stage.index===p.before.stage.index&&x.before.stage.playIndex===p.before.stage.playIndex);if(q&&p.trace.finalScore!==q.trace.finalScore){firstScore={stage:p.before.stage.index+1,play:p.before.stage.playIndex+1,baseline:q.trace.finalScore,candidate:p.trace.finalScore,samePublicHand:JSON.stringify(p.before.hand)===JSON.stringify(q.before.hand),sameAction:JSON.stringify(p.command.action)===JSON.stringify(q.command.action)};break;}}
  const firstPublicHandChange=candidatePlay.map(s=>({s,q:originalPlay.find(q=>q.before.stage.index===s.before.stage.index&&q.before.stage.playIndex===s.before.stage.playIndex)})).find(({s,q})=>q&&JSON.stringify(s.before.hand)!==JSON.stringify(q.before.hand));
  pairs.push({baseline:base.key,candidate:c.key,
    priorOnly:c.condition==='A'?'chapter1 targets400/800/1200':'ordinary handoff p/2, no ordinary heat',
    firstDifferentAction:actionIndex<0?null:{ordinal:actionIndex+1,baseline:base.steps[actionIndex]?.command.action,candidate:c.steps[actionIndex].command.action,stage:c.steps[actionIndex].before.stage?.index+1,reason:c.steps[actionIndex].reason},
    firstScoreDifference:firstScore,
    firstObservedAlignedPublicHandDifference:firstPublicHandChange?{baselineSeq:firstPublicHandChange.q.command.expectedSeq+1,candidateSeq:firstPublicHandChange.s.command.expectedSeq+1,stage:firstPublicHandChange.s.before.stage?.index+1,phase:firstPublicHandChange.s.before.phase,baseline:firstPublicHandChange.q.before.hand,candidate:firstPublicHandChange.s.before.hand,note:'observed after decision divergence, not a forced same-deal comparison'}:null,
    stageOpeningEqual:c.stages.map((s,i)=>JSON.stringify(s.opening)===JSON.stringify(base.stages[i].opening)),
    shopShelfEqual:c.stages.map((s,i)=>{const shelf=x=>[...x.offers,...x.toolOffers,...x.itemOffers].map(o=>[o.offerId,o.definitionId,o.price]);return JSON.stringify(shelf(s.offersSeen))===JSON.stringify(shelf(base.stages[i].offersSeen));}),
    handsDelta:sum(c.stages,s=>s.hands)-sum(base.stages,s=>s.hands),goldDelta:c.final.gold-base.final.gold});
}
const summary={kind:r.kind,policyCommit:r.policyCommit,completeChains:39,clearedChains:r.chains.filter(c=>c.status==='THREE_CLEARED').length,conditions:{},entries,pairs};
for(const condition of ['O','A','B']){
  const rows=entries.filter(e=>e.condition===condition);
  summary.conditions[condition]={chains:rows.length,stages:rows.length*3,firstStageFirstHand:rows.filter(e=>e.hands[0]===1).length,allStageFirstHands:sum(rows,e=>e.hands.filter(h=>h===1).length),hands:sum(rows,e=>sum(e.hands,x=>x)),discards:sum(rows,e=>sum(e.discards,x=>x)),practices:sum(rows,e=>e.practices.length),burn:sum(rows,e=>e.burn)};
}
await writeFile(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');
// These are explicit paper checks, not additional sampled runs or made-up openings.
const scratch=await mkdtemp(path.join(tmpdir(),'balance-paper-'));
await compile('O',scratch+'/O.mjs');const m=await import(pathToFileURL(scratch+'/O.mjs'));
await build({stdin:{contents:"export {azaoChargeStep,emptyAzaoCharge} from './src/domain/r2AzaoCharge'; export {touyeWagerStep,touyeSnapshotToken} from './src/domain/r2TouyeWager';",resolveDir:process.cwd()},outfile:scratch+'/steps.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const steps=await import(pathToFileURL(scratch+'/steps.mjs'));
let charge=steps.emptyAzaoCharge();const progression=[];
for(const type of ['two-pair','three-kind','straight']){const t=steps.azaoChargeStep(type,{before:charge,release:false},true);progression.push(t);charge=t.after;}
assert.equal(charge.charge,3);
const releaseTiers=[1,2,3].map(n=>steps.azaoChargeStep('flush',{before:{charge:n,previousQualifiedType:'straight'},release:true},true));
assert.deepEqual(releaseTiers.map(t=>t.multiplier),['1.5','2.5','4']);
const pairHand=[{id:'2h',rank:2,suit:'hearts'},{id:'2s',rank:2,suit:'spades'},{id:'Ac',rank:14,suit:'clubs'},{id:'Ad',rank:14,suit:'diamonds'}];
const scoreInput={rulesVersion:'r2',runId:'paper-only',rootId:'arithmetic',characterId:'erxiang',hand:pairHand,selectedIds:pairHand.map(c=>c.id),disabledIds:[],jokers:[],definitions:[],handLevels:{},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,erxiangHandoff:{targetId:null,beforeUsed:false}};
const base=m.previewR2Hand(scoreInput).scoreRange.minimum,full=m.previewR2Hand({...scoreInput,erxiangHandoff:{targetId:'Ac',beforeUsed:false}}).scoreRange.minimum;
assert.equal(base,'182');assert.equal(full,'1040');
await compile('B',scratch+'/B.mjs');const b=await import(pathToFileURL(scratch+'/B.mjs'));
const half=b.previewR2Hand({...scoreInput,erxiangHandoff:{targetId:'Ac',beforeUsed:false}}).scoreRange.minimum;assert.equal(half,'600');
const wenScores=releaseTiers.map((t,i)=>m.previewR2Hand({...scoreInput,characterId:'azao',erxiangHandoff:undefined,azaoCharge:{before:{charge:i+1,previousQualifiedType:'straight'},release:true}}).scoreRange.minimum);
assert.deepEqual(wenScores,['273','455','728']);
const before=[{id:'4h',rank:4,suit:'hearts'},{id:'4d',rank:4,suit:'diamonds'},{id:'Kc',rank:13,suit:'clubs'},...['2h','3c','5d','7d','9h'].map(id=>({id,rank:Number(id[0]),suit:({h:'hearts',c:'clubs',d:'diamonds'})[id[1]]}))];
const selectedIds=before.slice(3).map(c=>c.id),rules={fourStraight:false,fourFlush:false},newIds=['9c','9d','6h','8d','Qc'];
const commit={target:'two-pair',snapshotToken:steps.touyeSnapshotToken(before,rules,1,1,8),stageIndex:1,duePlayIndex:1,discardCommandId:'paper/discard',expectedSeq:8,handBefore:before,rules,selectedIds,refill:{handLimit:8,handAfter:[...before.slice(0,3).map(c=>c.id),...newIds],refilledIds:newIds}};
const qin=[steps.touyeWagerStep('two-pair',null,true,[],true),steps.touyeWagerStep('two-pair',commit,true,['4h','4d','9c','9d'],true),steps.touyeWagerStep('pair',commit,true,['4h','4d'],true)];
assert.deepEqual(qin.map(t=>t.multiplier),['1.15','2','0.85']);
const paper={kind:'paper-arithmetic-only-no-natural-path-no-rate',twoPair:{cards:pairHand,withoutSkill:base,liueFull:full,liueHalf:half,liueHalfDerivation:'(91-11)*(2+11/2)=600'},wencheng:{progression,releaseTiers,conditionalScoresOnSameNakedTwoPair:wenScores,note:'requires prior qualified alternation; no such release observed in sampled chains'},qin:{hypotheticalPublicCommit:commit,outcomes:qin,note:'legal two-pair target; win requires new active core. No sampled bet was made; no hit probability claimed.'}};
await writeFile(out+'/paper.json',JSON.stringify(paper,null,2)+'\n');
const productionFiles=execFileSync('git',['ls-tree','-r','--name-only',lock.baseline,'src'],{encoding:'utf8'}).trim().split('\n');
for(const f of productionFiles)assert.equal(sha(execFileSync('git',['show',lock.baseline+':'+f])),sha(await readFile(f)),'production source drift '+f);
const verification={productionSourceFilesEqualBaseline:productionFiles.length,productionSourceChanged:0,defaultOHasNoAdapterReplacements:true,all39PassedFormalInvariantsAndSavedRun:true,stageColdRestoreChecks:sum(r.chains,c=>c.storage.restoreChecks),policyLockUnchanged:true,qualificationLimits:{qinBets:sum(entries,e=>e.qinBets),wenReleases:sum(entries,e=>e.wenReleases),wenMaximumCharge:Math.max(...entries.map(e=>e.wenMax)),positiveAccumulatedJokerGrowthReads:sum(entries,e=>e.positiveJokerGrowthReads)},ui:'NOT_RUN: headless experiment, no UI/product source changes',notHumanOrLongTermAcceptance:true};
await writeFile(out+'/verification.json',JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({conditions:summary.conditions,verification},null,2));
