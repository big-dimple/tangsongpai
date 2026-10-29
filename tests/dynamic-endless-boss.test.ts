import {expect,it} from 'vitest';
import {R2_VALUE_JOKERS} from '../src/content/r2RouteGrowthJokers';
import {scoreR2Hand,type ScoreInput} from '../src/domain/scoreR2';
import {dynamicEndlessBossTarget} from '../src/domain/r2DynamicEndless';
import {azaoChargeStep,emptyAzaoCharge} from '../src/domain/r2AzaoCharge';

it('exposes the single-suit B03 counterexample for the generic severe tier',()=>{
 const hand=Array.from({length:5},(_,i)=>({id:`heart/${i}`,rank:14 as const,suit:'hearts' as const,edition:'polychrome' as const}));
 const base:ScoreInput={rulesVersion:'r2',runId:'boss-case',rootId:'boss-case/hand/1',characterId:'neutral',hand,selectedIds:hand.map(c=>c.id),disabledIds:[],jokers:[],definitions:R2_VALUE_JOKERS,handLevels:{'flush-five':30},playIndex:1,handsBeforePlay:4,previousHandType:null,wager:false,routeGrowth:{clears:0,G:0,S:0,F:0},rng:{algorithm:'fnv1a-mulberry32-v1',state:1}};
 const normal=BigInt(scoreR2Hand(base).finalScore),limited=BigInt(scoreR2Hand({...base,boss:{definitionId:'B03',disabledSuit:'hearts'},disabledIds:hand.map(c=>c.id)}).finalScore);
 const recent=normal*4n,anchor=(recent*35n+99n)/100n,target=BigInt(dynamicEndlessBossTarget(anchor.toString(),'1','B03'));
 expect(limited*4n).toBeLessThan(target);
 const adjusted=BigInt(dynamicEndlessBossTarget(anchor.toString(),'1','B03',true));
 expect(limited*4n).toBeGreaterThanOrEqual(adjusted);expect(adjusted).toBeGreaterThan(limited*3n);
 expect(dynamicEndlessBossTarget(anchor.toString(),'2000000','B03',true)).toBe('2000000');
});

it('B09 default three plays permit a two-charge release, not an assumed fourth play',()=>{
 let charge=emptyAzaoCharge();charge=azaoChargeStep('two-pair',{before:charge,release:false},true).after;charge=azaoChargeStep('three-kind',{before:charge,release:false},true).after;
 const third=azaoChargeStep('straight',{before:charge,release:true},true);expect(third.multiplier).toBe('2.5');expect(third.after).toEqual(emptyAzaoCharge());
 const held=azaoChargeStep('straight',{before:charge,release:false},true).after;expect(held.charge).toBe(3);
 expect(azaoChargeStep('flush',{before:held,release:true},true).multiplier).toBe('4');
});

it('measures a four-hand Azao charge cycle against the confirmed ordinary anchor',()=>{
 const make=(ranks:number[],suits:('hearts'|'spades'|'clubs'|'diamonds')[])=>ranks.map((rank,i)=>({id:`cycle/${i}`,rank:rank as 2|3|4|5|6|7|8|9|10,suit:suits[i],edition:'polychrome' as const}));
 const hands=[make([2,2,3,3],['hearts','spades','clubs','diamonds']),make([4,4,4],['hearts','spades','clubs']),make([2,3,4,5,6],['hearts','spades','clubs','diamonds','hearts']),make([2,4,6,8,10],['hearts','hearts','hearts','hearts','hearts'])];
 let charge=emptyAzaoCharge();const scores:bigint[]=[];
 for(let i=0;i<hands.length;i++){const hand=hands[i],trace=scoreR2Hand({rulesVersion:'r2',runId:'cycle',rootId:`cycle/hand/${i}`,characterId:'azao',hand,selectedIds:hand.map(c=>c.id),disabledIds:[],jokers:[],definitions:R2_VALUE_JOKERS,handLevels:{'two-pair':30,'three-kind':30,straight:30,flush:30},playIndex:i+1,handsBeforePlay:4-i,previousHandType:null,wager:false,routeGrowth:{clears:0,G:0,S:0,F:0},activeMultTiming:'after-route-growth',azaoCharge:{before:charge,release:i===3},rng:{algorithm:'fnv1a-mulberry32-v1',state:1}});scores.push(BigInt(trace.finalScore));charge=trace.azaoCharge!.after;}
 const total=scores.reduce((a,b)=>a+b,0n),anchor=(total*35n+99n)/100n;
 expect(scores.map(String)).toEqual(['54712','48844','162961','584415']);expect(anchor.toString()).toBe('297827');
 const held=scores[0]+scores[1]+scores[2];expect(held).toBeLessThan(anchor);expect(total).toBeGreaterThanOrEqual(anchor);
 // The bootstrap intentionally uses only one prior clear; a cold start may still end early.
 const cold=(total+9n)/10n;expect(scores[0]+scores[1]).toBeGreaterThanOrEqual(cold);
 const goal=(anchor*75n+99n)/100n;
 const calculate=(hand:typeof hands[number],boss:'B08'|'B09',before:ReturnType<typeof emptyAzaoCharge>,release:boolean)=>scoreR2Hand({rulesVersion:'r2',runId:'boss-cycle',rootId:'boss-cycle/hand/1',characterId:'azao',hand,selectedIds:hand.map(c=>c.id),disabledIds:[],jokers:[],definitions:R2_VALUE_JOKERS,handLevels:{'two-pair':30,'three-kind':30,straight:30,flush:30},playIndex:1,handsBeforePlay:3,previousHandType:null,wager:false,routeGrowth:{clears:0,G:0,S:0,F:0},activeMultTiming:'after-route-growth',azaoCharge:{before,release},boss:{definitionId:boss,disabledSuit:null},rng:{algorithm:'fnv1a-mulberry32-v1',state:1}});
 const b08=hands.map(hand=>BigInt(calculate(hand,'B08',emptyAzaoCharge(),false).finalScore)).reduce((a,b)=>a+b,0n);expect(b08).toBeGreaterThanOrEqual(goal);
 let before=emptyAzaoCharge();before=azaoChargeStep('two-pair',{before,release:false},true).after;before=azaoChargeStep('three-kind',{before,release:false},true).after;
 const b09=scores[0]+scores[1]+BigInt(calculate(hands[2],'B09',before,true).finalScore);expect(b09).toBeGreaterThanOrEqual(goal);
});
