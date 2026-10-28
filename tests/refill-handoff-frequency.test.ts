import {expect,it} from 'vitest';
import {createRun,applyCommand,type Action,type Command,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {erxiangChoice} from '../src/game/ErxiangHandoffCopy';
import {heroAbilityCue} from '../src/game/HeroAbilityCue';
import {characterForNewRun} from '../src/game/CharacterRunCopy';
import {SELECTION_PRESENTATION} from '../src/game/SelectionPresentation';
import {SavedRun,type SaveSlots,type SaveStore} from '../src/application/SavedRun';
const mode={mode:'standard' as const,difficulty:0 as const,challengeId:null,programsEnabled:false};
const command=(s:R2RunState,action:Action):Command=>({runId:s.runId,commandId:'frequency/'+s.commandSeq,expectedSeq:s.commandSeq,action});
function ready(id:'laohuan'|'erxiang',disabled=false,difficulty:0|1|2|3=0){
 let state=createRun({rulesVersion:'r2',seed:disabled?'challenge/q01/0':'frequency',runId:'frequency/'+id,characterId:id,r2Identity:newRunIdentity(id,'group'),openingRoute:'group',modeConfig:disabled?{...mode,mode:'challenge',challengeId:'Q01'}:{...mode,difficulty}});const journal:Command[]=[];
 const send=(action:Action)=>{const c=command(state,action),r=applyCommand(state,c);if(!r.ok)throw Error(r.code);state=r.state;journal.push(c);const saved=readCheckpoint(makeCheckpoint(state,journal));expect(saved.ok).toBe(true);return r;};
 send({type:'LeaveShop'});send({type:'EnterStage'});
 return {get state(){return state;},set state(s:R2RunState){state=s;},journal,send};
}
it('Xin automatically offers candidates on all paid normal discards, with fixed source IDs and strict chosen count',()=>{
 const f=ready('laohuan'),initial=f.state.stage!.discardsLeft;
 for(let n=0;n<initial;n++){
  const before=f.state,discarded=before.handOrder.slice(0,1),c=command(before,{type:'DiscardHand',selectedIds:discarded}),r=f.send(c.action),pending=f.state.pendingRefill!;
  expect(pending.discardCommandId).toBe(c.commandId);expect(pending.required).toBe(1);expect(pending.candidateIds).toHaveLength(3);expect(f.state.stage!.discardsLeft).toBe(initial-n-1);expect(f.state.discardPile).toContain(discarded[0]);
  expect(applyCommand(f.state,c)).toMatchObject({ok:true,duplicate:true});expect(applyCommand(f.state,command(f.state,{type:'ChooseRefill',selectedIds:[]}))).toMatchObject({ok:false});
  const selected=pending.candidateIds.slice(0,pending.required);f.send({type:'ChooseRefill',selectedIds:selected});expect(f.state.handOrder).toContain(selected[0]);for(const id of pending.candidateIds.slice(1))expect(f.state.playedPile).toContain(id);
  expect(f.state.pendingRefill).toBeNull();expect(heroAbilityCue(f.state,undefined,f.state.handOrder.slice(0,1))?.state).not.toBe('used');
 }
 expect(applyCommand(f.state,command(f.state,{type:'DiscardHand',selectedIds:f.state.handOrder.slice(0,1)}))).toMatchObject({ok:false,code:'no-discards-left'});
});
it('a short Xin draw stack keeps all actual available cards without inventing two more',()=>{const f=ready('laohuan'),draw=f.state.drawPile.slice(0,2);f.state={...f.state,drawPile:draw,playedPile:f.state.drawPile.filter(id=>!draw.includes(id))};const before=f.state.stage!.discardsLeft;f.send({type:'DiscardHand',selectedIds:f.state.handOrder.slice(0,3)});expect(f.state.pendingRefill).toBeNull();expect(f.state.handOrder).toHaveLength(7);for(const id of draw)expect(f.state.handOrder).toContain(id);expect(f.state.stage!.discardsLeft).toBe(before-1);});
it('disabled Xin ordinary discard remains ordinary; explicit activation is rejected',()=>{
 const f=ready('laohuan',true),ids=f.state.handOrder.slice(0,1);expect(applyCommand(f.state,command(f.state,{type:'DiscardHand',selectedIds:ids,laohuanTrick:true}))).toMatchObject({ok:false,code:'laohuan-disabled'});f.send({type:'DiscardHand',selectedIds:ids});expect(f.state.pendingRefill).toBeNull();expect(f.state.stage!.laohuanTrickUsed).toBe(false);
});
function lowPairs(){const f=ready('erxiang',false,3),ids=['spades-2','hearts-2','clubs-2','diamonds-2','spades-3','hearts-3','clubs-7','diamonds-9'];f.state={...f.state,handOrder:ids,drawPile:f.state.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id))};return f;}
it('Liu uses exactly two actual successful plays, remains additive and rejects a third atomically',()=>{
 const f=lowPairs();expect(erxiangChoice(f.state).remaining).toBe(2);
 for(const [index,ids] of [['spades-2','hearts-2'],['clubs-2','diamonds-2']].entries()){const rank=2;f.send({type:'PlayHand',selectedIds:ids,erxiangTargetId:ids[0]});expect(f.state.stage!.erxiangHandoffUses).toBe(index+1);expect(erxiangChoice(f.state).remaining).toBe(1-index);expect(f.state.lastTrace!.events.filter(e=>e.reasonKey==='erxiang.handoff')).toMatchObject(ids.map(targetCardId=>({operation:'add-multiplier',targetCardId,value:{n:String(rank),d:'1'}})));}
 const before=structuredClone(f.state);expect(applyCommand(f.state,command(f.state,{type:'PlayHand',selectedIds:['spades-3','hearts-3'],erxiangTargetId:'spades-3'}))).toMatchObject({ok:false,code:'score-diagnostic',diagnostic:{code:'erxiang-already-used'}});expect(f.state).toEqual(before);f.send({type:'PlayHand',selectedIds:['spades-3','hearts-3']});expect(f.state.stage!.erxiangHandoffUses).toBe(2);
});
it('invalid Liu selection spends no use and a new stage starts with two remaining',()=>{const f=lowPairs(),before=structuredClone(f.state);expect(applyCommand(f.state,command(f.state,{type:'PlayHand',selectedIds:['spades-2','hearts-2'],erxiangTargetId:'clubs-7'}))).toMatchObject({ok:false});expect(f.state).toEqual(before);expect(f.state.stage!.erxiangHandoffUses).toBe(0);expect(erxiangChoice(ready('erxiang').state).remaining).toBe(2);});
it('disabled Liu cannot transfer or spend either use',()=>{const f=ready('erxiang',true),ids=['spades-2','hearts-2','spades-3','hearts-3','spades-4','hearts-4','clubs-7','diamonds-9'];f.state={...f.state,handOrder:ids,drawPile:f.state.deckInstances.map(c=>c.id).filter(id=>!ids.includes(id))};expect(applyCommand(f.state,command(f.state,{type:'PlayHand',selectedIds:ids.slice(0,2),erxiangTargetId:ids[0]}))).toMatchObject({ok:false,code:'score-diagnostic',diagnostic:{code:'erxiang-disabled'}});expect(f.state.stage!.erxiangHandoffUses).toBe(0);f.send({type:'PlayHand',selectedIds:ids.slice(0,2)});expect(f.state.stage!.erxiangHandoffUses).toBe(0);});
it('Liu quota survives saved retry and forged counters cannot disagree with the journal',async()=>{
 const f=lowPairs();f.send({type:'PlayHand',selectedIds:['spades-2','hearts-2'],erxiangTargetId:'spades-2'});let slots:SaveSlots={revision:1,current:makeCheckpoint(f.state,f.journal),previous:null},fail=true;
 const store:SaveStore={read:async()=>slots,commit:async(revision,cp,backup)=>{if(fail)throw Error('quota-exceeded');slots={revision:revision+1,current:cp,previous:backup};return slots.revision;}};
 const saved=SavedRun.restore(store,slots);expect((await saved.dispatch({type:'PlayHand',selectedIds:['clubs-2','diamonds-2'],erxiangTargetId:'clubs-2'})).ok).toBe(false);expect(saved.state.stage!.erxiangHandoffUses).toBe(1);fail=false;expect((await saved.retry()).ok).toBe(true);expect(saved.state.stage!.erxiangHandoffUses).toBe(2);expect(SavedRun.restore(store,slots).state).toEqual(saved.state);
 const bad=structuredClone(f.state);bad.stage!.erxiangHandoffUses=2;bad.stage!.erxiangHandoffUsed=true;expect(()=>makeCheckpoint(bad,f.journal)).toThrow('invalid-save-erxiang-count');
});
it('current selection and details show repeatable Xin and two-use Liu without changing the other four',()=>{
 expect(characterForNewRun('laohuan').detailRules).toContain('每次正常弃牌');expect(characterForNewRun('laohuan').skillTags).not.toContain('每场1次');expect(SELECTION_PRESENTATION.laohuan.cost).toContain('下一手出牌或再次弃牌后旧批失效');expect(characterForNewRun('erxiang').skillTags).toContain('每场2次');expect(SELECTION_PRESENTATION.erxiang.cost).toContain('每场2次');expect(characterForNewRun('amo').quickEffect).toContain('×3');expect(characterForNewRun('xiemu').quickEffect).toContain('2／4／6／8');
});
