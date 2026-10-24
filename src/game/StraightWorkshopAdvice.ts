import {RANKS,SUITS,rankLabel,type PlayingCard,type Rank} from '../cards/types';
import {R2_TOOLS} from '../content/r2Tools';
import {evaluateR2Hand} from '../domain/evaluateR2';
import {toolCardTargetStatus} from './ToolTargetDirectory';
import {toolCardChange} from './ToolChangePreview';

/** Quotes are already checked by the existing shop adapter; this module never creates a price or command. */
export interface StraightAdviceQuote {quoteId:string;definitionId:string;paidPrice:number;available:boolean;quotaCost:0|1}
export interface StraightAdviceInput {
 deck:readonly PlayingCard[];destroyedIds:readonly string[];fourStraight:boolean;
 quotes:readonly StraightAdviceQuote[];gold:number;diyUsesLeft:number;
 /** Optional player-selected goal; accepted only when the production evaluator recognises it. */
 segment?:readonly Rank[];
}
export interface StraightRankCount {rank:Rank;count:number}
export interface StraightAdviceChange {
 fromRank:Rank;toRank:Rank;count:number;
 /** Alternatives to inspect, not selected IDs. The player still chooses actual instances. */
 eligibleCardIds:string[];sourceBefore:number;sourceAfter:number;
}
export interface StraightAdviceOption {
 quoteId:string;definitionId:string;paidPrice:number;quotaCost:0|1;costText:string;
 changes:StraightAdviceChange[];countsAfter:StraightRankCount[];reason:string;
}
export interface StraightAdviceGoal {
 segment:Rank[];label:string;deficientRanks:Rank[];countsBefore:StraightRankCount[];
 options:StraightAdviceOption[];caveat:string;
}
export type StraightWorkshopAdvice=
 | {kind:'none';reason:'no-gap'|'no-available-tool'|'no-safe-transfer'|'unsupported-segment';message:string}
 | {kind:'gap';goals:StraightAdviceGoal[]};

/** Compile rank windows from the sole hand evaluator rather than reimplementing Ace/consecutive rules. */
function legalSegments(size:4|5):Rank[][] {
 const result:Rank[][]=[],picked:Rank[]=[];
 const visit=(start:number)=>{
  if(picked.length===size){
   const cards=picked.map((rank,i)=>({id:'straight-advice/'+i,rank,suit:SUITS[i%SUITS.length]}));
   if(evaluateR2Hand(cards,{fourStraight:size===4}).type==='straight')result.push([...picked]);
   return;
  }
  for(let i=start;i<=RANKS.length-(size-picked.length);i++){picked.push(RANKS[i]);visit(i+1);picked.pop();}
 };visit(0);return result;
}
const segments={five:legalSegments(5),four:legalSegments(4)};
const signature=(ranks:readonly Rank[])=>[...ranks].sort((a,b)=>a-b).join(',');
const betterCoverage=(before:number[],after:number[])=>{
 const a=[...before].sort((x,y)=>x-y),b=[...after].sort((x,y)=>x-y);
 const different=a.findIndex((value,i)=>value!==b[i]);return different>=0&&b[different]>a[different];
};
const countRows=(ranks:readonly Rank[],counts:ReadonlyMap<Rank,number>)=>ranks.map(rank=>({rank,count:counts.get(rank)??0}));

