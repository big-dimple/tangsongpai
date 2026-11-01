/** Display brand only; repository, rules identities and persistence keys are independent. */
export const GAME_NAME='唐宋牌';
export const GAME_DESCRIPTION='唐宋人物题材的牌组构筑游戏';

/** Display projection only: persisted content and identifiers remain unchanged.
 * The listed legacy phrases describe accumulated/target scores, not base H. */
export function playerText(copy:string):string {
 return copy
  .replaceAll('已过关场次累计热度','已过关场次累计得分')
  .replaceAll('已入账累计热度','已入账累计得分')
  .replaceAll('本场累计热度','本场累计得分')
  .replaceAll('这场累计热度','这场累计得分')
  .replaceAll('出牌前已经累计的热度','出牌前已经累计的得分')
  .replaceAll('本场总热度','本场总得分')
  .replaceAll('本场热度已达目标','本场得分已达目标')
  .replaceAll('目标热度','目标分数')
  .replaceAll('热度','筹码')
  .replaceAll('加热','加筹')
  .replaceAll('热+','筹+')
  .replaceAll('读热','读筹')
  .replaceAll('蓄热','蓄筹')
  .replace(/(\d)热(?=$|[\s，。；、)）])/g,'$1筹');
}
