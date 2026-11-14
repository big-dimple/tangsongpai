import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {openSelector,tapUI} from './ui.mjs';

const out=process.env.SELECTION_ENTRANCE_OUT??'shots/selection-entrance';
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5576,strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const report={cases:[],errors:[]};
const selector='.qiyu-entrance-burst-canvas.is-select';
try {
 for(const [width,height] of [[1920,1080],[390,844]])for(const reduced of [false,true]){
  const touch=width<700,context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  const row={width,height,touch,reduced,heroes:[],maxConcurrent:0};report.cases.push(row);
  await page.goto('http://127.0.0.1:5576/?harness=1&seed=selection-entrance');
  await openSelector(page,touch);
  await page.evaluate(()=>{window.__entranceCounts={max:0,mounts:0};new MutationObserver(records=>{const n=document.querySelectorAll('.qiyu-entrance-burst-canvas.is-select').length;window.__entranceCounts.max=Math.max(window.__entranceCounts.max,n);for(const r of records)for(const a of r.addedNodes)if(a.nodeType===1&&a.matches('.qiyu-entrance-burst-canvas.is-select'))window.__entranceCounts.mounts++;}).observe(document.body,{childList:true});});
  for(const [index,id] of ['amo','touye','laohuan','amo'].entries()){
   await tapUI(page,'character-select','character/'+id,touch);
   assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').selectedId),id);
   if(reduced){assert.equal(await page.locator(selector).count(),0,'reduced motion suppresses the cut-in');}
   else {
    const host=page.locator(selector);await host.waitFor({state:'attached',timeout:1500});
    assert.equal(await host.count(),1);assert.equal(await host.getAttribute('aria-hidden'),'true');
    assert.equal(await host.evaluate(n=>getComputedStyle(n).pointerEvents),'none','cut-in must not intercept clicks');
    await page.waitForTimeout(160);
    await page.screenshot({path:`${out}/${width}-${index}-${id}.png`,scale:'css'});
    await host.waitFor({state:'detached',timeout:2500});
   }
   row.heroes.push(id);
  }
  // Real consecutive pointer/touch input while the previous cut-in is still playing.
  for(const id of ['touye','xiemu','laohuan'])await tapUI(page,'character-select','character/'+id,touch);
  assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').selectedId),'laohuan');
  const counts=await page.evaluate(()=>window.__entranceCounts);row.maxConcurrent=counts.max;row.mounts=counts.mounts;
  if(reduced){assert.equal(counts.mounts,0);}else{
   assert.equal(counts.mounts,7,'one entrance for each actual hero change, including rapid changes');
   assert.equal(counts.max,1,'rapid changes do not stack animation layers');
   await page.locator(selector).waitFor({state:'detached',timeout:2500});
  }
  await tapUI(page,'character-select','action/confirm-character',touch);
  await tapUI(page,'character-select','route/straight',touch);
  assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').selectedRoute),'straight','route controls remain usable');
  assert.equal((await page.evaluate(()=>window.__entranceCounts)).mounts,counts.mounts,'route selection does not start a hero cut-in');
  assert.equal(await page.locator(selector).count(),0);
  await page.screenshot({path:`${out}/${width}-${reduced?'reduced':'route'}.png`,scale:'css'});
  row.status='PASS';await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await server.close();console.log(JSON.stringify(report));}
