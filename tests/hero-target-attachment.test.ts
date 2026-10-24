import {describe,it,expect} from 'vitest';
import {HeroTargetAttachmentState,attachmentEdgePoint} from '../src/game/HeroTargetAttachmentState';
const draft={key:'run/stage/main-6c+6h',targetId:'instance/6h'},event={eventId:'saved/hero/1',targetCardId:draft.targetId,reasonKey:'erxiang.handoff'};
const context=()=>({generation:1,signal:new AbortController().signal});

describe('hero target intent ownership',()=>{
  it('copies per-receipt source targets independently of persistent ownership without resetting its clock on refresh',()=>{
    const state=new HeroTargetAttachmentState(),owned=['prior/kept','new/kept'],fresh=['new/kept'],saved={key:'saved/second-choice',targetId:owned[0],targetIds:owned,sourceTargetIds:fresh,confirmed:true};state.preview(saved);fresh.push('not-saved');expect(state.value?.sourceTargetIds).toEqual(['new/kept']);state.advance(40);const generation=state.value!.generation,clock=state.value!.clock,updated=['new/kept'];state.preview({...saved,sourceTargetIds:updated});updated.push('not-saved');expect(state.value).toMatchObject({targetIds:owned,sourceTargetIds:['new/kept'],generation,clock});state.preview({...saved,sourceTargetIds:[]});expect(state.value).toMatchObject({targetIds:owned,sourceTargetIds:[],generation,clock});
  });
  it('partial candidate selection updates labels without resetting the saved candidate field or claiming retention',()=>{
    const state=new HeroTargetAttachmentState(),ids=['candidate/a','candidate/b','candidate/c'],picked=['candidate/b'];state.preview({key:'saved/discard/candidates',targetId:ids[0],targetIds:ids,kind:'candidate',label:'候选',confirmed:true,suppressSource:true});state.advance(100);const generation=state.value!.generation,clock=state.value!.clock;state.preview({key:'saved/discard/candidates',targetId:ids[0],targetIds:ids,selectedIds:picked,kind:'candidate',label:'候选',confirmed:true,suppressSource:true});picked.push('not-picked');expect(state.value).toMatchObject({generation,clock,label:'候选',targetIds:ids,selectedIds:['candidate/b'],suppressSource:true});expect(state.value?.resolvedLabel).toBeUndefined();
  });
  it('keeps successful particle ownership separate from an uncommitted draft and restarts its clock only at actual save',()=>{
    const state=new HeroTargetAttachmentState();state.preview(draft);for(let i=0;i<40;i++)state.advance(50);expect(state.accepted).toBe(false);state.consume(draft.targetId,event.eventId,context());expect(state.accepted).toBe(true);expect(state.value?.clock).toBe(0);state.advance(50);state.consume(draft.targetId,event.eventId,context());expect(state.value?.clock).toBe(50);state.clear();expect(state.accepted).toBe(false);state.preview({...draft,key:'real/saved-refill',confirmed:true});expect(state.accepted).toBe(true);
  });
  it('uses the exact instance, keeps idle indefinitely, and does not require an idle hold before saving',()=>{
    const state=new HeroTargetAttachmentState();state.preview(draft);
    expect(state.value?.phase).toBe('travel');expect(state.consume(draft.targetId,event.eventId,context())).toBe(true);
    expect(state.value?.phase).toBe('committed');expect(state.release(event,context())).toBe(true);
    for(let i=0;i<5;i++)state.advance(50);expect(state.value).toBeUndefined();
    state.preview(draft);for(let i=0;i<100;i++)state.advance(50);
    expect(state.value).toMatchObject({targetId:'instance/6h',phase:'idle'});
  });
  it('never releases for the other six, another event or a stale callback',()=>{
    const state=new HeroTargetAttachmentState();state.preview(draft);state.consume(draft.targetId,event.eventId,context());
    expect(state.release({...event,targetCardId:'instance/6c'},context())).toBe(false);
    expect(state.release({...event,eventId:'another'},context())).toBe(false);
    expect(state.release({...event,reasonKey:'ordinary.points'},context())).toBe(false);
    state.preview({...draft,key:'retarget',targetId:'instance/6c'});
    expect(state.release(event,context())).toBe(false);expect(state.value?.targetId).toBe('instance/6c');
    const expired=new AbortController();expired.abort();expect(state.consume('instance/6c','stale',{generation:0,signal:expired.signal})).toBe(false);
    expect(state.consume(draft.targetId,event.eventId,context())).toBe(false);expect(state.value?.targetId).toBe('instance/6c');
  });
  it('same accepted intent survives card rebind/reorder without replaying source',()=>{
    const state=new HeroTargetAttachmentState();state.preview(draft);for(let i=0;i<5;i++)state.advance(50);
    const generation=state.value?.generation;state.preview({...draft});expect(state.value).toMatchObject({generation,phase:'idle'});
    state.preview(undefined);expect(state.value).toBeUndefined();
  });
  it('aborting a saved generation clears it, but cannot cancel a later target',()=>{
    const state=new HeroTargetAttachmentState(),old=new AbortController();state.preview(draft);state.consume(draft.targetId,event.eventId,{generation:1,signal:old.signal});
    state.preview({...draft,key:'new',targetId:'instance/6c'});old.abort();expect(state.value?.targetId).toBe('instance/6c');
    const active=new AbortController();state.consume('instance/6c','new-event',{generation:2,signal:active.signal});active.abort();expect(state.value).toBeUndefined();
  });
  it('hiding discards flight and release tails; reduced/off retain a static target',()=>{
    const state=new HeroTargetAttachmentState();state.preview(draft);state.advance(40);state.suspend();expect(state.value?.phase).toBe('idle');
    for(const mode of ['reduced','off'] as const){state.clear();state.setMotion(mode);state.preview(draft);for(let i=0;i<80;i++)state.advance(50);expect(state.value).toMatchObject({phase:'idle',clock:0,targetId:draft.targetId});state.consume(draft.targetId,event.eventId,context());expect(state.release(event,context())).toBe(true);expect(state.value).toBeUndefined();}
    state.setMotion('full');state.preview(draft);state.consume(draft.targetId,event.eventId,context());state.release(event,context());state.suspend();expect(state.value).toBeUndefined();
  });
  it('exterior ribbon samples never cover the printed face or card indices',()=>{
    for(const [width,height] of [[38,54],[74,105],[112,159]])for(let i=0;i<=200;i++){
      const p=attachmentEdgePoint(width,height,i/200);expect(Math.abs(p.x)>=width/2+2.99||Math.abs(p.y)>=height/2+2.99).toBe(true);
    }
  });
  it('owns one exact assist group, survives idle/rebind and releases only its saved assist event',()=>{
    const state=new HeroTargetAttachmentState(),ids=['assist/2c','assist/2s'],assist={key:'main-77-99/assist-22',targetId:ids[0],targetIds:ids,kind:'assist' as const,releaseReason:'amo.assist.'};
    state.preview(assist);ids.push('not-selected-later');expect(state.value?.targetIds).toEqual(['assist/2c','assist/2s']);
    for(let i=0;i<100;i++)state.advance(50);expect(state.value?.phase).toBe('idle');
    state.consume(assist.targetId,'saved/assist',context());expect(state.release({eventId:'saved/assist',reasonKey:'ordinary.points'},context())).toBe(false);
    expect(state.release({eventId:'saved/assist',reasonKey:'amo.assist.pair'},context())).toBe(true);
    for(let i=0;i<5;i++)state.advance(50);expect(state.value).toBeUndefined();
  });
  it('editing/canceling the assist set invalidates old flight and saved callbacks without changing a main target',()=>{
    const state=new HeroTargetAttachmentState(),old=new AbortController();state.preview({key:'assist-a',targetId:'a',targetIds:['a','b'],kind:'assist',releaseReason:'amo.assist.'});state.consume('a','old',{generation:1,signal:old.signal});
    state.preview({key:'assist-b',targetId:'c',targetIds:['c','d','e'],kind:'assist',releaseReason:'amo.assist.'});old.abort();expect(state.value?.targetIds).toEqual(['c','d','e']);
    expect(state.release({eventId:'old',reasonKey:'amo.assist.pair'},context())).toBe(false);state.preview(undefined);expect(state.value).toBeUndefined();
  });
  it('the whole-hand bracket changes payment wording only after saving and waits for the exact saved source event',()=>{
    const state=new HeroTargetAttachmentState();state.preview({key:'burn20',targetId:'main/a',targetIds:['main/a','main/b'],kind:'group',label:'待付20',releaseReason:'xiemu.multiply-multiplier'});
    expect(state.value?.label).toBe('待付20');state.consume('main/a','saved/payment',context());expect(state.value?.label).toBe('已付20·待算');
    expect(state.release({eventId:'saved/payment',reasonKey:'ordinary.points'},context())).toBe(false);
    expect(state.release({eventId:'saved/payment',reasonKey:'xiemu.multiply-multiplier'},context())).toBe(true);
  });
  it('a saved core can narrow new-card ownership while retaining one abort-bound generation',()=>{
    const state=new HeroTargetAttachmentState(),abort=new AbortController();state.preview({key:'wager',targetId:'new/a',targetIds:['new/a','new/b'],kind:'wager',releaseReason:'touye.'});const generation=state.value?.generation;
    state.retainTargets(['new/b']);state.consume('new/b','saved/win',{generation:1,signal:abort.signal});expect(state.value).toMatchObject({generation,targetId:'new/b',targetIds:['new/b']});
    abort.abort();expect(state.value).toBeUndefined();
  });
});
