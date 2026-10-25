import type {CharacterId} from './characters';
import {characterArt,characterArtKey} from './CharacterArt';
/** Full-frame user cutouts. Wider gestures get breathing room without cropping. */
export const PC_HERO_COMPOSITION:Record<CharacterId,{scale:number;align:number}>={
 amo:{scale:1,align:.50},touye:{scale:.94,align:.46},laohuan:{scale:.98,align:.48},
 erxiang:{scale:1,align:.57},azao:{scale:.94,align:.51},xiemu:{scale:.98,align:.54},
};
export const pcHeroKey=(id:CharacterId)=>characterArtKey(id,'pc');
export const pcHeroURL=(id:CharacterId)=>characterArt(id,'pc')?.url??'';
