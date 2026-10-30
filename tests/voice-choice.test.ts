import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyCommand,createRun,type Action,type R2RunState} from '../src/domain/run';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {R2_HOUSE_PROFILES,isR2VoiceChoice,r2BasicChoiceIds,r2PurchaseValueBase,r2TargetedValueBase,r2DynamicEndlessBase,isR2PurchaseValue,isR2DynamicEndless} from '../src/domain/r2GroupUpgrade';
import {r2BasicChoicePool} from '../src/domain/r2Shop';
import {basicChoiceRows} from '../src/game/BasicToolChoice';
import {purchasePaymentFacts} from '../src/game/PurchasePaymentFacts';
import {enhancementAcquisition} from '../src/game/EnhancementReference';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {CHARACTER_IDS} from '../src/domain/characters';
const start=(challenge=false)=>createRun({seed:challenge?'challenge/q10/0':'voice-choice',runId:'voice-choice',rulesVersion:'r2',characterId:'amo',openingRoute:'group',r2Identity:newRunIdentity('amo','group'),modeConfig:{mode:challenge?'challenge':'standard',difficulty:0,challengeId:challenge?'Q10':null,programsEnabled:false}});
const cmd=(s:R2RunState,action:Action)=>({runId:s.runId,commandId:'voice/'+s.commandSeq,expectedSeq:s.commandSeq,action});
const buy=(s:R2RunState):Action=>({type:'BuyBasicTool',definitionId:'T13',shopSeq:s.shop!.basicChoice!.shopSeq});
const send=(s:R2RunState,a:Action)=>{const r=applyCommand(s,cmd(s,a));if(!r.ok)throw Error(r.code);return r.state;};
const round=(s:R2RunState)=>{const result=readCheckpoint(makeCheckpoint(s,[]));expect(result.ok).toBe(true);if(result.ok)expect(result.checkpoint.state).toEqual(s);};
const previousHashes:Record<string,string>={amo:'json-fnv-v1:145e0781e9f608ed',touye:'json-fnv-v1:47cb3174c988f8a8',laohuan:'json-fnv-v1:b2ee5e7cebdfc738',erxiang:'json-fnv-v1:8299113f8a4b68b3',azao:'json-fnv-v1:25bace1192d60cfd',xiemu:'json-fnv-v1:a9081e58cd37cb3c'};
it.each(CHARACTER_IDS)('new %s identity adds voice choice while the exact prior identity stays usable',id=>{
 const identity=newRunIdentity(id,'group');expect(isR2VoiceChoice(identity)).toBe(true);
 const old=R2_HOUSE_PROFILES.find(p=>p.contentVersion===identity.contentVersion.replace(/-voice-choice-v1$/,''))!;
 expect(old).toBeTruthy();expect(old.contentHash).toBe(previousHashes[id]);expect(isR2PurchaseValue(identity)).toBe(true);expect(isR2DynamicEndless(identity)).toBe(true);expect(r2PurchaseValueBase(identity)).toEqual(r2PurchaseValueBase(old));expect(r2TargetedValueBase(identity)).toEqual(r2TargetedValueBase(old));expect(r2DynamicEndlessBase(identity)).toEqual(r2DynamicEndlessBase(old));expect(r2BasicChoiceIds(old)).not.toContain('T13');expect(r2BasicChoiceIds(identity)).toContain('T13');
 const state=createRun({seed:'voice-old',runId:'voice-old',rulesVersion:'r2',characterId:id,openingRoute:'group',r2Identity:{contentVersion:old.contentVersion,contentHash:old.contentHash}});round(state);
 expect(launchIdentity(id,{kind:'retry',run:state})).toEqual({contentVersion:old.contentVersion,contentHash:old.contentHash});
});
it('offers a 4-gold shared choice independently of same-name stock; purchase, use and restoration preserve quota',()=>{
 const s=start();s.shop!.toolOffers[0]={...s.shop!.toolOffers[0],definitionId:'T13',price:4};const snapshot=structuredClone(s);
 const row=basicChoiceRows(s).find(r=>r.id==='T13')!;expect(row).toMatchObject({price:4,duplicate:undefined,reason:undefined});expect(r2BasicChoicePool(s).some(t=>t.id==='T13')).toBe(true);expect(s).toEqual(snapshot);
 const c=cmd(s,buy(s)),result=applyCommand(s,c);expect(result.ok).toBe(true);if(!result.ok)return;
 const n=result.state;expect(n.gold).toBe(s.gold-4);expect(n.shop!.basicChoice!.purchase).toMatchObject({definitionId:'T13',paidPrice:4});expect(n.shop!.toolOffers[0].consumed).toBe(false);expect(n.rng).toEqual(s.rng);
 expect(purchasePaymentFacts(s,n,{offerId:'basic-choice/'+s.shop!.basicChoice!.shopSeq,definitionId:'T13',price:4,consumed:false})).toMatchObject({original:4,paid:4});
 expect(applyCommand(n,c)).toMatchObject({ok:true,duplicate:true});expect(applyCommand(n,cmd(n,buy(n)))).toMatchObject({ok:false,code:'basic-choice-consumed'});round(n);
 const ids=n.deckInstances.slice(0,2).map(card=>card.id),used=send(n,{type:'UseConsumable',instanceId:n.consumables[0].instanceId,targetIds:ids});expect(used.deckInstances.filter(card=>ids.includes(card.id)).every(card=>card.enhancement==='voice-paper')).toBe(true);round(used);
 const refreshed=send(used,{type:'RerollShop'});expect(refreshed.shop!.basicChoice!.purchase).toEqual(n.shop!.basicChoice!.purchase);round(refreshed);
 const next=send(send(refreshed,{type:'SkipStage'}),{type:'OpenShop'});expect(next.shop!.basicChoice!.purchase).toBeNull();round(next);
});
it('rejects unavailable balance, capacity, invalid targets and Q10 without consuming resources',()=>{
 const s=start(),poor={...s,gold:3},full={...s,consumables:[{instanceId:'a',definitionId:'T02'},{instanceId:'b',definitionId:'T09'}]};
 for(const [state,code] of [[poor,'not-enough-gold'],[full,'consumable-slots-full']] as const){const before=structuredClone(state);expect(applyCommand(state,cmd(state,buy(state)))).toMatchObject({ok:false,code});expect(state).toEqual(before);}
 const q=start(true),before=structuredClone(q);expect(basicChoiceRows(q).find(r=>r.id==='T13')!.reason).toBeTruthy();expect(applyCommand(q,cmd(q,buy(q)))).toMatchObject({ok:false,code:'basic-choice-not-legal'});expect(q).toEqual(before);expect(enhancementAcquisition('voice-paper',q,q)).toContain('禁止');const held={...q,consumables:[{instanceId:'held-voice',definitionId:'T13'}]},heldBefore=structuredClone(held);expect(applyCommand(held,cmd(held,{type:'UseConsumable',instanceId:'held-voice',targetIds:[held.deckInstances[0].id]}))).toMatchObject({ok:false,code:'enhancements-disabled'});expect(held).toEqual(heldBefore);
 const n=send(s,buy(s)),use=(ids:string[]):Action=>({type:'UseConsumable',instanceId:n.consumables[0].instanceId,targetIds:ids});for(const ids of [[],n.deckInstances.slice(0,3).map(c=>c.id),[n.deckInstances[0].id,n.deckInstances[0].id]])expect(applyCommand(n,cmd(n,use(ids))).ok).toBe(false);
});

it('restores and retries an actual e5cc378 checkpoint without migration',()=>{
 const saved=JSON.parse(readFileSync(new URL('./fixtures/voice-choice-prechange-checkpoint.json',import.meta.url),'utf8'));
 const restored=readCheckpoint(saved);expect(restored.ok).toBe(true);if(!restored.ok)return;
 const state=restored.checkpoint.state;expect(state.contentHash).toBe(previousHashes.amo);expect(state.shop!.basicChoice!.purchase).toMatchObject({definitionId:'T08',paidPrice:2});expect(launchIdentity('amo',{kind:'retry',run:state})).toEqual({contentVersion:state.contentVersion,contentHash:state.contentHash});expect(r2BasicChoiceIds(state)).not.toContain('T13');round(state);
});

it('existing coupon applies to the 4-gold voice choice and its saved payment',()=>{
 const s=send(send(start(),{type:'SkipStage'}),{type:'OpenShop'});expect(s.purchaseCoupons).toBe(1);const n=send(s,buy(s));expect(n.gold).toBe(s.gold-2);expect(n.purchaseCoupons).toBe(0);expect(n.shop!.basicChoice!.purchase).toMatchObject({definitionId:'T13',paidPrice:2});round(n);
});
