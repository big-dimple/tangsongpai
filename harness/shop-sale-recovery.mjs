import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {tapUI,waitScene} from './ui.mjs';
// Isolated checkpoints only: failed capacity and failed-save recovery must preserve state.
const output=process.env.SALE_RECOVERY_OUTPUT??'/tmp/shop-sale-recovery';await mkdir(output,{recursive:true});
const port=5797,server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});const report=[];
const send=(s,action)=>applyCommand(s,{runId:s.runId,commandId:s.runId+'/command/'+(s.commandSeq+1),expectedSeq:s.commandSeq,action});
try{for(const spec of [{width:1366,height:768},{width:390,height:844},{width:320,height:568}])for(const mode of ['capacity','quota']){
 const touch=spec.width<500,ctx=await browser.newContext({viewport:spec,hasTouch:touch,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],row={viewport:spec,mode};p.on('pageerror',e=>errors.push(String(e.stack||e)));report.push(row);p.setDefaultTimeout(20000);
 try{
  let state=createRun({seed:'sell-recovery',runId:'controlled/sell-recovery',characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
  for(const action of [{type:'LeaveShop'},{type:'SkipStage'},{type:'OpenShop'}]){const r=send(state,action);assert.ok(r.ok,r.code);state=r.state;}
  state.gold=40;state.jokers=(mode==='capacity'?['e09','b03']:['e05','e06','e11','b03']).map((id,i)=>r2CreateJoker(id,'recovery/held/'+i,8,'none',state));
  if(mode==='capacity')state.consumables=['T01','T02','T03'].map((definitionId,i)=>({instanceId:'recovery/tool/'+i,definitionId}));
  const cp=makeCheckpoint(state,[]);assert.ok(readCheckpoint(cp).ok);
  await p.route('**/__sell-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await p.goto(`http://127.0.0.1:${port}/__sell-bootstrap`);await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},cp);
  await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'shop');await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  const snap=()=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};});const before=await snap();assert.deepEqual(before.state,state);
  if(touch)await tapUI(p,'shop','action/toggle-owned',touch);await tapUI(p,'shop','joker/recovery/held/0',touch);await p.getByRole('button',{name:'出售',exact:true}).click();await p.locator('.detail-dialog[data-shop-context=sale][open]').waitFor();
  if(mode==='quota')await p.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts'),storage=gameSession().storage;window.__saleCommit=storage.commit.bind(storage);window.__saleWrites=0;storage.commit=async(...args)=>{window.__saleWrites++;throw new DOMException('controlled quota','QuotaExceededError');};});
  await p.getByRole('button',{name:'确认出售',exact:true}).click();
  if(mode==='capacity'){
   const blocked=send(state,{type:'SellJoker',instanceId:'recovery/held/0'});assert.ok(!blocked.ok);assert.equal(blocked.code,'over-capacity-after-sale');const dialog=p.getByRole('dialog',{name:'操作未提交'});await dialog.waitFor();const copy=await dialog.innerText();assert.ok(copy.includes('道具箱超出容量'));assert.ok(copy.includes('使用或销毁多余道具'));assert.deepEqual(await snap(),before);await p.screenshot({path:`${output}/${spec.width}-${mode}.png`});await p.getByRole('button',{name:'关闭',exact:true}).click();
  }else{
   await p.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='paused');assert.deepEqual(await snap(),before);assert.equal(await p.evaluate(()=>window.__saleWrites),1);
   if(!await p.locator('.run-menu-modal').evaluate(e=>e.open))await p.locator('.run-menu-toggle').click();await p.getByRole('button',{name:'重试保存',exact:true}).waitFor();await p.screenshot({path:`${output}/${spec.width}-${mode}.png`});
   await p.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts');gameSession().storage.commit=window.__saleCommit;});await p.getByRole('button',{name:'重试保存',exact:true}).click();await waitScene(p,'shop');await p.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='idle'&&window.__harness.game.scene.getScene('shop').ready);
   const after=await snap(),expected=applyCommand(state,after.journal.at(-1));assert.ok(expected.ok,expected.code);assert.deepEqual(after.state,expected.state);assert.equal(after.state.gold,44);assert.equal(after.state.jokers.length,state.jokers.length-1);assert.equal(after.journal.length,before.journal.length+1);assert.equal(after.journal.at(-1).action.instanceId,'recovery/held/0');row.committedSeq=after.state.commandSeq;
  }
  const final=await snap();await p.reload();await waitScene(p,'title');await p.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='idle');assert.deepEqual(await snap(),final);assert.deepEqual(errors,[]);row.status='PASS';console.log(spec.width,mode,'PASS');
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);console.log(spec.width,mode,'FAIL',row.error);await p.screenshot({path:`${output}/${spec.width}-${mode}-FAIL.png`}).catch(()=>{});}finally{await ctx.close();await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();}if(report.some(r=>r.status!=='PASS'))process.exitCode=1;
