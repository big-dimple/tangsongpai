import {createRun,applyCommand,type Action,type R2RunState} from '../../src/domain/run';
import type {CharacterId} from '../../src/domain/characters';
import {newRunIdentity} from '../../src/game/RunLaunch';
import {SavedRun,type SaveSlots,type SaveStore} from '../../src/application/SavedRun';
import {makeCheckpoint,readCheckpoint} from '../../src/application/checkpoint';
import {savedHeroAttachment} from '../../src/game/HeroAttachmentFacts';
import {touyeChoice} from '../../src/game/TouyeWagerCopy';

const hand=['spades-8','hearts-8','clubs-7','diamonds-7','spades-13','hearts-13','clubs-2','diamonds-4'];
const send=(s:R2RunState,action:Action)=>{const r=applyCommand(s,{runId:s.runId,commandId:s.runId+'/'+s.commandSeq,expectedSeq:s.commandSeq,action});if(!r.ok)throw Error(r.code);return r.state;};
/** Explicit controlled deck/visible-hand partition, current identity. All activation and final save commands are real. */
function arrange(s:R2RunState,ids:readonly string[]=hand,incoming:readonly string[]=[]):R2RunState {const state=structuredClone(s);state.handOrder=[...ids];state.drawPile=[...state.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id)&&!incoming.includes(id)&&!state.playedPile.includes(id)&&!state.discardPile.includes(id)&&!state.destroyedIds.includes(id)),...[...incoming].reverse()];return state;}
export async function currentHeroReceipt(hero:CharacterId,lose=false){
 let before=createRun({seed:'group-natural-17',runId:'current/pool/'+hero+(lose?'/lost':''),characterId:hero,rulesVersion:'r2',r2Identity:newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});before=arrange(send(send(before,{type:'LeaveShop'}),{type:'EnterStage'}));before.gold=40;
 if(hero==='azao'){before=arrange(before,['spades-2','hearts-2','clubs-3','diamonds-3',...hand.slice(4)]);before=arrange(send(before,{type:'PlayHand',selectedIds:before.handOrder.slice(0,4)}));}
 if(hero==='touye'){before=arrange(before,hand,['clubs-8','diamonds-6']);const ids=hand.slice(6);before=send(before,{type:'DiscardHand',selectedIds:ids,touyeBet:{target:'three-kind',snapshotToken:touyeChoice(before,ids).snapshotToken}});}
 if(hero==='laohuan')before=send(before,{type:'DiscardHand',selectedIds:hand.slice(0,1)});
 const action:Action=hero==='laohuan'?{type:'ChooseRefill',selectedIds:before.pendingRefill!.candidateIds.slice(0,before.pendingRefill!.required)}:hero==='touye'?{type:'PlayHand',selectedIds:lose?['diamonds-6']:['spades-8','hearts-8','clubs-8']}:{type:'PlayHand',selectedIds:hero==='amo'||hero==='erxiang'?hand.slice(0,2):hand.slice(0,4),...(hero==='amo'?{amoExile:true}:{}),...(hero==='erxiang'?{erxiangTargetId:hand[0]}:{}),...(hero==='azao'?{azaoRelease:true}:{}),...(hero==='xiemu'?{xiemuBurn:2 as const}:{})};
 let slots:SaveSlots={revision:1,current:makeCheckpoint(before,[]),previous:null};const checked=readCheckpoint(slots.current!);if(!checked.ok)throw Error('controlled checkpoint/'+checked.code);
 const store:SaveStore={read:async()=>slots,commit:async(revision,current,previous)=>{slots={revision:revision+1,current,previous};return slots.revision;}},saved=SavedRun.restore(store,slots),result=await saved.dispatch(action);if(!result.ok)throw Error(result.code);const after=saved.state,cue=hero==='laohuan'?undefined:savedHeroAttachment(after.lastTrace!,hero);if(hero!=='laohuan'&&!cue)throw Error('missing real hero event');
 return{before,after,saved,trace:after.lastTrace!,cue,targetIds:hero==='laohuan'?after.handOrder.filter(id=>!before.handOrder.includes(id)):cue!.targetIds??[],eventId:hero==='laohuan'?result.receipt.commandId+'/laohuan-refill':cue!.event.eventId,restore:()=>SavedRun.restore(store,slots)};
}
