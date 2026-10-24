import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {applyCommand,createRun,type Action,type Command,type DomainEvent,type R2RunState} from '../src/domain/run';
import {r2PurchasePrice,salePrice} from '../src/domain/r2Shop';
import {r2PracticeQuotes} from '../src/domain/r2Practice';
import {R2_ROUTE_STARTERS,type R2OpeningRoute} from '../src/domain/r2GroupUpgrade';
import {r2RouteFactor} from '../src/domain/r2RouteGrowth';
import {makeCheckpoint,readCheckpoint,type Checkpoint} from '../src/application/checkpoint';
import {stableHash} from '../src/domain/hash';
import {newRunIdentity} from '../src/game/RunLaunch';
import {buildGrowthProgress} from '../src/game/BuildGrowthProgress';
import {growthPayoffs} from '../src/game/GrowthPayoff';
import {groupGrowthCausality} from '../src/game/JokerGrowthCausality';
import {shopRouteGrowthFacts} from '../src/game/ShopRouteGrowthFacts';
import {shopPracticeEffect} from '../src/game/ShopPracticeService';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';

const root='docs/production/evidence/';
const files={legacy:root+'w5-growth-opportunities-2026-10-07/natural-three.json.gz',c9:root+'core-build-preparation-2026-10-14/laohuan-c9-natural-save-20261014.json'};
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
type LegacyRow={action?:Action;before:R2RunState;after:R2RunState};
type LegacyRoute={focus:R2OpeningRoute;seed:string;initial:R2RunState;steps:LegacyRow[]};
const routes=JSON.parse(gunzipSync(readFileSync(files.legacy)).toString()).cases as LegacyRoute[];
const stateSummary=(s:R2RunState)=>({hash:stableHash(s),seq:s.commandSeq,identity:{contentVersion:s.contentVersion,contentHash:s.contentHash},phase:s.phase,gold:s.gold,stageIndex:s.stageIndex,levels:s.handLevels,jokers:s.jokers,route:s.routeGrowth,stage:s.stage&&{target:s.stage.targetHeat,heat:s.stage.heat,handsLeft:s.stage.handsLeft,eligible:s.stage.routeGrowth?.eligible},trace:s.lastTrace&&{rootId:s.lastTrace.rootId,handType:s.lastTrace.handType,level:s.lastTrace.level,score:s.lastTrace.finalScore,sourceJokers:s.lastTrace.sourceJokers,savedJokers:s.lastTrace.jokers,route:s.lastTrace.routeGrowth,events:s.lastTrace.events.filter(e=>['base','read-growth','add-growth','read-coefficient','add-coefficient','route-factor','route-clear','route-clear-family','reset-growth'].includes(e.operation))}});
const checkpoints:Record<string,Checkpoint>={};
function roundTrip(s:R2RunState,journal:Command[],key:string){
 const cp=makeCheckpoint(s,journal),read=readCheckpoint(JSON.parse(JSON.stringify(cp)));
 assert.deepEqual(read,{ok:true,checkpoint:cp});
 checkpoints[key]=cp;
 return cp.checksum;
}
function session(initial:R2RunState){
 let state=initial;const journal:Command[]=[],ledger:{command:Command;events:DomainEvent[];before:ReturnType<typeof stateSummary>;after:ReturnType<typeof stateSummary>}[]=[];
 const send=(action:Action)=>{
  const before=state,beforeHash=stableHash(state),command={runId:state.runId,commandId:state.runId+'/command/'+(state.commandSeq+1),expectedSeq:state.commandSeq,action};
  const result=applyCommand(state,command);assert.equal(result.ok,true,JSON.stringify({action,result}));
  assert.equal(stableHash(state),beforeHash);state=result.state;journal.push(command);
  ledger.push({command,events:result.events.filter(e=>!['hand-scored','hand-scored-r2','stage-ended'].includes(e.type)),before:stateSummary(before),after:stateSummary(state)});
  return result;
 };
 const reject=(action:Action)=>{
  const before=stableHash(state),command={runId:state.runId,commandId:state.runId+'/rejected/'+state.commandSeq,expectedSeq:state.commandSeq,action},result=applyCommand(state,command);
  assert.equal(result.ok,false);assert.equal(stableHash(state),before);assert.equal(stableHash(result.state),before);
  return {command,code:result.ok?null:result.code,unchanged:true,stateHash:before};
 };
 return {get state(){return state;},journal,ledger,send,reject};
}

