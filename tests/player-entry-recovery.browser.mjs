// Real IndexedDB, Web Locks and page reloads; only the stalled read is fault-injected.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),mode:'e2e',server:{host:'127.0.0.1',port:5621,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH}),context=await browser.newContext({viewport:{width:390,height:740},hasTouch:true}),page=await context.newPage();
const url='http://127.0.0.1:5621/__session_probe';await page.route('**/__session_probe',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Session recovery probe</title>'}));
const report=[];
try{
 await page.goto(url);
 const first=await page.evaluate(async()=>{const {GameSession}=await import('/src/game/session.ts');const s=new GameSession();await s.initialize();const empty=!s.run;const r=await s.start('browser-first','amo');return {empty,seed:r?.state.seed,status:r?.status};});assert.deepEqual(first,{empty:true,seed:'browser-first',status:'idle'});report.push('no save: persistent first launch');
 await page.reload();
 const second=await page.evaluate(async()=>{const {GameSession}=await import('/src/game/session.ts');const s=new GameSession();await s.initialize();const old=s.state()?.seed;const r=await s.start('browser-second','amo');return {old,seed:r?.state.seed,status:r?.status};});assert.deepEqual(second,{old:'browser-first',seed:'browser-second',status:'idle'});report.push('unfinished old run: new launch without exit');
 await page.reload();
 const temporary=await page.evaluate(async()=>{const {GameSession}=await import('/src/game/session.ts');const s=window.probe=new GameSession();window.diskBefore=JSON.stringify(await s.storage.read());s.storage.read=()=>new Promise((resolve,reject)=>{window.lateResolve=resolve;window.lateReject=reject;});window.boot=s.initialize();const busy=s.working;const r=await s.start('browser-temporary','amo');return {busy,seed:r?.state.seed,status:r?.status,notice:s.notice,writable:s.lease.writable};});assert.equal(temporary.busy,false);assert.equal(temporary.seed,'browser-temporary');assert.equal(temporary.status,'idle');assert.equal(temporary.writable,true);assert.match(temporary.notice,/刷新会丢失/);report.push('hung restore: immediate playable memory launch');
 const late=await page.evaluate(async()=>{const s=window.probe;window.lateResolve(JSON.parse(window.diskBefore));await window.boot;const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const disk=await new IndexedDbSave().read();return {seed:s.state()?.seed,status:s.run?.status,unchanged:JSON.stringify(disk)===window.diskBefore,working:s.working};});assert.deepEqual(late,{seed:'browser-temporary',status:'idle',unchanged:true,working:false});report.push('late restore: memory run and original disk preserved');
 await page.reload();
 const recovered=await page.evaluate(async()=>{const {GameSession}=await import('/src/game/session.ts');const s=new GameSession();await s.initialize();const restored=s.state()?.seed;const r=await s.start('browser-recovered','amo');const command=await r.dispatch({type:'LeaveShop'});return {restored,seed:r.state.seed,phase:r.state.phase,ok:command.ok};});assert.equal(recovered.restored,'browser-second');assert.equal(recovered.seed,'browser-recovered');assert.equal(recovered.ok,true);
 await page.reload();
 const refreshed=await page.evaluate(async()=>{const {GameSession}=await import('/src/game/session.ts');const s=new GameSession();await s.initialize();return {seed:s.state()?.seed,phase:s.state()?.phase,status:s.run?.status};});assert.deepEqual(refreshed,{seed:'browser-recovered',phase:recovered.phase,status:'idle'});report.push('refresh: old save after temporary play, new durable run after recovery');
 console.log(JSON.stringify({status:'PASS',browser:browser.version(),cases:report},null,2));
}finally{await browser.close();await server.close();}
