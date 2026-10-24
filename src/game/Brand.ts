/** Display brand only; repository, rules identities and persistence keys are independent. */
export const GAME_NAME='唐宋牌';
export const GAME_DESCRIPTION='唐宋人物题材的牌组构筑游戏';

/** Display text only. Source content now speaks the current brand natively, so this is an identity pass-through. Never apply rewrites to rule definitions, save data or protocol keys. */
export function playerText(copy:string):string {return copy;}
