/** A saved sale with a target-sensitive Joker must not blank the shop or its restored save. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {tapUI,waitScene} from './ui.mjs';
const out=process.env.SALE_PREVIEW_OUTPUT??'/tmp/shop-sale-preview-recovery',port=Number(process.env.SALE_PREVIEW_PORT??5806);await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {recommendationEvidenceFixture}=await server.ssrLoadModule('/harness/fixtures/recommendation-evidence.ts');
const {r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']}),report=[];
try{for(const spec of [{width:320,height:568},{width:390,height:844},{width:1366,height:768}]){
 const touch=spec.width<500,ctx=await browser.newContext({viewport:spec,hasTouch:touch,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],row={viewport:spec};report.push(row);p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  const state=recommendationEvidenceFixture('group');state.jokers=['d07','e06','e11','b09','f11'].map((id,i)=>r2CreateJoker(id,'preview-crash/held/'+i,8,'none',state));const checkpoint=makeCheckpoint(state,[]),valid=readCheckpoint(checkpoint);assert.ok(valid.ok,valid.code);assert.ok(state.shop.offers.some(o=>o.definitionId==='f06'));
  await p.route('**/__sale-preview-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await p.goto(`http://127.0.0.1:${port}/__sale-preview-bootstrap`);await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
  const enter=async()=>{await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'shop');await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);};
  const snap=()=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};});
  await p.goto(`http://127.0.0.1:${port}/?harness=1`);await enter();const before=await snap(),dom=async button=>touch?button.tap():button.click();assert.deepEqual(before.state,state);
  const offer=state.shop.offers.find(o=>o.definitionId==='f06');await tapUI(p,'shop','offer/'+offer.offerId,touch);await dom(p.getByRole('button',{name:'比较替换',exact:true}));await p.locator('.shop-comparison-dialog[open]').waitFor();assert.equal(await p.locator('.shop-compare-slot').count(),5);assert.deepEqual(await snap(),before,'comparison must remain read-only');await dom(p.getByRole('button',{name:'返回现货',exact:true}));if(touch)await tapUI(p,'shop','action/toggle-owned',true);
  if(touch){const point=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),b=s.geometry().slots[0],r=s.game.canvas.getBoundingClientRect(),q=s.cameras.main.matrix.transformPoint(b.x+2,b.y+b.height/2);return{x:r.left+q.x*r.width/s.scale.width,y:r.top+q.y*r.height/s.scale.height};});await p.touchscreen.tap(point.x,point.y);}else await tapUI(p,'shop','joker/preview-crash/held/0',false);
  await p.locator('.detail-dialog[data-shop-context=held][open]').waitFor();assert.deepEqual(await snap(),before);await dom(p.getByRole('button',{name:'出售',exact:true}));await p.locator('.detail-dialog[data-shop-context=sale][open]').waitFor();await dom(p.getByRole('button',{name:'确认出售',exact:true}));
  await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,before.state.commandSeq);await p.locator('.detail-dialog[data-shop-context=sale][open]').waitFor({state:'detached'});await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  const after=await snap(),expected=applyCommand(before.state,after.journal.at(-1));assert.ok(expected.ok,expected.code);assert.deepEqual(after.state,expected.state);assert.equal(after.state.gold,before.state.gold+4);assert.equal(after.state.jokers.length,4);assert.equal(after.journal.length,before.journal.length+1);assert.equal(after.journal.at(-1).action.instanceId,'preview-crash/held/0');assert.ok(readCheckpoint(makeCheckpoint(after.state,[])).ok);
  const ui=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop');return{active:s.scene.isActive(),objects:s.view.root.length};});assert.ok(ui.active&&ui.objects>10);await p.screenshot({path:`${out}/${spec.width}-after.png`});
  await p.reload();await enter();assert.deepEqual(await snap(),after,'saved sale can be restored without another transaction');assert.deepEqual(errors,[]);await p.screenshot({path:`${out}/${spec.width}-restored.png`});row.status='PASS';row.seq=after.state.commandSeq;row.gold=after.state.gold;row.objects=ui.objects;console.log(spec.width,'PASS');
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);console.log(spec.width,'FAIL',row.error);await p.screenshot({path:`${out}/${spec.width}-FAIL.png`}).catch(()=>{});}finally{await ctx.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();}
if(report.some(r=>r.status!=='PASS'))process.exitCode=1;
