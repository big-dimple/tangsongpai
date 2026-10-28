import {createRun,applyCommand,type Action,type R2RunState} from '../../src/domain/run';
import type {CharacterId} from '../../src/domain/characters';
import {newRunIdentity} from '../../src/game/RunLaunch';
import {r2Price} from '../../src/domain/r2Shop';
import {r2DisabledCards} from '../../src/domain/r2Chapter';
import {makeCheckpoint,readCheckpoint} from '../../src/application/checkpoint';

export function economySend(state:R2RunState,action:Action):R2RunState {
 const result=applyCommand(state,{runId:state.runId,commandId:state.runId+'/'+state.commandSeq,expectedSeq:state.commandSeq,action});
 if(!result.ok)throw Error(result.code);return result.state;
}
export function economyStart(hero:CharacterId,cash:number,identity?:{contentVersion:string;contentHash:string}){
 const s=createRun({rulesVersion:'r2',characterId:hero,seed:'budget/three-stages',runId:'budget/'+hero+'/'+cash,r2Identity:identity??newRunIdentity(hero),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});s.gold=cash;return s;
}
export function economyHand(state:R2RunState){
 const s=structuredClone(state),suits=['hearts','spades','clubs','diamonds'] as const;
 const main=suits.map(suit=>[10,11,12,13,14].map(rank=>`${suit}-${rank}`)).find(ids=>!(s.stage!.boss?r2DisabledCards(s.stage!.boss,s.stage!.index,ids.map(id=>s.deckInstances.find(c=>c.id===id)!)):[]).some(id=>ids.includes(id)))!;
 const sideKing=suits.map(suit=>`${suit}-13`).find(id=>!main.includes(id))!;
 s.handOrder=[...main,'clubs-3',sideKing,'diamonds-9'];s.drawPile=s.deckInstances.map(c=>c.id).filter(id=>!s.handOrder.includes(id)&&!s.playedPile.includes(id)&&!s.discardPile.includes(id));
 s.stage!.disabledIds=s.stage!.boss?r2DisabledCards(s.stage!.boss,s.stage!.index,s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!)):[];return {state:s,main};
}
/** Controlled public shelves and two real scoring commands per stage; not natural card/offer availability. */
export function threeStageBudget(options:{hero:CharacterId;cash:number;purchasePrice:4|6;burn?:3|6|10;exile?:boolean;identity?:{contentVersion:string;contentHash:string}}){
 let s=economyStart(options.hero,options.cash,options.identity);const rows=[];
 const purchases=options.purchasePrice===4?['pengci','mantangcai','a03']:['a10','c10','c06'];
 for(let index=0;index<3;index++){
  const beforeShop=s.gold,definitionId=purchases[index],offerId=s.runId+'/public/'+index;
  if(r2Price(definitionId,'none',s)!==options.purchasePrice)throw Error('budget-price-drift');
  s.shop!.offers[0]={offerId,definitionId,price:options.purchasePrice,edition:'none',consumed:false};
  const bought=s.gold>=options.purchasePrice;if(bought)s=economySend(s,{type:'BuyOffer',offerId});
  s=economySend(economySend(s,{type:'LeaveShop'}),{type:'EnterStage'});const arranged=economyHand(s);s=arranged.state;
  s=economySend(s,{type:'PlayHand',selectedIds:['clubs-3']});if(s.phase!=='await-input')throw Error('budget-first-hand-cleared');
  const capital=s.gold,burn=options.hero==='xiemu'&&options.burn&&capital>=options.burn?options.burn:0;
  s=economySend(s,{type:'PlayHand',selectedIds:arranged.main,...(options.exile?{amoExile:true}:{}),...(burn?{xiemuBurn:burn}:{})});
  if(s.phase!=='stage-cleared'||s.stage!.handsLeft!==2)throw Error('budget-not-two-hand-clear');
  const cp=makeCheckpoint(s,[]);if(!readCheckpoint(cp).ok)throw Error('budget-checkpoint');
  rows.push({stage:index,target:s.stage!.targetHeat,beforeShop,purchasePrice:options.purchasePrice,bought,capitalBeforeSkill:capital,paid:s.lastTrace!.xiemuBurn?.cost??0,skillUsed:!!s.lastTrace!.xiemuBurn?.cost||!!s.lastTrace!.amoExile?.use,score:s.lastTrace!.finalScore,handsLeft:s.stage!.handsLeft,reward:s.stage!.goldEarned,extraInterest:Number(s.lastTrace!.events.find(e=>e.sourceDefinitionId==='xiemu'&&e.phase==='onStageClear')?.value.n??0),characterGoldDebits:s.lastTrace!.events.filter(e=>e.sourceType==='character'&&e.resourceBefore!==undefined&&e.resourceAfter!==undefined&&e.resourceAfter<e.resourceBefore).reduce((sum,e)=>sum+e.resourceBefore!-e.resourceAfter!,0),end:s.gold});
  if(index<2)s=economySend(s,{type:'OpenShop'});
 }
 return {options,rows,uses:rows.filter(r=>r.skillUsed).length,purchases:rows.filter(r=>r.bought).length,end:s.gold};
}
