import {withBossSuitRescueIdentity} from '../domain/r2BossSuitRescue';
import {withPokerEncounterIdentity} from '../domain/r2PokerEncounter';
import {withPurchaseValueIdentity,withTargetedValueIdentity,withDynamicEndlessIdentity,withLaohuanFindIdentity,withXiemuRevisionIdentity,withTouyeScalingIdentity,withErxiangGroupIdentity,withJokerValueIdentity,r2WithHouseJoker,R2_HERO_FREQUENCY_VERSION,R2_HERO_FREQUENCY_HASH} from '../domain/r2GroupUpgrade';
import {R2_AMO_KING_VERSION,R2_AMO_KING_HASH,R2_XIEMU_FREQUENT_VERSION,R2_XIEMU_FREQUENT_HASH,R2_S04_FINISH_VERSION,R2_S04_FINISH_HASH} from '../domain/r2GroupUpgrade';
import type {CharacterId} from '../domain/characters';
import type {R2RunState} from '../domain/r2Run';
import {r2RulesetFor} from '../domain/r2Run';
import {type R2OpeningRoute} from '../domain/r2GroupUpgrade';

export type RunLaunchIntent={kind:'new';openingRoute?:R2OpeningRoute}|{kind:'retry';run:R2RunState};
/** Only the normal new-game route follows this policy. Saved runs carry their own identity. */
function originalNewRunIdentity(_characterId:CharacterId,_route?:R2OpeningRoute){
  if(_characterId==='erxiang'||_characterId==='laohuan')return r2WithHouseJoker({contentVersion:R2_HERO_FREQUENCY_VERSION,contentHash:R2_HERO_FREQUENCY_HASH});
  if(_characterId==='amo')return r2WithHouseJoker({contentVersion:R2_AMO_KING_VERSION,contentHash:R2_AMO_KING_HASH});
  if(_characterId==='xiemu')return r2WithHouseJoker({contentVersion:R2_XIEMU_FREQUENT_VERSION,contentHash:R2_XIEMU_FREQUENT_HASH});
  return r2WithHouseJoker({contentVersion:R2_S04_FINISH_VERSION,contentHash:R2_S04_FINISH_HASH});
}
export const newRunIdentity=(id:CharacterId,route?:R2OpeningRoute)=>{const base=withPokerEncounterIdentity(withBossSuitRescueIdentity(originalNewRunIdentity(id,route)));return withPurchaseValueIdentity(withTargetedValueIdentity(withDynamicEndlessIdentity(withJokerValueIdentity(id==='erxiang'?withErxiangGroupIdentity(base):id==='laohuan'?withLaohuanFindIdentity(base):id==='xiemu'?withXiemuRevisionIdentity(base):id==='touye'?withTouyeScalingIdentity(base):base))));};
export function launchIdentity(characterId:CharacterId,intent:RunLaunchIntent){
  if(intent.kind==='new')return newRunIdentity(characterId,intent.openingRoute);
  if(intent.kind!=='retry'||intent.run.characterId!==characterId||!r2RulesetFor(intent.run))throw Error('invalid-retry-identity');
  return {contentVersion:intent.run.contentVersion,contentHash:intent.run.contentHash};
}
