/** A real short card tap must not become an action in the dialog it opens. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {tapUI,waitScene} from './ui.mjs';

const out=process.env.OWNED_GUARD_OUTPUT??'/tmp/shop-owned-open-guard';
const port=Number(process.env.OWNED_GUARD_PORT??5803);await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const runId='natural/sale/laohuan/1';let initial=createRun({seed:runId,runId,characterId:'laohuan',rulesVersion:'r2',r2Identity:newRunIdentity('laohuan','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});const journal=[];
const actions=[{type:'BuyOffer',offerId:runId+'/shop/0/0/joker/0'},{type:'LeaveShop'},{type:'EnterStage'},{type:'PlayHand',selectedIds:['hearts-9','hearts-14','clubs-14','diamonds-9']},{type:'PlayHand',selectedIds:['spades-4','hearts-4']},{type:'OpenShop'},{type:'BuyOffer',offerId:runId+'/shop/1/0/joker/0'}];
for(const action of actions){const command={runId,commandId:runId+'/command/'+(initial.commandSeq+1),expectedSeq:initial.commandSeq,action},result=applyCommand(initial,command);assert.ok(result.ok,result.code);initial=result.state;journal.push(command);}
assert.equal(initial.phase,'shop');assert.equal(initial.jokers.length,2);const checkpoint=makeCheckpoint(initial,journal);assert.ok(readCheckpoint(checkpoint).ok);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});const report=[];
try{for(const spec of [{width:320,height:568},{width:390,height:844},{width:1366,height:768}]){
 const touch=spec.width<500,context=await browser.newContext({viewport:spec,hasTouch:touch,reducedMotion:'reduce'}),p=await context.newPage(),errors=[],row={viewport:spec};report.push(row);p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  await p.route('**/__owned-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await p.goto(`http://127.0.0.1:${port}/__owned-bootstrap`);await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
  const enter=async()=>{await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'shop');await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);};
  const snap=()=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};});
  const press=async button=>touch?button.tap():button.click();
  const verifyCommand=async before=>{await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,before.state.commandSeq);await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);const after=await snap(),command=after.journal.at(-1),expected=applyCommand(before.state,command);assert.ok(expected.ok,expected.code);assert.deepEqual(after.state,expected.state);assert.equal(after.journal.length,before.journal.length+1);return after;};
  await p.goto(`http://127.0.0.1:${port}/?harness=1`);await enter();let current=await snap();assert.deepEqual(current.state,initial);if(touch)await tapUI(p,'shop','action/toggle-owned',touch);
  const first=current.state.jokers[0].instanceId,second=current.state.jokers[1].instanceId;
  await tapUI(p,'shop','joker/'+first,touch);await p.locator('.detail-dialog[data-shop-context=held][open]').waitFor();await p.waitForTimeout(150);
  assert.match(await p.locator('.detail-dialog[open]').getAttribute('aria-label'),/第 1 槽/);assert.deepEqual(await snap(),current,'opening the first card must not write or move it');await p.screenshot({path:`${out}/${spec.width}-first.png`});
  const moveRight=p.getByRole('button',{name:'右移',exact:true});if(touch)await press(moveRight);else{await moveRight.focus();await p.keyboard.press('Enter');}current=await verifyCommand(current);assert.equal(current.journal.at(-1).action.type,'ReorderJokers');assert.deepEqual(current.state.jokers.map(j=>j.instanceId),[second,first]);await p.getByRole('button',{name:'左移',exact:true}).waitFor();
  await press(p.getByRole('button',{name:'左移',exact:true}));current=await verifyCommand(current);assert.deepEqual(current.state.jokers.map(j=>j.instanceId),[first,second]);
  await press(p.locator('.detail-dialog[open] .dialog-close'));await tapUI(p,'shop','joker/'+second,touch);await p.locator('.detail-dialog[data-shop-context=held][open]').waitFor();await p.waitForTimeout(150);assert.match(await p.locator('.detail-dialog[open]').getAttribute('aria-label'),/第 2 槽/);assert.deepEqual(await snap(),current,'opening the second card must remain read-only');
  await press(p.getByRole('button',{name:'出售',exact:true}));await p.locator('.detail-dialog[data-shop-context=sale][open]').waitFor();await press(p.getByRole('button',{name:'取消',exact:true}));assert.deepEqual(await snap(),current,'cancelling sale is read-only');
  // A genuine long-press drag remains a single saved reorder.
  const points=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),r=s.game.canvas.getBoundingClientRect();return s.geometry().slots.slice(0,2).map(b=>{const q=s.cameras.main.matrix.transformPoint(b.x+b.width/2,b.y+b.height/2);return{x:r.left+q.x*r.width/s.scale.width,y:r.top+q.y*r.height/s.scale.height};});});
  if(touch){const cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});await p.waitForTimeout(430);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[1],id:1}]});await p.waitForTimeout(50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await p.mouse.move(points[0].x,points[0].y);await p.mouse.down();await p.waitForTimeout(40);await p.mouse.move(points[1].x,points[1].y,{steps:5});await p.mouse.up();}
  current=await verifyCommand(current);assert.equal(current.journal.at(-1).action.type,'ReorderJokers');assert.deepEqual(current.state.jokers.map(j=>j.instanceId),[second,first]);assert.equal(await p.locator('.detail-dialog[open]').count(),0);
  await p.reload();await enter();assert.deepEqual(await snap(),current,'drag reorder survives reload');if(touch)await tapUI(p,'shop','action/toggle-owned',touch);
  await tapUI(p,'shop','joker/'+first,touch);await p.locator('.detail-dialog[data-shop-context=held][open]').waitFor();assert.deepEqual(await snap(),current);await press(p.getByRole('button',{name:'出售',exact:true}));await press(p.getByRole('button',{name:'确认出售',exact:true}));current=await verifyCommand(current);assert.equal(current.journal.at(-1).action.type,'SellJoker');assert.equal(current.journal.at(-1).action.instanceId,first);await p.locator('.detail-dialog[data-shop-context=sale][open]').waitFor({state:'detached'});
  await p.reload();await enter();assert.deepEqual(await snap(),current,'explicit sale survives reload exactly once');assert.deepEqual(errors,[]);row.status='PASS';row.finalSeq=current.state.commandSeq;console.log(spec.width,'PASS');
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);console.log(spec.width,'FAIL',row.error);await p.screenshot({path:`${out}/${spec.width}-FAIL.png`}).catch(()=>{});}finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();}
if(report.some(r=>r.status!=='PASS'))process.exitCode=1;
