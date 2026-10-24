import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openSelector,tapUI} from '../../../../harness/ui.mjs';
const stage=process.env.CLEARANCE_STAGE??'before',out='docs/production/evidence/selection-ink-seal-2026-10-21/clearance-'+stage;await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5593,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const report={stage,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:createHash('sha256').update(await readFile('src/game/SelectionEntryParticles.ts')).digest('hex'),cases:[],errors:[],scope:'Native local confirmation at two existing viewports; actual rendered image/text bounds. A bounds crossing is not evidence that a glyph was obscured. Continuous unedited browser video; no audio.'};
try{
 for(const [width,height]of [[390,740],[1366,768]]){
  const touch=width<640,context=await browser.newContext({viewport:{width,height},hasTouch:touch,recordVideo:{dir:out,size:{width,height}}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5593/?harness=1');await openSelector(page,touch);await page.waitForTimeout(500);
  await tapUI(page,'character-select','character/erxiang',touch);await tapUI(page,'character-select','action/confirm-character',touch);await tapUI(page,'character-select','route/straight',touch);await page.waitForTimeout(600);
  await page.evaluate(()=>{
   window.clearanceFrames=[];window.clearanceFirst=undefined;const s=window.__harness.game.scene.getScene('character-select');
   s.events.on('postupdate',()=>{
    const p=s.entryParticles;if(!p?.gathering.length)return;
    const rect=o=>{const b=o.getBounds();return {x:b.x,y:b.y,width:b.width,height:b.height};},texts=[];
    const walk=list=>{for(const o of list){if(!o.active||!o.visible||o.alpha<=0)continue;if(o.type==='Text'&&o!==p.seal)texts.push({name:o.name,text:o.text,...rect(o)});if(o.list)walk(o.list);}};walk(s.view.root.list);
    const particles=p.gathering.map((i,j)=>({index:i,j,visible:p.nodes[i].visible,alpha:p.nodes[i].alpha,...rect(p.nodes[i])}));
    const footprints=particles.map(n=>({...n,kind:'image'}));if(p.gathering.length===9)for(const n of particles.slice(0,8))footprints.push({...n,x:n.x+n.width/2-5.2,y:n.y+n.height/2-5.2,width:10.4,height:10.4,kind:'gold-core-envelope'});
    const crossings=[];for(const n of footprints.filter(n=>n.visible&&n.alpha>0))for(const text of texts){const x=Math.max(n.x,text.x),y=Math.max(n.y,text.y),right=Math.min(n.x+n.width,text.x+text.width),bottom=Math.min(n.y+n.height,text.y+text.height);if(right>x&&bottom>y)crossings.push({j:n.j,kind:n.kind,text:text.text,name:text.name,intersection:{x,y,width:right-x,height:bottom-y},particle:n,textBounds:text});}
    const frame={at:performance.now(),nodes:p.nodes.length,anchor:p.anchor,sealVisible:!!p.seal?.visible,particles,footprints,crossings,texts};window.clearanceFrames.push(frame);if(crossings.length&&!window.clearanceFirst)window.clearanceFirst=frame;
   });
  });
  await tapUI(page,'character-select','action/confirm-character',touch);
  if(stage==='before'){await page.waitForFunction(()=>!!window.clearanceFirst);await page.screenshot({path:out+'/'+width+'-crossing-observation.png'});}
  else {await page.waitForFunction(()=>window.clearanceFrames.some(f=>f.sealVisible));await page.screenshot({path:out+'/'+width+'-confirmation-observation.png'});}
  await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));
  const frames=await page.evaluate(()=>window.clearanceFrames),crossings=frames.flatMap(f=>f.crossings.map(c=>({at:f.at-frames[0].at,...c})));assert.ok(frames.length>5);assert.ok(frames.some(f=>f.sealVisible));assert.ok(frames.every(f=>f.nodes===(touch?32:64)));
  if(stage==='before')assert.ok(crossings.length,'reproduce actual bounds crossing');
  else {assert.equal(crossings.length,0,'no confirmation mote or gold core overlaps any visible text bounds');for(const f of frames)for(const n of f.footprints.filter(n=>n.visible&&n.alpha>0)){const b=f.anchor;assert.ok(n.x>=b.x-.001&&n.y>=b.y-.001&&n.x+n.width<=b.x+b.width+.001&&n.y+n.height<=b.y+b.height+.001,'entire mote, glow or core envelope stays inside portrait');}}
  report.cases.push({width,height,frameCount:frames.length,crossingCount:crossings.length,crossings,frames});const video=page.video();await context.close();await rename(await video.path(),out+'/'+width+'-continuous.webm');console.log(width,'frames',frames.length,'crossings',crossings.length);
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack??String(e);console.error(report.error);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();console.log(report.status);}
