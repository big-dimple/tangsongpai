/** Bounded iPad-size regression. Only native touch/mouse/DOM input changes application state. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const dir=path.resolve(process.env.IPAD_EVIDENCE_DIR||'shots/ipad-layout'),port=5218;
const portraitWidth=810,portraitHeight=1080,landscapeWidth=portraitHeight,landscapeHeight=portraitWidth;
const url=`http://127.0.0.1:${port}/?harness=1&seed=ipad-readonly`;
const report={checks:[],input:[],errors:[],requestFailures:[],limitations:['Chromium touch emulation, not physical iPad or Safari/WebKit.','810x984 and 1080x714 are synthetic 96 CSS px browser-chrome budgets, not measured user viewport heights.']};
await mkdir(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','e2e','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser,active;
const state=page=>page.evaluate(()=>{const g=window.__harness.game,c=g.registry.get('runController'),s=g.scene.getScene('game');return {seq:c?.state.commandSeq,phase:c?.state.phase,gold:c?.state.gold,owned:c?.state.jokers.length,selected:[...(s?.selectedIds??[])]};});
const wait=page=>page.waitForTimeout(400);
async function resize(page,width,height){await page.setViewportSize({width,height});await page.waitForFunction(({width,height})=>{const r=document.querySelector('canvas').getBoundingClientRect();return r.width===width&&r.height===height;},{width,height});await wait(page);}
async function objects(page,key){return page.evaluate(key=>{const g=window.__harness.game,s=g.scene.getScene(key),hits=[],texts=[];const walk=list=>{for(const o of list){if(o.input?.enabled)hits.push({name:o.name,...o.getBounds()});if(o.type==='Text')texts.push({name:o.name,text:o.text,id:o.getData('offerId'),...o.getBounds()});if(o.list)walk(o.list);}};walk(s.children.list);const c=g.canvas.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},canvas:{width:c.width,height:c.height},mode:s.view?.layout.mode,hand:s.view?.layout.hand,hits,texts};},key);}
const overlaps=(a,b)=>a.x<b.x+b.width-.01&&b.x<a.x+a.width-.01&&a.y<b.y+b.height-.01&&b.y<a.y+a.height-.01;
async function tap(page,key,name,edge=false){const native=page.locator(`[data-ui="${key}/${name}"]`);if(await native.count())await native.tap();else {const p=await page.evaluate(({key,name,edge})=>{const g=window.__harness.game,s=g.scene.getScene(key);const walk=list=>{for(const o of list){if(o.name===name)return o;const n=o.list&&walk(o.list);if(n)return n;}};const o=walk(s.children.list),h=o?.input?.hitArea;if(!o||!o.input.enabled)throw Error('Missing enabled target '+name);const q=o.getWorldTransformMatrix().transformPoint(h.x+(edge?h.width-4:h.width/2)-o.displayOriginX,h.y+h.height/2-o.displayOriginY),v=s.cameras.main.matrix.transformPoint(q.x-s.cameras.main.scrollX,q.y-s.cameras.main.scrollY),r=g.canvas.getBoundingClientRect();return{x:r.left+v.x*r.width/g.scale.width,y:r.top+v.y*r.height/g.scale.height};},{key,name,edge});report.input.push({key,name,...p});await page.touchscreen.tap(p.x,p.y);}await wait(page);}
async function shot(page,name,key){const data=await objects(page,key);await page.screenshot({path:path.join(dir,name+'.png'),scale:'css'});report.checks.push({name,state:await state(page),...data});return data;}
async function shopCheck(page,name){const data=await shot(page,name,'shop'),offers=data.hits.filter(h=>h.name.startsWith('offer/'));
 for(const hit of data.hits.filter(h=>['action/chapter','action/items'].includes(h.name)))for(const offer of offers)assert.equal(overlaps(hit,offer),false,hit.name+' must not steal a goods hit');
 for(const identity of data.texts.filter(t=>t.name==='shop/offer-identity')){const rows=data.texts.filter(t=>t.id===identity.id&&['shop/offer-identity','shop/offer-purpose','shop/offer-operation','shop/offer-price'].includes(t.name));for(let i=0;i<rows.length;i++)for(const other of rows.slice(i+1))assert.equal(overlaps(rows[i],other),false,rows[i].name+' overlaps '+other.name);}
 assert.deepEqual(data.canvas,data.viewport);return data;
}
async function openShop(page){await page.goto(url);await page.waitForFunction(()=>window.__harness?.game.scene.isActive('title'),null,{timeout:60000});await tap(page,'title','action/title-start');await tap(page,'character-select','character/amo');await tap(page,'character-select','action/confirm-character');await tap(page,'character-select','route/group');await tap(page,'character-select','action/confirm-character');await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));await wait(page);}
try{
 const deadline=Date.now()+30000;while(true){try{if((await fetch(url)).ok)break;}catch{}if(Date.now()>deadline)throw Error('Vite startup timeout');await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch();report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:portraitWidth,height:portraitHeight},deviceScaleFactor:2,hasTouch:true}),page=await context.newPage();active=page;page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('requestfailed',r=>report.requestFailures.push({url:r.url(),failure:r.failure()}));
 await openShop(page);await shopCheck(page,'01-shop-portrait');
 const before=await state(page);await tap(page,'shop','action/chapter',true);await page.getByRole('dialog',{name:'本章节目单',exact:true}).waitFor();assert.deepEqual(await state(page),before);await page.screenshot({path:path.join(dir,'02-chapter-right-edge.png'),scale:'css'});await page.getByRole('dialog',{name:'本章节目单',exact:true}).getByRole('button',{name:/^(暂不选择|关闭)$/}).tap();
 const offer=await page.evaluate(()=>window.__harness.game.registry.get('runController').state.shop.offers[0].offerId);await tap(page,'shop','offer/'+offer);await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:/购买详情/})}).waitFor();assert.deepEqual(await state(page),before);
 const detail=await page.getByRole('dialog').innerText();await resize(page,landscapeWidth,landscapeHeight);assert.equal(await page.getByRole('dialog').innerText(),detail);assert.deepEqual(await state(page),before);await page.getByRole('button',{name:'取消',exact:true}).tap();await shopCheck(page,'03-shop-landscape');
 await resize(page,landscapeWidth,landscapeHeight-96);await shopCheck(page,'04-shop-landscape-chrome');await resize(page,portraitWidth,portraitHeight-96);await shopCheck(page,'05-shop-portrait-chrome');await resize(page,portraitWidth,portraitHeight);
 await tap(page,'shop','offer/'+offer);await page.getByRole('button',{name:'购买 · 4 金',exact:true}).tap();await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,before.seq);await shopCheck(page,'06-shop-owned-portrait');
 await tap(page,'shop','action/start-stage');await page.getByRole('button',{name:'进入暖场 ›',exact:true}).tap();await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').cardViews.length===8);await wait(page);
 const id=await page.evaluate(()=>window.__harness.game.registry.get('runController').state.handOrder[0]);await tap(page,'game','card/'+id);const selected=await state(page);assert.deepEqual(selected.selected,[id]);
 for(const [name,width,height] of [['07-table-portrait',portraitWidth,portraitHeight],['08-table-landscape',landscapeWidth,landscapeHeight],['09-table-landscape-chrome',landscapeWidth,landscapeHeight-96],['10-table-portrait-chrome',portraitWidth,portraitHeight-96]]){
  await resize(page,width,height);assert.deepEqual(await state(page),selected,'resize preserves selected card and run');const data=await shot(page,name,'game');assert.deepEqual(data.canvas,data.viewport);if(width===portraitWidth){assert.equal(data.mode,'portrait');assert.equal(data.hand.width,portraitWidth-24);}
  for(const h of data.hits.filter(h=>h.name.startsWith('card/')||['action/play','action/discard'].includes(h.name))){assert.ok(h.x>=0&&h.y>=0&&h.x+h.width<=width+.1&&h.y+h.height<=height+.1,h.name+' must remain reachable');}
 }
 await tap(page,'game','card/'+id);assert.deepEqual((await state(page)).selected,[]);await tap(page,'game','card/'+id);assert.deepEqual((await state(page)).selected,[id]);
 await context.close();active=undefined;
 // Existing working phone and PC endpoints, one natural chain each; no expanded device matrix.
 for(const [width,height] of [[390,844],[1280,720]]){const c=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:2}),p=await c.newPage();active=p;p.on('pageerror',e=>report.errors.push(String(e)));await openShop(p);await shopCheck(p,`regression-shop-${width}`);await tap(p,'shop','action/start-stage');await p.getByRole('button',{name:'进入暖场 ›',exact:true}).tap();await wait(p);const id=await p.evaluate(()=>window.__harness.game.registry.get('runController').state.handOrder[0]);await tap(p,'game','card/'+id);assert.deepEqual((await state(p)).selected,[id]);await shot(p,`regression-table-${width}`,'game');await c.close();active=undefined;}
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error);if(active&&!active.isClosed()){await active.screenshot({path:path.join(dir,'failure.png'),scale:'css'});report.failureState=await state(active).catch(()=>null);}process.exitCode=1;}
finally{await browser?.close();server.kill('SIGTERM');await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,error:report.error,checks:report.checks.map(c=>c.name),browser:report.browser},null,2));}
