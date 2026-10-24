import {prepareBossSuitRescueAction} from '../../src/domain/r2BossSuitRescue';
import {applyCommand,createRun,type Action,type Command,type R2RunState} from '../../src/domain/run';
import {newRunIdentity} from '../../src/game/RunLaunch';
import {r2CreateJoker} from '../../src/domain/r2Run';
import {currentPokerOpportunity} from '../../src/domain/r2PokerEncounter';
import {choose,publicView} from '../../harness/balance-open/policy';

export function pokerStep(state:R2RunState,action:Action){
 const command:Command={runId:state.runId,commandId:`${state.runId}/command/${state.commandSeq+1}`,expectedSeq:state.commandSeq,action:prepareBossSuitRescueAction(state,action)};
 const r=applyCommand(state,command);if(!r.ok)throw Error(r.code);return {state:r.state,command,events:r.events};
}
/** Declared mature test stock, then native unforced deals/commands. Not natural acquisition. */
export function pokerEncounterStart(){
 const state=createRun({seed:'poker-encounter-contract-fixed',runId:'fixture/poker-encounter',characterId:'laohuan',rulesVersion:'r2',r2Identity:newRunIdentity('laohuan','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 state.jokers=['b10','b03','a11','b06','e11'].map((id,i)=>{const j=r2CreateJoker(id,'controlled/'+i,8,'polychrome',state);if(id==='b10')j.growth.heat={n:'100',d:'1'};if(id==='b03')j.growth.multiplier={n:'3',d:'1'};if(id==='e11')j.growth.coefficient={n:'2',d:'1'};return j;});
 state.handLevels={pair:4,'two-pair':4,'three-kind':4,straight:4,flush:4,'full-house':5,'high-card':4};state.gold=64;return state;
}
export function pokerPublicAction(s:R2RunState):Action {
 return s.phase==='shop'?{type:'LeaveShop'}:s.phase==='stage-ready'?{type:'EnterStage'}:s.phase==='stage-cleared'?{type:'OpenShop'}:choose(publicView(s)).action;
}
let cached:{state:R2RunState;journal:Command[]}|undefined;
export function pokerEncounterBeforeShop(){
 if(cached)return structuredClone(cached);let state=pokerEncounterStart();const journal:Command[]=[];
 for(let i=0;i<90&&!(state.phase==='stage-cleared'&&currentPokerOpportunity(state)?.status==='pending');i++){const r=pokerStep(state,pokerPublicAction(state));state=r.state;journal.push(r.command);if(state.phase==='run-lost')throw Error('controlled fixture failed; do not change seed');}
 if(currentPokerOpportunity(state)?.status!=='pending')throw Error('fixture did not reach first opportunity');
 cached={state,journal};return structuredClone(cached);
}
export function pokerEncounterFixture(){const f=pokerEncounterBeforeShop(),r=pokerStep(f.state,{type:'OpenShop'});r.state.gold=32;return {state:r.state,journal:[...f.journal,r.command]};}
