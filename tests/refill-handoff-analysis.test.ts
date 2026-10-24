import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {createRun} from '../src/domain/run';
import {r2CreateJoker,r2ScoreContext} from '../src/domain/r2Run';
import {r2JokerDefinitionsFor} from '../src/domain/r2ContentProfiles';
import {scoreR2Hand} from '../src/domain/scoreR2';
import {r2StageSpec} from '../src/domain/r2Chapter';
import {newRunIdentity} from '../src/game/RunLaunch';
const choose=(n:number,k:number):bigint=>{if(k<0||k>n)return 0n;let x=1n;for(let i=1;i<=k;i++)x=x*BigInt(n-k+i)/BigInt(i);return x;};
const hit=(N:number,K:number,n:number,need=1)=>{let wins=0n;for(let k=need;k<=Math.min(K,n);k++)wins+=choose(K,k)*choose(N-K,n-k);const all=choose(N,n);return {wins:String(wins),all:String(all),probability:Number(wins)/Number(all)};};
export function frequencyAnalysis(){
 const run=createRun({rulesVersion:'r2',seed:'frequency-analysis',runId:'frequency-analysis',characterId:'erxiang',r2Identity:newRunIdentity('erxiang','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}}),defs=r2JokerDefinitionsFor(run);
 const hands={pair:['spades-8','hearts-8'],straight:['spades-4','hearts-5','clubs-6','diamonds-7','hearts-8'],flush:['clubs-2','clubs-4','clubs-7','clubs-9','clubs-13']};
 const scoring=[];
 for(const [band,level,jokerIds,gold]of [['early',1,[],6],['middle',8,['b02','b04','c04','c06','e08'],25],['late',20,['b02','b04','c04','c06','e08'],25],['late-grown',20,['b02','b04','c04','c06','e08'],25]] as const){
  const jokers=jokerIds.map((id,i)=>r2CreateJoker(id,band+'/'+i,6,'none',run));
  if(band==='late-grown'){jokers.find(j=>j.definitionId==='c06')!.growth.multiplier={n:'6',d:'1'};jokers.find(j=>j.definitionId==='c04')!.growth.heat={n:'100',d:'1'};}
  for(const [name,ids]of Object.entries(hands)){
   const hand=ids.map(id=>run.deckInstances.find(c=>c.id===id)!),target=[...hand].sort((a,b)=>Math.min(b.rank===14?11:b.rank,10)-Math.min(a.rank===14?11:a.rank,10))[0].id;
   const input={...r2ScoreContext({...run,jokers,gold},hand,ids),rulesVersion:'r2' as const,runId:run.runId,rootId:band+'/'+name,hand,selectedIds:ids,disabledIds:[],jokers,definitions:defs,handLevels:{[name]:level},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,rng:run.rng.rule,gold};
   const base=scoreR2Hand({...input,erxiangHandoff:{targetId:null,beforeUsed:false}}),skill=scoreR2Hand({...input,erxiangHandoff:{targetId:target,beforeUsed:false}}),delta=BigInt(skill.finalScore)-BigInt(base.finalScore),baseline=BigInt(base.finalScore)*4n;
   const others=[];
   for(const hero of ['amo','xiemu','azao','touye'] as const){
    const other={...run,characterId:hero,...newRunIdentity(hero,'group'),jokers,gold},otherHand=hero==='amo'?[...hand,run.deckInstances.find(c=>c.id==='spades-13')!]:hand;
    const common={...input,...r2ScoreContext(other,otherHand,ids),hand:otherHand,erxiangHandoff:undefined};
    const ordinary=scoreR2Hand(common);
    if(hero==='amo'){const active=scoreR2Hand({...common,amoExile:{use:true,beforeUsed:false}});others.push({hero,ordinary:ordinary.finalScore,active:active.finalScore,cost:'discard actual remainder K, once per stage'});}
    if(hero==='touye')others.push({hero,ordinary:ordinary.finalScore,active:'conditional target/new-core x2 or failure x0.85, no invented hit rate',cost:'normal discard quota; next hand only'});
    if(hero==='xiemu')for(const cost of [3,6,10] as const){if(name==='pair'){others.push({hero,cost,active:'unqualified'});continue;}if(gold<cost){others.push({hero,cost,active:'insufficient-gold'});continue;}const active=scoreR2Hand({...common,gold:gold-cost,xiemuBurn:{cost,goldBefore:gold,beforeUsed:false}});others.push({hero,cost,ordinary:ordinary.finalScore,active:active.finalScore,goldAfter:gold-cost});}
    if(hero==='azao'&&name!=='pair')for(const charge of [1,2,3] as const){const active=scoreR2Hand({...common,azaoCharge:{before:{charge,previousQualifiedType:'two-pair'},release:true}});others.push({hero,charge,ordinary:ordinary.finalScore,active:active.finalScore,cost:'actual previously accumulated layers; release consumes them'});}
   }
   const stageIndex=band==='early'?2:band==='middle'?11:23;
   const actualTargetWindows=([0,3] as const).map(difficulty=>{const target=r2StageSpec(stageIndex,'normal',difficulty,true,true)!.targetHeat;const outcomes=[0,1,2,4].map(quota=>{let heat=0n,uses=0,hands=0;while(hands<4&&heat<BigInt(target)){const active=uses<quota;heat+=BigInt(active?skill.finalScore:base.finalScore);if(active)uses++;hands++;}return {quota,target,hands,uses,heat:String(heat),cleared:heat>=BigInt(target)};});return {stageIndex,difficulty,outcomes};});
   scoring.push({actualTargetWindows,others,jokerState:jokers,band,level,hand:name,target,points:skill.erxiangHandoff!.points,jokers:jokerIds,base:{score:base.finalScore,H:base.accumulator.H,M:base.accumulator.M},skill:{score:skill.finalScore,H:skill.accumulator.H,M:skill.accumulator.M},delta:String(delta),fourHandTotals:{none:String(baseline),once:String(baseline+delta),twice:String(baseline+2n*delta),everyHand:String(baseline+4n*delta)},quotaRatios:{once:Number(baseline+delta)/Number(baseline),twice:Number(baseline+2n*delta)/Number(baseline),everyHand:Number(baseline+4n*delta)/Number(baseline)}});
  }
 }
 return {identity:newRunIdentity('erxiang','group'),assumptions:'Controlled repeatable scoring windows, not natural deck/availability/win rates; four equal legal hands only to compare quota. Middle/late owned Joker sets are explicit fixtures, not natural economy.',scoring,refill:[{name:'指定8配对子',N:44,K:3,discard:3,normal:hit(44,3,3),plusTwo:hit(44,3,5)},{name:'四张同花补第五张',N:44,K:9,discard:4,normal:hit(44,9,4),plusTwo:hit(44,9,6)},{name:'4-5-6-7两头顺',N:44,K:8,discard:4,normal:hit(44,8,4),plusTwo:hit(44,8,6)},{name:'三张同花补两张',N:44,K:10,discard:5,normal:hit(44,10,5,2),plusTwo:hit(44,10,7,2)}],threePaidPairAttempts:{N:44,K:3,normal:hit(44,3,9),onceExtra:hit(44,3,11),everyDiscardExtra:hit(44,3,15)},definitions:defs.filter(d=>['b02','b04','c04','c06','e08'].includes(d.id)).map(d=>({id:d.id,description:d.description}))};
}
it('fixed exact probability and real scoring analysis is reproducible without a simulation campaign',()=>{const report=frequencyAnalysis();expect(report.scoring).toHaveLength(12);expect(report.scoring[0].base.score).toBe('102');expect(report.scoring[0].skill.score).toBe('430');expect(report.refill[0].normal).toMatchObject({wins:'2584',all:'13244'});for(const r of report.refill)expect(r.plusTwo.probability).toBeGreaterThan(r.normal.probability);if(process.env.HERO_FREQUENCY_REPORT)writeFileSync(process.env.HERO_FREQUENCY_REPORT,JSON.stringify(report,null,2)+'\n');});
