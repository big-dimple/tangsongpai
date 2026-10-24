import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openSelector,tapUI} from '../../../../../harness/ui.mjs';
const out=new URL('./',import.meta.url).pathname;
const source=execFileSync('git',['show','53c2abd5:src/game/SelectionEntryParticles.ts'],{encoding:'utf8'});
const body=source.slice(source.indexOf('      const left:{x:number;y:number}[]'),source.indexOf('      g.fillStyle(color,alpha*fade)'));
assert.ok((await readFile('tests/fixtures/selection-ink-ribbon-53c2abd5.ts','utf8')).includes(body),'reference must retain original53c2abd5 geometry verbatim');
const current=await readFile('src/game/SelectionEntryParticles.ts','utf8');
const stripHelper=s=>s.replace(/\/\*\* Reuse the tapered outline[\s\S]*?(?=export function selectionFeedbackRegion)/,'').replace(/\/\*\* Reuse scratch points[\s\S]*?(?=export function selectionFeedbackRegion)/,'');
const baseline=execFileSync('git',['show','fbdaaeec:src/game/SelectionEntryParticles.ts'],{encoding:'utf8'});
assert.equal(stripHelper(current),stripHelper(baseline),'only helper geometry may differ from main');
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5801,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const report={reference:'53c2abd5bd77a2aee12ed43a030314845bac2da9',baseMain:'fbdaaeeca2343b58ed26969f735260673ab1528b',sourceHash:createHash('sha256').update(current).digest('hex'),onlyHelperChanged:true,geometryReferenceVerbatim:true,scope:'One desktop scene; strict Graphics-buffer and Canvas pixel equivalence of original64 versus restored64, plus one native hero switch. No performance matrix/FPS claim or whole-game/aesthetic/device signoff.',errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5801/?harness=1');await openSelector(page,false);await tapUI(page,'character-select','character/amo');await page.waitForTimeout(900);
 const data=await page.evaluate(async()=>{
  const {createSelectionInkRibbon}=await import('/src/game/SelectionEntryParticles.ts'),{legacySelectionInkRibbon}=await import('/tests/fixtures/selection-ink-ribbon-53c2abd5.ts'),scene=window.__harness.game.scene.getScene('character-select');
  const box={x:70,y:72,width:408,height:510},ribbon=createSelectionInkRibbon(box),rows=[];let pictures;
  const sha=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  for(const t of [0,.14,.28,.4,.64,.8,1]){
   const head=1-(1-Math.min(1,t/.64))**2,tail=Math.max(0,(t-.28)/.72),fade=Math.min(1,(1-t)/.24),brush=Math.min(23,Math.max(12,box.width*.06));
   const specs=[[0,brush+3,0xe9dbb1,.7,tail,head],[0,brush,0x183b36,.95,tail,head],[-brush*.2,1.6,0xc6ac6c,.9,Math.max(tail,.12),head]];
   for(let k=0;k<3;k++){const start=Math.max(tail,.12+k*.18),end=Math.min(head,start+.2);if(end>start)specs.push([brush*(k-1)*.19,1,0xe9dbb1,.48,start,end]);}
   const original=scene.make.graphics({},false),restored=scene.make.graphics({},false);
   for(const [offset,width,color,alpha,start,end]of specs){original.fillStyle(color,alpha*fade).fillPoints(legacySelectionInkRibbon(box,start,end,offset,width),true);restored.fillStyle(color,alpha*fade).fillPoints(ribbon(start,end,offset,width),true);}
   if(original.commandBuffer.length!==restored.commandBuffer.length||original.commandBuffer.some((v,i)=>!Object.is(v,restored.commandBuffer[i])))throw Error('Graphics buffer mismatch at '+t);
   const canvases=[original,restored].map(g=>{const c=document.createElement('canvas');c.width=600;c.height=650;g.generateTexture(c,600,650);return c;});
   const pixels=canvases.map(c=>c.getContext('2d').getImageData(0,0,600,650).data);let mismatches=0,nonzero=0;
   for(let i=0;i<pixels[0].length;i++){if(pixels[0][i]!==pixels[1][i])mismatches++;if(i%4===3&&pixels[0][i])nonzero++;}
   if(mismatches)throw Error('Canvas pixels mismatch at '+t);
   if(t===.4){if(!nonzero)throw Error('empty raster evidence');pictures=canvases.map(c=>c.toDataURL());}
   rows.push({t,verticesPerRibbon:130,commands:original.commandBuffer.length,commandBufferExactlyEqual:true,pixelChannelMismatches:mismatches,nontransparentPixels:nonzero,pixelSha256:await sha(pixels[0])});original.destroy();restored.destroy();
  }
  const p=scene.entryParticles;window.losslessNative={samples:0,maxCommands:0};scene.events.on('postupdate',()=>{if(p.activeKind==='switch'){window.losslessNative.samples++;window.losslessNative.maxCommands=Math.max(window.losslessNative.maxCommands,p.feedback.commandBuffer.length);}});
  return{rows,pictures};
 });
 report.equivalence=data.rows;for(const [i,png]of data.pictures.entries())await writeFile(out+(i?'restored64.png':'original53.png'),Buffer.from(png.split(',')[1],'base64'));
 await tapUI(page,'character-select','character/erxiang');await page.waitForTimeout(1000);report.nativeSwitch=await page.evaluate(()=>window.losslessNative);assert.ok(report.nativeSwitch.samples>0);assert.equal(report.nativeSwitch.maxCommands,2532);assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser.close();await server.close();report.cleanup='Chromium/Vite closed in finally';await writeFile(out+'result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
