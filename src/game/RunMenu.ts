import {createRunMenuInteraction,type RunMenuInteractionState} from './RunMenuInteraction';
import {prepareDestination} from './LoadingScreen';
import {DetailDialog} from './DetailDialog';
import {showCatalog} from './CatalogDialog';
import type Phaser from 'phaser';
import {gameSession} from './session';
import {AudioEngine} from '../audio/AudioEngine';
import {readAudioPreferences} from '../audio/preferences';
import {Haptics} from '../haptics/Haptics';
import {installHapticSetting} from '../haptics/HapticSetting';
import {installFullscreen} from '../platform/Fullscreen';
import {canvasSizeFactor,selectedCanvasSize,setCanvasSize,viewportSafeInsets} from '../platform/Viewport';
import {startGuidedTutorial,resumeGuidedTutorialOpening} from './GuidedTutorial';
import {isGuidedTutorialRunId} from './RunLaunch';
import {dismissNoviceGuide,mayResumeNoviceOpening,noviceGuideDisabled,restoreNoviceGuide} from './NoviceGuide';
import {firstChapterGuideDisabled,restoreFirstChapterGuide} from './FirstChapterGuide';
import {installTutorialReplayHandler,requestTitleNewGame} from './TutorialEntry';
import type {SavedRun} from '../application/SavedRun';

export interface RunMenuActions {
  viewDeck?:()=>void;
  viewRules?:()=>void;
  viewLastHand?:()=>void;
}
const needsGuidedOpening=(run:SavedRun):boolean=>{
  const state=run.state;
  if(run.guidedOpeningSuppressed||state.mode!=='tutorial'||!isGuidedTutorialRunId(state.runId)||state.stageIndex!==0||!mayResumeNoviceOpening(state))return false;
  return state.stage===null&&((state.phase==='shop'&&state.commandSeq===1)||(state.phase==='stage-ready'&&state.commandSeq===2))||
    state.phase==='await-input'&&state.stage?.index===0&&state.commandSeq===3;
};
/** Finish only the interrupted guided opening; ordinary and legacy saves are untouched. */
export async function prepareSavedTutorial(run:SavedRun):Promise<boolean> {
  if(!needsGuidedOpening(run))return true;
  return resumeGuidedTutorialOpening(run);
}
export async function routeSavedRun(game:Phaser.Game):Promise<boolean> {
  const session=gameSession(),run=session.run;if(!run||session.pendingRun||session.working)return false;
  if(needsGuidedOpening(run)&&!await prepareSavedTutorial(run))return false;
  if(session.run!==run||session.pendingRun||session.working)return false;
  game.registry.set('runController',run);game.registry.set('runState',run.state);game.registry.set('characterId',run.state.characterId);game.registry.set('seed',run.state.seed);
  const state=run.state;
  const target=state.phase==='shop'?'shop':['stage-ready','await-input','pending-refill'].includes(state.phase)?'game':state.stage?'intermission':'character-select';
  for(const key of ['title','character-select','shop','game','intermission'])game.scene.stop(key);
  void prepareDestination(game,target).then(prepared=>{if(!prepared)return;game.scene.start(target,target==='intermission'?{cleared:state.phase==='stage-cleared'||state.phase==='run-won',stageIndex:state.stage!.index,stageHeat:state.stage!.heat,handsLeft:state.stage!.handsLeft,goldEarned:state.stage!.goldEarned}:undefined);});
  return true;
}

/** Leave tutorial mode without deleting its checkpoint or replacing ordinary progress. */
export async function skipTutorialToNormal(game:Phaser.Game,reason:'skip'|'complete'='skip'):Promise<boolean> {
  const session=gameSession(),run=session.run;
  if(!run||run.state.mode!=='tutorial')return false;
  if(session.working||session.pendingRun||!await run.flush()||session.run!==run||session.working||session.pendingRun){
    session.reportNotice('当前进度尚未保存，请先在菜单中重试保存，再前往普通游戏。');return false;
  }
  if(reason==='skip')dismissNoviceGuide(run.state,'run',run.journal);
  for(const key of ['title','character-select','shop','game','intermission'])game.scene.stop(key);
  game.scene.start('character-select');return true;
}