/** Public-hand selection only: one fixed route choice, no scorer/draw preview. */
function publicChoice(state:R2RunState,route:R2OpeningRoute):string[]{
 const hand=state.handOrder.map(id=>state.deckInstances.find(c=>c.id===id)!);
 const candidates:string[][]=[],chosen:string[]=[];
 const visit=(at:number)=>{
  if(chosen.length){const f=r2SelectionFacts({hand,selectedIds:chosen,jokers:state.jokers,definitions:r2JokerDefinitionsFor(state),disabledIds:state.stage!.disabledIds});
   const wanted=route==='group'?['four-kind','full-house','three-kind','two-pair','pair']:route==='straight'?['straight-flush','straight']:['straight-flush','flush-house','flush-five','flush'];
   if(wanted.includes(f.type))candidates.push([...chosen]);}
  if(chosen.length===5)return;
  for(let i=at;i<hand.length;i++){chosen.push(hand[i].id);visit(i+1);chosen.pop();}
 };visit(0);
 // First route-qualified selection, otherwise the first public card. No future-deal search.
 return candidates[0]??[hand[0].id];
}

function currentAudit(route:LegacyRoute){
 const initial=createRun({seed:route.seed,runId:'q2-current/'+route.focus,characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang',route.focus),openingRoute:route.focus,modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}}) as R2RunState;
 const wanted=route.focus==='group'?'b10':R2_ROUTE_STARTERS[route.focus];
 const s=session(initial),starter=initial.shop!.offers.find(o=>o.definitionId===wanted)??initial.shop!.offers.find(o=>o.definitionId===R2_ROUTE_STARTERS[route.focus])!;
 assert.ok(starter);const paid=r2PurchasePrice(s.state,starter);s.send({type:'BuyOffer',offerId:starter.offerId});
 assert.equal(s.state.gold,initial.gold-paid);
 const tooDear=[...s.state.shop!.offers,...s.state.shop!.toolOffers,...s.state.shop!.itemOffers].find(o=>!o.consumed&&r2PurchasePrice(s.state,o)>s.state.gold&&!s.state.jokers.some(j=>j.definitionId===o.definitionId));
 const cannotBuy=tooDear?s.reject({type:'BuyOffer',offerId:tooDear.offerId}):null;
 if(cannotBuy)assert.equal(cannotBuy.code,'not-enough-gold');
 s.send({type:'LeaveShop'});s.send({type:'EnterStage'});
 // Existing natural first-stage selections/discards are preferred, with no injected holdings or deals.
 let plays=0,opened=false,practice:unknown=null,replacement:unknown=null,nonTrigger:unknown[]=[];
 for(const row of route.steps){
  const a=row.action;if(!a||!['DiscardHand','PlayHand','PlayAssistedHand'].includes(a.type))continue;
  if(s.state.phase!=='await-input'||plays===3)break;
  if(a.type==='PlayHand'||a.type==='PlayAssistedHand')plays++;
  s.send(a);
  if(a.type==='PlayHand'||a.type==='PlayAssistedHand'){
   const t=s.state.lastTrace!;assert.deepEqual(t.routeGrowth!.before,initial.routeGrowth&&{clears:0,G:0,S:0,F:0});
   nonTrigger.push({handType:t.handType,postHandGains:t.events.filter(e=>e.sourceType==='joker'&&e.phase==='afterHand'&&e.operation==='add-growth'),growthBefore:t.sourceJokers,growthAfter:t.jokers});
  }
  if(row.after.phase==='stage-cleared')break;
 }
 while(s.state.phase==='await-input'&&plays<3){s.send({type:'PlayHand',selectedIds:publicChoice(s.state,route.focus)});plays++;}
 const firstStage=stateSummary(s.state);
 roundTrip(s.state,s.journal,'current-'+route.focus+'-first-stage');
 if(s.state.phase==='stage-cleared'){
  const beforeGold=s.state.gold,history=structuredClone(s.state.routeGrowth);s.send({type:'OpenShop'});opened=true;
  assert.equal(s.state.gold,beforeGold);assert.deepEqual(s.state.routeGrowth,history);
  const atShop=s.state,held=atShop.jokers[0],clone=session(atShop),refund=salePrice(held.paidPrice);
  clone.send({type:'SellJoker',instanceId:held.instanceId});
  assert.equal(clone.state.gold,atShop.gold+refund);assert.deepEqual(clone.state.routeGrowth,atShop.routeGrowth);
  assert.equal(clone.state.jokers.some(j=>j.instanceId===held.instanceId),false);
  roundTrip(clone.state,clone.journal,'current-'+route.focus+'-sale-counterfactual');
  replacement={classification:'COUNTERFACTUAL_SALE_COMMAND_ON_CLONE_NOT_UI',paidPrice:held.paidPrice,refund,lostInstance:held,routePreserved:clone.state.routeGrowth,ledger:clone.ledger};
  const practicedType=route.focus==='group'?'two-pair':route.focus;
  const q=r2PracticeQuotes(atShop).find(q=>q.handType===practicedType);
  if(q&&q.available){
   const result=s.send({type:'PracticeHand',handType:q.handType,expectedLevel:q.levelBefore,shopSeq:q.shopSeq});
   assert.equal(s.state.gold,atShop.gold-q.price);assert.equal(s.state.handLevels[q.handType],q.levelAfter);
   assert.deepEqual(s.state.rng,atShop.rng);assert.deepEqual(s.state.routeGrowth,atShop.routeGrowth);
   practice={quote:q,receipt:result.events.find(e=>e.type==='hand-practiced'),effect:shopPracticeEffect({handType:q.handType,levelBefore:q.levelBefore,levelAfter:q.levelAfter}),secondRejected:s.reject({type:'PracticeHand',handType:q.handType,expectedLevel:q.levelAfter,shopSeq:q.shopSeq})};
  }else practice={status:q?'NOT_ENOUGH_GOLD':'NOT_DISCOVERED',quote:q??null};
  roundTrip(s.state,s.journal,'current-'+route.focus+'-shop');
  if(plays<3){
   s.send({type:'LeaveShop'});s.send({type:'EnterStage'});
   if(route.focus==='flush'){
    // Actual high-card deliberately checks read-without-new-growth and the upgraded-type restriction.
    s.send({type:'PlayHand',selectedIds:[s.state.handOrder[0]]});plays++;
   }else{
    const shopAt=route.steps.findIndex(row=>row.action?.type==='OpenShop');
    let played=false;
    for(const row of route.steps.slice(shopAt+1)){
     const a=row.action;if(!a||!['DiscardHand','PlayHand'].includes(a.type))continue;
     s.send(a);if(a.type==='PlayHand'){plays++;played=true;break;}
    }
    assert.equal(played,true);
   }
  }
 }
 const before=stableHash(s.state),presentation={progress:buildGrowthProgress(s.state),payoff:growthPayoffs(s.state),causality:s.state.jokers.map(j=>({id:j.definitionId,detail:groupGrowthCausality(s.state,j)??null})),route:shopRouteGrowthFacts(s.state)};
 assert.equal(stableHash(s.state),before);
 roundTrip(s.state,s.journal,'current-'+route.focus+'-final');
 return {route:route.focus,seed:route.seed,classification:'CURRENT_IDENTITY_ORDINARY_COMMANDS_NO_INJECTION_NOT_BROWSER_UI',starter:{offer:starter,paid},cannotBuy,plays,subsequentShops:opened?1:0,firstStage,nonTrigger,practice,replacement,presentation,final:stateSummary(s.state),ledger:s.ledger};
}

/** The user-supplied C9 terminal snapshot is left on its original identity. No extra hands. */
function lateShopAudit(){
 const cp=JSON.parse(readFileSync(files.c9,'utf8')) as Checkpoint,validated=readCheckpoint(cp);assert.equal(validated.ok,true);
 const s=session(cp.state);s.send({type:'OpenShop'});const shop=s.state;
 assert.equal(shop.gold,264);assert.equal(shop.lastTrace!.finalScore,'60047');
 const held=shop.jokers.find(j=>j.definitionId==='c04')!,sold=session(shop);sold.send({type:'SellJoker',instanceId:held.instanceId});
 assert.equal(sold.state.gold,shop.gold+salePrice(held.paidPrice));assert.deepEqual(sold.state.routeGrowth,shop.routeGrowth);
 const offer=sold.state.shop!.offers.find(o=>o.definitionId==='e06')!;assert.ok(offer);
 sold.send({type:'BuyOffer',offerId:offer.offerId});
 const bought=sold.state.jokers.find(j=>j.definitionId==='e06')!;
 assert.equal(bought.growth.multiplier,undefined,'the prior sale must not backfill a newly bought e06');
 const other=sold.state.jokers.find(j=>j.definitionId==='c08')!;
 sold.send({type:'SellJoker',instanceId:other.instanceId});
 assert.deepEqual(sold.state.jokers.find(j=>j.instanceId===bought.instanceId)!.growth.multiplier,{n:'1',d:'2'});
 roundTrip(sold.state,sold.journal,'c9-sale-counterfactual');
 return {classification:'ORIGINAL_NATURAL_SAVE_PLUS_DERIVED_SHOP_AND_SALE_NOT_NEW_UI',original:{identity:cp.state.contentVersion,gold:cp.state.gold,score:cp.state.lastTrace!.finalScore},shop:stateSummary(shop),soldGrowthSource:{lost:held,refund:salePrice(held.paidPrice),transaction:sold.ledger,after:stateSummary(sold.state)},presentation:buildGrowthProgress(sold.state),routePreserved:shopRouteGrowthFacts(sold.state),checkpoint:roundTrip(s.state,s.journal,'c9-derived-shop')};
}

export function q2GrowthAudit(){
 const inputs=Object.fromEntries(Object.entries(files).map(([key,file])=>[key,{file,sha256:hash(readFileSync(file))}]));
 assert.equal(inputs.c9.sha256,'085d29b9fd4bcabf638f87c2eeb63f55c17ca553c65ade87e10544337d28f1b9');
 const archived=routes.map(r=>({route:r.focus,seed:r.seed,identity:r.initial.contentVersion,classification:'EXISTING_RECORD_READ_ONLY_NOT_A_NEW_ROUTE_RUN',source:files.legacy}));
 const current=routes.map(currentAudit),lateShop=lateShopAudit();
 const [group,straight,flush]=current;
 assert.deepEqual(current.map(r=>r.route),['group','straight','flush']);
 assert.equal(group.starter.offer.definitionId,'b10','this fixed seed must provide the ordinary growth card; do not inject a replacement offer');
 assert.equal(group.plays,3);assert.equal(group.final.phase,'shop');assert.deepEqual(group.final.jokers[0].growth.heat,{n:'30',d:'1'});
 assert.equal(group.final.levels['two-pair'],2,'the paid service is saved, with no fourth play claimed');
 assert.equal(straight.final.trace!.handType,'straight');assert.equal(straight.final.trace!.level,2);assert.equal(straight.final.trace!.score,'1125');
 assert.ok(straight.final.trace!.events.some(e=>e.sourceDefinitionId==='c04'&&e.operation==='read-growth'&&e.value.n==='10'&&e.value.d==='1'));
 assert.deepEqual(straight.final.jokers[0].growth.heat,{n:'20',d:'1'});
 assert.equal(flush.final.trace!.handType,'high-card');assert.equal(flush.final.trace!.level,1);assert.equal(flush.final.levels.flush,2);
 assert.deepEqual(flush.final.jokers[0].growth.multiplier,{n:'1',d:'2'});
 assert.ok(flush.final.trace!.events.some(e=>e.sourceDefinitionId==='c06'&&e.operation==='read-growth'&&e.value.n==='1'&&e.value.d==='2'));
 assert.equal(flush.final.trace!.events.some(e=>e.sourceDefinitionId==='c06'&&e.phase==='afterHand'&&e.operation==='add-growth'),false);
 for(const [key,file]of Object.entries(files))assert.equal(hash(readFileSync(file)),inputs[key].sha256);
 return {report:{inputs,archived,current,lateShop,graceFacts:{G:[0,1,2,3,4].map(n=>({clears:n,factor:r2RouteFactor('G',n,true).toJSON()})),note:'前三次合格清场后的因子仍为1；第四次清场后的下一手才读取27/20。此项只读函数，不额外出牌。'},limits:{playsPerCurrentRoute:3,subsequentShopsPerCurrentRoute:1,newUiOperations:false,noInjectedState:true,naturalRates:'NOT_RUN',physicalOrHumanAcceptance:'NOT_RUN'}},checkpoints};
}
