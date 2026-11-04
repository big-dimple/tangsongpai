import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());

function descendants(list:Phaser.GameObjects.GameObject[],out:Phaser.GameObjects.GameObject[]=[]){
 for(const object of list){out.push(object);const children=(object as Phaser.GameObjects.Container).list;if(children)descendants(children,out);}
 return out;
}

it('group releases attach to each real card without a synthetic union target or gap label',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),cards=new Map([
  ['active/a',f.card('active/a',{x:92,y:430,width:72,height:100})],
  ['active/b',f.card('active/b',{x:298,y:430,width:72,height:100})],
 ]),abort=new AbortController(),context={generation:3,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:72,height:100}:undefined;},source:()=>({x:40,y:70}),motion:()=> 'full',blocked:()=>false});
 try{
  layer.preview({key:'saved/group',targetId:'active/a',targetIds:[...cards.keys()],kind:'group',label:'本手待放',resolvedLabel:'已释放',releaseReason:'azao.multiply-multiplier'});
  f.step(16);
  const all=descendants(f.root.list),edges=all.filter(object=>object.name==='hero/target-edge'),tags=all.filter(object=>object.name==='hero/target-tag');
  expect(edges.map(object=>object.getData('targetId')).sort()).toEqual([...cards.keys()].sort());
  expect(edges.every(object=>!String(object.getData('targetId')).startsWith('group/'))).toBe(true);
  expect(tags).toHaveLength(1);
  expect(tags[0].getData('targetId')).toBe('active/a');
  expect([...cards.values()].every(card=>card.list.some(object=>object.name==='hero/target-edge'))).toBe(true);
  layer.commit('saved/group',context);layer.release({eventId:'saved/group',reasonKey:'azao.multiply-multiplier'},context);
  for(let time=32;time<600;time+=16)f.step(time);
  expect(descendants(f.root.list).filter(object=>object.name==='hero/target-edge')).toHaveLength(0);
 }finally{abort.abort();layer.destroy();f.root.destroy();f.step(650);}
});

it('uses saved target IDs and lights each Liu E target at its own actual impact',()=>{
 const f=nativeHeroRuntime(),cards=new Map(['a','b'].map((id,i)=>[id,f.card(id,{x:100+i*130,y:250,width:70,height:100})])),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:70,height:100}:undefined;},source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false});
 const lit=()=>descendants(f.root.list).filter(o=>o.name==='hero/target-afterglow').map(o=>o.getData('targetCardId'));
 try{
  layer.preview({key:'saved/handoff',targetId:'a',targetIds:['a','b'],kind:'group',releaseReason:'erxiang.handoff'});
  layer.commit('first',context,['a','b']);expect(lit()).toEqual([]);layer.landed(context);
  for(let time=50;time<=200;time+=50)f.step(time,50);
  expect(lit()).toEqual([]);for(let time=250;time<=450;time+=50)f.step(time,50);expect(lit().sort()).toEqual(['a','b']);
  const first={eventId:'first',reasonKey:'erxiang.handoff',targetCardId:'a'};layer.release(first,context);layer.impactConfirmedTarget(first,context);expect(lit().sort()).toEqual(['a','b']);
  const second={eventId:'second',reasonKey:'erxiang.handoff',targetCardId:'b'};layer.impactConfirmedTarget(second,context);expect(lit().sort()).toEqual(['a','b']);
  layer.impactConfirmedTarget({eventId:'other',reasonKey:'erxiang.handoff',targetCardId:'not-confirmed'},context);expect(lit().sort()).toEqual(['a','b']);
  abort.abort();expect(lit()).toEqual([]);
 }finally{layer.destroy();f.root.destroy();}
});

it.each([1,2,4])('scales the source and landing handoff with %ix presentation speed',speed=>{
 const f=nativeHeroRuntime(),cards=new Map(['a','b'].map((id,i)=>[id,f.card(id,{x:100+i*130,y:250,width:70,height:100})])),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:70,height:100}:undefined;},source:()=>({x:30,y:40}),motion:()=> 'full',speed:()=>speed,blocked:()=>false});
 const lit=()=>descendants(f.root.list).filter(o=>o.name==='hero/target-afterglow').map(o=>o.getData('targetCardId'));
 try{
  layer.preview({key:'speed/'+speed,targetId:'a',targetIds:['a','b'],kind:'group',releaseReason:'erxiang.handoff'});layer.commit('first',context,['a','b']);layer.landed(context);
  const before=200/speed;for(let time=25;time<=before;time+=25)f.step(time,25);
  expect(lit()).toEqual([]);for(let time=before+25;time<=475/speed+25;time+=25)f.step(time,25);expect(lit().sort()).toEqual(['a','b']);
  abort.abort();expect(lit()).toEqual([]);
 }finally{layer.destroy();f.root.destroy();}
});

