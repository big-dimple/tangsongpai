import {describe,expect,it} from 'vitest';
import {SeededRng} from '../src/core/SeededRng';
import {drawR2Shelf,rerollPrice,r2Price,r2PurchasePrice,r2ShelfPrice} from '../src/domain/r2Shop';
import {R2_JOKERS} from '../src/content/r2Schema';
import {publicR2View,chooseR2Action} from '../src/testing/r2Bot';
import {newRunIdentity} from '../src/game/RunLaunch';
import {applyCommand,createRun,assertRunInvariants,type R2RunState} from '../src/domain/run';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {R2_HOUSE_PROFILES} from '../src/domain/r2GroupUpgrade';
describe('r2 shelves and public policy',()=>{
  it('offers a budgeted D3 flush opener only on the first shelf; preserves old saves and real payment',()=>{
    const current=newRunIdentity('erxiang','flush'),old=R2_HOUSE_PROFILES.find(p=>p.contentVersion===current.contentVersion.replace(/-restock-v1$/,''))!;
    const options={rulesVersion:'r2' as const,characterId:'erxiang' as const,openingRoute:'flush' as const,seed:'workshop-1',runId:'discount',modeConfig:{mode:'standard' as const,difficulty:3 as const,challengeId:null,programsEnabled:false}};
    const run=createRun({...options,r2Identity:current}),offer=run.shop!.offers.find(o=>o.definitionId==='c06')!;
    expect(offer.price).toBe(4);expect(r2Price('c06','none',run)).toBe(6);expect(r2ShelfPrice('c06','none',run,0,1)).toBe(6);
    const cmd={runId:run.runId,commandId:'buy',expectedSeq:run.commandSeq,action:{type:'BuyOffer' as const,offerId:offer.offerId}};
    const result=applyCommand(run,cmd);if(!result.ok)throw Error(result.code);
    expect(result.state.gold).toBe(0);expect(result.state.jokers[0].paidPrice).toBe(4);expect(applyCommand(result.state,cmd)).toMatchObject({ok:true,duplicate:true});
    expect(readCheckpoint(makeCheckpoint(result.state,[])).ok).toBe(true);
    const legacy=createRun({...options,r2Identity:{contentVersion:old.contentVersion,contentHash:old.contentHash}});
    expect(legacy.shop!.offers.some(o=>o.definitionId==='c06'&&o.price<=4)).toBe(false);expect(readCheckpoint(makeCheckpoint(legacy,[])).ok).toBe(true);
  });
  it('paid refreshes offer fresh legal definitions and cover the remaining ordinary budget',()=>{
    for(let i=0;i<24;i++){
      const run=createRun({rulesVersion:'r2',characterId:'erxiang',seed:'workshop-'+i,runId:'budget',openingRoute:'group',r2Identity:newRunIdentity('erxiang','group')});
      const cmd={runId:run.runId,commandId:'refresh',expectedSeq:run.commandSeq,action:{type:'RerollShop' as const}};
      const result=applyCommand(run,cmd);if(!result.ok)throw Error(result.code);
      const fresh=result.state,ids=fresh.shop!.offers.map(o=>o.definitionId);
      expect(new Set(ids).size).toBe(3);expect(run.shop!.offers.some(o=>ids.includes(o.definitionId))).toBe(false);
      expect(fresh.gold).toBe(4);expect(fresh.shop!.offers.some(o=>r2PurchasePrice(fresh,o)<=fresh.gold)).toBe(true);
      expect(fresh.rng.rule).toEqual(run.rng.rule);expect(fresh.rng.deck).toEqual(run.rng.deck);expect(fresh.shop!.itemOffers).toEqual(run.shop!.itemOffers);
      expect(applyCommand(structuredClone(run),cmd)).toEqual(result);
    }
  });
  it('draws weighted slots without replacement, handles short/empty pools and ensures affordability',()=>{
    expect(drawR2Shelf(new SeededRng('empty'),[])).toEqual([]);
    expect(drawR2Shelf(new SeededRng('one'),R2_JOKERS.slice(0,1))).toEqual(['pengci']);
    const fixtures=Array.from({length:6},(_,i)=>({...R2_JOKERS[0],id:`fixture-${i}`,rarity:i===0?'common' as const:'rare' as const}));
    for(let seed=0;seed<100;seed++){
      const shelf=drawR2Shelf(new SeededRng(`shop-${seed}`),fixtures,6);
      expect(shelf).toContain('fixture-0');expect(new Set(shelf).size).toBe(3);
    }
    expect([0,1,2,8,9,100].map(rerollPrice)).toEqual([2,3,4,10,10,10]);
  });
  it.each(['default','current'])('%s policy uses public information and leaves the checkpoint intact',profile=>{
    const route=profile==='current'?{openingRoute:'group' as const,r2Identity:newRunIdentity('erxiang','group')}:{};
    let run=createRun({seed:'policy',characterId:'erxiang',runId:'policy',rulesVersion:'r2',...route});
    for(let i=0;i<15;i++){
      const view=publicR2View(run),before=JSON.stringify(run);
      for(const key of ['rng','drawPile','deckInstances'])expect(view).not.toHaveProperty(key);
      const action=chooseR2Action(view);expect(JSON.stringify(run)).toBe(before);if(!action)break;
      const cmd={runId:run.runId,commandId:`p-${i}`,expectedSeq:run.commandSeq,action};
      const response=applyCommand(run,cmd),restored=applyCommand(JSON.parse(before) as R2RunState,cmd);
      expect(response.ok).toBe(true);expect(restored).toEqual(response);if(!response.ok)throw new Error(response.code);
      run=response.state;assertRunInvariants(run);
    }
  });
});
