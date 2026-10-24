import type {R2RunState} from '../domain/r2Run';
import {bossSuitRescueAvailability} from '../domain/r2BossSuitRescue';
import type {DetailDialog} from './DetailDialog';

export function bossSuitRescueLabel(run:R2RunState):string {
  const status=run.stage?.bossSuitRescue?.status;
  return status==='pending'?'待下次出牌\n本手解封':status==='used'?'应急解封\n本场已用':run.gold<5?'应急解封\n金币不足 · 需5金':'应急解封 · 5金';
}
export function showBossSuitRescue(dialog:DetailDialog,run:R2RunState,confirm:()=>Promise<void>):void {
  const available=bossSuitRescueAvailability(run);
  dialog.open('应急解封',available.reason+'\n花5金，让下一次成功出牌暂时解除单色灯的花色封禁；结算后恢复。本场最多一次。\n牌的花色、点数、增强和版次保持原样，花色搭配正常生效。购买后可以先弃牌准备。\n不增加出牌或弃牌次数，不降低目标，也不保证过关。',[
    ...(run.stage?.bossSuitRescue?.status==='unbought'?[{label:'花5金，准备解封',primary:true,disabled:!available.available,run:confirm}]:[]),
  ],{closeLabel:'返回牌桌'});
}