/** Public rank coverage only: no future draw order, score estimate, recommendation stars or side effects. */
export function straightWorkshopAdvice(input:StraightAdviceInput):StraightWorkshopAdvice {
 const destroyed=new Set(input.destroyedIds),live=input.deck.filter(card=>!destroyed.has(card.id));
 const counts=new Map(RANKS.map(rank=>[rank,live.filter(card=>card.rank===rank).length]));
 let windows=input.fourStraight?[...segments.four,...segments.five]:segments.five;
 if(input.segment){const key=signature(input.segment);windows=windows.filter(ranks=>signature(ranks)===key);if(!windows.length)return {kind:'none',reason:'unsupported-segment',message:'该连续段不符合当前顺子规则。'};}
 const gaps=windows.flatMap(segment=>{
  const values=segment.map(rank=>counts.get(rank)!),minimum=Math.min(...values);
  // Equal coverage has no explicit bottleneck. In particular, a balanced52 deck gets no forced advice.
  return values.every(value=>value===minimum)?[]:[{segment,values,deficientRanks:segment.filter(rank=>counts.get(rank)===minimum)}];
 });
 if(!gaps.length)return {kind:'none',reason:'no-gap',message:'当前没有明确的顺子补点，保留金币与本店机会。'};
 const quotes=input.quotes.flatMap(quote=>{
  const tool=R2_TOOLS.find(row=>row.id===quote.definitionId);
  return quote.available&&Number.isFinite(quote.paidPrice)&&quote.paidPrice>=0&&quote.paidPrice<=input.gold&&quote.quotaCost<=input.diyUsesLeft&&tool?.operation.kind==='shift-rank'&&tool.target.kind==='cards'?[{quote,tool}]:[];
 });
 if(!quotes.length)return {kind:'none',reason:'no-available-tool',message:'当前没有资金和次数都可用的改点工具，保留金币与本店机会。'};
 const goals:StraightAdviceGoal[]=[];
 for(const {segment,values,deficientRanks}of gaps){
  const ordered=segment.includes(14)&&segment.includes(2)?[14 as Rank,...segment.filter(rank=>rank!==14)]:[...segment];
  const options:StraightAdviceOption[]=[];
  for(const {quote,tool}of quotes){
   if(tool.target.kind!=='cards')continue;
   const target=tool.target;
   const groups=new Map<string,{fromRank:Rank;toRank:Rank;ids:string[]}>();
   for(const card of live){
    const status=toolCardTargetStatus(tool,card,'target');if(!status.eligible||!status.changes)continue;
    const after=toolCardChange(tool,card)?.after;if(!after||!deficientRanks.includes(after.rank))continue;
    const key=card.rank+'/'+after.rank,group=groups.get(key)??{fromRank:card.rank,toRank:after.rank,ids:[]};group.ids.push(card.id);groups.set(key,group);
   }
   const alternatives=[...groups.values()];
   const add=(moves:{group:typeof alternatives[number];count:number}[])=>{
    const amount=moves.reduce((sum,m)=>sum+m.count,0);if(amount<target.minimum||amount>target.maximum)return;
    const after=new Map(counts);for(const {group,count}of moves){after.set(group.fromRank,after.get(group.fromRank)!-count);after.set(group.toRank,after.get(group.toRank)!+count);}
    // Even an outside neighbour keeps a physical copy; do not just move this segment's bottleneck.
    if(moves.some(({group})=>after.get(group.fromRank)!<1))return;
    const next=segment.map(rank=>after.get(rank)!);if(next.some(value=>value===0)||!betterCoverage(values,next))return;
    const changes=moves.map(({group,count})=>({fromRank:group.fromRank,toRank:group.toRank,count,eligibleCardIds:[...group.ids],sourceBefore:counts.get(group.fromRank)!,sourceAfter:after.get(group.fromRank)!}));
    options.push({quoteId:quote.quoteId,definitionId:quote.definitionId,paidPrice:quote.paidPrice,quotaCost:quote.quotaCost,
     costText:`实付${quote.paidPrice}金 · `+(quote.quotaCost?'占本店1次自选':'现货，不占本店自选'),changes,countsAfter:countRows(ordered,after),
     reason:changes.map(change=>`${change.count}张${rankLabel(change.fromRank)}→${rankLabel(change.toRank)}，${rankLabel(change.fromRank)}由${change.sourceBefore}剩${change.sourceAfter}张`).join('；')});
   };
   for(let i=0;i<alternatives.length;i++){
    const group=alternatives[i];for(let count=1;count<=Math.min(group.ids.length,target.maximum);count++)add([{group,count}]);
    // The real current shift tool selects up to two cards in the same direction; derive the limit from its definition.
    if(target.maximum>=2)for(const other of alternatives.slice(i+1))add([{group,count:1},{group:other,count:1}]);
   }
  }
  if(options.length){
   goals.push({segment:ordered,label:ordered.map(rankLabel).join('–'),deficientRanks:ordered.filter(rank=>deficientRanks.includes(rank)),countsBefore:countRows(ordered,counts),options,
    caveat:'仅说明这一连续段的点数覆盖；实际牌型以选牌预览为准，其它连续段及计分联动可能变化。'});
  }
 }
 return goals.length?{kind:'gap',goals}:{kind:'none',reason:'no-safe-transfer',message:'没有能保留连接点并补齐该段的富余邻点，保留金币与本店机会。'};
}