it('keeps an already-landed group visible when the real hit arrives before the source finishes',()=>{
 const f=nativeHeroRuntime(),cards=new Map(['a','b'].map((id,i)=>[id,f.card(id,{x:100+i*130,y:250,width:70,height:100})])),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:70,height:100}:undefined;},source:()=>({x:30,y:40}),motion:()=> 'full',speed:()=>4,blocked:()=>false});
 const lit=()=>descendants(f.root.list).filter(o=>o.name==='hero/target-afterglow').map(o=>o.getData('targetCardId'));
 try{
  layer.preview({key:'early',targetId:'a',targetIds:['a','b'],kind:'group',releaseReason:'erxiang.handoff'});layer.commit('first',context,['a','b']);layer.landed(context);f.step(25,25);expect(lit()).toEqual([]);
  const first={eventId:'first',reasonKey:'erxiang.handoff',targetCardId:'a'};layer.release(first,context);layer.impactConfirmedTarget(first,context);expect(lit().sort()).toEqual(['a','b']);
  abort.abort();expect(lit()).toEqual([]);layer.release(first,context);expect(lit()).toEqual([]);
 }finally{layer.destroy();f.root.destroy();}
});

it('clips source ink to the current occupied joker art bounds as that art moves',()=>{
 const f=nativeHeroRuntime(),card=f.card('a',{x:300,y:350,width:70,height:100}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const fallback=f.scene.add.graphics().setName('joker/fallback-motif');f.root.add(fallback);let art={x:110,y:120,width:50,height:80};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='a'?{container:card,width:70,height:100}:undefined,source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false,sourceArtExclusions:()=>[art]});
 try{
  layer.preview({key:'art',targetId:'a',kind:'group',releaseReason:'erxiang.handoff'});layer.commit('first',context,['a']);f.step(50,50);
  let current=descendants(f.root.list).find(o=>o.name==='hero/target-current')!;expect(current.getData('protectedBoxes')).toContainEqual(art);
  art={x:185,y:200,width:50,height:80};f.step(100,50);current=descendants(f.root.list).find(o=>o.name==='hero/target-current')!;expect(current.getData('protectedBoxes')).toContainEqual(art);expect(current.getData('protectedBoxes')).not.toContainEqual({x:110,y:120,width:50,height:80});
 }finally{abort.abort();layer.destroy();f.root.destroy();}
});

it('refreshes saved targets after landing without reviving a stale or aborted presentation',()=>{
 const f=nativeHeroRuntime(),card=f.card('a',{x:100,y:250,width:70,height:100}),abort=new AbortController(),other=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='a'?{container:card,width:70,height:100}:undefined,source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false});
 const lit=()=>descendants(f.root.list).filter(o=>o.name==='hero/target-afterglow');
 try{
  layer.preview({key:'release',targetId:'a',targetIds:['a'],kind:'group',releaseReason:'azao.multiply-multiplier'});layer.commit('event',context,['a']);
  layer.landed({generation:2,signal:other.signal});for(let time=50;time<=200;time+=50)f.step(time,50);expect(lit()).toHaveLength(0);
  for(let time=250;time<=450;time+=50)f.step(time,50);expect(lit()).toHaveLength(1);
  const ink=lit()[0] as Phaser.GameObjects.Graphics,before=ink.getWorldTransformMatrix().transformPoint(0,0);card.setPosition(200,180);f.step(500,50);expect(ink.getWorldTransformMatrix().transformPoint(0,0)).not.toEqual(before);
  layer.landed(context);expect(lit()).toHaveLength(1);abort.abort();expect(lit()).toHaveLength(0);layer.landed(context);expect(lit()).toHaveLength(0);
 }finally{layer.destroy();f.root.destroy();}
});

it('never lights pending wager cards as positive targets when the saved wager fails',()=>{
 const f=nativeHeroRuntime(),card=f.card('a',{x:100,y:250,width:70,height:100}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='a'?{container:card,width:70,height:100}:undefined,source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false});
 try{
  layer.preview({key:'wager',targetId:'a',targetIds:['a'],kind:'wager',confirmed:true,releaseReason:'touye.'});
  layer.commit('lost',context,[]);layer.release({eventId:'lost',reasonKey:'touye.lost.hand'},context);
  expect(descendants(f.root.list).filter(o=>o.name==='hero/target-afterglow')).toHaveLength(0);
 }finally{abort.abort();layer.destroy();f.root.destroy();}
});

