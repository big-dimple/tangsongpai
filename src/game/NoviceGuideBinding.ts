import type Phaser from 'phaser';
import type {SavedRun} from '../application/SavedRun';
import type {R2RunState} from '../domain/run';
import {
  noviceGuide, NOVICE_GUIDE_PREFERENCES_EVENT,
  type NoviceGuideHint,
} from './NoviceGuide';
import {mountNoviceGuideView, type NoviceGuideGeometry, type NoviceGuideHandle, type NoviceGuideStep} from './NoviceGuideView';
import {gameSession} from './session';
import {isGuidedTutorialRunId} from './RunLaunch';

export type NoviceGuideSceneKind='game'|'shop'|'intermission';
export interface NoviceGuideBindingOptions {
  kind:NoviceGuideSceneKind;
  /** Resolve live scene anchors to viewport CSS pixels. */
  getGeometry:(hint:NoviceGuideHint)=>NoviceGuideGeometry;
  /** Resolve false if the transition cannot be completed, e.g. while saving is paused. */
  onReplay:()=>boolean|Promise<boolean>;
  onSkip:()=>boolean|Promise<boolean>;
  onComplete:()=>boolean|Promise<boolean>;
  /** For example, hold a new result until the score presentation has finished. */
  visible?:(hint:NoviceGuideHint)=>boolean;
  /** Local selections can update the prompt without becoming saved progress. */
  presentHint?:(hint:NoviceGuideHint)=>NoviceGuideHint;
  getInlineHost?:()=>HTMLElement|undefined;
}
export interface NoviceGuideUnmount {
  ():void;
  /** Refresh after an external layout or visibility change. */
  refresh():void;
}

interface RunPresentation {
  runId:string;
  closed:boolean;
}
// Scene transitions reuse the same SavedRun; a closed panel stays closed.
// Weak keys do not retain a replaced run.
const presentations=new WeakMap<SavedRun,RunPresentation>();
function presentation(run:SavedRun):RunPresentation {
  let entry=presentations.get(run);
  if(!entry||entry.runId!==run.state.runId){entry={runId:run.state.runId,closed:false};presentations.set(run,entry);}
  return entry;
}

function belongs(kind:NoviceGuideSceneKind,state:R2RunState,hint:NoviceGuideHint):boolean {
  const phase=state.phase;
  switch(hint.step){
    case 'pair':case 'discard':case 'independent':
      return kind==='game'&&(phase==='await-input'||phase==='pending-refill');
    case 'skill':case 'skill-practice':
      return kind==='shop'&&phase==='shop'||kind==='game'&&['stage-ready','await-input','pending-refill'].includes(phase)||
        kind==='intermission'&&phase==='stage-cleared';
    case 'shop':
      return kind==='shop'&&phase==='shop'||kind==='intermission'&&phase==='stage-cleared';
    case 'payoff':
      return kind==='shop'&&phase==='shop'||kind==='game'&&['stage-ready','await-input','pending-refill'].includes(phase)||
        kind==='intermission'&&phase==='stage-cleared';
    case 'complete':
      return kind==='shop'&&phase==='shop'||kind==='game'&&['stage-ready','await-input','pending-refill','stage-cleared','run-lost','run-won'].includes(phase)||
        kind==='intermission'&&['stage-cleared','run-lost','run-won'].includes(phase);
    case 'replay':
      return kind==='shop'&&phase==='shop'||kind==='game'&&['stage-ready','await-input','pending-refill','stage-cleared','run-lost','run-won'].includes(phase)||
        kind==='intermission'&&['stage-cleared','run-lost','run-won'].includes(phase);
  }
}

