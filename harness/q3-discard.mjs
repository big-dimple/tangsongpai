/** Ordinary discard only: controlled setup reuses the audited journey's exact legal checkpoint. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {point,tapUI,waitScene} from './ui.mjs';

const out=process.env.Q3_DISCARD_OUT??'docs/production/evidence/q3-interaction-2026-10-21/discard-01';
const inputPath='docs/production/evidence/q3-interaction-2026-10-21/final/full-state.json.gz';
await mkdir(out,{recursive:true});
const inputBytes=await readFile(inputPath),journey=JSON.parse(gunzipSync(inputBytes));
const input=journey.cases[0].steps.find(s=>s.actions?.[0]?.type==='PlayHand').before.storage.current;
const hash=async()=>{
 const h=createHash('sha256');
 for(const f of [...execFileSync('git',['ls-files','-z','src'],{encoding:'utf8'}).split('\0').filter(Boolean),'harness/q3-interaction.mjs','harness/q3-discard.mjs']){h.update(f+'\0');h.update(await readFile(f));}
 return h.digest('hex');
};
const sourceHash=await hash();
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHash,input:{path:inputPath,sha256:createHash('sha256').update(inputBytes).digest('hex'),checkpointChecksum:input.checksum,seq:input.state.commandSeq},scope:'Controlled setup imports the preceding natural journey checkpoint using GameSession.importJSON, then reloads and uses native Continue. Subsequent selection/cancel/discard inputs are native Chromium mouse/CDP touch. No edited state/stock/draws, discard-handler calls or synthetic domain dispatch; not a natural-acquisition or physical-phone acceptance claim.',cases:[],status:'RUNNING'};
const server=await createServer({mode:'e2e',cacheDir:'/tmp/q3-discard-vite',server:{host:'127.0.0.1',port:5754,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts'),{readCheckpoint,makeCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
assert.ok(readCheckpoint(input).ok,'reuse validator-approved complete checkpoint');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer']});report.browser=browser.version();let active;
try{
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const touch=viewport.width===390,context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:out+'/videos',size:viewport}}),p=await context.newPage(),cdp=await context.newCDPSession(p);active=p;p.setDefaultTimeout(18000);
  const row={viewport,touch,steps:[],errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
  const dom=l=>touch?l.tap():l.click(),tap=id=>tapUI(p,'game',id,touch);
  const snapshot=()=>p.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts'),s=gameSession(),c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await s.storage.read()};});
  const ui=()=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return {selected:[...s.selectedIds],assist:[...s.assistIds],skill:s.amoExile,discards:s.resourceCounts.discard.text,plays:s.resourceCounts.play.text,hand:s.cardViews.map(v=>v.card.id),discardEnabled:!!s.discardButton.input?.enabled};});
  const ready=()=>p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length===8&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
  const shot=async name=>{const f=viewport.width+'-'+name+'.png';await p.screenshot({path:out+'/'+f,scale:'css'});return f;};
  const unchanged=async(note,before)=>{assert.deepEqual(await snapshot(),before,note);row.steps.push({note,unchanged:true,ui:await ui()});console.log(viewport.width,note);};
  const down=async q=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:q.x,y:q.y,id:1}]});else{await p.mouse.move(q.x,q.y);await p.mouse.down();}};
  const up=async()=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();};
  const click=async q=>{if(touch)await p.touchscreen.tap(q.x,q.y);else await p.mouse.click(q.x,q.y);};
  await p.goto('http://127.0.0.1:5754/?harness=1',{timeout:120000});await waitScene(p,'title');
  await p.waitForFunction(async()=>{const {gameSession}=await import('/src/game/session.ts');return gameSession().loaded&&!gameSession().working;});
  row.setup=await p.evaluate(async input=>{const {gameSession}=await import('/src/game/session.ts'),s=gameSession();const lease=await s.lease.claim();return {lease,imported:lease&&await s.importJSON(JSON.stringify(input)),notice:s.notice};},input);assert.equal(row.setup.imported,true,'controlled fixture setup claims normal writer lease before validated import');
  await p.reload({timeout:120000});await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);
  await waitScene(p,'game');await ready();row.before=await snapshot();assert.deepEqual(row.before.state,input.state);assert.deepEqual(row.before.journal,input.journal);row.beforeUi=await ui();assert.deepEqual(row.beforeUi.selected,[]);assert.equal(row.beforeUi.discards,'3 次');assert.equal(row.beforeUi.plays,'4 次');
  // The chosen IDs depend only on the visible hand order, never the future draw order.
  const ids=row.before.state.handOrder.slice(0,2);row.selectedIds=ids;
  for(const id of ids)await tap('card/'+id);assert.deepEqual((await ui()).selected,ids);await unchanged('real two-card selection is a draft',row.before);row.selectedShot=await shot('selected');
  for(const id of ids)await tap('card/'+id);assert.deepEqual((await ui()).selected,[]);const discard=await point(p,'game','action/discard');assert.equal((await ui()).discardEnabled,false);
  await click(discard);await click(discard);await unchanged('deselect then repeated disabled Discard sends no command or cost',row.before);
  for(const id of ids)await tap('card/'+id);
  await down(discard);if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:discard.x,y:discard.y-100,id:1}]});else await p.mouse.move(discard.x,discard.y-100,{steps:4});await up();await p.waitForTimeout(100);
  assert.deepEqual((await ui()).selected,ids);await unchanged('drag-off Discard cancels and preserves the exact selected draft',row.before);
  if(touch){await down(discard);await p.waitForTimeout(40);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.waitForTimeout(100);assert.deepEqual((await ui()).selected,ids);await unchanged('native touchCancel on Discard sends no command or queued action',row.before);}
  row.canceledShot=await shot('canceled');
  // Two releases at the same native location while the first discard resolves.
  await click(discard);await click(discard);await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq,row.before.state.commandSeq+1);await ready();row.after=await snapshot();
  const added=row.after.journal.slice(row.before.journal.length);assert.equal(added.length,1);assert.deepEqual(added[0].action,{type:'DiscardHand',selectedIds:ids});
  const expected=applyCommand(row.before.state,added[0]);assert.ok(expected.ok);assert.deepEqual(row.after.state,expected.state);assert.deepEqual(row.after.journal,[...row.before.journal,added[0]]);assert.deepEqual(row.after.storage.current,makeCheckpoint(expected.state,row.after.journal));assert.deepEqual(row.after.storage.previous,row.before.storage.current);assert.equal(row.after.storage.revision,row.before.storage.revision+1);
  const before=row.before.state,after=row.after.state;assert.equal(after.stage.discardsLeft,before.stage.discardsLeft-1);assert.equal(after.stage.discardSpent,before.stage.discardSpent+1);assert.equal(after.stage.discardsUsed,before.stage.discardsUsed+1);assert.equal(after.stage.handsLeft,before.stage.handsLeft);assert.equal(after.stage.playIndex,before.stage.playIndex);assert.equal(after.stage.heat,before.stage.heat);assert.equal(after.gold,before.gold);assert.equal(after.handOrder.length,before.handOrder.length);assert.equal(after.drawPile.length,before.drawPile.length-2);assert.deepEqual(after.discardPile,[...before.discardPile,...ids]);for(const id of ids)assert.ok(!after.handOrder.includes(id));
  row.drawnIds=after.handOrder.filter(id=>!before.handOrder.includes(id));assert.equal(row.drawnIds.length,2);row.afterUi=await ui();assert.equal(row.afterUi.discards,'2 次');assert.equal(row.afterUi.plays,'4 次');assert.deepEqual(row.afterUi.hand,after.handOrder);assert.deepEqual(row.afterUi.selected,[]);assert.equal(row.afterUi.discardEnabled,false);row.afterShot=await shot('discarded-refilled');
  row.steps.push({note:'repeated ordinary Discard saved exactly once; 3→2 discards, 4 plays and 2 gold unchanged, two actual replacement cards',command:added[0],drawnIds:row.drawnIds,ui:row.afterUi});
  await click(discard);await click(discard);await p.waitForTimeout(150);await unchanged('post-refill repeated disabled Discard does not spend or queue another discard',row.after);
  await p.reload({timeout:120000});await waitScene(p,'title');assert.deepEqual(await snapshot(),row.after);await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'game');await ready();assert.deepEqual(await snapshot(),row.after);assert.deepEqual((await ui()).selected,[]);row.restoredShot=await shot('restored');row.steps.push({note:'cold Continue retains the exact discarded/refilled saved tuple and no draft',unchanged:true});
  assert.deepEqual(row.errors,[]);row.video='videos/'+path.basename(await p.video().path());row.status='PASS';await context.close();active=undefined;console.log(viewport.width,'PASS',row.drawnIds);
 }
 assert.deepEqual(report.cases[0].after.state,report.cases[1].after.state);assert.deepEqual(report.cases[0].after.journal,report.cases[1].after.journal);assert.equal(await hash(),sourceHash);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;if(active){await active.screenshot({path:out+'/FAIL.png',scale:'css'}).catch(()=>{});report.diagnostic=await active.evaluate(()=>({scenes:window.__harness?.game.scene.getScenes(true).map(s=>({key:s.scene.key,ready:s.ready})),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.innerText)})).catch(()=>null);}console.error(e);}
finally{
 await browser.close();await server.close();await writeFile(out+'/full-state.json.gz',gzipSync(JSON.stringify(report)));
 const brief={...report,cases:report.cases.map(c=>({...c,before:c.before?{seq:c.before.state.commandSeq,gold:c.before.state.gold,discards:c.before.state.stage.discardsLeft,hand:c.before.state.handOrder}:undefined,after:c.after?{seq:c.after.state.commandSeq,gold:c.after.state.gold,discards:c.after.state.stage.discardsLeft,hand:c.after.state.handOrder}:undefined}))};
 await writeFile(out+'/report.json',JSON.stringify(brief,null,2)+'\n');console.log(report.status,out);
}
