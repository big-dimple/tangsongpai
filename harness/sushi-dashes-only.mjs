/** One desktop/1x visual correction check; no performance or device matrix. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out=resolve(process.env.SUSHI_DASHES_OUTPUT??'shots/sushi-dashes-only'),port=5732;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve(out,'vite'),server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
let browser,context,p;
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}),status:'RUNNING',errors:[],scope:'Single 1366x768 software Chromium, speed1; controlled validated checkpoint then real skill/play UI. Only observe the actual energy draw calls. No performance, device, hearing or user visual acceptance claim.'};
try{
 const {sushiSkillLocationFixture}=await server.ssrLoadModule('/harness/fixtures/sushi-skill-location.ts'),{makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts'),{applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
 const fixture=await sushiSkillLocationFixture(),checkpoint=makeCheckpoint(fixture.state,[]);assert.ok(readCheckpoint(checkpoint).ok);await server.listen();
 browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'});report.browser=browser.version();
 context=await browser.newContext({viewport:{width:1366,height:768},recordVideo:{dir:resolve(out,'raw'),size:{width:1366,height:768}}});p=await context.newPage();p.setDefaultTimeout(25000);p.on('pageerror',e=>report.errors.push(String(e)));p.on('dialog',d=>d.accept());
 await p.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:false})));
 await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const store=new IndexedDbSave();await store.commit((await store.read()).revision,cp,null);},checkpoint);
 await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',false);await waitScene(p,'game');
 const settled=()=>p.waitForFunction(()=>{const s=__harness.game.scene.getScene('game');return s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});await settled();if(await p.locator('dialog[open]').count())await p.keyboard.press('Escape');
 await p.evaluate(async()=>{
  const {SushiKingEnergy}=await import('/src/game/SushiKingEnergy.ts'),original=SushiKingEnergy.prototype.draw,game=__harness.game,s=game.scene.getScene('game'),probe=window.dashesProbe={draws:[],frames:[],shots:{}};
  SushiKingEnergy.prototype.draw=function(g,...args){const fill=g.fillPoints,line=g.lineBetween,row={clock:args[2],reduced:args[3],release:args[4]??0,polygons:[],lines:[]};g.fillPoints=function(points,...rest){row.polygons.push(points.map(p=>({x:p.x,y:p.y})));return fill.call(this,points,...rest);};g.lineBetween=function(...points){row.lines.push(points);return line.apply(this,points);};try{return original.call(this,g,...args);}finally{g.fillPoints=fill;g.lineBetween=line;probe.draws.push(row);}};
  const walk=list=>list.flatMap(o=>o.active?[o,...(o.list?walk(o.list):[])]:[]),tick=()=>{if(!s.scene.isActive())return;const objects=walk(s.children.list),packet=objects.find(o=>o.name==='hero/sushi-skill-packet'),token=s.heroActionButton?.getData('sushiSkillPayoff'),charge=objects.filter(o=>o.name==='hero/sushi-king-charge'),shards=objects.filter(o=>o.name==='hero/sushi-cost-king-shard'&&o.alpha>.1);probe.frames.push({charged:charge.map(o=>({id:o.getData('targetId'),phase:o.getData('phase')})),packet:packet?.visible?packet.text:undefined,shards:shards.map(o=>o.getData('targetId')),arrived:token?.arrived,skill:s.heroActionButton?.getData('label')?.text});const name=charge.length?'score-dashes':shards.length?'fracture':packet?.visible?'factor-flight':token?.arrived?'gold':null;if(name&&!probe.shots[name])probe.shots[name]=game.canvas.toDataURL('image/png').split('base64,')[1];};game.events.on('postrender',tick);probe.stop=()=>{game.events.off('postrender',tick);SushiKingEnergy.prototype.draw=original;};
 });
 const save=()=>p.evaluate(async()=>{const c=__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};}),before=await save();
 for(const id of fixture.selectedIds)await tapUI(p,'game','card/'+id,false);await tapUI(p,'game','hero/action-shortcut',false);await p.getByRole('button',{name:'本手使用贬谪 ×3',exact:true}).click();
 await p.waitForTimeout(200);await p.screenshot({path:resolve(out,'armed-a.png')});await p.waitForTimeout(420);await p.screenshot({path:resolve(out,'armed-b.png')});await p.waitForTimeout(500);assert.deepEqual(await save(),before);
 await tapUI(p,'game','action/play',false);await settled();const after=await save(),expected=applyCommand(before.state,after.journal.at(-1));assert.ok(expected.ok);assert.deepEqual(after.state,expected.state);assert.deepEqual(after.storage.current,makeCheckpoint(after.state,after.journal));
 const observed=await p.evaluate(()=>{dashesProbe.stop();return{draws:dashesProbe.draws,frames:dashesProbe.frames,shots:dashesProbe.shots,activeRows:__harness.game.scene.getScene('game').targetAttachment.sushi.rows.size};});
 assert.ok(observed.draws.length);assert.ok(observed.draws.every(d=>d.polygons.every(p=>p.length===4)),'no ten-point center polygons');const full=observed.draws.filter(d=>d.lines.length===24&&d.polygons.length===12);assert.ok(full.length>2);assert.notDeepEqual(full[0].lines,full.find(d=>d.clock>full[0].clock+200)?.lines,'retained dashes continue moving');assert.ok(observed.frames.some(f=>f.shards.length===8));assert.ok(observed.frames.some(f=>f.packet==='×3'));assert.ok(observed.frames.some(f=>f.arrived&&f.skill==='本次得分 ×3'));assert.equal(observed.activeRows,0);assert.deepEqual(report.errors,[]);
 for(const [name,data]of Object.entries(observed.shots))await writeFile(resolve(out,name+'.png'),Buffer.from(data,'base64'));
 report.draws=observed.draws;report.frames=observed.frames;report.score=after.state.lastTrace.finalScore;report.factor=after.state.lastTrace.events.find(e=>e.reasonKey==='amo.exile').value;report.storageVerified=true;report.activeRows=observed.activeRows;report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;await p?.screenshot({path:resolve(out,'FAIL.png')}).catch(()=>{});}finally{
 await p?.evaluate(()=>window.dashesProbe?.stop()).catch(()=>{});const video=p?.video();await context?.close();if(video)await rename(await video.path(),resolve(out,'process-1x.webm'));await browser?.close();await server.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,error:report.error,head:report.head,draws:report.draws?.length,score:report.score,factor:report.factor}));
}