/** Bind only the published SavedRun; a pending candidate is never tutorial progress. */
export function bindNoviceGuide(scene:Phaser.Scene,options:NoviceGuideBindingOptions):NoviceGuideUnmount {
  // Ordinary and imported runs never need a tutorial listener. Starting or
  // resuming another run remounts its scene through the normal router.
  const owner=scene.registry.get('runController') as SavedRun|undefined;
  if(!owner||owner.state.mode!=='tutorial'||!isGuidedTutorialRunId(owner.state.runId)||owner.guidedOpeningSuppressed){
    const noop=(()=>{}) as NoviceGuideUnmount;noop.refresh=()=>{};return noop;
  }
  const session=gameSession();
  let stopped=false,suspended=false,actionPending=false,view:NoviceGuideHandle|undefined;
  let sourceRun:SavedRun|undefined,sourceState:R2RunState|undefined,sourceJournal:SavedRun['journal']|undefined;
  let hint:NoviceGuideHint|undefined,shownHint:NoviceGuideHint|undefined,shownHintKey='',shownMotion:boolean|undefined;
  let actionError='',shownError='',sawPair=false,scoreFeedbackStart:number|undefined;
  let geometry:NoviceGuideGeometry={},geometryKey='',lastMeasurement=-Infinity;
  let inlineHost:HTMLElement|undefined;

  const removeView=()=>{view?.unmount();view=undefined;shownHint=undefined;shownHintKey='';shownMotion=undefined;shownError='';geometryKey='';inlineHost=undefined;};
  const activeRun=()=>{
    const run=session.run;
    return run&&!run.guidedOpeningSuppressed&&scene.registry.get('runController')===run?run:undefined;
  };
  const makeGeometryKey=(value:NoviceGuideGeometry)=>JSON.stringify([
    (value.highlights??[]).map(b=>[b.x,b.y,b.width,b.height]),
    (value.avoid??[]).map(b=>[b.x,b.y,b.width,b.height]),
  ]);
  const measure=(current:NoviceGuideHint,force:boolean)=>{
    const now=performance.now();
    // Track a moving/raised card at display cadence; a two-frame delay leaves
    // the ring visibly behind while a phone hand is being sorted.
    if(!force&&now-lastMeasurement<16)return false;
    lastMeasurement=now;
    const next=options.getGeometry(current),key=makeGeometryKey(next),changed=key!==geometryKey;
    geometry=next;geometryKey=key;return changed;
  };
  const canShow=(run:SavedRun,current:NoviceGuideHint)=>!suspended&&belongs(options.kind,run.state,current)&&(options.visible?.(current)??true);
  const stillCurrent=(run:SavedRun,current:NoviceGuideHint)=>{
    if(stopped||activeRun()!==run||!canShow(run,current))return false;
    return noviceGuide(run.state,run.journal)?.step===current.step;
  };
  const invoke=(run:SavedRun,action:()=>boolean|Promise<boolean>)=>{
    if(actionPending)return;
    actionPending=true;actionError='';render();
    const finish=(ok:boolean)=>{
      actionPending=false;
      if(ok){presentation(run).closed=false;return;}
      if(stopped||activeRun()!==run)return;
      actionError='操作尚未完成，请检查保存状态后重试。';
      presentation(run).closed=false;
      refreshSource(true);view?.reopen();
    };
    try {Promise.resolve(action()).then(finish,()=>finish(false));} catch {finish(false);}
  };
  const makeStep=(run:SavedRun,current:NoviceGuideHint):NoviceGuideStep=>({
    id:current.step,title:current.cue,body:current.body+(actionError?'\n'+actionError:''),
    ...(current.details?{details:current.details}:{}),
    ...(current.step==='replay'?{action:{label:'重新练习',run:()=>{if(stillCurrent(run,current))invoke(run,options.onReplay);}}}:{}),
    ...(current.step==='complete'?{action:{label:'开始普通游戏',run:()=>{if(stillCurrent(run,current))invoke(run,options.onComplete);}}}:{}),
  });

  const render=(forceGeometry=false)=>{
    if(stopped)return;
    const run=activeRun();
    if(!run){removeView();return;}
    const prefs=presentation(run);let current=hint?(options.presentHint?.(hint)??hint):undefined;
    if(!current||!canShow(run,current)){removeView();return;}
    if(current.step==='pair')sawPair=true;
    if(current.step==='discard'&&sawPair&&scoreFeedbackStart===undefined)scoreFeedbackStart=performance.now();
    if(current.step==='discard'&&current.focus!=='discard'&&scoreFeedbackStart!==undefined){
      const elapsed=performance.now()-scoreFeedbackStart,stage=run.state.stage;
      if(elapsed<1300)current={...current,focus:'score',body:`这一手得 ${current.fact?.pairScore??'0'} 分。`};
      else if(elapsed<2600&&stage)current={...current,focus:'goal',body:`累计 ${stage.heat} / ${stage.targetHeat} 分。`};
    }
    const currentKey=JSON.stringify([current.step,current.cue,current.body,current.details,current.recommendedCardIds,current.offerIds,current.focus]);
    const hintChanged=shownHintKey!==currentKey;
    const nextInlineHost=options.getInlineHost?.(),hostChanged=nextInlineHost!==inlineHost;inlineHost=nextInlineHost;
    const geometryChanged=measure(current,forceGeometry||!view||hintChanged),motion=session.reducedMotion;
    if(view&&shownMotion!==motion)removeView();
    if(!view){
      // removeView clears the geometry key but the measured value remains valid.
      geometryKey=makeGeometryKey(geometry);
      view=mountNoviceGuideView({
        step:makeStep(run,current),getGeometry:()=>geometry,getInlineHost:options.getInlineHost,reducedMotion:motion,
        onClose:()=>{presentation(run).closed=true;},
        onReopen:()=>{if(!stopped&&activeRun()===run)presentation(run).closed=false;},
        onSkip:()=>{
          const activeHint=shownHint;
          if(actionPending||!activeHint||!stillCurrent(run,activeHint)){view?.reopen();return;}
          presentation(run).closed=true;invoke(run,options.onSkip);
        },
      });
      shownHint=current;shownHintKey=currentKey;shownMotion=motion;shownError=actionError;
      if(prefs.closed)view.close();
    } else if(hintChanged||shownError!==actionError){shownHint=current;shownHintKey=currentKey;shownError=actionError;view.update(makeStep(run,current));}
    else if(geometryChanged||hostChanged)view.refresh();
  };
  const refreshSource=(force=false)=>{
    if(stopped)return;
    const run=activeRun();
    if(!run){sourceRun=undefined;sourceState=undefined;sourceJournal=undefined;hint=undefined;actionError='';removeView();return;}
    if(force||run!==sourceRun||run.state!==sourceState||run.journal!==sourceJournal){
      if(run!==sourceRun||run.state!==sourceState)actionError='';
      sourceRun=run;sourceState=run.state;sourceJournal=run.journal;
      hint=noviceGuide(run.state,run.journal);
    }
    render(true);
  };
  const onPreferences=()=>{
    const run=activeRun(),previous=run===sourceRun?hint:undefined;
    refreshSource(true);
    // A menu request to re-enable a muted/disabled guide explicitly asks to see
    // it, even if it had been collapsed before. The menu may still be open;
    // remember the intent until the scene becomes visible again.
    if(run&&run===sourceRun&&!previous&&hint){presentation(run).closed=false;view?.reopen();}
  };
  const onSuspend=()=>{suspended=true;removeView();};
  const onResume=()=>{suspended=false;refreshSource(true);};
  // The hint is re-derived only when the saved snapshot or preferences change;
  // this light check also follows scene animation/layout changes between saves.
  const onPostUpdate=()=>{
    if(stopped)return;
    const run=activeRun();
    if(run!==sourceRun||run&&(run.state!==sourceState||run.journal!==sourceJournal)){refreshSource();return;}
    render();
  };
  const onRegistry=()=>refreshSource();
  const unsubscribe=session.subscribe(()=>refreshSource());
  scene.registry.events.on('setdata',onRegistry);scene.registry.events.on('changedata',onRegistry);scene.registry.events.on('removedata',onRegistry);
  scene.events.on('pause',onSuspend);scene.events.on('sleep',onSuspend);
  scene.events.on('resume',onResume);scene.events.on('wake',onResume);scene.events.on('postupdate',onPostUpdate);
  if(typeof window!=='undefined')window.addEventListener(NOVICE_GUIDE_PREFERENCES_EVENT,onPreferences);
  const unmount=(()=>{
    if(stopped)return;stopped=true;unsubscribe();removeView();
    scene.registry.events.off('setdata',onRegistry);scene.registry.events.off('changedata',onRegistry);scene.registry.events.off('removedata',onRegistry);
    scene.events.off('pause',onSuspend);scene.events.off('sleep',onSuspend);
    scene.events.off('resume',onResume);scene.events.off('wake',onResume);scene.events.off('postupdate',onPostUpdate);
    scene.events.off('shutdown',unmount);scene.events.off('destroy',unmount);
    if(typeof window!=='undefined')window.removeEventListener(NOVICE_GUIDE_PREFERENCES_EVENT,onPreferences);
  }) as NoviceGuideUnmount;
  unmount.refresh=()=>refreshSource(true);
  scene.events.once('shutdown',unmount);scene.events.once('destroy',unmount);
  refreshSource();
  return unmount;
}
