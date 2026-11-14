/** Native pointer/touch coverage for the unsaved route preview and the saved-choice spectacle. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {openSelector,point,tapUI} from './ui.mjs';

const out=process.env.ROUTE_CHOICE_OUT??'shots/route-choice';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5581,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer']});
const report={scope:'Fresh browser contexts, native mouse/touch; software Canvas, not physical-device or subjective acceptance.',cases:[],errors:[]};
const inspect=page=>page.evaluate(()=>{
 const s=window.__harness.game.scene.getScene('character-select'),nodes=[];
 const walk=list=>{for(const o of list){if(o.name?.startsWith('opening/route-')||o.name?.startsWith('route/')||o.name==='opening/status'||o.name==='opening/choice-feedback'||o.name==='action/confirm-character'){const b=typeof o.getBounds==='function'?o.getBounds():{x:0,y:0,width:0,height:0};nodes.push({name:o.name,text:o.text,visible:o.visible,alpha:o.alpha,enabled:!!o.input?.enabled,box:{x:b.x,y:b.y,width:b.width,height:b.height}});}if(o.list)walk(o.list);}};walk(s.view.root.list);
 return{step:s.step,route:s.selectedRoute??null,run:window.__harness.game.registry.get('runController')?.state??null,active:s.entryParticles?.activeKind??null,listening:s.entryParticles?.listening,seal:s.entryParticles?.seal?{text:s.entryParticles.seal.text,visible:s.entryParticles.seal.visible,width:s.entryParticles.seal.displayWidth}:null,nodes,storage:JSON.stringify({...localStorage})};
});
try{
 for(const spec of [{name:'pc',width:1366,height:768,touch:false},{name:'phone',width:390,height:844,touch:true},{name:'small',width:320,height:640,touch:true},{name:'landscape',width:740,height:390,touch:true},{name:'reduced',width:390,height:528,touch:true,reduced:true},{name:'muted',width:390,height:740,touch:true,muted:true}]){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,reducedMotion:spec.reduced?'reduce':'no-preference'}),page=await context.newPage(),row={...spec,checks:[]};report.cases.push(row);page.on('pageerror',e=>report.errors.push(spec.name+': '+String(e)));
  await page.goto('http://127.0.0.1:5581/?harness=1&seed=route-choice');await openSelector(page,spec.touch);await tapUI(page,'character-select','character/erxiang',spec.touch);await tapUI(page,'character-select','action/confirm-character',spec.touch);
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('character-select').step==='route');
  let v=await inspect(page);assert.equal(v.route,null);assert.equal(v.run,null);assert.equal(v.nodes.find(n=>n.name==='action/confirm-character').enabled,false);assert.match(v.nodes.find(n=>n.name==='opening/status').text,/点一条路线/);assert.ok(v.nodes.some(n=>n.name==='opening/route-heading'&&/^点.*路线$/.test(n.text)));assert.equal(v.nodes.filter(n=>n.name==='opening/route-cue').length,1);assert.equal(v.nodes.filter(n=>n.name.startsWith('route/')&&n.enabled).length,3);assert.equal(await page.locator('.qiyu-entrance-burst-canvas.is-select').count(),0,'hero entrance cannot cover next-step guidance');const before=v.storage;
  await page.screenshot({path:`${out}/${spec.name}-prompt.png`,scale:'css'});row.checks.push('All three routes equally prompted, no default or saved run');
  await tapUI(page,'character-select','action/character-details',spec.touch);await page.locator('dialog[open]').waitFor();v=await inspect(page);assert.equal(v.listening,false,'ambient cue pauses for modal');await page.getByRole('button',{name:'回到选角',exact:true}).click();
  // Rapidly change all three using actual input. Only the latest preview wins.
  for(const route of ['group','straight','flush'])await tapUI(page,'character-select','route/'+route,spec.touch);
  v=await inspect(page);assert.equal(v.route,'flush');assert.equal(v.run,null);assert.equal(v.storage,before);assert.equal(v.nodes.filter(n=>n.name==='opening/route-cue').length,0);assert.equal(v.nodes.find(n=>n.name==='action/confirm-character').enabled,true);assert.match(v.nodes.find(n=>n.name==='opening/status').text,/可改选/);
  if(!spec.reduced){assert.equal(v.active,'route');assert.equal(v.seal.text,'已选');await page.screenshot({path:`${out}/${spec.name}-preview-stamp.png`,scale:'css'});}else assert.equal(v.active,null);
  await tapUI(page,'character-select','action/cancel-character',spec.touch);assert.equal((await inspect(page)).step,'hero');await tapUI(page,'character-select','action/confirm-character',spec.touch);v=await inspect(page);assert.equal(v.route,'flush');assert.equal(v.run,null);assert.equal(v.storage,before);row.checks.push('Rapid changes and back/re-entry preserve freedom without writing a run');
  // Select a different last route, then commit. The visible seal can only follow a real save.
  await tapUI(page,'character-select','route/straight',spec.touch);
  // Observe the actual shared audio engine without changing its playback path.
  await page.waitForFunction(()=>{const a=window.__harness.game.scene.getScene('character-select').audio;return a.context?.state==='running'&&a.scoreSamples?.has('impactWood_heavy_000')&&a.scoreSamples?.has('impactBell_heavy_003');},null,{timeout:15000});
  await page.evaluate(muted=>{const scene=window.__harness.game.scene.getScene('character-select'),a=scene.audio,original=a.sourceCue;window.__sealCue=[];if(muted)a.muted=true;a.sourceCue=function(kind,...args){const before=new Set(this.voices);const result=original.call(this,kind,...args);if(kind==='character')window.__sealCue.push({active:scene.entryParticles?.activeKind,seal:scene.entryParticles?.seal?.visible,voices:[...this.voices].filter(v=>!before.has(v)).map(v=>({bus:v.bus,semantic:v.semantic,peak:v.peak}))});return result;};},!!spec.muted);
  await tapUI(page,'character-select','action/confirm-character',spec.touch);
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('character-select').entryParticles?.activeKind==='confirm',{timeout:15000});v=await inspect(page);assert.equal(v.run.openingRoute,'straight');assert.equal(v.seal.text,'定章');
  await page.waitForTimeout(spec.reduced?30:650);await page.screenshot({path:`${out}/${spec.name}-confirmed-stamp.png`,scale:'css'});await page.locator('.opening-rule-briefing[open]').waitFor({timeout:10000});assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController').state.openingRoute),'straight');
  const cues=await page.evaluate(()=>window.__sealCue);assert.equal(cues.length,1,'one hero-style sound on the committed stamp');assert.equal(cues[0].active,'confirm');
  if(spec.muted)assert.equal(cues[0].voices.length,0,'mute prevents sound voices');else assert.ok(cues[0].voices.some(v=>v.bus==='sfx'&&v.semantic==='role'&&v.peak>0),'decoded hero sound reaches the effects bus');
  row.checks.push('Saved stamp fires one hero cue; mute suppresses voices');
  row.status='PASS';await context.close();console.log(spec.name,'PASS');
 }
 // Confirm interruption must resolve the pending presentation exactly once, not strand the player.
 for(const mode of ['resize','blur','reduced','enter']){
  const context=await browser.newContext({viewport:{width:390,height:740},hasTouch:true,reducedMotion:'no-preference'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(mode+': '+String(e)));
  await page.goto('http://127.0.0.1:5581/?harness=1&seed=route-interruption');await openSelector(page,true);await tapUI(page,'character-select','character/erxiang',true);await tapUI(page,'character-select','action/confirm-character',true);await tapUI(page,'character-select','route/group',true);await tapUI(page,'character-select','action/confirm-character',true);
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('character-select').entryParticles?.activeKind==='confirm');
  if(mode==='resize')await page.setViewportSize({width:740,height:390});
  else if(mode==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  else if(mode==='reduced')await page.emulateMedia({reducedMotion:'reduce'});
  else {await page.keyboard.press('Enter');await page.keyboard.press('Enter');}
  await page.locator('.opening-rule-briefing[open]').waitFor({timeout:10000});assert.equal(await page.locator('.opening-rule-briefing[open]').count(),1);assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController').state.openingRoute),'group');
  report.cases.push({name:'confirm-interrupt-'+mode,status:'PASS',checks:['Interruption resolves saved confirmation and opens one briefing']});console.log('confirm-interrupt-'+mode,'PASS');await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await server.close();console.log(JSON.stringify(report));}
