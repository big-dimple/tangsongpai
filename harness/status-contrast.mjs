import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build,preview} from 'vite';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {waitScene,tapUI,chooseCharacter} from './ui.mjs';

// Exercise the real AI control, then a deliberately long status in each layout.
// Screenshots and background samples are from Chromium's rendered canvas.
const out='shots/status-contrast';await mkdir(out,{recursive:true});
await build({mode:'e2e',build:{outDir:'.vite/status-contrast-build',emptyOutDir:true},logLevel:'error'});
const server=await preview({build:{outDir:'.vite/status-contrast-build'},preview:{host:'127.0.0.1',port:5589,strictPort:true},logLevel:'error'});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const luminance=rgb=>{const c=rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const overlap=(a,b)=>a.x<b.x+b.width-.1&&b.x<a.x+a.width-.1&&a.y<b.y+b.height-.1&&b.y<a.y+a.height-.1;
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference'}),p=await context.newPage();
 try{
  const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:5589/?harness=1&seed=status');await chooseCharacter(p,'amo',false);await tapUI(p,'shop','action/start-stage',false);await waitScene(p,'game');await p.getByRole('button',{name:'进入暖场 ›',exact:true}).click();
  await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&!s.presentation&&s.aiButton.input?.enabled&&s.cardViews.every(v=>!v.dealing);});
  await tapUI(p,'game','selection/switch-type',false);await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').statusText.text.includes('AI已选'));
  const ai=await p.evaluate(()=>window.__harness.game.scene.getScene('game').statusMessage);
  const long='已换组，仍需自己出牌；查看牌型可撤销。选择已变化，请重新查看；本次没有消耗物品或资源。';
  for(const viewport of [{width:1366,height:768},{width:844,height:390},{width:390,height:844},{width:320,height:568}]){
   await p.setViewportSize(viewport);await p.emulateMedia({reducedMotion:viewport.width===320?'reduce':'no-preference'});await p.waitForTimeout(250);
   for(const [kind,message] of [['ai',ai],['flush-five','AI已选同花五条 · 查看牌型可撤销'],['long',long]]){
    const row=await p.evaluate(message=>{const s=window.__harness.game.scene.getScene('game');s.statusMessage=message;s.updateControls();const box=o=>{const b=o.getBounds();return{x:b.x,y:b.y,width:b.width,height:b.height};};const caption=s.view.root.list.find(o=>o.name==='table/played-label'&&o.visible);return {text:s.statusText.text,full:s.statusText.getData('fullStatus'),color:s.statusText.style.color,bounds:box(s.statusText),area:s.view.layout.status,visible:s.statusText.visible,buttons:[box(s.playButton),box(s.discardButton)],cards:s.cardViews.filter(v=>v.hit.visible).map(v=>box(v.hit)),caption:caption?box(caption):null};},message);
    assert.ok(row.visible&&row.text.length>0);assert.equal(row.full,message);assert.equal(row.color,'#30251f');assert.ok(row.bounds.x>=0&&row.bounds.y>=0&&row.bounds.x+row.bounds.width<=viewport.width+.1&&row.bounds.y+row.bounds.height<=viewport.height+.1);
    for(const target of [...row.buttons,...row.cards,...(row.caption?[row.caption]:[])])assert.ok(!overlap(row.bounds,target),`${viewport.width} ${kind} overlaps content`);
    const png=await p.screenshot({path:`${out}/${viewport.width}-${kind}.png`});
    const b=row.bounds,{data,info}=await sharp(png).extract({left:Math.floor(b.x),top:Math.floor(b.y),width:Math.max(1,Math.ceil(b.width)),height:Math.max(1,Math.ceil(b.height))}).removeAlpha().raw().toBuffer({resolveWithObject:true});const counts=new Map();for(let i=0;i<data.length;i+=info.channels){const key=[...data.subarray(i,i+3)].join(',');counts.set(key,(counts.get(key)??0)+1);}const bg=[...counts].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number),ink=[0x30,0x25,0x1f],ratio=(luminance(bg)+.05)/(luminance(ink)+.05);assert.ok(ratio>=4.5,`${viewport.width} ${kind} ratio ${ratio} background ${bg}`);
    console.log(`${viewport.width} ${kind}: ${row.text} · background rgb(${bg}) · contrast ${ratio.toFixed(2)}:1`);
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
