import {R2_ROUTE_GROWTH_JOKERS,R2_HOUSE_JOKERS,R2_VALUE_JOKERS,R2_TARGETED_VALUE_JOKERS} from '../content/r2RouteGrowthJokers';
import {r2HouseProfile,isR2TargetedValue,isR2JokerValue,isR2RouteGrowth,hasR2GroupUpgradeContract} from './r2GroupUpgrade';
import {R2_GROUP_UPGRADE_JOKERS} from '../content/r2GroupUpgradeJokers';
import {R2_PUBLISHED_CONTENT,R2_PUBLISHED_JOKERS} from './r2PublishedContent';
import {R2_ASSIST_HASH,R2_ASSIST_VERSION} from './r2AssistIdentity';
import {isR2ComboGrowth} from './r2ComboGrowth';
import {R2_COMBO_GROWTH_JOKERS} from '../content/r2ComboGrowthJokers';
import {R2_ASSIST_JOKERS} from '../content/r2AssistJokers';

export interface R2ContentIdentity {contentVersion?:unknown;contentHash?:unknown}
/** Exact run identity; no global default or mixed-version fallback. */
export function r2JokerDefinitionsFor(identity:R2ContentIdentity) {
 if(isR2TargetedValue(identity))return R2_TARGETED_VALUE_JOKERS;
 if(isR2JokerValue(identity))return R2_VALUE_JOKERS;
 if(r2HouseProfile(identity))return R2_HOUSE_JOKERS;
 if(isR2RouteGrowth(identity))return R2_ROUTE_GROWTH_JOKERS;
 if(hasR2GroupUpgradeContract(identity))return R2_GROUP_UPGRADE_JOKERS;
 if(isR2ComboGrowth(identity))return R2_COMBO_GROWTH_JOKERS;
 if(identity.contentVersion===R2_ASSIST_VERSION&&identity.contentHash===R2_ASSIST_HASH)return R2_ASSIST_JOKERS;
 if([R2_PUBLISHED_CONTENT.v10,R2_PUBLISHED_CONTENT.v11].some(p=>p.version===identity.contentVersion&&p.hash===identity.contentHash))return R2_PUBLISHED_JOKERS;
 throw Error('incompatible-version');
}
export function r2JokerDefinitionsForContext(identity:R2ContentIdentity) {
 if(identity.contentVersion===undefined&&identity.contentHash===undefined)return R2_PUBLISHED_JOKERS;
 return r2JokerDefinitionsFor(identity);
}
export function r2JokerDefinitionFor(identity:R2ContentIdentity,id:string) {
 const definition=r2JokerDefinitionsFor(identity).find(d=>d.id===id);
 if(!definition)throw Error('unavailable-joker-definition');
 return definition;
}
