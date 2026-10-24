import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rename} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {compile,CONDITIONS} from './adapters.mjs';
const BASE='fe2de5edaea6c3dbcc9a7e0885dfe324bae457be';
export const OUT='docs/production/evidence/separated-balance-2026-10-21';
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const harnessFiles=['policy.ts','worker.ts','adapters.mjs','run.mjs','check.mjs','tsconfig.json'].map(f=>'harness/balance-open/'+f);
export async function fingerprints(){
  const files=[...git('ls-tree','-r','--name-only',BASE,'src','package-lock.json').split('\n'),...harnessFiles];
  const hashes={};for(const file of files)hashes[file]=sha(await readFile(file));return hashes;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('harness/balance-open/run.mjs')){
  await mkdir(OUT,{recursive:true});
  if(process.argv.includes('--lock')){
    assert.equal(git('rev-parse','HEAD'),BASE,'lock must precede sample runs');
    const lock={baseline:BASE,excludedPR:210,excludedHead:'f6c86f13522c7374963f611dc41dc843c78155f0',policy:'open-group-v1',runtime:process.version,seeds:['balance-open-20261021-01','balance-open-20261021-02','balance-open-20261021-03'],characters:['amo','touye','laohuan','erxiang','azao','xiemu'],route:'group',conditions:CONDITIONS,budget:39,lockedAt:new Date().toISOString(),files:await fingerprints()};
    await writeFile(OUT+'/lock.json',JSON.stringify(lock,null,2)+'\n');console.log('LOCKED '+sha(JSON.stringify(lock)));process.exit(0);
  }
  const lock=JSON.parse(await readFile(OUT+'/lock.json','utf8'));assert.deepEqual(await fingerprints(),lock.files,'locked input drift; never retune after opening seeds');
  assert.equal(git('rev-parse',BASE),BASE);
  const scratch=await mkdtemp(path.join(tmpdir(),'tangsongpai-balance-'));
  const models={};for(const condition of CONDITIONS){const file=path.join(scratch,condition+'.mjs');await compile(condition,file);models[condition]=await import(pathToFileURL(file));}
  const resultPath=OUT+'/results.json';
  // Do not overwrite original evidence or silently restart a partial experiment.
  try{await readFile(resultPath);throw Error('results already exist; inspect before any replay');}catch(e){if(e.code!=='ENOENT')throw e;}
  const results={kind:'public-state-policy-simulation-not-human-win-rate',lockSha256:sha(await readFile(OUT+'/lock.json')),policyCommit:git('rev-parse','HEAD'),startedAt:new Date().toISOString(),status:'RUNNING',chains:[]};
  await writeFile(resultPath,JSON.stringify(results,null,2)+'\n');
  try{
    for(const condition of CONDITIONS)for(const character of condition==='B'?['erxiang']:lock.characters)for(const seed of lock.seeds){
      const m=models[condition],key=condition+'-'+character+'-'+seed.slice(-2),storagePath=path.join(scratch,key+'.json');
      const row={key,condition,character,seed,route:'group',status:'RUNNING',stages:[],steps:[],storage:{backend:'file-CAS/SavedRun/makeCheckpoint',restoreChecks:0}};
      results.chains.push(row);await writeFile(resultPath,JSON.stringify(results,null,2)+'\n');
      let slots={revision:0,current:null,previous:null};
      const store={async read(){try{const envelope=JSON.parse(await readFile(storagePath,'utf8'));assert.equal(envelope.experiment,condition);return envelope.slots;}catch(e){if(e.code==='ENOENT')return structuredClone(slots);throw e;}},async commit(expectedRevision,current,previous){const old=await this.read();assert.equal(old.revision,expectedRevision);const next={revision:expectedRevision+1,current,previous};await writeFile(storagePath+'.tmp',JSON.stringify({experiment:condition,warning:'EXPERIMENT ONLY; never import into default game',slots:next}));await rename(storagePath+'.tmp',storagePath);slots=next;return next.revision;}};
      const initial=m.createRun({seed,characterId:character,runId:'balance/'+seed+'/'+character,rulesVersion:'r2',r2Identity:m.newRunIdentity(character,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
      row.initialIdentity={contentVersion:initial.contentVersion,contentHash:initial.contentHash};row.initialGold=initial.gold;row.initialLevels=initial.handLevels;row.initialOffers=initial.shop;
      let controller=await m.SavedRun.start(store,initial,await store.read());
      for(let count=0;count<100;count++){
        const before=controller.state;
        if(before.phase==='run-lost'||before.stageIndex>=3){row.status=before.phase==='run-lost'?'LOST':'THREE_CLEARED';break;}
        const view=m.publicView(before),decision=m.choose(view);
        assert.equal('rng' in view,false);assert.equal('drawPile' in view,false);assert.equal('seed' in view,false);assert.equal('refillProof' in (view.stage?.touyeWager??{}),false);
        const beforeSummary=summarize(before,m),answer=await controller.dispatch(decision.action);
        assert.equal(answer.ok,true,JSON.stringify({key,action:decision.action,code:answer.code}));
        const after=controller.state;
        const entry={command:controller.journal.at(-1),reason:decision.reason,estimate:decision.publicEstimate,before:beforeSummary,after:summarize(after,m),revision:slots.revision,events:answer.events.filter(e=>e.type!=='hand-scored-r2')};
        if(decision.action.type==='PlayHand'){
          entry.trace=after.lastTrace;
          // Local arithmetic probe only: same played cards, no alternate decisions or RNG draws.
          // All growth counters reset to their published initial values; paid hand levels become Lv1.
          const p=m.estimate(view,decision.action).input;
          const jokers=p.jokers.map(j=>m.r2CreateJoker(j.definitionId,j.instanceId,j.paidPrice,j.edition,view));
          const probe=m.previewR2Hand({...p,jokers,handLevels:{}});
          entry.growthArithmetic={actualPublicMinimum:decision.publicEstimate,withoutPurchasedLevelsAndAccumulatedJokerGrowth:probe.scoreRange.minimum,note:'same hand, inventory, route and skill; arithmetic only; not a no-buy run'};
        }
        row.steps.push(entry);
        if(decision.action.type==='EnterStage')row.stages.push({index:after.stage.index,target:after.stage.targetHeat,opening:m.publicView(after).hand,goldBefore:before.gold,offersSeen:before.shop});
        if(after.phase==='stage-cleared'||after.phase==='run-lost'){
          const stage=row.stages.at(-1);Object.assign(stage,{score:after.stage.heat,cleared:after.phase==='stage-cleared',death:after.outcome,hands:after.stage.playIndex,discards:after.stage.discardsUsed,discardSpent:after.stage.discardSpent,goldAfter:after.gold,reward:after.stage.goldEarned,skills:row.steps.filter(e=>e.before.stage?.index===after.stage.index&&e.command.action.type==='PlayHand').map(e=>({command:e.command.commandId,amo:e.trace.amoExile,liue:e.trace.erxiangHandoff,wencheng:e.trace.azaoCharge,huarui:e.trace.xiemuBurn,qin:e.trace.touyeWager})),growth:after.routeGrowth});
          const saved=await store.read(),restored=m.SavedRun.restore(store,saved);assert.deepEqual(restored.state,controller.state);assert.deepEqual(restored.journal,controller.journal);controller=restored;row.storage.restoreChecks++;
        }
      }
      assert.notEqual(row.status,'RUNNING','bounded command limit');
      row.final=summarize(controller.state,m);row.storage.revision=slots.revision;
      const envelope={experiment:condition,baseline:BASE,policy:lock.policy,warning:'EXPERIMENT ONLY; never import into default game',checkpoint:JSON.parse(controller.exportJSON())};
      row.checkpoint=key+'.checkpoint.json.gz';await writeFile(OUT+'/'+row.checkpoint,gzipSync(JSON.stringify(envelope),{level:9}));
      row.storage.sha256=sha(await readFile(OUT+'/'+row.checkpoint));
      console.log(JSON.stringify({key,status:row.status,stages:row.stages.map(s=>({target:s.target,score:s.score,hands:s.hands,discards:s.discards})),gold:row.final.gold}));
      await writeFile(resultPath,JSON.stringify(results,null,2)+'\n');
    }
    assert.equal(results.chains.length,39);results.status='COMPLETE';
  }catch(e){results.status='FAILED';results.error=e.stack;throw e;}
  finally{results.finishedAt=new Date().toISOString();await writeFile(resultPath,JSON.stringify(results,null,2)+'\n');}
}
function summarize(s,m){return {hash:m.stableHash(s),seq:s.commandSeq,phase:s.phase,stageIndex:s.stageIndex,gold:s.gold,hand:s.handOrder,stage:s.stage&&{index:s.stage.index,target:s.stage.targetHeat,score:s.stage.heat,handsLeft:s.stage.handsLeft,discardsLeft:s.stage.discardsLeft,playIndex:s.stage.playIndex,discardsUsed:s.stage.discardsUsed},levels:s.handLevels,jokers:s.jokers,routeGrowth:s.routeGrowth};}
