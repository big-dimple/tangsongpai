import {HAND_LABELS} from '../content/handLabels';
import {previewR2Hand} from '../domain/scoreR2';
import {aiHandKey,aiHandScoreInput,type AiHandInput,type AiHandResult} from './AiHandCandidates';

export interface FirstStageOption {
 id:string;
 label:string;
 cardIds:string[];
 minimum:string;
 maximum:string;
 canClear:boolean;
}

/** Public current-hand examples only; this never reads the draw pile or chooses cards. */
export function firstStageOptions(input:AiHandInput,result:AiHandResult|undefined):FirstStageOption[] {
 if(result?.status!=='ready'||result.key!==aiHandKey(input))return [];
 const options:FirstStageOption[]=[];
 for(const facts of result.ordered){
  try {
   const preview=previewR2Hand(aiHandScoreInput(input,facts.playedIds));
   const minimum=preview.scoreRange.minimum,maximum=preview.scoreRange.maximum;
   const canClear=BigInt(input.resources.stageHeat)+BigInt(minimum)>=BigInt(input.resources.target);
   const score=minimum===maximum?minimum:minimum+'–'+maximum;
   options.push({id:facts.type,label:HAND_LABELS[facts.type]+' · 预计'+score+'分',cardIds:[...facts.playedIds],minimum,maximum,canClear});
  } catch { /* A changed public skill intent may make this example unavailable. */ }
 }
 // A final-hand example which cannot reach the target would invite an avoidable
 // loss. If none can clear, leave the options available and explain that fact.
 const clearing=options.filter(option=>option.canClear);
 if(input.resources.handsLeft===1){
  if(clearing.length)return clearing.slice(0,2);
  return [...options].sort((a,b)=>BigInt(a.minimum)>BigInt(b.minimum)?-1:BigInt(a.minimum)<BigInt(b.minimum)?1:0).slice(0,1);
 }
 return options.slice(0,2);
}
