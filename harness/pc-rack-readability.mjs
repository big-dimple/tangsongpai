/** Controlled five-card rack, rendered and opened through the production game scene. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {tapUI,waitScene} from './ui.mjs';
import {enterCurrentStage} from './stage-entry.mjs';
const out=process.env.PC_RACK_OUT??'shots/pc-rack-readability';await mkdir(out,{recursive:true});
const sourceFiles=['src/game/GameScene.ts','src/game/PcTableLayout.ts','src/game/PcJokerSummary.ts','src/game/StageTableArt.ts','harness/pc-rack-readability.mjs'];
const digest=createHash('sha256');for(const file of sourceFiles)digest.update(file+'\0').update(readFileSync(file));
const evidence={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFiles,sourceHash:digest.digest('hex')};
const fixture=path.resolve(out,'fixture.mjs');
await build({stdin:{contents:"export {holographicRecommendationFixture,holographicSend} from './harness/fixtures/holographic-recommendation';export {makeCheckpoint,readCheckpoint} from './src/application/checkpoint';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',define:{'import.meta.env.BASE_URL':JSON.stringify('./')},outfile:fixture,logLevel:'error'});
const f=await import(pathToFileURL(fixture));let state=f.holographicRecommendationFixture();state=f.holographicSend(state,{type:'LeaveShop'});state=f.holographicSend(state,{type:'EnterStage'});assert.ok(f.readCheckpoint(f.makeCheckpoint(state,[])).ok);
const port=Number(process.env.PC_RACK_PORT??5177),server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});const rows=[];
const sizes=(process.env.PC_RACK_SIZES??'1920x1080,1920x924,1366x768,1280x640,1180x640').split(',').map(s=>s.split('x').map(Number));
try{for(const [width,height] of sizes){
 const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');await p.evaluate(async checkpoint=>{const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts');if(!gameSession().lease.writable)await gameSession().takeOver();if(!await gameSession().importJSON(checkpoint))throw Error(gameSession().notice);routeSavedRun(window.__harness.game);},JSON.stringify(f.makeCheckpoint(state,[])));await waitScene(p,'game');await enterCurrentStage(p,false);await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').ready);await p.waitForTimeout(400);
  const bossIntro=p.getByRole('button',{name:'开始出牌',exact:true});await bossIntro.waitFor();await bossIntro.click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const rack=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),l=s.view.layout,items=s.view.root.list;return {slots:l.slots,rack:l.jokers,names:items.filter(o=>o.name==='pc/joker-name').map(o=>({text:o.text,bounds:o.getBounds()})),rules:items.filter(o=>o.name==='pc/joker-rule').map(o=>({text:o.text,full:o.getData('fullText'),color:o.style.color,bounds:o.getBounds()}))};});
  assert.equal(rack.names.length,5);assert.equal(rack.rules.length,5);for(let i=0;i<5;i++){const slot=rack.slots[i],right=rack.rack.x+rack.rack.width*(i+1)/5;for(const t of [rack.names[i],rack.rules[i]]){assert.ok(t.bounds.x>=slot.x+slot.width&&t.bounds.x+t.bounds.width<=right+1,'text stays in own rack seat');assert.ok(t.bounds.y>=slot.y&&t.bounds.y+t.bounds.height<=slot.y+slot.height,'text stays vertically in its seat');}assert.ok(rack.names[i].bounds.y+rack.names[i].bounds.height<=rack.rules[i].bounds.y);assert.ok(!/[+×−-]\s*\n\s*\d|\d\s*\n\s*\d/.test(rack.rules[i].text),'quantity is not split over lines');}
  assert.equal(rack.names[0].text,'满堂喝彩');assert.ok(rack.rules[0].text.includes('+90'),'short rule preserves the heat value: '+JSON.stringify(rack.rules[0]));
  const luminance=rgb=>{const c=[16,8,0].map(shift=>(rgb>>shift&255)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  for(const rule of rack.rules)assert.ok((luminance(0xe1d3bc)+.05)/(luminance(parseInt(rule.color.slice(1),16))+.05)>=4.5,'rack text contrasts with its painted surface');
  await p.screenshot({path:`${out}/${width}x${height}.png`});await tapUI(p,'game','pc/joker-details/'+state.jokers[0].instanceId);const dialog=p.locator('dialog[open]');await dialog.waitFor();assert.match(await dialog.innerText(),/满堂喝彩/);await dialog.getByRole('button',{name:/关闭|返回/}).first().click();assert.deepEqual(await p.evaluate(()=>window.__harness.game.registry.get('runController').state),state);
  if(width===1366){const from=rack.rules[0].bounds,to=rack.slots[1];await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await p.mouse.up();await p.waitForFunction(id=>window.__harness.game.registry.get('runController').state.jokers[1]?.instanceId===id,state.jokers[0].instanceId);const moved=await p.evaluate(()=>window.__harness.game.registry.get('runController').state);assert.equal(moved.commandSeq,state.commandSeq+1,'drag commits exactly one reorder');}
  assert.deepEqual(errors,[]);rows.push({width,height,rack,status:'PASS'});console.log('PASS',width,height);
 }finally{await p.close();}
}}finally{await writeFile(out+'/report.json',JSON.stringify({...evidence,scope:'Controlled valid checkpoint and real browser details input; not natural acquisition.',rows},null,2));await browser.close();await server.close();}
