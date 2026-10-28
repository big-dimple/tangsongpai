import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {waitScene} from './ui.mjs';
import {tapUI} from './ui.mjs';

const out='shots/dynamic-endless';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5598,strictPort:true},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {r2DynamicEndlessBase}=await server.ssrLoadModule('/src/domain/r2GroupUpgrade.ts');
const {lockR2ChapterTargets}=await server.ssrLoadModule('/src/domain/r2Chapter.ts');
const {makeCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {r2ModeStorageKey}=await server.ssrLoadModule('/src/content/r2Modes.ts');
const send=(s,action)=>{const r=applyCommand(s,{runId:s.runId,commandId:`browser/${s.commandSeq}`,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;};
function shop(legacy){let s;for(let i=0;i<20;i++){const newest=newRunIdentity('azao','group'),identity=legacy?r2DynamicEndlessBase(newest):newest,x=createRun({rulesVersion:'r2',runId:'dynamic-browser',seed:'dynamic-runtime-'+i,characterId:'azao',openingRoute:'group',r2Identity:identity,modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});if(x.pokerEncounter.nextAt>7){s=x;break;}}if(!s)throw Error('seed');s=send(s,{type:'LeaveShop'});Object.assign(s,{chapter:8,stageIndex:23,totalHeat:'1000',boss:{definitionId:'B12',disabledSuit:null},seenBossIds:['B01','B02','B05','B06','B07','B08','B13','B12'],routeGrowth:{clears:7,G:0,S:0,F:0,settlements:[2,5,8,11,14,17,20].map(stageIndex=>({stageIndex,families:[]}))}});s.chapterTargetPlan=lockR2ChapterTargets(8,'normal',0,s.boss);s.deckInstances=Array.from({length:20},(_,i)=>({id:`dynamic/card/${i}`,rank:14,suit:'hearts',enhancement:'encore-paper',edition:'polychrome'}));s.drawPile=s.deckInstances.map(c=>c.id);s.handLevels={'flush-five':30};s=send(s,{type:'EnterStage'});s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,5)});return send(s,{type:'ContinueEndless'});}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});const report={scope:'Controlled end-of-standard fixture; real save import and UI actions in software Chromium.',cases:[]};
try{for(const width of [1366,390])for(const legacy of [false,true]){
 const p=await browser.newPage({viewport:{width,height:width===390?844:768},hasTouch:width===390,reducedMotion:'reduce'}),row={width,legacy,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(e.message));p.on('dialog',d=>d.accept());
 try{await p.goto('http://127.0.0.1:5598/?harness=1');await waitScene(p,'title');const state=shop(legacy),checkpoint=makeCheckpoint(state,[]),slotKey=r2ModeStorageKey(state,state.contentHash);await p.evaluate(({checkpoint,slotKey})=>new Promise((resolve,reject)=>{const open=indexedDB.open('tangsongpai-checkpoints',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const tx=open.result.transaction('saves','readwrite'),store=tx.objectStore('saves');store.put({current:checkpoint,previous:null},slotKey);store.put({revision:1,slotKey},'meta');tx.oncomplete=()=>{open.result.close();resolve();};tx.onerror=()=>reject(tx.error);};}),{checkpoint,slotKey});await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',width===390);await waitScene(p,'shop');
  await p.locator('.run-menu-toggle').click();const more=p.locator('.run-menu-more');if(!await more.evaluate(e=>e.open))await more.locator('summary').click();await p.locator('[data-menu-action="viewRules"]').click();
  if(legacy){await p.getByRole('button',{name:'启用动态挑战',exact:true}).click();const text=await p.locator('dialog[open]').last().innerText();assert.match(text,/从第 10 章开始/);await p.screenshot({path:`${out}/${width}-legacy-choice.png`});await p.getByRole('button',{name:'保留当前规则',exact:true}).click();assert.equal(await p.evaluate(()=>window.__harness.game.registry.get('runController').state.dynamicEndless),undefined);await p.locator('[data-menu-action="viewRules"]').click();await p.getByRole('button',{name:'启用动态挑战',exact:true}).click();await p.getByRole('button',{name:'启用动态挑战',exact:true}).last().click();await p.waitForFunction(()=>window.__harness.game.registry.get('runController').state.dynamicEndless?.status==='pending');row.activation=await p.evaluate(()=>window.__harness.game.registry.get('runController').state.dynamicEndless.fromStage);assert.equal(row.activation,27);}
  else{await p.getByRole('button',{name:'本章对手与规则',exact:true}).click();const text=await p.locator('dialog[open]').last().innerText();assert.ok((text.match(/待定/g)||[]).length>=2);row.presentation=text;await p.screenshot({path:`${out}/${width}-dynamic-targets.png`});}
  assert.deepEqual(row.errors,[]);row.status='PASS';
 }finally{await p.close();}
}report.status='PASS';}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}finally{await browser.close();await server.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
