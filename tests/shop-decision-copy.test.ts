import {it,expect} from 'vitest';
import {createRun,applyCommand} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {r2TargetedValueBase} from '../src/domain/r2GroupUpgrade';
import {shopOfferGuidance} from '../src/game/ShopOfferGuidance';
import {toolPurpose} from '../src/game/RouteFitCue';
import {toolInfo} from '../src/game/r2ToolInfo';
import {cardDefinitionName,TANGSONG_CARD_NAMES} from '../src/game/tangsongCardNames';
import {getR2Tool} from '../src/content/r2Tools';
import {r2PurchasePrice} from '../src/domain/r2Shop';
import {r2CreateJoker} from '../src/domain/r2Run';

const shop=(old=false)=>{const current=newRunIdentity('erxiang','flush');return createRun({rulesVersion:'r2',seed:'phone-shop-decision',runId:'phone-shop-decision',characterId:'erxiang',r2Identity:old?r2TargetedValueBase(current) as {contentVersion:string;contentHash:string}:current,openingRoute:'flush'});};
it('the photographed choices state new growth, actual cost and conditions without turning the starter into a ranking',()=>{
 const s=shop();s.gold=6;s.shop!.offers=[{offerId:'a11',definitionId:'a11',price:11,edition:'foil',consumed:false},{offerId:'e06',definitionId:'e06',price:6,consumed:false},{offerId:'c06',definitionId:'c06',price:6,consumed:false}];
 const before=structuredClone(s),growth=shopOfferGuidance(s,s.shop!.offers[2]),sale=shopOfferGuidance(s,s.shop!.offers[1]);
 expect(growth.label).toBe('选购依据');expect(growth.decision).toMatchObject({now:'打出同花牌型后，攒+0.5倍率，下次出牌起任意牌型都能用。',transaction:'购后0金'});
 expect(sale.decision).toMatchObject({now:'新购倍率+0',later:'成功卖牌后+0.5，下次出牌生效'});expect(sale.stars).toBe(3);expect(shopOfferGuidance(s,s.shop!.offers[0]).operation).toBe('差5金');expect(s).toEqual(before);
 const bought=applyCommand(s,{runId:s.runId,commandId:'buy-c06',expectedSeq:s.commandSeq,action:{type:'BuyOffer',offerId:'c06'}});expect(bought.ok).toBe(true);if(!bought.ok)return;
 const next=shopOfferGuidance(bought.state,bought.state.shop!.offers[1]);expect(next.operation).toBe('差6金');expect(next.stars).toBe(3);expect(next.decision.transaction).toBe('还差6金');
});
it('candidate spending and Qin Qiong conflicts remain explicit instead of becoming a positive connection',()=>{
 const s=shop();s.gold=21;s.jokers=[r2CreateJoker('e08','capital',8,'none',s)];s.shop!.offers=[{offerId:'new',definitionId:'b10',price:4,consumed:false}];expect(shopOfferGuidance(s,s.shop!.offers[0]).decision.connection).toContain('20');expect(shopOfferGuidance(s,s.shop!.offers[0]).decision.now).toBe('每次出牌热度+40；打出对子等同点组合后，攒+10热度，下次出牌起任意牌型都能用。');
 const old=shop(true);old.gold=21;old.jokers=[r2CreateJoker('e08','capital',8,'none',old)];old.shop!.offers=[{offerId:'new',definitionId:'b10',price:4,consumed:false}];expect(shopOfferGuidance(old,old.shop!.offers[0]).decision.connection).toContain('20');expect(shopOfferGuidance(old,old.shop!.offers[0]).decision.now).toBe('打出对子等同点组合后，攒+10热度，下次出牌起任意牌型都能用。');
 const q=createRun({rulesVersion:'r2',seed:'qin-decision',runId:'qin-decision',characterId:'touye',r2Identity:newRunIdentity('touye','group'),openingRoute:'group'});q.shop!.offers=[{offerId:'qin',definitionId:'f09',price:4,consumed:false}];expect(shopOfferGuidance(q,q.shop!.offers[0]).decision.connection).toContain('秦琼弃牌技能');
});
it('new c04 keeps its conditional fixed heat and zero initial growth separate in shelf and purchase copy',()=>{
 const s=createRun({rulesVersion:'r2',seed:'qin-step-up',runId:'qin-step-up',characterId:'touye',r2Identity:newRunIdentity('touye','group'),openingRoute:'group'});
 s.gold=23;s.jokers=['c06','d07','f09','a08'].map((id,i)=>r2CreateJoker(id,'held/'+i,4,'none',s));s.jokers[0].growth.multiplier={n:'2',d:'1'};
 const offer={offerId:'step-up',definitionId:'c04',price:4,consumed:false},before=structuredClone(s),copy=shopOfferGuidance(s,offer).decision;
 expect(copy.now).toBe('顺子或同花顺热度+50；出牌后攒+10热度，下次出牌起任意牌型都能用。');expect(copy.later).toBe('最多攒+100热度，跨场保留，出售后清空。');expect(copy.transaction).toBe('购后19金');
 expect(copy.purchaseAbility?.plain).toMatchObject({effectLine:copy.now,timingLine:copy.later,essential:'搭配：让普通顺子只需4张的唐宋牌，或改点工具。'});
 expect(copy.purchaseAbility?.plain?.details).toContain('其他牌型不增加成长');expect(copy.purchaseAbility?.plain?.details).toContain('重买从0开始');expect(s).toEqual(before);
});
it('T18 shows the short exchange-ticket copy while keeping its price and published definition',()=>{
 const s=shop(),offer={offerId:'T18',definitionId:'T18',price:4,consumed:false},before=structuredClone(s),definition=structuredClone(getR2Tool('T18'));
 const info=toolInfo('T18',s);expect(info.name).toBe('换货券');expect(info.label).toBe('补给 · 换货券');expect(info.summary).toBe('刷新一次商店商品');expect(toolPurpose(s,'T18')).toBe(info.summary);expect(info.description).toContain('长期道具不变');
 expect(cardDefinitionName(getR2Tool('T18'))).toBe('换货券');expect(Object.keys(TANGSONG_CARD_NAMES)).toHaveLength(72);expect(r2PurchasePrice(s,offer)).toBe(4);expect(s).toEqual(before);
 s.purchaseCoupons=1;expect(r2PurchasePrice(s,offer)).toBe(2);expect(toolInfo('T18',s).summary).toBe(info.summary);
 expect(getR2Tool('T18')).toEqual(definition);expect(definition.name).toBe('免费逛摊');expect(definition.operation).toEqual({kind:'free-reroll',advanceCount:true,growth:false});
});
