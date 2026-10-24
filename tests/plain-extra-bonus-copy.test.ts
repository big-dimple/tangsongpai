import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {R2_TOOLS,R2_EDITIONS,R2_ENHANCEMENTS,R2_TOOL_CATALOG} from '../src/content/r2Tools';
import {R2_JOKERS} from '../src/content/r2Schema';
import {cardSpecialText,cardSpecialSummary,editionEffectText,editionLabel,jokerExtraBonusCopy,toolInfo} from '../src/game/r2ToolInfo';
import {toolCardTargetStatus} from '../src/game/ToolTargetDirectory';
import {createRun,applyCommand} from '../src/domain/run';
import {r2CreateJoker} from '../src/domain/r2Run';
import type {Edition} from '../src/cards/types';
import {R2_ASSIST_JOKERS} from '../src/content/r2AssistJokers';
import {jokerMemoryAbility,publicJokerMemoryContext} from '../src/game/JokerMemory';
import {handScoringOrder} from '../src/game/HandRuleReference';

const clean=(value:unknown)=>expect(JSON.stringify(value)).not.toMatch(/版次|大丑|独立于本体/);
it('covers full detail rules for all ordinary and assist definitions, including paused copies and the rule reference',()=>{
 const run=createRun({rulesVersion:'r2',seed:'all-detail-wording',runId:'all-detail-wording',characterId:'amo'}),snapshot=structuredClone(run);
 for(const d of [...R2_JOKERS,...R2_ASSIST_JOKERS])for(const scoringLimited of [false,true]){const j=r2CreateJoker(d.id,d.id,0),ctx=publicJokerMemoryContext(run,{hand:[],scoringLimited,deckSize:run.deckInstances.length,jokerSlots:5,jokerCount:1}),before=structuredClone(j);clean(jokerMemoryAbility(d,j,ctx));expect(j).toEqual(before);}
 clean(handScoringOrder(run));expect(run).toEqual(snapshot);
});
it('uses ordinary words across every tool and the full enhancement/extra-bonus display matrix without mutating definitions',()=>{
 const before=JSON.stringify([R2_TOOL_CATALOG,R2_JOKERS]);
 for(const tool of R2_TOOLS)clean(toolInfo(tool.id));
 for(const edition of R2_EDITIONS){clean(editionEffectText(edition.id));expect(editionEffectText(edition.id)).toContain(edition.name);expect(editionLabel(edition.id)).toBe(edition.name);
  for(const enhancement of [undefined,...R2_ENHANCEMENTS.map(e=>e.id)]){const card={id:'visible',rank:7 as const,suit:'hearts' as const,enhancement,edition:edition.id},snapshot=structuredClone(card);clean([cardSpecialText(card),cardSpecialSummary(card)]);expect(cardSpecialText(card)).toContain('额外加成：');expect(cardSpecialText(card)).toContain(edition.effect?edition.name:'无（普通）');expect(card).toEqual(snapshot);}
 }
 expect(JSON.stringify([R2_TOOL_CATALOG,R2_JOKERS])).toBe(before);
});
it.each([['foil','闪箔','热度+25'],['holographic','全息','倍率+2'],['polychrome','多彩','倍率×1.5']] as const)('%s retains the real label/value and separates a C12 score bonus from its gift and the dyed poker', (edition,label,math)=>{
 const extra=jokerExtraBonusCopy(edition,{definitionId:'c12'});clean(extra);expect(extra.label).toBe(label);expect(extra.shelf).toContain(math);expect(extra.detail).toContain('这张唐宋牌的计分');expect(extra.detail).toContain('同一场分别打出普通顺子和普通同花');expect(extra.detail).toContain('再成功过关');expect(extra.detail).toContain('同花顺不能替代');expect(extra.detail).toContain('保留受染扑克原有的额外加成');expect(extra.detail).toContain('不会因此把扑克变成多彩');expect(extra.detail).toContain('被封禁计分时暂停');
});
it('names the actual no-bonus targeting constraint without changing eligibility',()=>{
 const tool=R2_TOOLS.find(t=>t.id==='S02')!,card={id:'target',rank:7 as const,suit:'hearts' as const};expect(toolCardTargetStatus(tool,card,'target').eligible).toBe(true);
 for(const edition of ['foil','holographic','polychrome'] as Edition[]){const status=toolCardTargetStatus(tool,{...card,edition},'target');expect(status.eligible).toBe(false);expect(status.reason).toBe('须无额外加成（普通）');clean(status);}
 const info=toolInfo('S02');expect(info.description).toContain('没有闪箔、全息或多彩加成');for(const text of ['闪箔5/10','全息3/10','多彩2/10','热度+25','倍率+2','倍率×1.5'])expect(info.risk).toContain(text);
});
it.each(['T03','T04','T05','T06'])('%s changes only suit and retains a poker’s existing bonus beside polychrome C12',id=>{
 for(const edition of ['none','foil'] as const){const state=createRun({rulesVersion:'r2',seed:'dye-extra-copy',runId:'dye/'+id+'/'+edition,characterId:'amo'}),tool=R2_TOOLS.find(t=>t.id===id)!;if(tool.operation.kind!=='set-suit')throw Error('expected dye');const suit=tool.operation.suit,card=state.deckInstances.find(c=>c.suit!==suit)!;card.edition=edition;state.jokers=[r2CreateJoker('c12','owned/c12',4,'polychrome',state)];state.consumables=[{instanceId:'dye',definitionId:id}];const snapshot=structuredClone(state),result=applyCommand(state,{runId:state.runId,commandId:'dye',expectedSeq:state.commandSeq,action:{type:'UseConsumable',instanceId:'dye',targetIds:[card.id]}});expect(result.ok).toBe(true);if(!result.ok)return;expect(result.state.deckInstances.find(c=>c.id===card.id)).toEqual({...card,suit});expect(result.state.jokers[0].edition).toBe('polychrome');expect(state).toEqual(snapshot);expect(toolInfo(id).description).toContain('不会给扑克新增多彩等加成');}
});
it('closes the known scene/target/preview omission paths while leaving technical edition identifiers available',()=>{
 for(const file of ['GameScene','ShopScene','ConsumableDialog','ToolTargetDirectory','ToolChangePreview','SavedToolResult','ShopRouteRelations','ShopPurchaseValue','ErxiangHandoffCopy'])clean(readFileSync('src/game/'+file+'.ts','utf8'));
 for(const file of ['GameScene','ShopScene','ConsumableDialog'])expect(readFileSync('src/game/'+file+'.ts','utf8')).toContain('jokerExtraBonusCopy');
});