it('lets target arcs pass over the mobile backdrop but still protects foreground art',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:1,renderer:2}),backdrop=f.scene.add.image(160,180,'paper').setDisplaySize(240,240).setName('table-art/mobile-hero');f.root.add(backdrop);
 const card=f.card('a',{x:125,y:130,width:70,height:100}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='a'?{container:card,width:70,height:100}:undefined,source:()=>({x:20,y:20}),motion:()=> 'full',blocked:()=>false});
 try{
  layer.preview({key:'backdrop',targetId:'a',targetIds:['a'],kind:'group',releaseReason:'azao.multiply-multiplier'});layer.commit('saved',context,['a']);layer.landed(context);
  for(let time=50;time<=800;time+=50)f.step(time,50);
  const ink=descendants(f.root.list).find(o=>o.name==='hero/target-afterglow')!;expect(ink.getData('perimeterSides').every((n:number)=>n>0)).toBe(true);
  const foreground=f.scene.add.image(160,180,'paper').setDisplaySize(240,240).setName('foreground-art');f.root.add(foreground);f.step(850,50);expect(ink.getData('electricSegments')).toBe(0);
 }finally{abort.abort();layer.destroy();f.root.destroy();}
});

it('retains a real charge frame when the first saved-source frame is slow',()=>{
 const f=nativeHeroRuntime({width:320,height:568,density:1,renderer:2}),card=f.card('slow',{x:140,y:330,width:40,height:64}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 let art={x:0,y:0,width:320,height:568};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='slow'?{container:card,width:40,height:64}:undefined,source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false,sourceArtExclusions:()=>[art]});
 try{
  layer.preview({key:'slow-charge',targetId:'slow',targetIds:['slow'],kind:'group',releaseReason:'erxiang.handoff'});layer.commit('event',context,['slow']);
  f.step(50,20);expect(descendants(f.root.list).find(o=>o.name==='hero/target-current')!.getData('stats').electricSegments).toBe(0);
  art={x:280,y:40,width:20,height:20};
  f.step(500,20);const charge=descendants(f.root.list).find(o=>o.name==='hero/target-current')!,charged=charge.getData('stats');
  expect(charged.sourceCharge).toBeGreaterThan(0);expect(charged.sourceChargeSegments).toBeGreaterThan(0);
  f.step(550,20);const travel=descendants(f.root.list).find(o=>o.name==='hero/target-current')!.getData('stats');
  expect(travel.directionalSegments).toBeGreaterThan(0);expect(travel.front).toBeGreaterThan(charged.front);
 }finally{abort.abort();layer.destroy();f.root.destroy();}
});

it('advances the saved source with moving cards after a slow frame and still shows an arrival',()=>{
 const f=nativeHeroRuntime(),card=f.card('slow',{x:160,y:250,width:70,height:100}),abort=new AbortController(),context={generation:1,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>id==='slow'?{container:card,width:70,height:100}:undefined,source:()=>({x:30,y:40}),motion:()=> 'full',blocked:()=>false});
 try{
  layer.preview({key:'slow-frame',targetId:'slow',targetIds:['slow'],kind:'group',releaseReason:'azao.multiply-multiplier'});layer.commit('event',context,['slow']);
  f.step(50,20);f.step(300,20);const current=descendants(f.root.list).find(o=>o.name==='hero/target-current')!;expect(current.getData('progress')).toBeGreaterThan(.7);
  f.step(550,20);expect(descendants(f.root.list).some(o=>o.name==='hero/target-afterglow')).toBe(true);
  f.step(800,20);expect(descendants(f.root.list).some(o=>o.name==='hero/target-current')).toBe(true);expect(layer.sourceRemaining()).toBe(0);
  f.step(1050,20);expect(descendants(f.root.list).some(o=>o.name==='hero/target-current')).toBe(true);f.step(1300,20);expect(descendants(f.root.list).some(o=>o.name==='hero/target-current')).toBe(false);
  abort.abort();expect(descendants(f.root.list).some(o=>o.name==='hero/target-afterglow')).toBe(false);
 }finally{layer.destroy();f.root.destroy();}
});
