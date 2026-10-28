import type {CharacterId} from './characters';
import type {ScoreEvent,ScoreTrace} from '../domain/scoreR2';

/** A retained card's first real ordinary scoring arrival; no new hero multiplier is implied. */
export function retainedRefillImpact(event:ScoreEvent,ids:readonly string[]):string|undefined {
  return event.sourceType==='card'&&event.phase==='onCardScore'&&event.sourceDefinitionId.startsWith('rank-')&&event.operation==='add-heat'&&event.retriggerDepth===0&&event.value.n!=='0'&&event.targetCardId&&ids.includes(event.targetCardId)?event.targetCardId:undefined;
}

/** Saved IDs only. No draft qualification, arithmetic, new command or predicted outcome. */
export function savedHeroAttachment(trace:ScoreTrace,hero:CharacterId){
  const event=trace.events.find(e=>e.sourceType==='character'&&e.sourceDefinitionId===hero&&(
    hero==='amo'&&e.reasonKey==='amo.exile'&&trace.amoExile?.use||
    hero==='amo'&&e.reasonKey.startsWith('amo.assist.')&&!!trace.assist?.ids.length||
    hero==='erxiang'&&e.reasonKey==='erxiang.handoff'&&!!trace.erxiangHandoff?.targetId&&(trace.erxiangGroup?!!e.targetCardId:e.targetCardId===trace.erxiangHandoff.targetId)||
    hero==='laohuan'&&e.reasonKey==='laohuan.find'&&!!trace.laohuanFind?.multiplier||
    hero==='azao'&&e.reasonKey==='azao.multiply-multiplier'&&trace.azaoCharge?.release===true||
    hero==='xiemu'&&e.reasonKey==='xiemu.multiply-multiplier'&&!!trace.xiemuBurn?.cost||
    hero==='touye'&&!!trace.touyeWager?.commit&&(e.reasonKey.startsWith('touye.won.')||e.reasonKey.startsWith('touye.lost.'))));
  if(!event)return;
  const ids=hero==='laohuan'?trace.laohuanFind?.activeIds:hero==='amo'?(trace.amoExile?.use?trace.amoExile.discardedIds:trace.assist!.ids):hero==='erxiang'?(trace.erxiangGroup?[...new Set(trace.events.filter(e=>e.reasonKey==='erxiang.handoff').map(e=>e.targetCardId!).filter(Boolean))]:[trace.erxiangHandoff!.targetId!]):hero==='touye'?(trace.touyeWager?.outcome==='won'?trace.touyeWager.core?.activeNewIds:undefined):trace.sets.activeScoringIds.length?trace.sets.activeScoringIds:trace.sets.playedIds;
  return {event,targetIds:ids?[...ids]:undefined};
}
