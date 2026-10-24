import {settlementReady} from './settlement';

/** Explicit controlled ownership, discovered levels and chapter history.
 * The final PlayHand and U09 upgrade are real domain commands, not injected events. */
export function reviewBookReady(kind:'boss-win'|'boss-loss'|'ordinary'='boss-win',owned=true){
 const fixture=settlementReady(kind,'current');
 fixture.state.longTermItems=owned?['U09']:[];
 fixture.state.handLevels['two-pair']=2;
 fixture.state.chapterHandUsage={'two-pair':2};
 return {...fixture,action:{type:'PlayHand' as const,selectedIds:fixture.action.selectedIds}};
}
