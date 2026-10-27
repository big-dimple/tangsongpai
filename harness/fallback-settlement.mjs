/** Legal controlled saves, real renderer and pointer input; no natural acquisition claim. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {waitScene,tapUI} from './ui.mjs';

const out=process.env.SETTLEMENT_OUT??'shots/fallback-settlement',port=Number(process.env.SETTLEMENT_PORT??5187);
await mkdir(out,{recursive:true});
const fixtureFile=resolve(out,'fixtures.mjs');
await build({stdin:{contents:"export {supportSettlementReady,multiHandSettlementReady,settlementReady} from './harness/fixtures/settlement';export {energySend} from './harness/fixtures/hero-climax';export {makeCheckpoint,readCheckpoint} from './src/application/checkpoint';export {createRun} from './src/domain/run';export {newRunIdentity} from './src/game/RunLaunch';export {settlementFacts} from './src/game/SettlementPresentation';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',define:{'import.meta.env.BASE_URL':JSON.stringify('./')},outfile:fixtureFile,logLevel:'error'});
const f=await import(pathToFileURL(fixtureFile)),support=f.supportSettlementReady();
const states=[{name:'source-kicker',state:f.energySend(support.state,{...support.action,selectedIds:support.action.selectedIds.slice(0,4)})}];
const mixed=f.supportSettlementReady();mixed.state.deckInstances.find(c=>c.id===mixed.action.selectedIds[3]).suit='diamonds';
states.push({name:'mixed-suits',state:f.energySend(mixed.state,{...mixed.action,selectedIds:mixed.action.selectedIds.slice(0,4)})});
for(const [name,fixture] of [['multi',f.multiHandSettlementReady()],['loss',f.settlementReady('boss-loss','current')]])states.push({name,state:f.energySend(fixture.state,fixture.action)});
let skip=f.createRun({seed:'fallback-skip',runId:'controlled/fallback-skip',characterId:'erxiang',rulesVersion:'r2',r2Identity:f.newRunIdentity('erxiang','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
skip=f.energySend(skip,{type:'LeaveShop'});skip=f.energySend(skip,{type:'SkipStage'});states.push({name:'skip',state:skip});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Controlled valid checkpoints; actual mouse/touch scrolling and navigation. Not aesthetic approval.',cases:[]};
const intersects=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
try{for(const spec of [{width:1024,height:768,touch:false,fallback:true},{width:740,height:390,touch:true,fallback:true},{width:1920,height:1080,touch:false},{width:390,height:844,touch:true},{width:320,height:740,touch:true}])for(const {name,state} of spec.fallback?states:states.slice(0,2)){
 const p=await browser.newPage({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,reducedMotion:'reduce'}),row={name,spec,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(e.message));p.on('dialog',d=>d.accept());
 const shot=async suffix=>p.screenshot({path:`${out}/${spec.width}x${spec.height}-${name}-${suffix}.png`});
 try{
  const cp=f.makeCheckpoint(state,[]);assert.ok(f.readCheckpoint(cp).ok);await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');
  await p.evaluate(async cp=>{const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts');if(!gameSession().lease.writable)await gameSession().takeOver();if(!await gameSession().importJSON(cp))throw Error(gameSession().notice);routeSavedRun(window.__harness.game);},JSON.stringify(cp));
  await waitScene(p,'intermission');await p.waitForTimeout(900);await p.evaluate(()=>document.fonts.ready);
  const inspect=()=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('intermission'),walk=xs=>xs.flatMap(o=>[o,...(o.list?walk(o.list):[])]),all=walk(s.view.root.list);return {viewport:s.resultContent.getData('viewport'),texts:all.filter(o=>o.type==='Text'&&o.visible&&o.text).map(o=>({name:o.name,text:o.text,box:o.getBounds(),color:o.style.color,cardId:o.getData('cardId'),suit:o.getData('suit'),scoring:o.getData('scoring'),fullText:o.getData('fullText')})),cards:all.filter(o=>o.name==='result/card-face').map(o=>({id:o.getData('cardId'),scoring:o.getData('scoring')})),state:window.__harness.game.registry.get('runController').state};});
  row.initial=await inspect();assert.deepEqual(row.initial.state,state);delete row.initial.state;await shot('initial');
  const facts=f.settlementFacts(state,name!=='loss',name==='skip'),find=n=>row.initial.texts.find(t=>t.name===n);
  if(facts.trace){
   assert.ok(facts.card,'fixture includes a key joker source');assert.ok(find('result/source-continuity')||!spec.fallback);
   const combo=find('result/hand-combo'),calc=find('result/score-explanation');
   if(spec.fallback){assert.equal(find('result/gap').text,'本手牌型 · '+facts.handLabel);assert.equal(combo.text,'使用组合 · ');assert.equal(calc.text,'末手计算 · '+facts.scoreExplanation);assert.ok(!intersects(combo.box,calc.box));assert.ok(!intersects(calc.box,find('result/source-continuity').box));}
   if(spec.fallback||spec.width<700){
    const labels=row.initial.texts.filter(t=>t.name==='result/hand-card'),notes=row.initial.texts.filter(t=>t.name==='result/hand-card-note');
    assert.deepEqual(labels.map(t=>t.cardId),state.lastTrace.sets.playedIds);
    for(const label of labels){assert.equal(label.scoring,state.lastTrace.sets.activeScoringIds.includes(label.cardId));assert.equal(label.color,['hearts','diamonds'].includes(label.suit)?'#a8372d':'#26313a');assert.ok(!intersects(label.box,calc.box));}
    for(const note of notes)assert.ok(!intersects(note.box,calc.box));
    const all=[combo,...labels,...notes];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(!intersects(all[i].box,all[j].box),`${all[i].name} overlaps ${all[j].name}`);
    assert.deepEqual(notes.map(t=>t.cardId),labels.filter(t=>!t.scoring).map(t=>t.cardId));
   }else{
    assert.deepEqual(row.initial.cards.map(c=>c.id),state.lastTrace.sets.playedIds);
    for(const face of row.initial.cards)assert.equal(face.scoring,state.lastTrace.sets.activeScoringIds.includes(face.id));
    for(const t of row.initial.texts.filter(t=>t.name==='result/card-index'||t.name==='result/card-suit'))assert.equal(t.color,['hearts','diamonds'].includes(t.suit)?'#a8372d':'#26313a');
   }
   if(name==='source-kicker'){assert.equal(state.lastTrace.sets.playedIds.length,4);assert.equal(state.lastTrace.sets.activeScoringIds.length,3);if(spec.fallback||spec.width<700)assert.ok(combo.fullText.includes('9♠'),'played kicker remains in combination');}
   if(name==='mixed-suits')assert.equal(new Set(state.lastTrace.cards.filter(c=>state.lastTrace.sets.playedIds.includes(c.id)).map(c=>c.suit)).size,4);
   if(name==='multi')assert.ok(BigInt(facts.stageTotal)>BigInt(facts.trace.finalScore),'stage cumulative score differs from last hand');
  }else{assert.equal(find('result/score-explanation'),undefined);assert.equal(find('result/hand-combo'),undefined);assert.ok(name==='loss'?find('result/gap').text.startsWith('最后一手'):find('result/gap').text==='没有本场计分');}
  // Read the local scroll surface using real browser input, then tap its action.
  if(row.initial.viewport.overflow>0){
   if(spec.touch){const cdp=await p.context().newCDPSession(p),x=spec.width/2,from=row.initial.viewport.bottom-28,to=row.initial.viewport.top+18;
    for(let n=0;n<8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);const v=(await inspect()).viewport;if(v.scroll>=v.overflow-1)break;}await cdp.detach();
   }else{await p.mouse.move(spec.width/2,spec.height/2);await p.mouse.wheel(0,3000);await p.waitForTimeout(120);}
  }
  row.end=await inspect();assert.deepEqual(row.end.state,state,'reading never mutates save');delete row.end.state;assert.ok(row.end.viewport.scroll>=row.end.viewport.overflow-1,'real scroll reaches footer');await shot('footer');
  await tapUI(p,'intermission',name==='loss'?'action/retry-seed':'action/continue-stage',spec.touch);await waitScene(p,'shop');assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',spec.width,spec.height,name);
 }catch(error){row.status='FAIL';row.error=String(error.stack??error);await shot('failure');throw error;}finally{await p.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();}
