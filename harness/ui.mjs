/** Read actual Phaser hit geometry; all actions remain browser mouse/touch/DOM inputs. */
import assert from 'node:assert/strict';
export const waitScene=(page,key)=>page.waitForFunction(key=>window.__harness?.game.scene.isActive(key),key);
export async function point(page,key,name){
  const native=page.locator('[data-ui="'+key+'/'+name+'"]');
  if(await native.count()){await native.waitFor({state:'visible'});const b=await native.boundingBox();assert.ok(b,'visible native UI');return {x:b.x+b.width/2,y:b.y+b.height/2,enabled:!await native.isDisabled()};}
  await page.waitForFunction(({key,name})=>{const scene=window.__harness?.game.scene.getScene(key);if(!scene?.scene.isActive())return false;const walk=list=>list.some(o=>o.name===name||o.list&&walk(o.list));return walk(scene.children.list);},{key,name});
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const game=window.__harness.game,done=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{game.events.off('poststep',done);reject(Error('Phaser poststep timeout'));},5000);game.events.once('poststep',done);
  }));
  const p=await page.evaluate(({key,name})=>{
    const game=window.__harness.game,scene=game.scene.getScene(key),walk=list=>{for(const o of list){if(o.name===name)return o;if(o.list){const found=walk(o.list);if(found)return found;}}},o=walk(scene.children.list),r=game.canvas.getBoundingClientRect(),hit=o.input?.hitArea;
    const x=hit?hit.x+hit.width/2-o.displayOriginX:0,y=hit?hit.y+hit.height/2-o.displayOriginY:0,matrix=o.getWorldTransformMatrix(),p=matrix.transformPoint(x,y);
    const camera=scene.cameras.main,screen=camera.matrix.transformPoint(p.x-camera.scrollX,p.y-camera.scrollY);
    const xCss=r.left+screen.x*r.width/game.scale.width,yCss=r.top+screen.y*r.height/game.scale.height;
    scene.view?.recordDiagnostic?.('point-read',()=>({name,x:xCss,y:yCss,enabled:!!o.input?.enabled,hit:{x:hit?.x,y:hit?.y,width:hit?.width,height:hit?.height},shop:scene.entryDiagnosticSnapshot?.(),dom:document.elementsFromPoint(xCss,yCss).slice(0,6).map(el=>{const b=el.getBoundingClientRect();return{tag:el.tagName,className:String(el.className),ui:el.getAttribute('data-ui'),role:el.getAttribute('role'),label:el.getAttribute('aria-label'),text:el.textContent?.trim().slice(0,100),disabled:el.disabled,rect:{x:b.x,y:b.y,width:b.width,height:b.height},pointerEvents:getComputedStyle(el).pointerEvents};}),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({className:d.className,label:d.getAttribute('aria-label'),buttons:[...d.querySelectorAll('button')].slice(0,8).map(b=>({text:b.textContent,disabled:b.disabled}))}))}));
    return{x:xCss,y:yCss,enabled:!!o.input?.enabled};
  },{key,name});assert.ok(p,'visible named UI');return p;
}
export async function tapUI(page,key,name,touch=false){
  if(key==='shop'&&['action/chapter','action/items'].includes(name)&&await page.evaluate(()=>window.__harness.game.scene.getScene('shop').geometry().portrait)){
    await tapUI(page,'shop','action/build',touch);const all=page.getByRole('button',{name:'查看全部现货与持牌',exact:true});if(await all.count()){if(touch)await all.tap();else await all.click();}if(name==='action/items'){const manage=page.getByRole('button',{name:'持有牌管理',exact:true});if(touch)await manage.tap();else await manage.click();}const button=page.getByRole('button',{name:name==='action/chapter'?'本章节目':'物品与道具',exact:true});if(touch)await button.tap();else await button.click();return;
  }
  const native=page.locator('[data-ui="'+key+'/'+name+'"]'),nativeCount=await native.count();
  if(key==='shop'&&name.startsWith('offer/')&&!nativeCount)for(let i=0;i<8;i++){
    const visible=await page.evaluate(name=>{const s=window.__harness.game.scene.getScene('shop'),walk=list=>list.some(o=>o.name===name||o.list&&walk(o.list));return walk(s.children.list);},name);if(visible)break;
    await tapUI(page,'shop','action/shelf-page',touch);
  }
  if(nativeCount){assert.equal(nativeCount,1,'one native action for '+key+'/'+name);if(touch)await native.tap();else await native.click();}
  else{const p=await point(page,key,name);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
  // Touch returns before Phaser consumes its pointer-up; observe the real next frame before another choice.
  await page.evaluate(()=>new Promise((resolve,reject)=>{const game=window.__harness.game,timer=setTimeout(()=>{game.events.off('poststep',done);reject(Error('Phaser post-tap timeout'));},5000),done=()=>{clearTimeout(timer);resolve();};game.events.once('poststep',done);}));
}
/** Keep the accessibility contract while pinning and leaving through real pointer input. */
async function runMenuArrow(page,expanded){
  const arrow=page.locator('.run-menu-toggle');
  assert.equal(await arrow.count(),1,'one persistent menu arrow');
  assert.equal(await arrow.getAttribute('aria-expanded'),String(expanded),'arrow describes the actual panel state');
  const pressed=await arrow.getAttribute('aria-pressed'),label=await arrow.getAttribute('aria-label');
  assert.ok(pressed===null||pressed==='true'||pressed==='false','menu exposes a valid optional pin state');
  if(expanded)assert.equal(label,pressed===null?'收起菜单':pressed==='true'?'菜单已固定，点击解除固定':'菜单已展开，点击固定','menu arrow describes current input and pin state');
  else{assert.match(label,/^展开菜单(?:，有进度提示待处理)?$/,'closed menu retains its accessible entry');if(pressed!==null)assert.equal(pressed,'false','a closed menu is not pinned');}
  return {arrow,pressed};
}
export async function toggleRunMenu(page,touch=false){
  const expanded=await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open),{arrow,pressed}=await runMenuArrow(page,expanded);
  if(expanded&&!touch&&pressed!==null){
    if(pressed==='true')await arrow.click();
    // The approved PC action unpins; leaving the whole menu then lets its own 220ms close run.
    await page.mouse.move(0,0);
  }else if(touch)await arrow.tap();else await arrow.click();
  await page.waitForFunction(expected=>document.querySelector('.run-menu-modal')?.open===expected,!expanded);
  assert.equal(await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open),!expanded,'native menu input reaches the requested panel state');
  await runMenuArrow(page,!expanded);
}
export async function openRunMenu(page,touch=false){
  if(!await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open))await toggleRunMenu(page,touch);
  const {arrow,pressed}=await runMenuArrow(page,true);
  if(!touch&&pressed==='false'){await arrow.click();assert.equal(await arrow.getAttribute('aria-pressed'),'true','mouse actions pin a hover-open menu');}
  assert.equal(await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open),true,'menu stays expanded for its next native action');
}
export async function openMenuSection(page,section,touch=false){
  const tap=async locator=>touch?locator.tap():locator.click();
  await openRunMenu(page,touch);
  assert.ok(['settings','more','playback'].includes(section),'known menu section');
  const details=page.locator(section==='more'?'.run-menu-more':'.run-menu-'+section+'-tools');
  if(await details.evaluate(element=>element.tagName==='DETAILS'&&!element.open))await tap(details.locator('summary'));
}
export async function tapMenuAction(page,label,touch=false){
  const tap=async locator=>touch?locator.tap():locator.click();
  await openRunMenu(page,touch);
  if(['图鉴查询','查看牌组','规则 / 物品','上手详情','进入全屏','退出全屏'].includes(label))await openMenuSection(page,'more',touch);
  if(['快进当前手','回看上一手'].includes(label))await openMenuSection(page,'playback',touch);
  await tap(page.getByRole('button',{name:label,exact:true}));
}
/** Open the real title control when present; never bypass the production opening scene. */
export async function openSelector(page,touch=false){
  await page.waitForFunction(()=>window.__harness?.game.scene.isActive('title')||window.__harness?.game.scene.isActive('character-select'));
  if(await page.evaluate(()=>window.__harness.game.scene.isActive('title')))await tapUI(page,'title','action/title-start',touch);
  await waitScene(page,'character-select');
}
/** Follow the production hero → route → joint confirmation, including old-save prompts. */
export async function confirmHeroRoute(page,touch=false,focus='group'){
  const hero=page.locator('dialog.hero-explanation[open]');if(await hero.count()){const close=hero.getByRole('button',{name:'回到选角',exact:true});if(touch)await close.tap();else await close.click();}
  if(await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').step==='hero'))await tapUI(page,'character-select','action/confirm-character',touch);
  await tapUI(page,'character-select','route/'+focus,touch);
  await tapUI(page,'character-select','action/confirm-character',touch);
}
/** The saved new run pauses at the poker examples before its first shop. */
export async function enterOpeningShop(page,touch=false){
  const briefing=page.locator('.opening-rule-briefing[open]');await briefing.waitFor();
  const enter=briefing.locator('.dialog-primary');
  if(touch)await enter.tap();else await enter.click();
  await waitScene(page,'shop');
}
export async function chooseCharacter(page,id,touch=false){await openSelector(page,touch);await tapUI(page,'character-select','character/'+id,touch);await confirmHeroRoute(page,touch);await enterOpeningShop(page,touch);}
export async function buyOffer(page,id,touch=false){await tapUI(page,'shop','offer/'+id,touch);const button=page.getByRole('button',{name:/^(邀请|购买) · \d+ 金$/});if(touch)await button.tap();else await button.click();}
