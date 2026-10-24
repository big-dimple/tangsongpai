import {stableHash} from './hash';
export const BOSS_SUIT_RESCUE_PRICE=5;
export const BOSS_SUIT_RESCUE_CONTRACT=Object.freeze({version:1,price:5,entry:'nonempty-living-deck-all-disabled-suit',uses:1,due:'next-successful-play',scope:'B03-only',cards:'unchanged',proof:'entry-token-and-purchase-play-index-in-command-receipts',legacy:'unchanged-no-migration'});
export const withBossSuitRescueIdentity=(base:{contentVersion:string;contentHash:string})=>({contentVersion:base.contentVersion+'-b03-rescue-v1',contentHash:stableHash({inherits:base.contentHash,rescue:BOSS_SUIT_RESCUE_CONTRACT})});