/** Progress and presentation preferences survive scene changes. */
export function installRunMenu(game:Phaser.Game,getActions:()=>RunMenuActions|undefined=()=>game.registry.get('runMenuActions') as RunMenuActions|undefined):void {
  const session=gameSession(),audio=AudioEngine.shared,fullscreen=installFullscreen(),haptics=Haptics.shared;
  const host=document.createElement('div'),toggle=document.createElement('button'),fullButton=document.createElement('button'),modal=document.createElement('dialog'),panel=document.createElement('section'),status=document.createElement('p');
  const memoryNotice=document.createElement('p');
  memoryNotice.className='run-memory-notice';memoryNotice.textContent='本局暂未保存，刷新会丢失';memoryNotice.hidden=true;memoryNotice.setAttribute('role','status');memoryNotice.setAttribute('aria-live','polite');
  const fullscreenInfo=document.createElement('p');
  let previousFocus:HTMLElement|undefined,closing=false,needsAttention=false,keyboardInput=false,pointerHeld=false,actionDepth=0,returningFromDialog=false;
  const primaryHover=globalThis.matchMedia?.('(hover: hover) and (pointer: fine)'),anyHover=globalThis.matchMedia?.('(any-hover: hover) and (any-pointer: fine)'),coarsePointer=globalThis.matchMedia?.('(any-pointer: coarse)');
  const insideMenu=(target:EventTarget|null)=>{for(let node=target instanceof HTMLElement?target:undefined;node;node=node.parentElement??undefined)if(node===toggle||node===panel)return true;return false;};
  const externalDialog=()=>[...(document.querySelectorAll?.('dialog[open]')??[])].some(dialog=>dialog!==modal);
  const protectedInteraction=()=>!!document.hidden||pointerHeld||actionDepth>0||externalDialog();
  const stored=(key:string):unknown=>{try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}};
  const audioPreferences=readAudioPreferences(stored('tangsongpai-audio-v2'),stored('tangsongpai-audio-v1'),stored('tangsongpai-presentation-v1'));
  audio.setVolume('master',1);audio.muted=false;audio.musicMuted=false;
  audio.setVolume('music',audioPreferences.music);audio.setVolume('sfx',audioPreferences.sfx);audio.setVolume('ui',audioPreferences.sfx);
  host.className='run-menu';toggle.className='run-menu-toggle';fullButton.className='run-fullscreen-toggle';
  const chevron=document.createElement('span');chevron.className='run-menu-chevron';chevron.textContent='‹';chevron.setAttribute('aria-hidden','true');toggle.append(chevron);
  const caption=document.createElement('span');caption.className='run-menu-caption';caption.textContent='菜单';caption.setAttribute('aria-hidden','true');toggle.append(caption);
  toggle.type=fullButton.type='button';toggle.setAttribute('aria-label','展开菜单');toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','run-menu-modal');
  modal.id='run-menu-modal';modal.className='run-menu-modal';modal.setAttribute('aria-labelledby','run-menu-heading');panel.className='run-menu-panel';
  const heading=document.createElement('h2');heading.id='run-menu-heading';heading.textContent='游戏菜单';panel.append(heading);
  status.className='run-menu-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  fullscreenInfo.className='run-menu-fullscreen-info';fullscreenInfo.hidden=true;fullscreenInfo.setAttribute('role','status');fullscreenInfo.setAttribute('aria-live','polite');
  const updateToggle=(state:Readonly<RunMenuInteractionState>)=>{
    host.dataset.input=state.mode;host.dataset.touchCapable=String(!!coarsePointer?.matches);toggle.classList.toggle('is-pinned',state.pinned);toggle.setAttribute('aria-expanded',String(state.open));
    caption.textContent=state.open&&state.mode==='click'?'收起':'菜单';
    const label=state.open?(state.mode==='click'?'收起菜单':state.pinned?'菜单已固定，点击解除固定':'菜单已展开，点击固定'):(needsAttention?'展开菜单，有进度提示待处理':'展开菜单');
    toggle.setAttribute('aria-label',label);toggle.title=state.mode==='click'?(state.open?'收起菜单':'展开菜单'):(state.pinned?'再次点击解除固定；Escape关闭':'移入展开，点击固定');
    if(state.mode==='hover')toggle.setAttribute('aria-pressed',String(state.pinned));else toggle.removeAttribute('aria-pressed');
  };
  const restoreAnchor=()=>{
    host.prepend(toggle);
    if(previousFocus?.isConnected&&previousFocus!==toggle&&!previousFocus.closest('[hidden]'))previousFocus.focus({preventScroll:true});else toggle.focus({preventScroll:true});previousFocus=undefined;
  };
  const hideMenu=()=>{haptics.stop();returningFromDialog=false;keyboardInput=false;closing=true;if(modal.open){if(typeof modal.close==='function')modal.close();else modal.removeAttribute('open');}restoreAnchor();closing=false;};
  const showMenu=(source:'hover'|'click')=>{
    if(modal.open)return;haptics.stop();previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
    refreshActions();more.open=false;modal.prepend(toggle);
    if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');panel.scrollTop=0;
    if(source==='click'){const action=[takeover,resume,retry,reload,start].find(button=>!button.hidden&&!button.disabled);(action??toggle).focus({preventScroll:true});}
  };
  const interaction=createRunMenuInteraction({hoverCapable:!!(primaryHover?.matches||anyHover?.matches),initialHover:!!primaryHover?.matches,protected:protectedInteraction,open:showMenu,close:hideMenu,change:updateToggle});
  const controllerInput=()=>{keyboardInput=true;pointerHeld=false;interaction.input('gamepad');interaction.focusKeyboard(insideMenu(document.activeElement));};
  const controllerMenu=()=>{controllerInput();if(interaction.state().open)interaction.dismiss();else interaction.show();};
  globalThis.addEventListener?.('tangsongpai-controller-input',controllerInput);globalThis.addEventListener?.('tangsongpai-controller-menu',controllerMenu);
  const close=(returnToGame=false)=>{interaction.dismiss();if(returnToGame)game.canvas.focus({preventScroll:true});};
  const open=()=>interaction.show();
  const inPointerRegion=(event:PointerEvent)=>{
    const a=toggle.getBoundingClientRect?.(),b=panel.getBoundingClientRect?.();if(!a||!b)return false;
    return event.clientX>=Math.min(a.left,b.left)&&event.clientX<=Math.max(a.right,b.right)&&event.clientY>=Math.min(a.top,b.top)&&event.clientY<=Math.max(a.bottom,b.bottom);
  };
  const pointerEnter=(event:PointerEvent)=>{if(event.pointerType==='mouse')interaction.enterMouse();};
  const pointerMove=(event:PointerEvent)=>{if(event.pointerType==='mouse'&&modal.open)interaction.pointerInside(inPointerRegion(event));};
  const pointerDown=(event:PointerEvent)=>{keyboardInput=false;interaction.input(event.pointerType);interaction.focusKeyboard(false);pointerHeld=insideMenu(event.target);if(modal.open&&event.pointerType==='mouse')interaction.pointerInside(inPointerRegion(event));interaction.refresh();};
  const pointerEnd=()=>{pointerHeld=false;interaction.refresh();};
  const keydown=(event:KeyboardEvent)=>{keyboardInput=true;if(modal.open&&insideMenu(document.activeElement))interaction.focusKeyboard(true);if(event.key==='Escape'&&typeof modal.showModal!=='function'&&insideMenu(event.target)){event.preventDefault();close();}};
  const focusIn=(event:FocusEvent)=>{if(!modal.open)return;const inside=insideMenu(event.target);if(!inside&&externalDialog())returningFromDialog=true;if(inside&&(keyboardInput||returningFromDialog)){interaction.focusKeyboard(true);returningFromDialog=false;}else if(keyboardInput)interaction.focusKeyboard(false);};
  const focusOut=(event:FocusEvent)=>{if(!insideMenu(event.relatedTarget))interaction.focusKeyboard(false);};
  const mediaChanged=()=>interaction.capabilities(!!(primaryHover?.matches||anyHover?.matches));
  toggle.onclick=()=>{const state=interaction.state();if(state.mode==='click'&&state.open)audio.cancel();else audio.select();interaction.click();};
  toggle.addEventListener('pointerenter',pointerEnter);panel.addEventListener('pointerenter',pointerEnter);
  toggle.addEventListener('pointerleave',pointerMove);panel.addEventListener('pointerleave',pointerMove);
  document.addEventListener?.('pointermove',pointerMove,true);document.addEventListener?.('pointerdown',pointerDown,true);document.addEventListener?.('pointerup',pointerEnd,true);document.addEventListener?.('pointercancel',pointerEnd,true);
  document.addEventListener?.('keydown',keydown,true);document.addEventListener?.('focusin',focusIn);document.addEventListener?.('focusout',focusOut);
  primaryHover?.addEventListener?.('change',mediaChanged);anyHover?.addEventListener?.('change',mediaChanged);coarsePointer?.addEventListener?.('change',mediaChanged);
  globalThis.addEventListener?.('blur',pointerEnd);
  modal.addEventListener('cancel',event=>{if(event.target===modal){event.preventDefault();close();}});
  modal.addEventListener('close',()=>{if(!closing&&toggle.parentElement===modal)close();});
  const removeInteraction=()=>{
    globalThis.removeEventListener?.('tangsongpai-controller-input',controllerInput);globalThis.removeEventListener?.('tangsongpai-controller-menu',controllerMenu);
    document.removeEventListener?.('pointermove',pointerMove,true);document.removeEventListener?.('pointerdown',pointerDown,true);document.removeEventListener?.('pointerup',pointerEnd,true);document.removeEventListener?.('pointercancel',pointerEnd,true);
    document.removeEventListener?.('keydown',keydown,true);document.removeEventListener?.('focusin',focusIn);document.removeEventListener?.('focusout',focusOut);
    primaryHover?.removeEventListener?.('change',mediaChanged);anyHover?.removeEventListener?.('change',mediaChanged);coarsePointer?.removeEventListener?.('change',mediaChanged);globalThis.removeEventListener?.('blur',pointerEnd);interaction.dispose();
  };
  const button=(name:string,action:()=>void|Promise<unknown>,container:HTMLElement=panel)=>{
    const b=document.createElement('button');b.type='button';b.textContent=name;
    b.onclick=async()=>{if(b.disabled)return;audio.select();actionDepth++;interaction.refresh();try{await action();}catch{status.textContent='暂时无法完成，请重试。';open();}finally{actionDepth--;interaction.refresh();}};
    container.append(b);return b;
  };
  const primary=document.createElement('div');primary.className='run-menu-primary';panel.append(primary,status);
  const resume=button('继续游戏',async()=>{
    if((!session.lease.writable||session.run?.status==='readonly')&&!await session.takeOver())return;
    const run=session.run;if(!run){close();return;}
    const target=run.state.phase==='shop'?'shop':['stage-ready','await-input','pending-refill'].includes(run.state.phase)?'game':run.state.stage?'intermission':'character-select';
    // Closing a menu on the current scene preserves the player's unsubmitted card selection.
    if(game.registry.get('runController')!==run||!game.scene.isActive(target)){if(!await routeSavedRun(game))return;}close(true);
  },primary);resume.className='run-menu-resume';
  const more=document.createElement('details'),moreLabel=document.createElement('summary');more.className='run-menu-more';moreLabel.textContent='更多';more.append(moreLabel);
  const catalogDialog=new DetailDialog();
  const catalogButton=button('图鉴查询',()=>{const snapshot=session.run?.state;showCatalog(catalogDialog,snapshot,()=>session.run?.state===snapshot&&!session.working);},more);
  const inspect=document.createElement('div');inspect.className='run-menu-inspect';more.append(inspect);
  const inspectButtons=(['viewDeck','viewRules','viewLastHand'] as const).map((key,index)=>{
    const action=button(['查看牌组','规则 / 物品','上手详情'][index],()=>{
      const callback=getActions()?.[key];if(typeof callback!=='function'){refreshActions();return;}
      callback();
    },inspect);
    action.dataset.menuAction=key;return {key,button:action};
  });
  const screenTools=document.createElement('div');screenTools.className='run-menu-screen';screenTools.append(fullButton,fullscreenInfo);more.append(screenTools);
  const recovery=document.createElement('div');recovery.className='run-menu-recovery';panel.append(recovery);
  const retry=button('重试保存',async()=>{if(await session.retry()&&await routeSavedRun(game))close(true);},recovery);
  const cancelCandidate=button('取消这次操作',()=>{if(session.cancelPending())refreshState();},recovery);
  const reload=button('重试读取',()=>session.initialize(),recovery);
  const takeover=button('在这里继续',async()=>{
    if(!await session.takeOver())return;
    if(session.run&&!await routeSavedRun(game))return;close(true);
  },recovery);
  const settingsTools=document.createElement('div');settingsTools.className='run-menu-settings-tools';
  const settings=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='声音与画面';settings.className='run-menu-settings';settings.append(legend);settingsTools.append(settings);panel.append(settingsTools);
  const start=button('开始新局',async()=>{
    if(!session.run&&game.scene.isActive('title')&&requestTitleNewGame()){close(true);return;}
    if(session.run&&!await session.run.flush())return;
    for(const key of ['title','shop','game','intermission'])game.scene.stop(key);game.scene.start('character-select');close(true);
  },primary);primary.prepend(start);
  const replayTutorial=async()=>{
    if(session.working||session.pendingRun||!session.loaded||session.storageUnavailable||session.run&&!session.lease.writable){
      session.reportNotice('暂时无法重玩教程，请先完成保存或在这里继续游戏。');return false;
    }
    if(session.run&&!await session.run.flush()){session.reportNotice('当前进度尚未保存，请先在菜单中重试保存。');return false;}
    restoreNoviceGuide();
    const run=await startGuidedTutorial(session);
    if(!run||run!==session.run||run.status!=='idle')return false;
    return routeSavedRun(game);
  };
  const removeTutorialReplay=installTutorialReplayHandler(replayTutorial);
  const replay=button('重玩新手教程',async()=>{if(await replayTutorial())close(true);else status.textContent=session.notice||'教程尚未开始，请检查保存状态后重试。';},more);replay.dataset.menuAction='replay-tutorial';
  const skip=button('跳过教程，开始普通游戏',async()=>{if(await skipTutorialToNormal(game))close(true);else status.textContent=session.notice||'请先完成或重试保存，再跳过教程。';},primary);skip.dataset.menuAction='skip-tutorial';
  const speedLabel=document.createElement('label'),speed=document.createElement('select');speedLabel.textContent='计分速度 ';
  for(const value of [1,2,4]){const option=document.createElement('option');option.value=String(value);option.textContent=`${value}×`;speed.append(option);}speed.value=String(session.speed);speedLabel.append(speed);settings.append(speedLabel);
  const sizeLabel=document.createElement('label'),size=document.createElement('select');sizeLabel.textContent='画面大小 ';
  for(const [value,label] of [['auto','跟随浏览器字号'],['standard','标准'],['large','较大（最多1.2倍）']] as const){const option=document.createElement('option');option.value=value;option.textContent=label;size.append(option);}
  size.value=selectedCanvasSize();sizeLabel.append(size);settings.append(sizeLabel);
  const sizeHint=document.createElement('small');sizeHint.className='canvas-size-hint';settings.append(sizeHint);
  const refreshSizeHint=()=>{const bounds=game.canvas.getBoundingClientRect(),factor=canvasSizeFactor(bounds.width,bounds.height,selectedCanvasSize(),viewportSafeInsets());sizeHint.textContent=`当前画布 ${Math.round(factor*100)}%。跟随模式在浏览器默认字号达到20px时放大画布文字和按钮，部分页面会重新排布；小窗口和安全区会限制放大。`;};
  size.onchange=()=>{setCanvasSize(size.value==='large'?'large':size.value==='standard'?'standard':'auto');refreshSizeHint();};refreshSizeHint();globalThis.addEventListener?.('resize',refreshSizeHint);globalThis.addEventListener?.('focus',refreshSizeHint);
  const reduced=document.createElement('input'),reducedLabel=document.createElement('label');reduced.type='checkbox';reduced.checked=session.reducedMotion;reducedLabel.append(reduced,document.createTextNode(' 减少动态'));settings.append(reducedLabel);
  const enableGuide=button('重新开启新手引导',()=>{restoreNoviceGuide();restoreFirstChapterGuide();refreshActions();},settings);enableGuide.dataset.menuAction='enable-tutorial-guide';
  const disableGuide=button('不再显示新手引导',()=>{const run=session.run;if(run)dismissNoviceGuide(run.state,'forever',run.journal);refreshActions();},settings);disableGuide.dataset.menuAction='disable-tutorial-guide';
  const presentation=()=>session.preferences(Number(speed.value) as 1|2|4,reduced.checked);
  speed.onchange=presentation;reduced.onchange=presentation;
  const removeHapticSetting=installHapticSetting(settings,haptics);
  const audioControls=document.createElement('div');audioControls.className='audio-controls';settings.append(audioControls);
  for(const [bus,label]of [['music','背景音量'],['sfx','音效音量']] as const){
    const row=document.createElement('label'),name=document.createElement('span'),range=document.createElement('input'),value=document.createElement('output');
    row.className='audio-volume-label';name.textContent=label;range.type='range';range.min='0';range.max='100';range.step='1';range.value=String(Math.round(audio.getVolume(bus)*100));range.setAttribute('aria-label',label);value.textContent=range.value+'%';value.className='audio-volume-value';
    row.append(name,range,value);audioControls.append(row);
    range.oninput=()=>{const volume=Number(range.value)/100;audio.setVolume(bus,volume);if(bus==='sfx')audio.setVolume('ui',volume);value.textContent=range.value+'%';void audio.unlock();saveAudio();};
  }
  const audioHint=document.createElement('small');audioHint.className='audio-controls-hint';audioHint.textContent='音量拖到 0% 即可关闭。';audioControls.append(audioHint);
  function saveAudio():void {try{localStorage.setItem('tangsongpai-audio-v2',JSON.stringify({version:2,music:audio.getVolume('music'),sfx:audio.getVolume('sfx')}));}catch{/* Audio preferences are optional. */}}
  saveAudio();
  function refreshActions():void {
    catalogButton.disabled=session.working||!session.loaded;
    enableGuide.hidden=!noviceGuideDisabled()&&!firstChapterGuideDisabled();
    disableGuide.hidden=noviceGuideDisabled()||session.run?.state.mode!=='tutorial';
    const actions=getActions();for(const entry of inspectButtons)entry.button.hidden=typeof actions?.[entry.key]!=='function';
    inspect.hidden=inspectButtons.every(entry=>entry.button.hidden);
  }
  panel.append(more);
  function refreshState():void {
    const run=session.run,pending=session.pendingRun,saving=pending??run;
    game.registry.set('persistentStorageReady',session.persistentReady);
    if(run){game.registry.set('runController',run);game.registry.set('runState',run.state);}else{game.registry.remove('runController');game.registry.remove('runState');}
    const elsewhere=!!session.lease.elsewhere||run?.status==='readonly';
    status.textContent=session.storageUnavailable?'浏览器暂时无法保存进度，请重试。':!session.loaded?(session.notice?'暂时无法读取进度，请重试。':'正在准备…'):pending?'这次操作还没保存，请重试，或取消返回原进度。':elsewhere?'游戏已在另一页打开。':run?.status==='paused'?(run.lastError==='quota-exceeded'?'空间不足，暂时无法保存。请清理浏览器空间后重试。':'暂时无法保存进度，请重试。'):run?.status==='saving'?'正在保存…':session.notice||'';
    resume.hidden=!run;resume.textContent=elsewhere?'在这里继续':'继续游戏';resume.disabled=session.working||!!pending||!!run&&!['idle','readonly'].includes(run.status);
    retry.hidden=saving?.status!=='paused';retry.disabled=session.working;cancelCandidate.hidden=!pending;cancelCandidate.disabled=session.working||saving?.status==='saving';
    reload.hidden=session.persistentReady||!!run||!!pending||!session.notice;reload.disabled=session.working||!!pending||!session.notice;
    takeover.hidden=!!run||!session.loaded||!session.lease.elsewhere;takeover.disabled=session.working||!!pending;
    start.disabled=session.working||!!pending||!session.loaded||session.storageUnavailable||!!run&&!session.lease.writable||run?.status==='saving'||run?.status==='paused';
    replay.disabled=start.disabled;skip.hidden=run?.state.mode!=='tutorial';skip.disabled=start.disabled;
    enableGuide.hidden=!noviceGuideDisabled()&&!firstChapterGuideDisabled();
    start.className='run-menu-new dialog-primary';
    recovery.hidden=[retry,reload,cancelCandidate,takeover].every(b=>b.hidden);
    refreshActions();
    memoryNotice.hidden=!session.temporaryRun;
    const critical=!!session.temporaryRun||!!pending||!!session.storageUnavailable||run?.status==='paused'||elsewhere;
    needsAttention=critical;toggle.classList.toggle('needs-attention',critical);updateToggle(interaction.state());status.dataset.tone=critical?'warning':run?.status==='saving'?'pending':'normal';
  }
  fullButton.onclick=()=>{actionDepth++;interaction.refresh();void fullscreen.toggle().then(()=>{if(!fullscreen.getState().message)close();}).finally(()=>{actionDepth--;interaction.refresh();});};
  const unsubscribeFullscreen=fullscreen.subscribe(state=>{
    fullButton.textContent=state.active?'退出全屏':'全屏游玩';fullButton.setAttribute('aria-label',state.active?'退出全屏':'进入全屏');fullButton.setAttribute('aria-pressed',String(state.active));fullButton.setAttribute('aria-busy',String(state.pending));fullButton.disabled=state.pending;
    fullButton.title=state.active?'退出浏览器全屏':'全屏游玩，减少浏览器工具栏占用';
    fullscreenInfo.textContent=state.message;fullscreenInfo.hidden=!state.message;
  });
  modal.append(panel);host.append(toggle,memoryNotice,modal);document.body.append(host);
  const unsubscribe=session.subscribe(refreshState);refreshState();
  const sceneKey=()=>game.scene.getScenes?.(true).map(scene=>scene.sys.settings.key).sort().join('|');let lastScene=sceneKey();
  const refreshLiveActions=()=>{const scene=sceneKey();if(scene!==lastScene){lastScene=scene;close(interaction.state().open);}if(modal.open){refreshActions();interaction.refresh();}};game.events.on('poststep',refreshLiveActions);
  const refreshMenuActions=(_parent:unknown,key:string)=>{if(key==='runMenuActions')refreshActions();};
  for(const event of ['setdata','changedata','removedata'])game.registry.events.on(event,refreshMenuActions);
  game.events.once('destroy',()=>{game.events.off('poststep',refreshLiveActions);globalThis.removeEventListener?.('resize',refreshSizeHint);globalThis.removeEventListener?.('focus',refreshSizeHint);removeInteraction();removeTutorialReplay();catalogDialog.close();unsubscribe();unsubscribeFullscreen();for(const event of ['setdata','changedata','removedata'])game.registry.events.off(event,refreshMenuActions);fullscreen.dispose();removeHapticSetting();haptics.dispose();if(modal.open)modal.close();host.remove();});
}
