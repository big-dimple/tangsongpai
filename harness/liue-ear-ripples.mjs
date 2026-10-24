/** Current Liu E public checkpoint + native input; read-only observers. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tapUI,waitScene,openRunMenu,toggleRunMenu} from './ui.mjs';

const out=process.env.LIUE_EAR_OUTPUT??'/tmp/liue-ear-ripples',port=5193;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});
const {liueAttachmentFixture}=await server.ssrLoadModule('/harness/fixtures/liue-target-attachment.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {energySend}=await server.ssrLoadModule('/harness/fixtures/score-energy.ts');
await server.listen();
const browser=await chromium.launch(process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH}:{});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}),browser:browser.version(),scope:'Controlled current-identity checkpoint seeded through IndexedDbSave.commit then ordinary reload/continue. Native select/skill/cancel/menu/play inputs, actual card-body Graphics and exact saved state. Chromium software rendering; no visual, hardware, hearing or natural-run acceptance.',cases:[]};
const snapshot=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};});
const settled=p=>p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
const ears=p=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),all=[],walk=list=>{for(const o of list){if(o.active&&o.name==='hero/handoff-ear'){const b=o.getData('inkBounds'),m=o.getWorldTransformMatrix();all.push({id:o.getData('targetId'),phase:o.getData('wavePhase'),visible:o.visible,body:o.parentContainer?.name,bounds:b,world:[[b.x,b.y],[b.x+b.width,b.y+b.height]].map(([x,y])=>m.transformPoint(x,y)),commands:o.commandBuffer.length});}if(o.list)walk(o.list);}};walk(s.view.root.list);return all;});
async function choose(p,id,touch){await tapUI(p,'game','hero/action-shortcut',touch);const button=p.getByRole('button',{name:new RegExp('^(已选 )?第\\d+张 · 6'+(id==='hearts-6'?'♥':'♣')+'$')});if(touch)await button.tap();else await button.click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));}
try{
 for(const spec of [{width:1366,height:768},{width:390,height:844},{width:390,height:740,reduced:true}]){
  const key=spec.width+'-'+(spec.reduced?'reduced':'full'),touch=spec.width<600,context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:touch,deviceScaleFactor:touch?2:1,reducedMotion:spec.reduced?'reduce':'no-preference'}),p=await context.newPage(),row={...spec,key,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());p.setDefaultTimeout(20000);
  try{
   const f=liueAttachmentFixture(false),cp=makeCheckpoint(f.state,[]);assert.ok(readCheckpoint(cp).ok);
   await p.addInitScript(reduced=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:4,reducedMotion:reduced})),!!spec.reduced);
   await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');
   await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const store=new IndexedDbSave();await store.commit((await store.read()).revision,cp,null);},cp);
   await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'game');await settled(p);
   for(const label of ['开始出牌','关闭']){const b=p.getByRole('button',{name:label,exact:true});if(await b.count())await b.click();}
   const initial=await snapshot(p);assert.deepEqual(initial.state,f.state);
   for(const id of f.selectedIds)await tapUI(p,'game','card/'+id,touch);await choose(p,f.targetId,touch);
   const samples=[];for(let i=0;i<9;i++){await p.waitForTimeout(100);samples.push(await ears(p));}
   assert.ok(samples.every(a=>a.length===1&&a[0].id===f.targetId&&a[0].visible));
   if(spec.reduced)assert.ok(samples.every(a=>a[0].phase===0));else assert.ok(new Set(samples.map(a=>a[0].phase)).size>5);
   assert.ok(await p.evaluate(id=>{const s=window.__harness.game.scene.getScene('game'),v=s.cardViews.find(v=>v.card.id===id);return !v.selectionMark.visible&&v.selectionMark.text!=='交';},f.targetId),'ear target has no 交 marker');
   assert.deepEqual(await snapshot(p),initial);row.samples=samples;await p.screenshot({path:out+'/'+key+'.png'});
   await choose(p,f.otherId,touch);assert.deepEqual((await ears(p)).map(e=>e.id),[f.otherId]);
   await tapUI(p,'game','hero/action-shortcut',touch);await p.getByRole('button',{name:'取消本手选牌',exact:true}).click();assert.deepEqual(await ears(p),[]);assert.deepEqual(await snapshot(p),initial);
   await choose(p,f.targetId,touch);await openRunMenu(p,touch);await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').targetAttachment.handoffEarExclusions().length===0);await toggleRunMenu(p,touch);await p.waitForTimeout(400);assert.equal((await ears(p)).length,1);
   await tapUI(p,'game','action/play',touch);await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,initial.state.commandSeq);await settled(p);assert.deepEqual(await ears(p),[]);
   const final=await snapshot(p);assert.deepEqual(final.state,energySend(f.state,{type:'PlayHand',selectedIds:f.selectedIds,erxiangTargetId:f.targetId}));row.score=final.state.lastTrace.finalScore;row.checks=['native target selection, no 交 marker','moving full/static reduced waves','retarget and cancel destroy old Graphics','menu clears and returns current idle','real release clears all ears','exact domain state, journal and storage unchanged by previews'];assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack||error);await p.screenshot({path:out+'/'+key+'-FAIL.png'}).catch(()=>{});throw error;}finally{await context.close();}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack||error);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser.close();await server.close();}
