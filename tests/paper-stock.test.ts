import {describe,expect,it,vi} from 'vitest';
import {LAMP_LIMIT,PAPER_BAKE_PIXELS,PAPER_FIBER_KEY,PAPER_SHADOW,asPaperSheet,bakedPaper,cardShadow,lampShade,paperBakeDensity,paperFibreMeanShift,paperFibrePlan,
  paperGrainScale,paperGrainSprite,paperRandom,rasterizePaper} from '../src/game/PaperStock';
import {PAPER_THEME} from '../src/game/theme';

/** A 2D context that accepts any call; only the calls a test inspects are recorded. */
function context(){
  const calls:string[]=[],state:Record<string,unknown>={};
  const c=new Proxy(state,{
    get:(target,key:string)=>key in target?target[key]:key==='createPattern'?()=>({setTransform(){}}):key==='createRadialGradient'?()=>({addColorStop(){}}):(...args:unknown[])=>{calls.push(key+(key==='fillRect'?':'+args.join(','):''));},
    set:(target,key:string,value)=>{target[key]=value;return true;},
  });
  return {c,calls};
}
function fakeScene(zoom=1){
  const store=new Map<string,any>(),ctx=context(),listeners:Record<string,(()=>void)[]>={};
  const picture=(key?:string)=>{const o:any={type:'Image',key,data:{} as Record<string,unknown>,displayWidth:0,displayHeight:0};
    for(const name of ['setOrigin','setScale','setName','setAlpha','setTileScale'])o[name]=vi.fn(()=>o);
    o.setData=(k:string,v:unknown)=>{o.data[k]=v;return o;};o.setDisplaySize=(w:number,h:number)=>{o.displayWidth=w;o.displayHeight=h;return o;};o.getBounds=()=>({});return o;};
  const scene:any={scale:{zoom},
    events:{once:(name:string,fn:()=>void)=>{(listeners[name]??=[]).push(fn);}},
    textures:{exists:(key:string)=>store.has(key),get:(key:string)=>store.get(key),remove:vi.fn((key:string)=>{store.delete(key);}),
      createCanvas:vi.fn((key:string,width:number,height:number)=>{const texture={key,width,height,getContext:()=>ctx.c,refresh:vi.fn(),getSourceImage:()=>({getContext:()=>ctx.c,toDataURL:()=>'data:image/png;base64,AA=='})};store.set(key,texture);return texture;})},
    add:{image:vi.fn((_x:number,_y:number,key:string)=>picture(key)),tileSprite:vi.fn((_x:number,_y:number,_w:number,_h:number,key:string)=>picture(key))}};
  return {scene,store,ctx,shutdown:()=>listeners.shutdown?.forEach(fn=>fn())};
}

