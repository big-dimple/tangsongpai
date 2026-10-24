import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {waitScene,tapUI} from './ui.mjs';
const out='docs/production/evidence/q2-growth-2026-10-21/ui-detail';await mkdir(out,{recursive:true});
const cache=await mkdtemp(path.join(tmpdir(),'q2-detail-vite-'));
const server=await createServer({mode:'e2e',cacheDir:cache,server:{host:'127.0.0.1',port:5745,strictPort:true},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const cp=JSON.parse(gunzipSync(await readFile('docs/production/evidence/q2-growth-2026-10-21/checkpoints.json.gz')).toString());
function noHistory(route,id){let s=createRun({seed:route==='straight'?'policy-valid-groups':'policy-valid-suit',runId:'q2-no-history/'+route,characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang',route),openingRoute:route});const command={runId:s.runId,commandId:s.runId+'/buy',expectedSeq:s.commandSeq,action:{type:'BuyOffer',offerId:s.shop.offers.find(o=>o.definitionId===id).offerId}};const r=applyCommand(s,command);assert.ok(r.ok,r.code);return makeCheckpoint(r.state,[command]);}
const sourceFile='src/game/JokerGrowthCausality.ts',sourceHash=createHash('sha256').update(await readFile(sourceFile)).digest('hex');
const report={status:'RUNNING',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source:{file:sourceFile,sha256:sourceHash},scope:'Controlled saved checkpoints written with validated IndexedDbSave.commit before application boot. Actual Continue, pointer/touch detail activation and close, native scroll and cold continue. No new plays, no natural acquisition or physical-device claim.',cases:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});report.browser=browser.version();let active;
const snap=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read(),local:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))};});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function ready(p,scene){await waitScene(p,scene);await p.waitForFunction(scene=>{const s=window.__harness.game.scene.getScene(scene);return s.ready&&!s.playing&&!s.presentation;},scene);await p.evaluate(()=>document.fonts.ready);}
async function inspect(p,spec,touch,key){
 const before=await snap(p),j=before.state.jokers.find(j=>j.definitionId===spec.id);assert.ok(j);
 if(touch&&spec.scene==='shop'){
  await tapUI(p,'shop','action/build',true);
  const all=p.getByRole('button',{name:'查看全部现货与持牌',exact:true});if(await all.count())await all.tap();
  await p.getByRole('button',{name:'查看来源与成长',exact:true}).tap();
 }else await tapUI(p,spec.scene,'joker/'+j.instanceId,touch);
 const entry=p.getByRole('button',{name:'加成从哪来',exact:true});await entry.waitFor();
 const bounds=await entry.boundingBox();assert.ok(bounds.height>=44);if(touch)await entry.tap();else await entry.click();
 const d=p.locator('.detail-dialog[open]');await d.waitFor();const body=await d.innerText();
 for(const text of spec.expected)assert.ok(body.includes(text),text);assert.ok(!/上手|下手|这手|每手|预计/.test(body));
 const geometry=await d.evaluate(d=>{const r=d.getBoundingClientRect(),s=d.querySelector('.dialog-scroll'),close=d.querySelector('.dialog-close').getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,fontSize:getComputedStyle(s).fontSize,close:{x:close.x,y:close.y,width:close.width,height:close.height,right:close.right,bottom:close.bottom}};});
 const viewport=p.viewportSize();assert.ok(geometry.x>=0&&geometry.right<=viewport.width+1&&geometry.y>=0&&geometry.bottom<=viewport.height+1);assert.ok(geometry.scrollWidth<=geometry.clientWidth+1);assert.ok(geometry.close.height>=44&&geometry.close.bottom<=viewport.height+1);
 const top=key+'-top.png';await p.screenshot({path:out+'/'+top,scale:'css'});
 const scroll=d.locator('.dialog-scroll'),box=await scroll.boundingBox();
 for(let i=0;i<10;i++){if(await scroll.evaluate(s=>s.scrollTop+s.clientHeight>=s.scrollHeight-2))break;await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,Math.max(100,box.height*.8));await p.waitForTimeout(80);}
 assert.equal(await scroll.evaluate(s=>s.scrollTop+s.clientHeight>=s.scrollHeight-2),true);
 const bottom=touch?key+'-bottom.png':null;if(bottom)await p.screenshot({path:out+'/'+bottom,scale:'css'});
 assert.deepEqual(await snap(p),before,'view/scroll cannot consume or write');const close=d.locator('.dialog-close');if(touch)await close.tap();else await close.click();await d.waitFor({state:'detached'});assert.deepEqual(await snap(p),before,'cancel/close cannot consume or write');
 return {body,entryBounds:bounds,geometry,top,bottom,entireScrollReached:true,saveJournalRngAndStorageUnchanged:true,savedHash:digest(before)};
}
try{
 const fixtures=[{key:'c04-shop',id:'c04',scene:'shop',checkpoint:cp['current-straight-shop'],expected:['当前已攒热度加成：+10','上次出牌实际用到热度加成：+0','上次出牌结算后新增热度加成：+10']},{key:'c06-table',id:'c06',scene:'game',checkpoint:cp['current-flush-final'],expected:['当前已攒倍率加成：+0.5','上次出牌：高牌','上次出牌实际用到倍率加成：+0.5','上次出牌结算后没有新增成长']}];
 if(process.env.Q2_DETAIL_REUSE_DESKTOP){
  const prior=JSON.parse(await readFile(process.env.Q2_DETAIL_REUSE_DESKTOP,'utf8'));assert.equal(prior.source.sha256,sourceHash);
  const passed=prior.cases.filter(c=>c.viewport.width===1366&&c.status==='PASS');assert.equal(passed.length,3);report.cases.push(...passed);report.reusedDesktopFrom=process.env.Q2_DETAIL_REUSE_DESKTOP;
 }
 for(const viewport of (process.env.Q2_DETAIL_REUSE_DESKTOP?[{width:390,height:844}]:[{width:1366,height:900},{width:390,height:844}])){
  const touch=viewport.width<700;
  for(const spec of [...fixtures,{key:'no-history',id:touch?'c04':'c06',scene:'shop',checkpoint:touch?noHistory('straight','c04'):noHistory('flush','c06'),expected:['加成：+0','还没有这张牌的出牌记录']}]){
   assert.equal(readCheckpoint(spec.checkpoint).ok,true);const context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:touch?2:1}),p=await context.newPage();active=p;p.setDefaultTimeout(30000);
   const row={key:viewport.width+'-'+spec.key,id:spec.id,viewport,touch,checkpointChecksum:spec.checkpoint.checksum,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
   await p.route('**/__q2-setup',route=>route.fulfill({contentType:'text/html',body:'<html>Controlled Q2 saved checkpoint setup</html>'}));await p.goto('http://127.0.0.1:5745/__q2-setup');
   await p.evaluate(async checkpoint=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,checkpoint,null);},spec.checkpoint);
   await p.goto('http://127.0.0.1:5745/?harness=1',{waitUntil:'domcontentloaded'});await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);
   await ready(p,spec.scene);assert.deepEqual((await snap(p)).state,spec.checkpoint.state);row.detail=await inspect(p,spec,touch,row.key);
   const before=await snap(p);await p.reload({waitUntil:'domcontentloaded'});await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await ready(p,spec.scene);assert.deepEqual(await snap(p),before);row.coldRestoreUnchanged=true;
   if(spec.key!=='no-history')row.restoredDetail=await inspect(p,spec,touch,row.key+'-restored');assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.key);await context.close();active=undefined;
  }
 }
 assert.equal(createHash('sha256').update(await readFile(sourceFile)).digest('hex'),sourceHash);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);if(active)await active.screenshot({path:out+'/FAIL-'+Date.now()+'.png'}).catch(()=>{});}
finally{await writeFile(out+'/'+(report.status==='FAIL'?'FAIL-'+Date.now():'report')+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();await rm(cache,{recursive:true,force:true});console.log(report.status);}
