import {prepareBossSuitRescueAction} from '../../src/domain/r2BossSuitRescue';
import {applyCommand,createRun,type Action,type Command,type R2RunState} from '../../src/domain/run';
import {newRunIdentity} from '../../src/game/RunLaunch';
import {r2HouseProfile} from '../../src/domain/r2GroupUpgrade';
import {lockR2ChapterTargets,type R2BossPlan} from '../../src/domain/r2Chapter';

export function rescueStep(state:R2RunState,action:Action){
  const command:Command={runId:state.runId,commandId:state.runId+'/command/'+(state.commandSeq+1),expectedSeq:state.commandSeq,action:prepareBossSuitRescueAction(state,action)};
  const result=applyCommand(state,command);if(!result.ok)throw Error(result.code);return {state:result.state,command};
}
/** Controlled B03 setup, not a reconstruction of a user save. Entry and all later actions are real commands. */
export function b03RescueFixture(options:{mixed?:boolean;legacy?:boolean;boss?:R2BossPlan;gold?:number;specials?:boolean}={}){
  const identity=newRunIdentity('azao'),base=options.legacy?r2HouseProfile(identity)!.rescueBase!:identity;
  let state=createRun({seed:'b03-rescue-test',runId:'fixture/b03-rescue',characterId:'azao',rulesVersion:'r2',r2Identity:base,openingRoute:'flush',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
  const leave=rescueStep(state,{type:'LeaveShop'});state=leave.state;
  state.stageIndex=2;state.boss=options.boss??{definitionId:'B03',disabledSuit:'hearts'};state.seenBossIds=[state.boss.definitionId];state.chapterTargetPlan=lockR2ChapterTargets(1,state.tourMode,state.difficulty,state.boss);
  state.deckInstances=state.deckInstances.map((c,i)=>({...c,suit:options.mixed&&i===0?'spades':'hearts'}));state.gold=options.gold??6;
  const enter=rescueStep(state,{type:'EnterStage'});if(options.specials){const c=enter.state.deckInstances.find(c=>c.id===enter.state.handOrder[0])!;c.enhancement='heat-paper';c.edition='foil';}return {state:enter.state,journal:[leave.command,enter.command],ready:state,readyJournal:[leave.command]};
}