describe('paper stock',()=>{
  it('uses its own fixed visual stream and one deterministic fibre plan',()=>{
    const a=paperRandom(7),b=paperRandom(7),c=paperRandom(8);
    const first=[a(),a(),a()];expect([b(),b(),b()]).toEqual(first);expect([c(),c(),c()]).not.toEqual(first);
    for(const value of first){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThan(1);}
    expect(paperFibrePlan()).toEqual(paperFibrePlan());
    const plan=paperFibrePlan();
    expect(plan.fibres.some(f=>f.light)).toBe(true);expect(plan.fibres.some(f=>!f.light)).toBe(true);
    for(const f of plan.fibres){expect(f.x).toBeGreaterThanOrEqual(0);expect(f.x).toBeLessThan(plan.size);expect(f.alpha).toBeLessThan(.4);expect(f.width).toBeLessThan(1.2);}
  });
  it('keeps every paper tone within two levels per channel under the fibres',()=>{
    const plan=paperFibrePlan();
    for(const tone of [PAPER_THEME.paper,PAPER_THEME.paperLight,PAPER_THEME.paperEdge,0xf7f0e4,0xe9ddc7,0xe8dcc8,0xf6eee0,0xefeee5])
      for(const channel of [0,1,2] as const){
        const value=tone>>(16-channel*8)&255,shift=paperFibreMeanShift(plan,value,channel);
        expect(Math.abs(shift),`tone ${tone.toString(16)} channel ${channel}`).toBeLessThanOrEqual(2);
      }
    // Full strength is never used on paper; the strongest call site is 0.9.
    expect(Math.abs(paperFibreMeanShift(plan,0xf3,0))).toBeGreaterThan(0);
  });
  it('lights one lamp: nothing at the centre, at most twelve percent at the dark corners',()=>{
    expect(LAMP_LIMIT.desk).toBeLessThanOrEqual(.12);expect(LAMP_LIMIT.paper).toBeLessThanOrEqual(.03);
    for(const kind of ['desk','paper'] as const){
      expect(lampShade(kind,.5,.44)).toBe(0);expect(lampShade(kind,.5,.5)).toBe(0);expect(lampShade(kind,.3,.4)).toBe(0);
      for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]])expect(lampShade(kind,u,v)).toBeCloseTo(LAMP_LIMIT[kind],6);
      let last=0;for(let i=0;i<=20;i++){const shade=lampShade(kind,.5+i/40,.44+i/20*.56);expect(shade).toBeGreaterThanOrEqual(last-1e-9);expect(shade).toBeLessThanOrEqual(LAMP_LIMIT[kind]+1e-9);last=shade;}
    }
    // Paper centre sampling stays exact: the middle 40% of the screen is unshaded.
    for(const u of [.3,.5,.7])for(const v of [.3,.44,.6])expect(lampShade('paper',u,v)).toBe(0);
  });
  it('casts a warm shadow down and slightly right, like the hard edges it replaces',()=>{
    const [r,g,b]=PAPER_SHADOW.color;expect(r).toBeGreaterThan(g);expect(g).toBeGreaterThan(b);
    expect(PAPER_SHADOW.dy).toBeGreaterThan(0);expect(PAPER_SHADOW.dx).toBeGreaterThanOrEqual(0);expect(PAPER_SHADOW.dy).toBeGreaterThan(PAPER_SHADOW.dx);
  });
  it('bounds every baked page by the four megapixel table budget',()=>{
    for(const [width,height,zoom] of [[1920,1080,1],[1920,1080,.5],[390,844,1/3],[3840,2160,1],[320,568,.5]]){
      const density=paperBakeDensity(width,height,zoom);
      expect(Math.ceil(width*density)*Math.ceil(height*density)).toBeLessThanOrEqual(PAPER_BAKE_PIXELS*1.01);expect(density).toBeLessThanOrEqual(2);expect(density).toBeLessThanOrEqual(1/zoom+1e-9);
    }
    expect(paperGrainScale(1)).toBe(1);expect(paperGrainScale(2)).toBe(.5);expect(paperGrainScale(3)).toBe(.5);
  });
  it('stays out of the way where canvases are unavailable',()=>{
    const bare={textures:{exists:()=>false},add:{}} as any;
    expect(bakedPaper(bare,{slot:'page',width:100,height:100,base:PAPER_THEME.paper,lamp:'paper',grain:.5})).toBeUndefined();
    expect(paperGrainSprite(bare,{x:0,y:0,width:10,height:10},.3)).toBeUndefined();
    expect(cardShadow(bare,96,134)).toBeUndefined();
    const graphics={generateTexture:vi.fn(),destroy:vi.fn()} as any;
    expect(rasterizePaper(bare,graphics,{slot:'table',width:10,height:10,signature:1})).toBeUndefined();expect(graphics.destroy).not.toHaveBeenCalled();
  });
  it('bakes a page once per layout, reuses it across redraws and releases it with the scene',()=>{
    const f=fakeScene(),spec={slot:'page',width:800,height:600,base:PAPER_THEME.paper,lamp:'paper' as const,grain:.6};
    const first=bakedPaper(f.scene,spec)!,pages=()=>[...f.store.keys()].filter(key=>key.startsWith('paper-bake/page/'));
    expect(first.type).toBe('PaperSheet');expect(pages()).toHaveLength(1);
    const key=pages()[0];expect(f.ctx.calls).toContain('fillRect:0,0,800,600');
    const again=bakedPaper(f.scene,{...spec}) as any;expect(again.key).toBe(key);expect(pages()).toEqual([key]);
    bakedPaper(f.scene,{...spec,width:820});expect(pages()).toHaveLength(1);expect(pages()[0]).not.toBe(key);expect(f.scene.textures.remove).toHaveBeenCalledWith(key);
    expect(f.store.has(PAPER_FIBER_KEY)).toBe(true);
    f.shutdown();expect(pages()).toHaveLength(0);expect(f.store.has(PAPER_FIBER_KEY)).toBe(true);
  });
  it('rasterizes a table page once and finishes it in CSS pixels',()=>{
    const f=fakeScene(.5),finish=vi.fn();
    const graphics=()=>{const g:any={name:'table-art/pc-paper',getData:()=>({x:1}),destroy:vi.fn(),setScale:vi.fn(()=>g)};
      g.generateTexture=vi.fn((key:string,width:number,height:number)=>{f.scene.textures.createCanvas(key,width,height);return g;});return g;};
    const a=graphics(),image=rasterizePaper(f.scene,a,{slot:'table',width:1000,height:500,signature:['pc',1],finish}) as any;
    expect(a.setScale).toHaveBeenCalledWith(2);expect(a.generateTexture).toHaveBeenCalledWith(expect.stringMatching(/^paper-bake\/table\//),2000,1000);
    expect(finish).toHaveBeenCalledOnce();expect(finish.mock.calls[0][1]).toEqual({width:1000,height:500});expect(finish.mock.calls[0][2]).toBe(2);
    expect(a.destroy).toHaveBeenCalledOnce();expect(image.data.bounds).toEqual({x:1});expect(image.type).toBe('Image');
    const b=graphics();rasterizePaper(f.scene,b,{slot:'table',width:1000,height:500,signature:['pc',1],finish});
    expect(b.generateTexture).not.toHaveBeenCalled();expect(finish).toHaveBeenCalledOnce();expect(b.destroy).toHaveBeenCalledOnce();
    const c=graphics();rasterizePaper(f.scene,c,{slot:'table',width:1000,height:500,signature:['pc',2],finish});
    expect(c.generateTexture).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledTimes(2);
    // A raster standing in for a plain Graphics stays invisible to the art/print guards.
    expect((rasterizePaper(f.scene,graphics(),{slot:'frame',width:10,height:10,signature:1,sheet:true}) as any).type).toBe('PaperSheet');
  });
  it('keeps static sheets out of the print and art guards',()=>{
    const f=fakeScene(1/3),sprite=paperGrainSprite(f.scene,{x:4,y:4,width:90,height:40},.3) as any;
    expect(sprite.key).toBe(PAPER_FIBER_KEY);expect(sprite.setTileScale).toHaveBeenCalledWith(.5,.5);
    const shadow=cardShadow(f.scene,96,134)!;
    expect(shadow.type).toBe('PaperSheet');expect(shadow.getBounds).toBeUndefined();expect(shadow.displayWidth).toBeCloseTo(128);expect(shadow.displayHeight).toBeCloseTo(176);
    const wide=cardShadow(f.scene,192,268)!;expect(wide.displayWidth).toBeCloseTo(256);
    expect(asPaperSheet({type:'Image'} as any).type).toBe('PaperSheet');
  });
});
