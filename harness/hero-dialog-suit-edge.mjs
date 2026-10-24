/** Bounded desktop/mobile native-input checks; controlled validated saves, no gameplay or performance claim. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';
const out=process.env.DIALOG_SORT_OUT??'shots/hero-dialog-suit-edge';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5583,strictPort:true},logLevel:'error'});await server.listen();
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {heroStageFixture}=await server.ssrLoadModule('/harness/fixtures/hero-stage-continuity.ts');
const report={scope:'1366x900 mouse and 390x740 touch; Linux Chromium Canvas. Controlled current identities installed via validated session.importJSON as fixture setup; subsequent interactions are native mouse/touch. Bounded table interactions only. Physical devices, GPU, audio and aesthetics acceptance NOT_RUN.',source:{},cases:[],errors:[]};
for(const path of ['src/game/GameScene.ts','src/game/HeroSkillDialog.ts','src/game/HeroSkillDialog.css','src/game/HeroSkillGuide.ts','src/game/HeroDiscardChoice.ts','src/game/AssistChoiceDialog.ts'])report.source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
let browser;
const snap=p=>p.evaluate(()=>structuredClone(window.__harness.game.registry.get('runController').state));
const selected=p=>p.evaluate(()=>[...window.__harness.game.scene.getScene('game').selectedIds]);
const ready=p=>p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
async function imp(p,s,touch){
 const cp=makeCheckpoint(s,[]);assert.ok(readCheckpoint(cp).ok);
 await p.evaluate(async checkpoint=>{
  const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts'),session=gameSession();
  if(!await session.lease.claim())throw Error('fixture lease unavailable');
  if(!await session.importJSON(JSON.stringify(checkpoint)))throw Error(session.notice);
  routeSavedRun(window.__harness.game);
 },cp);
 await waitScene(p,'game');await ready(p);assert.deepEqual(await snap(p),s);
}
async function measure(p){return p.locator('dialog.hero-skill-compact[open]').evaluate(d=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};},content=d.querySelector('.dialog-content'),buttons=[...d.querySelectorAll(':scope > .dialog-actions > button')];
 return {illustrated:!!d.querySelector('.dialog-portrait-art'),inner:rect(d.querySelector('.dialog-scroll')),dialog:rect(d),content:{...rect(content),clientHeight:content.clientHeight,scrollHeight:content.scrollHeight,scrollTop:content.scrollTop},buttons:buttons.map(b=>({label:b.textContent,primary:b.classList.contains('dialog-primary'),close:b.classList.contains('dialog-close'),...rect(b)})),viewport:{width:innerWidth,height:innerHeight}};
});}
function reachable(m){if(!m.illustrated&&m.content.scrollHeight<=m.content.clientHeight+1)assert.ok(m.content.clientHeight-m.inner.height<=64,'short content must not leave a stretched empty workspace: '+JSON.stringify(m));assert.ok(m.dialog.y>=11&&m.dialog.bottom<=m.viewport.height-11,JSON.stringify(m));for(const b of m.buttons){assert.ok(b.height>=44&&b.y>=m.dialog.y&&b.bottom<=m.dialog.bottom,JSON.stringify(b));}const close=m.buttons.find(b=>b.close),primary=m.buttons.find(b=>b.primary);if(primary)assert.ok(close.x+close.width<=primary.x+1,'return left, confirmation right');}
const entry={amo:'hero/details',erxiang:'hero/erxiang-handoff',laohuan:'hero/laohuan-trick',azao:'hero/azao-charge',xiemu:'hero/xiemu-burn',touye:'hero/touye-wager'};
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});report.browser=browser.version();
 for(const viewport of [{width:1366,height:900},{width:390,height:740}]){
  const touch=viewport.width===390,ctx=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'no-preference'}),p=await ctx.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>report.errors.push(String(e)));p.on('dialog',d=>d.accept());await p.goto('http://127.0.0.1:5583/?harness=1',{waitUntil:'domcontentloaded',timeout:60000});await waitScene(p,'title');p.setDefaultTimeout(30000);
  const tap=name=>tapUI(p,'game',name,touch),dom=l=>touch?l.tap():l.click(),close=()=>dom(p.locator('dialog[open] .dialog-close'));
  const shot=async name=>{const file=viewport.width+'-'+name+'.png';await p.screenshot({path:out+'/'+file,scale:'css'});return file;};
  for(const hero of Object.keys(entry)){
   const f=heroStageFixture(hero);await imp(p,f.state,touch);for(const id of f.ids.slice(0,hero==='amo'?2:4))await tap('card/'+id);
   const before=await snap(p),ids=await selected(p),row={viewport,hero};report.cases.push(row);
   await tap(entry[hero]);await p.locator('dialog.hero-explanation[open]').waitFor();row.explanation=await measure(p);reachable(row.explanation);
   if(hero==='laohuan'){row.collapsed=await measure(p);await shot(hero+'-passive');}
   else {
    await dom(p.getByRole('button',{name:'查看本场技能操作',exact:true}));row.collapsed=await measure(p);reachable(row.collapsed);row.collapsedShot=await shot(hero+'-collapsed');
    if(hero==='amo'){assert.ok(row.collapsed.dialog.height<viewport.height*.75,'short exile copy is compact');assert.ok(await p.getByRole('button',{name:'本手使用贬谪 ×3',exact:true}).isEnabled());}
    if(hero==='touye'){
     await dom(p.locator('.touye-discard-grid button').first());await dom(p.getByRole('button',{name:'下一步 · 选押注牌型',exact:true}));reachable(await measure(p));await dom(p.locator('.dialog-choice-actions button:not([disabled])').first());row.confirm=await measure(p);reachable(row.confirm);row.confirmShot=await shot(hero+'-confirm');await close();
     assert.deepEqual(await snap(p),before);assert.deepEqual(await selected(p),ids);row.status='PASS';continue;
    }
   }
   // The actual details grow the dialog and overflow the content, keeping footer reachable.
   for(const summary of await p.locator('dialog[open] details > summary').all()){await summary.scrollIntoViewIfNeeded();await dom(summary);}
   if(hero==='laohuan')await p.locator('.hero-example li').first().waitFor({state:'attached'});
   row.expanded=await measure(p);reachable(row.expanded);assert.ok(row.expanded.dialog.height>=row.collapsed.dialog.height);
   if(row.expanded.content.scrollHeight>row.expanded.content.clientHeight+1){
    const area=p.locator('dialog[open] .dialog-content'),last=area.locator('details').last();await last.scrollIntoViewIfNeeded();row.scrolled=await measure(p);assert.ok(row.scrolled.content.scrollTop>0);reachable(row.scrolled);
   }
   row.expandedShot=await shot(hero+'-expanded');await close();assert.deepEqual(await snap(p),before);assert.deepEqual(await selected(p),ids);
   if(hero==='amo'){
    await tap('hero/action-shortcut');await dom(p.getByRole('button',{name:'本手使用贬谪 ×3',exact:true}));assert.deepEqual(await snap(p),before);assert.equal(await p.evaluate(()=>window.__harness.game.scene.getScene('game').amoExile),true);await tap('hero/action-shortcut');await dom(p.getByRole('button',{name:'取消本手贬谪',exact:true}));assert.deepEqual(await snap(p),before);assert.equal(await p.evaluate(()=>window.__harness.game.scene.getScene('game').amoExile),false);
   }
   row.status='PASS';console.log(viewport.width,hero,'PASS');
  }
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack??String(e);console.error(e);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();console.log(report.status,out);}
