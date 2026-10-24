import type {Action,R2RunState} from '../../src/domain/run';
import type {PlayingCard} from '../../src/cards/types';
import {publicR2View} from '../../src/testing/r2Bot';
import {previewR2Hand} from '../../src/domain/scoreR2';
import {r2ScoreContext} from '../../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../../src/domain/r2ContentProfiles';
import {r2PracticeQuotes} from '../../src/domain/r2Practice';
import {r2JokerCapacity} from '../../src/domain/r2Resources';
import {ordinaryCardPoints} from '../../src/domain/r2ErxiangHandoff';
import {touyeSnapshotToken} from '../../src/domain/r2TouyeWager';
import {AMO_ASSIST_TYPES} from '../../src/domain/r2QualifiedHands';

export const POLICY_VERSION='open-group-v1';
type PublicScoreInput=Parameters<typeof previewR2Hand>[0];
export function publicView(state:R2RunState){
  const basic=publicR2View(state);
  // The old bot's wholesale stage clone contains Touye's private refill proof.
  // Remove it before the decision boundary. Only already exposed cards survive.
  if(basic.stage?.touyeWager)delete basic.stage.touyeWager.refillProof;
  return {...basic,commandSeq:state.commandSeq,drawCount:state.drawPile.length,
    routeGrowth:structuredClone(state.routeGrowth),
    candidates:(state.pendingRefill?.candidateIds??[]).map(id=>({...state.deckInstances.find(c=>c.id===id)!})),
    refillRequired:state.pendingRefill?.required??0,
    practices:r2PracticeQuotes(state),
    visitPurchases:state.shop?.purchases??0,
    usage:{...state.chapterHandUsage}};
}
export type View=ReturnType<typeof publicView>;
type Play=Extract<Action,{type:'PlayHand'}>;
type Choice={action:Play;score:bigint;type:string;core:string[];input:PublicScoreInput};
function subsets<T>(items:T[],maximum:number,minimum=1):T[][]{
  const out:T[][]=[],picked:T[]=[];
  function visit(at:number){if(picked.length>=minimum)out.push([...picked]);if(picked.length===maximum)return;for(let i=at;i<items.length;i++){picked.push(items[i]);visit(i+1);picked.pop();}}
  visit(0);return out;
}
const qualified=(type:string)=>AMO_ASSIST_TYPES.includes(type as never);
function better(a:Choice,b:Choice){
  if(a.score!==b.score)return a.score>b.score;
  if(a.action.selectedIds.length!==b.action.selectedIds.length)return a.action.selectedIds.length<b.action.selectedIds.length;
  return a.action.selectedIds.join(',')<b.action.selectedIds.join(',');
}
export function estimate(view:View,action:Play):Choice {
  const stage=view.stage!;
  const input:PublicScoreInput={rulesVersion:'r2',runId:'public-policy',rootId:'preview',
    hand:view.hand,selectedIds:action.selectedIds,disabledIds:stage.disabledIds,jokers:view.jokers,
    definitions:r2JokerDefinitionsFor(view),handLevels:view.handLevels,playIndex:stage.playIndex+1,
    handsBeforePlay:stage.handsLeft,previousHandType:stage.previousHandType,wager:false,
    ...r2ScoreContext(view,view.hand,action.selectedIds)};
  if(action.amoExile)input.amoExile={use:true,beforeUsed:!!stage.amoExileUsed};
  if(action.erxiangTargetId)input.erxiangHandoff={targetId:action.erxiangTargetId,beforeUsed:!!stage.erxiangHandoffUsed};
  if(action.azaoRelease)input.azaoCharge={before:stage.azaoCharge!,release:true};
  if(action.xiemuBurn){input.gold=view.gold-action.xiemuBurn;input.xiemuBurn={cost:action.xiemuBurn,goldBefore:view.gold,beforeUsed:!!stage.xiemuBurnUsed};}
  const p=previewR2Hand(input);
  return {action,score:BigInt(p.scoreRange.minimum),type:p.handType,core:p.sets.activeScoringIds,input};
}
export function allPlays(view:View):Choice[]{
  const rows:Choice[]=[],stage=view.stage!,remaining=BigInt(stage.targetHeat)-BigInt(stage.heat);
  const enabled=stage.boss?.definitionId!=='B08';
  for(const cards of subsets(view.hand,5)){
    const action:Play={type:'PlayHand',selectedIds:cards.map(c=>c.id)},base=estimate(view,action);rows.push(base);
    if(!enabled)continue;
    if(view.characterId==='erxiang'&&!stage.erxiangHandoffUsed&&base.type!=='high-card'){
      const suppressed=base.input.ordinaryPointsSuppressedIds??[];
      const target=view.hand.filter(c=>base.core.includes(c.id)&&!suppressed.includes(c.id)).sort((a,b)=>ordinaryCardPoints(b)-ordinaryCardPoints(a)||a.id.localeCompare(b.id))[0];
      if(target)rows.push(estimate(view,{...action,erxiangTargetId:target.id}));
    }
    if(view.characterId==='amo'&&!stage.amoExileUsed&&view.hand.some(c=>!action.selectedIds.includes(c.id)&&c.rank===13))rows.push(estimate(view,{...action,amoExile:true}));
    if(view.characterId==='azao'&&stage.azaoCharge!.charge>0&&qualified(base.type)){
      const release=estimate(view,{...action,azaoRelease:true});
      if(stage.azaoCharge!.charge===3||stage.handsLeft===1||release.score>=remaining)rows.push(release);
    }
    if(view.characterId==='xiemu'&&!stage.xiemuBurnUsed&&qualified(base.type)){
      for(const cost of [3,6,10] as const)if(view.gold>=cost)rows.push(estimate(view,{...action,xiemuBurn:cost}));
    }
  }
  return rows;
}
const isSkill=(c:Choice)=>!!(c.action.amoExile||c.action.erxiangTargetId||c.action.azaoRelease||c.action.xiemuBurn);
function sorted(rows:Choice[]){return rows.sort((a,b)=>better(a,b)?-1:better(b,a)?1:0);}
function selection(view:View,rows:Choice[]):Choice {
  const stage=view.stage!,remaining=BigInt(stage.targetHeat)-BigInt(stage.heat),plain=sorted(rows.filter(c=>!isSkill(c)));
  const closes=plain.find(c=>c.score>=remaining);
  if(closes)return closes;
  const skillCloses=rows.filter(c=>isSkill(c)&&c.score>=remaining).sort((a,b)=>(a.action.xiemuBurn??0)-(b.action.xiemuBurn??0)||(better(a,b)?-1:1));
  if(skillCloses.length)return skillCloses[0];
  if(view.characterId==='azao'&&stage.azaoCharge!.charge<3&&stage.handsLeft>1){
    const build=plain.filter(c=>qualified(c.type)&&c.type!==stage.azaoCharge!.previousQualifiedType);
    if(build.length)return build[0];
  }
  if(view.characterId==='xiemu'&&plain[0].score*BigInt(stage.handsLeft)>=remaining&&stage.handsLeft>1)return plain[0];
  return sorted(rows)[0];
}
function discards(view:View,best:Choice):string[]{
  const groups=new Map<number,PlayingCard[]>();for(const c of view.hand)groups.set(c.rank,[...(groups.get(c.rank)??[]),c]);
  const repeated=[...groups.values()].filter(g=>g.length>=2).sort((a,b)=>b.length-a.length||ordinaryCardPoints(b[0])-ordinaryCardPoints(a[0]));
  let keep=repeated.flat().slice(0,4).map(c=>c.id);
  if(!keep.length){
    const suits=['clubs','diamonds','hearts','spades'].map(s=>view.hand.filter(c=>c.suit===s)).sort((a,b)=>b.length-a.length);
    if(suits[0].length>=4)keep=suits[0].slice(0,4).map(c=>c.id);
    else keep=[...view.hand].sort((a,b)=>ordinaryCardPoints(b)-ordinaryCardPoints(a)||a.id.localeCompare(b.id)).slice(0,2).map(c=>c.id);
  }
  if(view.characterId==='amo'&&!view.stage!.amoExileUsed){const king=view.hand.find(c=>c.rank===13&&!best.action.selectedIds.includes(c.id));if(king&&!keep.includes(king.id))keep.push(king.id);}
  return view.hand.filter(c=>!keep.includes(c.id)).sort((a,b)=>Number(view.stage!.disabledIds.includes(b.id))-Number(view.stage!.disabledIds.includes(a.id))||ordinaryCardPoints(a)-ordinaryCardPoints(b)||a.id.localeCompare(b.id)).slice(0,5).map(c=>c.id);
}
export function choose(view:View):{action:Action;reason:string;publicEstimate?:string}{
  if(view.phase==='stage-ready')return {action:{type:'EnterStage'},reason:'enter-next-stage'};
  if(view.phase==='stage-cleared')return {action:{type:'OpenShop'},reason:'open-earned-shop'};
  if(view.phase==='shop'){
    const reserve=view.characterId==='xiemu'?3:0;
    const priority=['b10','b03','mantangcai','b06','b08','tiesuanpan','huimaqiang','pengci'];
    if(view.visitPurchases===0&&view.jokers.length<r2JokerCapacity(view)){
      const offer=priority.map(id=>view.offers.find(o=>o.definitionId===id&&o.price<=view.gold-reserve&&!view.jokers.some(j=>j.definitionId===id))).find(Boolean);
      if(offer)return {action:{type:'BuyOffer',offerId:offer.offerId},reason:'one-group-support-per-visit; reserve-'+reserve};
    }
    const practice=[...view.practices].filter(q=>q.available&&q.price<=view.gold-reserve).sort((a,b)=>(view.usage[b.handType]??0)-(view.usage[a.handType]??0)||a.levelBefore-b.levelBefore||a.handType.localeCompare(b.handType))[0];
    if(practice)return {action:{type:'PracticeHand',handType:practice.handType,expectedLevel:practice.levelBefore,shopSeq:practice.shopSeq},reason:'practice-most-used-discovered; reserve-'+reserve};
    return {action:{type:'LeaveShop'},reason:'no-budgeted-priority-purchase'};
  }
  if(view.phase==='pending-refill'){
    let best:{ids:string[];score:bigint}|undefined;
    for(const picked of subsets(view.candidates,view.refillRequired,view.refillRequired)){
      const next={...view,phase:'await-input' as const,hand:[...view.hand,...picked]},score=selection(next,allPlays(next)).score;
      const ids=picked.map(c=>c.id);
      if(!best||score>best.score||score===best.score&&ids.join(',')<best.ids.join(','))best={ids,score};
    }
    if(!best)throw Error('no-public-refill-choice');
    return {action:{type:'ChooseRefill',selectedIds:best.ids},reason:'xin-visible-candidates-only',publicEstimate:String(best.score)};
  }
  if(view.phase!=='await-input'||!view.stage)throw Error('policy-terminal');
  const rows=allPlays(view),best=selection(view,rows),stage=view.stage,remaining=BigInt(stage.targetHeat)-BigInt(stage.heat);
  if(best.score>=remaining)return {action:best.action,reason:'public-minimum-closes',publicEstimate:String(best.score)};
  const plain=sorted(rows.filter(c=>!isSkill(c)))[0];
  const needAlternate=view.characterId==='azao'&&stage.azaoCharge!.charge>0&&!rows.some(c=>qualified(c.type)&&c.type!==stage.azaoCharge!.previousQualifiedType);
  const belowPace=best.score*BigInt(stage.handsLeft)<remaining;
  const weak=!qualified(best.type)&&plain.score<220n;
  const discardCost=stage.boss?.definitionId==='B01'&&stage.playIndex===0?2:1;
  const ids=discards(view,best);
  const locked=stage.touyeWager?.resolution==='pending';
  if(!locked&&stage.discardsLeft>=discardCost&&view.drawCount>0&&ids.length&&(belowPace||weak||needAlternate)){
    const action:Extract<Action,{type:'DiscardHand'}>={type:'DiscardHand',selectedIds:ids};
    if(view.characterId==='laohuan')action.laohuanTrick=true;
    if(view.characterId==='touye'&&stage.touyeWager?.resolution==='unused'&&stage.boss?.definitionId!=='B08'&&ids.length>=3){
      const retained=view.hand.filter(c=>!ids.includes(c.id));
      if(retained.some(c=>retained.filter(d=>d.rank===c.rank).length>=2)){
        const rules=plain.input.handRules!;
        action.touyeBet={target:'two-pair',snapshotToken:touyeSnapshotToken(view.hand,{fourStraight:!!rules.fourStraight,fourFlush:!!rules.fourFlush},stage.index,stage.playIndex+1,view.commandSeq)};
      }
    }
    return {action,reason:needAlternate?'seek-alternate-qualified':belowPace?'below-required-pace':'improve-unqualified-or-pair',publicEstimate:String(best.score)};
  }
  return {action:best.action,reason:'best-public-minimum; no-budgeted-discard',publicEstimate:String(best.score)};
}
