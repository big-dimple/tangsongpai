import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build,preview} from 'vite';
import {chromium} from 'playwright';
import {chooseCharacter,openRunMenu,openSelector,tapUI,confirmHeroRoute,waitScene} from './ui.mjs';
const out=process.env.MENU_OUT??'shots/player-menu-entry',only=process.env.MENU_CASES?.split(',');fs.mkdirSync(out,{recursive:true});
const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceStatus:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),cases:[]};
if(!process.env.MENU_REUSE_BUILD)await build({mode:'e2e',build:{outDir:out+'/build'},logLevel:'error'});
report.buildInfo=JSON.parse(fs.readFileSync(out+'/build/build-info.json','utf8'));
const server=await preview({build:{outDir:out+'/build'},preview:{host:'127.0.0.1',port:5198,strictPort:true},logLevel:'error'}),browser=await chromium.launch({channel:'msedge'});report.browser=browser.version();
const url='http://127.0.0.1:5198/?harness=1&seed=player-menu-1',hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const forbidden=/写入权|接管|候选|导出|导入|版本信息|回看上一手|进度与存档|本局与版本/;
const state=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return c?{state:c.state,journal:c.journal,slots:await c.store.read(),status:c.status}:null;});
const saved=p=>p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('tangsongpai-checkpoints',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly'),s=tx.objectStore('saves'),m=s.get('meta');let result={meta:null,slots:null};m.onsuccess=()=>{result.meta=m.result??null;if(m.result){const q=s.get(m.result.slotKey);q.onsuccess=()=>result.slots=q.result;}};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}});
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png'});
const boot=async(context)=>{const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>{report.pageErrors??=[];report.pageErrors.push(String(e));});await p.goto(url);await waitScene(p,'title');return p;};
const menu=async p=>{await openRunMenu(p,true);await p.locator('#run-menu-modal').waitFor({state:'visible'});assert.doesNotMatch(await p.locator('.run-menu-panel').innerText(),forbidden);};
const close=p=>p.locator('.run-menu-toggle').tap();
const metrics=async p=>{const m=await p.evaluate(()=>{const panel=document.querySelector('.run-menu-panel'),b=panel.getBoundingClientRect(),buttons=[...panel.querySelectorAll('button')].filter(x=>!x.hidden&&x.getBoundingClientRect().width).map(x=>{const r=x.getBoundingClientRect();return {text:x.textContent,x:r.x,width:r.width,height:r.height};});return {viewport:{width:innerWidth,height:innerHeight},panel:{x:b.x,y:b.y,width:b.width,height:b.height,clientWidth:panel.clientWidth,scrollWidth:panel.scrollWidth},buttons};});assert.ok(m.panel.scrollWidth<=m.panel.clientWidth+1);for(const b of m.buttons){assert.ok(b.x>=m.panel.x-1&&b.x+b.width<=m.panel.x+m.panel.width+1,b.text);assert.ok(b.height>=44,b.text);}const primary=m.buttons.filter(b=>['继续游戏','在这里继续','新开一局'].includes(b.text));assert.ok(primary.every(b=>Math.abs(b.width-primary[0].width)<1));return m;};
async function run(name,action){if(only&&!only.includes(name))return;console.log(name);const row={name};report.cases.push(row);try{await action(row);row.status='PASS';console.log(name,'PASS');}catch(e){row.status='FAIL';row.error=String(e.stack??e);throw e;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}}
try{
 await run('empty-and-concurrent',async row=>{
  const c=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true}),a=await boot(c),b=await boot(c);
  for(const p of [a,b]){assert.equal(await p.locator('.run-menu-modal').evaluate(e=>e.open),false);assert.deepEqual((await p.evaluate(()=>navigator.locks.query())).held,[]);assert.equal((await saved(p)).meta,null);}
  await menu(a);assert.equal(await a.getByRole('button',{name:'继续游戏',exact:true}).isVisible(),false);row.empty=await metrics(a);await shot(a,'fresh-pc');await close(a);
  await chooseCharacter(b,'amo',true);const first=await state(b);assert.equal(first.status,'idle');row.firstSave=hash(first.slots);
  const d=await boot(c);assert.equal((await state(d)).status,'readonly');assert.equal(await d.locator('.run-menu-modal').evaluate(e=>e.open),false);await menu(d);await shot(d,'real-other-page');
  await d.getByRole('button',{name:'在这里继续',exact:true}).tap();await waitScene(d,'shop');const continued=await state(d);assert.deepEqual(continued.slots,first.slots);assert.equal(continued.status,'idle');await b.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='readonly');
  await tapUI(b,'shop','action/start-stage',true);assert.deepEqual((await state(d)).slots,first.slots);row.oldPageProtected=true;
  const home=await boot(c);assert.equal((await state(home)).status,'readonly');await tapUI(home,'title','action/title-continue',true);await waitScene(home,'shop');assert.deepEqual((await state(home)).slots,first.slots);row.homeContinueOneAction=true;await home.close();await d.close();
  const e=await boot(c);assert.equal((await state(e)).status,'idle');assert.deepEqual((await state(e)).slots,first.slots);row.closedOwnerRecovered=true;
  await menu(e);row.withRun=await metrics(e);await shot(e,'saved-pc');await e.getByRole('button',{name:'新开一局',exact:true}).tap();await waitScene(e,'character-select');
  await tapUI(e,'character-select','character/erxiang',true);await confirmHeroRoute(e,true);await e.getByRole('button',{name:'确认开始新局',exact:true}).waitFor();assert.deepEqual(await saved(e),await saved(b));await e.getByRole('button',{name:'取消',exact:true}).tap();assert.deepEqual((await state(e)).slots,first.slots);row.newRunCancelPreserves=true;await shot(e,'new-run-confirm-cancelled');
  await c.close();
 });
 for(const [width,height] of [[390,844],[320,640]])await run('menu-'+width,async row=>{
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),p=await boot(c);await menu(p);row.fresh=await metrics(p);await shot(p,'fresh-'+width);
  const before=await saved(p);await p.getByLabel('背景音量',{exact:true}).focus();await p.getByLabel('背景音量',{exact:true}).press('Home');await p.getByRole('checkbox',{name:'减少动态',exact:true}).check();assert.deepEqual(await saved(p),before);
  await p.locator('.run-menu-more>summary').tap();row.more=await metrics(p);await shot(p,'more-'+width);await close(p);await p.reload();await waitScene(p,'title');await menu(p);assert.equal(await p.getByLabel('背景音量',{exact:true}).inputValue(),'0');assert.equal(await p.getByRole('checkbox',{name:'减少动态',exact:true}).isChecked(),true);row.settingsPersist=true;await close(p);
  await chooseCharacter(p,'amo',true);await menu(p);row.saved=await metrics(p);await shot(p,'saved-'+width);await c.close();
 });
 await run('storage-denied-retry',async row=>{
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await c.addInitScript(()=>{window.__menuFault=true;const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){if(window.__menuFault)throw new DOMException('denied','SecurityError');return open.apply(this,args);};});
  const p=await boot(c);await menu(p);assert.match(await p.locator('.run-menu-status').innerText(),/无法保存/);assert.doesNotMatch(await p.locator('.run-menu-status').innerText(),/另一页|写入|接管/);await shot(p,'storage-denied');await p.evaluate(()=>window.__menuFault=false);await p.getByRole('button',{name:'重试读取',exact:true}).tap();await p.getByRole('button',{name:'新开一局',exact:true}).waitFor({state:'visible'});assert.equal(await p.getByRole('button',{name:'新开一局',exact:true}).isEnabled(),true);await close(p);await chooseCharacter(p,'amo',true);assert.equal((await state(p)).status,'idle');row.samePageRecovered=true;await c.close();
 });
 await run('quota-retry',async row=>{
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await c.addInitScript(()=>{window.__menuFault=true;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(window.__menuFault)throw new DOMException('quota','QuotaExceededError');return put.apply(this,args);};});const p=await boot(c);
  await openSelector(p,true);await tapUI(p,'character-select','character/amo',true);await confirmHeroRoute(p,true);await menu(p);await p.getByRole('button',{name:'重试保存',exact:true}).waitFor();assert.equal((await saved(p)).meta,null);await shot(p,'quota-pending');await p.evaluate(()=>window.__menuFault=false);await p.getByRole('button',{name:'重试保存',exact:true}).tap();await waitScene(p,'shop');const after=await state(p);assert.equal(after.slots.revision,1);assert.equal(after.state.commandSeq,1);row.savedOnce=true;await c.close();
 });
 await run('lock-api-denied-cas',async row=>{
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await c.addInitScript(()=>{LockManager.prototype.request=()=>Promise.reject(new DOMException('denied','SecurityError'));});const a=await boot(c);await chooseCharacter(a,'amo',true);const b=await boot(c);assert.equal((await state(b)).status,'idle');await menu(b);assert.doesNotMatch(await b.locator('.run-menu-status').innerText(),/另一页|写入|接管/);await close(b);
  const sent=await a.evaluate(()=>window.__harness.game.registry.get('runController').dispatch({type:'LeaveShop'}));assert.equal(sent.ok,true);const current=await saved(a);const refused=await b.evaluate(()=>window.__harness.game.registry.get('runController').dispatch({type:'LeaveShop'}));assert.equal(refused.ok,false);assert.equal(refused.code,'read-only');assert.deepEqual(await saved(b),current);row.revisionConflictProtected=true;await menu(b);await shot(b,'cas-conflict');await c.close();
 });
 assert.deepEqual(report.pageErrors??[],[]);report.status='PASS';console.log('player-menu-entry PASS');
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}
