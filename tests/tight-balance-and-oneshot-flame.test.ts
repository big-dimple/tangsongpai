import {afterEach,describe,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {applyCommand,createRun,type Action,type R2RunState} from '../src/domain/run';
import {CHARACTER_IDS} from '../src/domain/characters';
import {newRunIdentity,launchIdentity} from '../src/game/RunLaunch';
import {R2_TIGHT_BALANCE_TARGETS,lockR2ChapterTargets,r2StageSpec} from '../src/domain/r2Chapter';
import {R2_TIGHT_ROUTE_RULE,r2RouteFactor} from '../src/domain/r2RouteGrowth';
import {R2_LEGACY_CONTENT_HASH,R2_LEGACY_CONTENT_VERSION,r2CreateJoker} from '../src/domain/r2Run';
import {isR2TightBalance,r2BasicChoiceBasePrice,r2TightBalanceBase} from '../src/domain/r2GroupUpgrade';
import {r2PracticeBasePriceFor} from '../src/domain/r2Practice';
import {r2PaidRerollPrice,r2ProgramGoldAmount,r2RerollBounds,r2StageClearBaseGold} from '../src/domain/r2Shop';
import {r2RunModeConfig} from '../src/content/r2Modes';
import {xiemuTiersFor} from '../src/domain/r2XiemuBurn';
import {makeCheckpoint,readCheckpoint} from '../src/application/checkpoint';
import {mountHighMultiplierAura} from '../src/game/HighMultiplierAura';
import {layout} from '../src/game/layout';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

const send=(s:R2RunState,action:Action)=>{
  const r=applyCommand(s,{runId:s.runId,commandId:`${s.runId}/tight/${s.commandSeq}`,expectedSeq:s.commandSeq,action});
  if(!r.ok)throw Error(r.code);
  return r.state;
};
const round=(s:R2RunState)=>{
  const cp=makeCheckpoint(s,[]);
  expect(readCheckpoint(JSON.parse(JSON.stringify(cp))).ok).toBe(true);
};

function paintedColors(ink:Phaser.GameObjects.Graphics):number[]{
  const commands=ink.commandBuffer,colors:number[]=[];
  for(let i=0;i<commands.length;){
    const op=commands[i++];
    if(op===7){colors.push(commands[i++]);i++;}
    else if(op===1){}
    else if(op===4||op===5){i+=2;}
    else if(op===8){}
    else throw new Error(`Unexpected Phaser graphics command ${op}`);
  }
  return colors;
}

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('tight-balance-v1 progression and economy contract',()=>{
  it('applies per-difficulty progressive target curves across D0-D3 while preserving prior identities',()=>{
    for(const d of [0,1,2,3] as const){
      const id=newRunIdentity('erxiang','group');
      expect(isR2TightBalance(id)).toBe(true);
      for(let chapter=1;chapter<=8;chapter++){
        const base=R2_TIGHT_BALANCE_TARGETS[d][chapter-1];
        const plan=lockR2ChapterTargets(chapter,'normal',d,{definitionId:'B01',disabledSuit:null},true);
        expect(plan.targets).toEqual([String(base),String((base*3)/2),String(base*2)]);
        expect(r2StageSpec((chapter-1)*3,'normal',d,true,true,true)?.targetHeat).toBe(String(base));
      }
      const s=createRun({rulesVersion:'r2',seed:'tight-target-'+d,runId:'tight-target-'+d,characterId:'erxiang',r2Identity:id,openingRoute:'group',modeConfig:{mode:'standard',difficulty:d,challengeId:null,programsEnabled:true}});
      expect(s.gold).toBe([5,5,4,4][d]);
      expect(s.chapterTargetPlan?.targets).toEqual(['400','600','800']);
      round(s);
    }

    const pre=r2TightBalanceBase(newRunIdentity('erxiang','group')) as {contentVersion:string;contentHash:string};
    expect(isR2TightBalance(pre)).toBe(false);
    const oldD3=createRun({rulesVersion:'r2',seed:'old-d3',runId:'old-d3',characterId:'erxiang',r2Identity:pre,openingRoute:'group',modeConfig:{mode:'standard',difficulty:3,challengeId:null,programsEnabled:false}});
    expect(oldD3.gold).toBe(4);
    expect(oldD3.chapterTargetPlan?.targets).toEqual(['480','720','960']);
    expect(launchIdentity('erxiang',{kind:'retry',run:oldD3})).toEqual(pre);
    round(oldD3);

    const legacyV10=createRun({rulesVersion:'r2',seed:'legacy-v10',runId:'legacy-v10',characterId:'amo',r2Identity:{contentVersion:R2_LEGACY_CONTENT_VERSION,contentHash:R2_LEGACY_CONTENT_HASH}});
    expect(legacyV10.contentHash).toBe(R2_LEGACY_CONTENT_HASH);
    round(legacyV10);
  });

  it('tightens shop prices, rerolls, program rewards, xiemu tiers, and clear gold without migrating restock-v1',()=>{
    const id=newRunIdentity('xiemu','group');
    expect(r2BasicChoiceBasePrice('T08',id)).toBe(3);
    expect(r2BasicChoiceBasePrice('T03',id)).toBe(4);
    expect(r2BasicChoiceBasePrice('T13',id)).toBe(4);
    expect([1,2,3,4,5,6].map(l=>r2PracticeBasePriceFor(l,id))).toEqual([4,4,6,6,8,8]);
    expect(xiemuTiersFor(id).map(t=>[t.cost,t.multiplier])).toEqual([[4,1.5],[8,2],[12,3],[16,4]]);

    const pre=r2TightBalanceBase(id) as {contentVersion:string;contentHash:string};
    expect(r2BasicChoiceBasePrice('T08',pre)).toBe(2);
    expect([1,2,3,4,5,6].map(l=>r2PracticeBasePriceFor(l,pre))).toEqual([4,4,4,6,6,6]);
    expect(xiemuTiersFor(pre).map(t=>[t.cost,t.multiplier])).toEqual([[2,1.5],[4,2],[6,3],[8,4]]);

    for(const d of [0,1,2,3] as const){
      const erxId=newRunIdentity('erxiang','group');
      const cfg=r2RunModeConfig({mode:'standard',difficulty:d,challengeId:null,programsEnabled:true});
      expect(r2RerollBounds(cfg,erxId)).toEqual(d===3?{start:5,cap:13}:{start:4,cap:12});
      const run=createRun({rulesVersion:'r2',seed:'tight-econ-'+d,runId:'tight-econ-'+d,characterId:'erxiang',r2Identity:erxId,openingRoute:'group',modeConfig:{mode:'standard',difficulty:d,challengeId:null,programsEnabled:true}});
      expect(r2PaidRerollPrice(run)).toBe(d===3?5:4);
      expect(r2ProgramGoldAmount(run,4)).toBe(3);
      expect([0,1,2].map(i=>r2StageClearBaseGold(run,i))).toEqual(d===0?[3,4,5]:[0,4,5]);
    }

    // Real stage clear checks D0 (3g base) vs D1 (0g base) clear gold in PlayHand trace
    for(const [d,expectedBase] of [[0,3],[1,0]] as const){
      let s=createRun({rulesVersion:'r2',seed:'clear-gold-'+d,runId:'clear-gold-'+d,characterId:'amo',r2Identity:newRunIdentity('amo','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:d,challengeId:null,programsEnabled:false}});
      s.handLevels={'high-card':15,pair:15,'two-pair':15,'three-kind':15,straight:15,flush:15,'full-house':15};
      s=send(send(s,{type:'LeaveShop'}),{type:'EnterStage'});
      s=send(s,{type:'PlayHand',selectedIds:s.handOrder.slice(0,2)});
      expect(s.phase).toBe('stage-cleared');
      expect(s.stage!.goldEarned).toBe(expectedBase+s.stage!.handsLeft+1);
      round(s);
    }
  });

  it('caps tight-balance routeGrowth at x2.5 with 1.20x per-clear step after grace 3',()=>{
    expect(R2_TIGHT_ROUTE_RULE.cap).toEqual({n:'5',d:'2'});
    expect(R2_TIGHT_ROUTE_RULE.rates.G).toEqual({n:'6',d:'5'});
    expect([0,1,2,3,4,5,8,9,15].map(c=>r2RouteFactor('G',c,true,true).toJSON())).toEqual([
      {n:'1',d:'1'},{n:'1',d:'1'},{n:'1',d:'1'},{n:'1',d:'1'},
      {n:'6',d:'5'},{n:'36',d:'25'},{n:'7776',d:'3125'},{n:'5',d:'2'},{n:'5',d:'2'},
    ]);
    for(const hero of CHARACTER_IDS)expect(isR2TightBalance(newRunIdentity(hero,'group'))).toBe(true);
  });
});

describe('single-hand one-shot aura tier 1 vs tier 2 rendering',()=>{
  it('stores tier metadata and renders brighter amethyst-gold flame palette on tier 2 overkill',()=>{
    const renderTier=(tier:1|2)=>{
      const f=nativeHeroRuntime({width:1280,height:720,density:1,renderer:2});
      const table=layout({width:1280,height:720},{top:0,left:0,right:0,bottom:0},'desktop',{count:8},{pc:true});
      const ac=new AbortController();
      mountHighMultiplierAura(f.scene,{
        root:f.root,eventId:'oneshot/event',signal:ac.signal,reduced:()=>false,tier,
        getBoard:()=>table.scoreBoard,getViewport:()=>({x:0,y:0,width:1280,height:720}),getGuards:()=>[],
      });
      f.scene.events.emit('postupdate',600,600);
      const ink=f.root.list.find(o=>o.name==='score/high-multiplier-aura') as Phaser.GameObjects.Graphics;
      const colors=paintedColors(ink);
      const recordedTier=ink.getData('tier');
      ac.abort();
      return {recordedTier,colors};
    };

    const t1=renderTier(1),t2=renderTier(2);
    expect(t1.recordedTier).toBe(1);
    expect(t1.colors).toContain(0x5b4186);
    expect(t1.colors).toContain(0xd8b56a);
    expect(t2.recordedTier).toBe(2);
    expect(t2.colors).toContain(0x7648b8);
    expect(t2.colors).toContain(0xffdf7a);
  });
});
