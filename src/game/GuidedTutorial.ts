import type {SavedRun} from '../application/SavedRun';
import {stableHash} from '../domain/hash';
import {clearPendingNoviceStart,enrollNoviceGuide,markNoviceStart,mayResumeNoviceOpening} from './NoviceGuide';
import {GUIDED_TUTORIAL_SEED,guidedTutorialRunId,isGuidedTutorialRunId} from './RunLaunch';
import type {GameSession} from './session';

/** Continue only the two saved setup commands of a new guided tutorial. */
export async function resumeGuidedTutorialOpening(run:SavedRun):Promise<boolean> {
  let state=run.state;
  if(run.status!=='idle'||run.guidedOpeningSuppressed||state.mode!=='tutorial'||state.characterId!=='erxiang'||state.seed!==GUIDED_TUTORIAL_SEED||
    state.difficulty!==0||state.challengeId!==null||state.programsEnabled||!isGuidedTutorialRunId(state.runId)||state.stageIndex!==0||!mayResumeNoviceOpening(state))return false;
  // Also repairs the window between saving an opening checkpoint and recording
  // its guide; enrollment validates the committed receipts and is idempotent.
  enrollNoviceGuide(state);
  if(state.phase==='await-input'&&state.stage?.index===0)return true;
  if(state.stage!==null)return false;

  if(state.phase==='shop'&&state.commandSeq===1){
    const result=await run.dispatch({type:'LeaveShop'});if(!result.ok)return false;
    state=run.state;
  }
  if(state.phase!=='stage-ready'||state.commandSeq!==2)return false;
  const command={runId:state.runId,commandId:`${state.runId}/command/2`,expectedSeq:1,action:{type:'LeaveShop'}};
  if(!state.receipts.some(receipt=>receipt.seq===2&&receipt.commandId===command.commandId&&receipt.fingerprint===stableHash(command)))return false;
  const entered=await run.dispatch({type:'EnterStage'});
  return entered.ok&&run.state.phase==='await-input'&&run.state.stage?.index===0;
}

function guidedNonce():string|undefined {
  const source=globalThis.crypto;
  if(!source)return;
  try {if(typeof source.randomUUID==='function')return source.randomUUID();}catch{/* Try the lower-level secure source. */}
  try {
    if(typeof source.getRandomValues!=='function')return;
    const bytes=source.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }catch{return;}
}

/** Create and save a real tutorial run before entering the first stage. */
export async function startGuidedTutorial(session:Pick<GameSession,'start'|'reportNotice'|'run'|'pendingRun'>,options:{requireEmptyHistory?:boolean}={}):Promise<SavedRun|undefined> {
  const nonce=guidedNonce();
  if(!nonce){session.reportNotice('无法生成教学对局标识，请使用支持安全随机数的浏览器重试。');return;}
  const runId=guidedTutorialRunId(nonce);
  // This marker is only a permission to resume our own interrupted opening;
  // no teaching progress is recorded until the initial checkpoint is saved.
  markNoviceStart(runId);
  const run=await session.start(GUIDED_TUTORIAL_SEED,'erxiang',
    {mode:'tutorial',difficulty:0,challengeId:null,programsEnabled:false},
    {kind:'new',openingRoute:'group',guidedTutorialNonce:nonce,...(options.requireEmptyHistory?{requireEmptyHistory:true}:{})});
  if(!run){
    if(session.pendingRun?.state.runId!==runId&&session.run?.state.runId!==runId)clearPendingNoviceStart(runId);
    return;
  }
  // Another tab can replace the local pending hint while this save is in
  // flight. The committed run is authoritative, so reclaim our own hint.
  markNoviceStart(runId);
  if(await resumeGuidedTutorialOpening(run))return run;
  session.reportNotice(run.status==='readonly'?'教学对局尚未保存，请先在这里取得写入权限。':run.status==='paused'?'教学对局尚未保存，请先重试保存，再继续教学。':'教学开场尚未完成，请在菜单中继续。');
  return;
}
