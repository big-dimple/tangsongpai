/** Controlled paired stage samples, not natural acquisition or human balance. */
import {createRun,applyCommand,type R2RunState,type Action,type Command} from '../src/domain/run';
import {assertR2Invariants,r2CreateJoker,r2ScoreContext,makeR2Shop} from '../src/domain/r2Run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2ChapterBossIds,lockR2ChapterTargets} from '../src/domain/r2Chapter';
import {R2_HAND_TYPES} from '../src/domain/evaluateR2';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {previewR2Hand,type ScoreInput} from '../src/domain/scoreR2';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {laohuanFindGroups} from '../src/domain/r2LaohuanFind';
import {touyeChoice} from '../src/game/TouyeWagerCopy';
import {stableHash} from '../src/domain/hash';
import type {PlayingCard} from '../src/cards/types';

type Hero='laohuan'|'touye'|'xiemu'|'erxiang';
const heroes:Hero[]=['laohuan','touye','xiemu','erxiang'];
const stages=[{band:'early',index:0,level:1,gold:6},{band:'middle',index:6,level:3,gold:24},{band:'late',index:12,level:8,gold:40}] as const;
const seeds=['hero-probe/a','hero-probe/b','hero-probe/c','hero-probe/d'] as const;
function send(s:R2RunState,action:Action){const c:Command={runId:s.runId,commandId:s.runId+'/probe/'+(s.commandSeq+1),expectedSeq:s.commandSeq,action},r=applyCommand(s,c);if(!r.ok)throw Error(action.type+':'+r.code);return r.state;}
function fixture(hero:Hero,stage:typeof stages[number],seed:string){
 let s=createRun({rulesVersion:'r2',characterId:hero,seed,runId:'hero-probe/'+stage.band+'/'+seed+'/'+hero,r2Identity:newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
 s.stageIndex=stage.index;s.chapter=stage.index/3+1;s.gold=stage.gold;s.handLevels=Object.fromEntries(R2_HAND_TYPES.map(t=>[t,stage.level]));
 s.jokers=(stage.index?['mantangcai','b10']:[]).map((id,i)=>r2CreateJoker(id,'probe/'+id+'/'+i,6,'none',s));
 if(stage.index)s.jokers[1].growth={heat:{n:'40',d:'1'}};
 const clears=stage.index/3;s.routeGrowth={clears,G:clears,S:0,F:0,settlements:Array.from({length:clears},(_,i)=>({stageIndex:3*i+2,families:['G']}))};
 const previous:string[]=[];for(let c=1;c<s.chapter;c++)previous.push(r2ChapterBossIds(c)!.find(id=>!previous.includes(id))!);const boss=r2ChapterBossIds(s.chapter)!.find(id=>!previous.includes(id))!;
 s.seenBossIds=[...previous,boss];s.boss={definitionId:boss,disabledSuit:boss==='B03'?'hearts':null};s.chapterTargetPlan=lockR2ChapterTargets(s.chapter,s.tourMode,s.difficulty,s.boss);
 const entry:Command={runId:s.runId,commandId:s.runId+'/planted-shop',expectedSeq:s.commandSeq,action:{type:'OpenShop'}};makeR2Shop(s,true);s.commandSeq++;s.receipts.push({commandId:entry.commandId,seq:s.commandSeq,fingerprint:stableHash(entry)});assertR2Invariants(s);
 return send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});
}
function hand(s:R2RunState){return s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id)!);}
function combinations(ids:readonly string[]){const all:string[][]=[];function visit(start:number,a:string[]){if(a.length)all.push([...a]);if(a.length===5)return;for(let i=start;i<ids.length;i++)visit(i+1,[...a,ids[i]]);}visit(0,[]);return all;}
function scoreInput(s:R2RunState,ids:string[]):ScoreInput {const cards=hand(s);return {rulesVersion:'r2',runId:s.runId,rootId:s.runId+'/preview',hand:cards,selectedIds:ids,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handLevels:s.handLevels,playIndex:s.stage!.playIndex+1,handsBeforePlay:s.stage!.handsLeft,previousHandType:s.stage!.previousHandType,wager:false,rng:s.rng.rule,...r2ScoreContext(s,cards,ids)};}
function best(s:R2RunState){let ids:string[]=[],value=-1n;for(const selected of combinations(s.handOrder)){const p=previewR2Hand(scoreInput(s,selected)),n=BigInt(p.scoreRange.minimum);if(n>value){value=n;ids=selected;}}return {ids,value};}
function candidates(s:R2RunState,ids:string[]){const cards=hand(s),ctx=r2ScoreContext(s,cards,ids);return r2SelectionFacts({hand:cards,selectedIds:ids,disabledIds:s.stage!.disabledIds,jokers:s.jokers,definitions:r2JokerDefinitionsFor(s),handRules:ctx.handRules,ordinaryPointsSuppressedIds:ctx.ordinaryPointsSuppressedIds});}
function xinChoice(s:R2RunState){const p=s.pendingRefill!,groups=new Map<number,PlayingCard[]>();for(const id of p.candidateIds){const c=s.deckInstances.find(x=>x.id===id)!;groups.set(c.rank,[...(groups.get(c.rank)??[]),c]);}const ranked=[...groups.values()].sort((a,b)=>b.length-a.length||b[0].rank-a[0].rank).flat();return p.candidateIds.filter(id=>ranked.slice(0,p.required).some(c=>c.id===id));}
function prepare(initial:R2RunState,hero:Hero){
 let a=structuredClone(initial),b=structuredClone(initial);let candidate=false,discardCost=0;
 if(hero==='laohuan'){
  const keep=best(a).ids,discard=a.handOrder.filter(id=>!keep.includes(id)).slice(0,5);if(discard.length){a=send(a,{type:'DiscardHand',selectedIds:discard});b=send(b,{type:'DiscardHand',selectedIds:discard});discardCost=1;if(a.pendingRefill){const ids=xinChoice(a);a=send(a,{type:'ChooseRefill',selectedIds:ids});b=send(b,{type:'ChooseRefill',selectedIds:ids});}candidate=laohuanFindGroups(a.deckInstances,a.handOrder,a.stage!.laohuanFindBatch??[]).length>0;}
 }else if(hero==='touye'){
  const cards=hand(a),suits=['spades','hearts','clubs','diamonds'] as const,bestSuit=[...suits].sort((x,y)=>cards.filter(c=>c.suit===y).length-cards.filter(c=>c.suit===x).length)[0],discard=cards.filter(c=>c.suit!==bestSuit).slice(0,5).map(c=>c.id);
  if(cards.filter(c=>c.suit===bestSuit).length>=3&&discard.length){const choice=touyeChoice(a,discard),target=choice.choices.find(c=>c.target==='flush'&&c.available);if(target){a=send(a,{type:'DiscardHand',selectedIds:discard,touyeBet:{target:'flush',snapshotToken:choice.snapshotToken}});b=send(b,{type:'DiscardHand',selectedIds:discard});candidate=true;discardCost=1;}}
 }
 return {active:a,plain:b,candidate,discardCost};
}
function played(initial:R2RunState,hero:Hero,activate:boolean,maxFlowerCost=8){
 let s=structuredClone(initial),candidate=false,used=false,firstBefore:string|null=null,firstAfter:string|null=null,spend=0,firstWagerOutcome:string|null=null,activationBefore:string|null=null,activationAfter:string|null=null,activationIndex:number|null=null;const scores:string[]=[];
 while(s.phase==='await-input'){
  let pick=best(s),action:Action={type:'PlayHand',selectedIds:pick.ids};
  if(activate&&!used){
   if(hero==='xiemu'){
    const f=candidates(s,pick.ids),cost=[8,6,4,2].find(n=>n<=maxFlowerCost&&n<=s.gold);candidate=!!cost&&f.type!=='high-card'&&f.type!=='pair';
    if(candidate){spend=cost!;action={...action,xiemuBurn:cost as 2|4|6|8};used=true;}
   }else if(hero==='erxiang'){
    const f=candidates(s,pick.ids),targets=f.type==='high-card'?[]:f.activeScoringIds.filter(id=>!f.ordinaryPointsSuppressedIds.includes(id));candidate=candidate||targets.length>0;
    let better=pick.value,target:string|undefined;for(const id of targets){const input=scoreInput(s,pick.ids);input.erxiangHandoff!.targetId=id;const v=BigInt(previewR2Hand(input).scoreRange.minimum);if(v>better){better=v;target=id;}}
    if(target){action={...action,erxiangTargetId:target};used=true;}
   }else if(hero==='laohuan'){
    const f=candidates(s,pick.ids),groups=laohuanFindGroups(s.deckInstances,f.activeScoringIds,s.stage!.laohuanFindBatch??[]);candidate=groups.length>0;
    if(groups.length){action={...action,laohuanFindRank:groups[0].rank};used=true;}
   }else if(s.stage!.touyeWager?.resolution==='pending'){candidate=true;used=true;}
  }
  const isActivation=used&&activationIndex===null;if(!scores.length||isActivation){const input=scoreInput(s,pick.ids);if(hero==='touye'&&input.touyeWager?.commit)input.touyeWager.commit=null;const ordinary=previewR2Hand(input).scoreRange.minimum;if(!scores.length)firstBefore=ordinary;if(isActivation){activationBefore=ordinary;activationIndex=scores.length+1;}}s=send(s,action);const score=s.lastTrace!.finalScore;scores.push(score);if(scores.length===1){firstAfter=score;firstWagerOutcome=s.lastTrace!.touyeWager?.outcome??null;}if(isActivation)activationAfter=score;
 }
 return {candidate,used,firstBefore,firstAfter,activationBefore,activationAfter,activationIndex,scores,passed:s.phase==='stage-cleared',gold:s.gold,discardsLeft:s.stage!.discardsLeft,handsLeft:s.stage!.handsLeft,spend,heat:s.stage!.heat,wagerOutcome:firstWagerOutcome};
}
type ProbeRow={band:typeof stages[number]['band'];hero:Hero;seed:string;target:string;entryGold:number;entryDiscards:number;preparationCandidate:boolean;discardCost:number;active:ReturnType<typeof played>;plain:ReturnType<typeof played>;sixTier:ReturnType<typeof played>|null};
export function heroBalanceProbe(){
 const rows:ProbeRow[]=[];for(const stage of stages)for(const hero of heroes)for(const seed of seeds){const start=fixture(hero,stage,seed),prep=prepare(start,hero),active=played(prep.active,hero,true),plain=played(prep.plain,hero,false),sixTier=hero==='xiemu'?played(prep.active,hero,true,6):null;rows.push({band:stage.band,hero,seed,target:start.stage!.targetHeat,entryGold:start.gold,entryDiscards:start.stage!.discardsLeft,preparationCandidate:prep.candidate,discardCost:prep.discardCost,active,plain,sixTier});}
 const aggregates=stages.flatMap(stage=>heroes.map(hero=>{const r=rows.filter(x=>x.band===stage.band&&x.hero===hero);return {band:stage.band,hero,n:r.length,preparationCandidate:r.filter(x=>x.preparationCandidate).length,scoringCandidate:r.filter(x=>x.active.candidate).length,used:r.filter(x=>x.active.used).length,activeClear:r.filter(x=>x.active.passed).length,plainClear:r.filter(x=>x.plain.passed).length,wonWagers:r.filter(x=>x.active.wagerOutcome==='won').length,sixTierClear:r.filter(x=>x.sixTier?.passed).length,paidGold:r.reduce((n,x)=>n+x.active.spend,0),discards:r.reduce((n,x)=>n+x.discardCost,0)};}));
 return {scope:'controlled paired stage snapshots; four fixed seeds per cell; four seeded actual deals per cell and domain commands; planted stage/resources/cards and prior mandatory clear history; greedy public minimum-score hand, first qualifying activation at most once, no later discard/purchase; flower compares top affordable tier with a six-gold cap; counted passes are this policy only, not natural acquisition or human inference',stages,seeds,aggregates,rows};
}
