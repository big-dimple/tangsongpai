import {expect,it} from 'vitest';
import {R2_JOKERS,r2GrowthCaps,r2GrowthMinimums} from '../src/content/r2Schema';
import {r2CreateJoker} from '../src/domain/r2Run';
import {r2SelectionFacts} from '../src/domain/r2SelectionFacts';
import {jokerMemoryAbility,type JokerMemoryContext} from '../src/game/JokerMemory';
import {fractionText} from '../src/game/scoreText';

const hand=[{id:'a',rank:7 as const,suit:'spades' as const},{id:'b',rank:7 as const,suit:'hearts' as const},{id:'c',rank:7 as const,suit:'clubs' as const},{id:'d',rank:2 as const,suit:'spades' as const},{id:'e',rank:4 as const,suit:'hearts' as const}];
const ctx=():JokerMemoryContext=>({inStage:false,hand,disabledIds:[],scoringLimited:false,gold:3,handsLeft:0,playIndex:0,discardsUsed:0,quadRefundUsed:false,previousHandType:null,stageHeat:'0',target:'1000',transaction:{gold:3,discarded:[],hasStage:false,maxPlayedCount:0,ordinaryStraightSeen:false,ordinaryFlushSeen:false,jokerSold:false,traceType:null,heat:'0',target:'1000'},deckSize:40,jokerSlots:5,jokerCount:2});
const def=(id:string)=>R2_JOKERS.find(d=>d.id===id)!;
const copy=(id:string,value?:{n:string;d:string})=>{const j=r2CreateJoker(id,id,0),key=Object.keys(r2GrowthCaps(def(id)))[0];if(value&&key)j.growth[key]=value;return jokerMemoryAbility(def(id),j,ctx());};

it('every owned growth definition exposes its real current value and cap in both detail status outlets',()=>{
 let checked=0;
 for(const d of R2_JOKERS){const caps=r2GrowthCaps(d);if(!Object.keys(caps).length)continue;const j=r2CreateJoker(d.id,d.id,0),growth={...r2GrowthMinimums(d),...j.growth},c=jokerMemoryAbility(d,j,ctx());
  for(const [key,cap] of Object.entries(caps)){const coefficient=key==='coefficient',label=coefficient?'当前倍率系数':key==='pendingHeat'?'当前待用热度':key==='multiplier'?'当前已攒倍率':'当前已攒热度',prefix=coefficient?'×':'+',line=label+'：'+prefix+fractionText(growth[key])+'；上限'+prefix+fractionText(cap);expect(c.state).toContain(line);expect(c.plain!.status).toContain(line);expect(c.rules).toContain('后续出牌生效');checked++;}
 }
 expect(checked).toBeGreaterThan(10);
});
it('zero, fractional and capped saved growth remain exact and capped growth can still reset when its rules say so',()=>{
 expect(copy('b10').plain!.status).toContain('当前已攒热度：+0');
 const grown=copy('b03',{n:'7',d:'4'});expect(grown.state).toContain('当前已攒倍率：+1.75');expect(grown.plain!.status).toContain('上限+');
 const b10=def('b10'),cap=r2GrowthCaps(b10).heat,capped=copy('b10',cap);expect(capped.plain!.status).toContain('已到上限');expect(capped.plain!.status.match(/当前已攒热度/g)).toHaveLength(1);
 expect(copy('f05',{n:'1',d:'1'}).rules).toContain('未超过会归零，到上限也可能归零');
});
it('pending heat, coefficient growth and coefficient resets explain their different persistence rules',()=>{
 const pending=R2_JOKERS.find(d=>Object.hasOwn(r2GrowthCaps(d),'pendingHeat'))!;expect(pending).toBeDefined();const p=jokerMemoryAbility(pending,r2CreateJoker(pending.id,pending.id,0),ctx());expect(p.state).toContain('当前待用热度：+0');expect(p.rules).toContain('实际读取后消耗，场末清空');
 const e11=copy('e11',{n:'7',d:'4'});expect(e11.state).toContain('当前倍率系数：×1.75');expect(e11.plain!.status).toContain('上限×');expect(e11.rules).toContain('出售事件会把倍率系数重置为×1');
 expect(copy('a06').rules).toContain('每场最多成长一次');
});
it('direct heat and multiplier effects are explicitly temporary and never presented as saved growth',()=>{
 const d07=copy('d07');expect(d07.state).toContain('只在当次计分生效，不保存、不跨手累计');expect(d07.rules).toContain('不保存、不跨手累计');expect(d07.state).not.toContain('当前已攒');expect(d07.plain!.details).toContain('不保存、不跨手累计');
});
it('historical scoring receipts do not mix in a later current-growth caption and unowned state stays unchanged',()=>{
 const j=r2CreateJoker('b10','receipt',0),receipt=jokerMemoryAbility(def('b10'),j,ctx(),[]);expect(receipt.plain!.status).not.toContain('当前已攒热度');
 expect(jokerMemoryAbility(def('b10'),undefined,ctx()).state).toBe('尚未购买，买入后才会生效');
});
