import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {AudioEngine,OPENING_SOUND_NAMES} from '../src/audio/AudioEngine';
import {FOLEY_SAMPLES} from '../src/audio/foley';
import {HIGH_MULTIPLIER_FIRE_SAMPLE} from '../src/audio/HighMultiplierFire';

const samples = [HIGH_MULTIPLIER_FIRE_SAMPLE,...FOLEY_SAMPLES, {name: 'cloth2', runtimePath: 'assets/audio/score-impact/cloth2.ogg'}];
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const buffer = (tag = 'current') => ({tag, duration: .3, numberOfChannels: 1, sampleRate: 100,
  getChannelData: () => new Float32Array([0, .1, -.1])});
const response = () => ({ok: true, arrayBuffer: vi.fn(async () => new ArrayBuffer(8))});
const never = () => new Promise<any>(() => {});
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const fixture = () => {
  const engine = new AudioEngine();
  const inside = engine as any;
  const sources: any[] = [];
  const param = () => ({value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()});
  const gain = () => ({gain: param(), connect: vi.fn(), disconnect: vi.fn()});
  const context = {state: 'running', currentTime: 1, resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => buffer()), createGain: gain, createBufferSource: () => {
      const source = {buffer: null, playbackRate: param(), start: vi.fn(), stop: vi.fn(),
        connect: vi.fn(), disconnect: vi.fn(), onended: null};
      sources.push(source); return source;
    }};
  inside.context = context;
  inside.gains = {master: gain(), music: gain(), sfx: gain(), ui: gain()};
  engine.musicMuted = true;
  return {engine, inside, context, sources, load: () => inside.loadScoreSamples() as Promise<void>};
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', {hidden: false, baseURI: 'https://game.test/nested/'});
  vi.stubGlobal('window', {});
  vi.stubGlobal('fetch', vi.fn(async () => response()));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('prioritizes the local fire and lets scoring start as soon as it decodes', async () => {
  const {engine,inside}=fixture();inside.unlocked=true;
  vi.stubGlobal('fetch',vi.fn((url:URL)=>url.pathname.endsWith(HIGH_MULTIPLIER_FIRE_SAMPLE.runtimePath)?Promise.resolve(response()):never()));
  const controller=new AbortController(),ready=engine.prepareHighMultiplierFire(controller.signal);
  await flush();await ready;
  expect(inside.scoreSamples.has(HIGH_MULTIPLIER_FIRE_SAMPLE.name)).toBe(true);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(HIGH_MULTIPLIER_FIRE_SAMPLE.runtimePath);
  expect(inside.highMultiplierFireWaiters.size).toBe(0);
  await vi.advanceTimersByTimeAsync(200000);await inside.scoreSampleTask;
});

it.each(['abort','timeout'] as const)('bounds preparation of a missing fire on %s without starting a voice', async boundary => {
  const {engine,inside,sources}=fixture();inside.unlocked=true;vi.stubGlobal('fetch',vi.fn(never));
  const controller=new AbortController(),ready=engine.prepareHighMultiplierFire(controller.signal);
  if(boundary==='abort')controller.abort();else await vi.advanceTimersByTimeAsync(801);
  await ready;expect(inside.highMultiplierFireWaiters.size).toBe(0);expect(sources).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(200000);await inside.scoreSampleTask;
  expect(sources).toHaveLength(0);
});

it('bounds the initial request burst and shares an in-flight load', async () => {
  vi.stubGlobal('fetch', vi.fn(never));
  const {load} = fixture();
  const pending = load();
  expect(load()).toBe(pending);
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(200000);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(samples.length * 3);
  expect(vi.getTimerCount()).toBe(0);
});

it('a timed-out wave releases slots for later samples before retrying it', async () => {
  const blocked = new Set(samples.slice(0, 3).map(s => s.runtimePath));
  const signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', vi.fn((url: URL, options?: RequestInit) => {
    if (blocked.has(url.pathname.replace('/nested/', ''))) {
      if (options?.signal) signals.push(options.signal);
      return never();
    }
    return Promise.resolve(response());
  }));
  const {load, inside} = fixture();
  let settled = false;
  const pending = load().then(() => { settled = true; });
  await vi.advanceTimersByTimeAsync(5001);
  expect(inside.scoreSamples.has(samples[3].name)).toBe(true);
  expect(signals.slice(0, 3).every(signal => signal.aborted)).toBe(true);
  await vi.advanceTimersByTimeAsync(200000);
  expect(settled).toBe(true);
  await pending;
  expect(inside.scoreSamples.size).toBe(samples.length - 3);
});

it.each(['network', 'http', 'body', 'decode'])('recovers a temporary %s failure in the same session', async stage => {
  const {load, inside, context} = fixture();
  if (stage === 'decode') context.decodeAudioData.mockRejectedValueOnce(new Error('decode'));
  else vi.mocked(fetch).mockImplementationOnce(async () => {
    if (stage === 'network') throw new Error('network');
    if (stage === 'http') return {ok: false} as Response;
    return {ok: true, arrayBuffer: async () => { throw new Error('body'); }} as unknown as Response;
  });
  await load();
  expect(inside.scoreSamples.size).toBe(samples.length);
  expect(inside.sampleBodies.size).toBe(samples.length);
  expect(fetch).toHaveBeenCalledTimes(samples.length + 1);
  await load();
  expect(fetch).toHaveBeenCalledTimes(samples.length + 1);
});

it('permanent failures stop after three attempts, including repeated unlocks', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ok: false})));
  const {load, inside, engine} = fixture();
  await load();
  expect(fetch).toHaveBeenCalledTimes(samples.length * 3);
  expect(inside.scoreSamples.size).toBe(0);
  for (let i = 0; i < 5; i++) { await load(); await engine.unlock(); }
  expect(fetch).toHaveBeenCalledTimes(samples.length * 3);
  expect(inside.scoreSampleTask).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['body', 'decode'])('permanently stuck %s settles within the finite attempt budget', async stage => {
  const {load, inside, context} = fixture();
  if (stage === 'decode') context.decodeAudioData.mockImplementation(never);
  else vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, arrayBuffer: never})));
  let settled = false;
  const pending = load().then(() => { settled = true; });
  await vi.advanceTimersByTimeAsync(200000);
  expect(settled).toBe(true);
  await pending;
  expect(fetch).toHaveBeenCalledTimes(samples.length * 3);
  expect(inside.scoreSamples.size).toBe(0);
  expect(inside.sampleBodies.size).toBe(0);
  await load();
  expect(fetch).toHaveBeenCalledTimes(samples.length * 3);
  expect(vi.getTimerCount()).toBe(0);
});

it('holds worker slots through body/decode instead of flooding the decoder', async () => {
  const {load, context} = fixture();
  const firstWave = Array.from({length: 3}, () => deferred<any>());
  for (const late of firstWave) context.decodeAudioData.mockImplementationOnce(() => late.promise);
  const pending = load();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(3);
  for (const late of firstWave) late.resolve(buffer());
  await pending;
  expect(fetch).toHaveBeenCalledTimes(samples.length);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(samples.length);
});

it('creates no context/request before unlock, remembers a muted gesture and respects foreground gates', async () => {
  const {engine, inside, context} = fixture();
  inside.context = undefined; inside.gains = undefined;
  Object.assign(context, {
    createDynamicsCompressor: () => ({threshold: {value: 0}, knee: {value: 0}, ratio: {value: 0},
      attack: {value: 0}, release: {value: 0}, connect: vi.fn()}),
    createWaveShaper: () => ({curve: null, oversample: '', connect: vi.fn()}),
  });
  const create = vi.fn(function () { return context; });
  vi.stubGlobal('window', {AudioContext: create});
  engine.select();
  expect(create).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  engine.muted = true;
  await engine.unlock();
  expect(create).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  vi.stubGlobal('document', {hidden: true, baseURI: 'https://game.test/nested/'});
  engine.muted = false; await engine.unlock();
  expect(create).not.toHaveBeenCalled();
  vi.stubGlobal('document', {hidden: false, baseURI: 'https://game.test/nested/'});
  engine.setSuspended(true); await engine.unlock();
  expect(create).not.toHaveBeenCalled();
  engine.setSuspended(false); await engine.unlock();
  await inside.scoreSampleTask;
  expect(create).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledTimes(samples.length);
  expect(inside.scoreSamples.size).toBe(samples.length);
  expect(vi.getTimerCount()).toBe(0);
});

it('routes the music bus directly to master without creating a music filter on capable devices', async () => {
  const {engine, inside, context} = fixture();inside.context = undefined;inside.gains = undefined;
  const filter={Q:{value:0},frequency:{setValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};
  const createBiquadFilter=vi.fn(()=>filter);
  Object.assign(context,{
    createBiquadFilter,
    createDynamicsCompressor:()=>({threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect:vi.fn()}),
    createWaveShaper:()=>({curve:null,oversample:'',connect:vi.fn()}),
  });
  vi.stubGlobal('window',{AudioContext:vi.fn(function(){return context;})});
  await engine.unlock();await inside.scoreSampleTask;
  expect(inside.gains.music.connect).toHaveBeenCalledExactlyOnceWith(inside.gains.master);
  expect(createBiquadFilter).not.toHaveBeenCalled();
  expect(inside.gains.sfx.connect).toHaveBeenCalledExactlyOnceWith(inside.gains.master);
  expect(inside.gains.ui.connect).toHaveBeenCalledExactlyOnceWith(inside.gains.master);
});

it.each(['fetch', 'body', 'decode'])('ignores late %s success after timeout and a successful retry', async stage => {
  const {load, inside, context} = fixture();
  const late = deferred<any>();
  if (stage === 'decode') context.decodeAudioData.mockImplementationOnce(() => late.promise);
  else vi.mocked(fetch).mockImplementationOnce(() => stage === 'fetch' ? late.promise
    : Promise.resolve({ok: true, arrayBuffer: () => late.promise} as Response));
  const pending = load();
  await vi.advanceTimersByTimeAsync(5001);
  await pending;
  const current = inside.scoreSamples.get(samples[0].name);
  const body = inside.sampleBodies.get(samples[0].name);
  expect(current).toBeDefined();
  const decodes = context.decodeAudioData.mock.calls.length;
  late.resolve(stage === 'decode' ? buffer('obsolete') : stage === 'fetch' ? response() : new ArrayBuffer(8));
  await flush();
  expect(inside.scoreSamples.get(samples[0].name)).toBe(current);
  expect(inside.sampleBodies.get(samples[0].name)).toBe(body);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(decodes);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not publish results for a closed context', async () => {
  const {load, inside, context} = fixture();
  const late = deferred<any>();
  context.decodeAudioData.mockImplementation(() => late.promise);
  const pending = load();
  await flush();
  context.state = 'closed';
  late.resolve(buffer());
  await pending;
  expect(inside.scoreSamples.size).toBe(0);
  expect(inside.sampleBodies.size).toBe(0);
});

it('does not publish results from a replaced context', async () => {
  const {load, inside, context} = fixture();
  const late = deferred<any>();
  context.decodeAudioData.mockImplementation(() => late.promise);
  const pending = load();
  await flush();
  inside.context = {...context};
  late.resolve(buffer());
  await pending;
  expect(inside.scoreSamples.size).toBe(0);
  expect(inside.sampleBodies.size).toBe(0);
});

it('gesture unlock stays responsive during a stuck load and repeated calls never redownload success', async () => {
  const {engine, inside, context} = fixture();
  vi.stubGlobal('fetch', vi.fn(never));
  await engine.unlock();
  expect(context.resume).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(3);
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  await vi.advanceTimersByTimeAsync(5001);
  await inside.scoreSampleTask;
  expect(inside.scoreSamples.size).toBe(samples.length);
  const downloads = vi.mocked(fetch).mock.calls.length;
  await engine.unlock(); await engine.unlock();
  expect(fetch).toHaveBeenCalledTimes(downloads);
});

it('mute/background and unavailable clips consume cues, without playback on load or foreground', async () => {
  const {engine, inside, sources} = fixture();
  inside.unlocked = true;
  const presentation = {};
  engine.scoreImpact(presentation, 'missing', 'add');
  engine.muted = true;
  engine.scoreImpact(presentation, 'muted', 'add');
  await inside.loadScoreSamples();
  expect(sources).toHaveLength(0);
  engine.muted = false; await engine.unlock();
  engine.setSuspended(true);
  engine.scoreImpact(presentation, 'background', 'add');
  engine.setSuspended(false); await engine.unlock();
  for (const id of ['missing', 'muted', 'background']) engine.scoreImpact(presentation, id, 'add');
  expect(sources).toHaveLength(0);
  inside.context.currentTime += .1; // A fresh event may use the newly loaded note and quiet wood.
  engine.scoreImpact(presentation, 'fresh', 'add');
  expect(sources).toHaveLength(2);
  engine.setSuspended(true);
  expect(inside.voices.size).toBe(0);
});

it('decodes the first interaction families while suspended, then plays only after a real unlock',async()=>{
  const {engine,inside,context,sources}=fixture();context.state='suspended';
  const initial=new Set<string>(OPENING_SOUND_NAMES);
  vi.stubGlobal('fetch',vi.fn((url:URL)=>{
    const name=url.pathname.split('/').pop()!.replace(/\.(ogg|mp3)$/,'');
    return initial.has(name)?Promise.resolve(response()):never();
  }));
  const progress:any[]=[],opening=engine.prepareOpeningSounds(p=>progress.push(p));
  await flush();const result=await opening;
  expect(result).toEqual({loaded:initial.size,total:initial.size,status:'ready'});
  expect(context.resume).not.toHaveBeenCalled();expect(sources).toHaveLength(0);
  expect(progress.at(-1).status).toBe('ready');
  const initialRequests=vi.mocked(fetch).mock.calls.map(([url])=>url as URL).filter(url=>initial.has(url.pathname.split('/').pop()!.replace(/\.(ogg|mp3)$/,'')));
  expect(initialRequests).toHaveLength(initial.size);expect(initialRequests.every(url=>url.searchParams.get('v')?.length===12)).toBe(true);
  context.resume.mockImplementation(async()=>{context.state='running';});
  await engine.unlock();engine.select();expect(sources.length).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(200000);await inside.scoreSampleTask;
});

it('skips startup sample downloads when effects are muted',async()=>{
  const {engine,context}=fixture();engine.setVolume('sfx',0);
  const progress=vi.fn();expect(await engine.prepareOpeningSounds(progress)).toEqual({loaded:0,total:0,status:'skipped'});
  await engine.unlock();expect(fetch).not.toHaveBeenCalled();expect(context.resume).not.toHaveBeenCalled();
  engine.setVolume('sfx',.8);await flush();expect(fetch).toHaveBeenCalled();
});

it('opens on the bounded deadline without replaying a late sound',async()=>{
  const {engine,inside,sources}=fixture();const late=deferred<any>();
  vi.stubGlobal('fetch',vi.fn(()=>late.promise));
  const progress=vi.fn(),opening=engine.prepareOpeningSounds(progress);
  await vi.advanceTimersByTimeAsync(2501);
  const result=await opening;expect(result.status).toBe('degraded');expect(result.loaded).toBe(0);
  expect(sources).toHaveLength(0);
  late.resolve(response());await flush();expect(sources).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(200000);await inside.scoreSampleTask;
});

it('retries missing samples once after reconnect, without duplicating requests or playing expired cues',async()=>{
  const {engine,inside,sources,load}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));
  await load();expect(fetch).toHaveBeenCalledTimes(samples.length*3);expect(inside.scoreSamples.size).toBe(0);
  vi.stubGlobal('fetch',vi.fn(async()=>response()));
  engine.retrySamplesAfterReconnect();engine.retrySamplesAfterReconnect();await inside.reconnectSampleTask;
  expect(fetch).toHaveBeenCalledTimes(samples.length);expect(inside.scoreSamples.size).toBe(samples.length);expect(sources).toHaveLength(0);
  engine.retrySamplesAfterReconnect();await inside.reconnectSampleTask;expect(fetch).toHaveBeenCalledTimes(samples.length);
});

it('does not download on reconnect while muted, but allows a later unmute to retry',async()=>{
  const {engine,inside,load}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));await load();
  engine.setVolume('sfx',0);vi.stubGlobal('fetch',vi.fn(async()=>response()));
  engine.retrySamplesAfterReconnect();await inside.reconnectSampleTask;expect(fetch).not.toHaveBeenCalled();
  await engine.unlock();engine.setVolume('sfx',.8);await inside.scoreSampleTask;expect(inside.scoreSamples.size).toBe(samples.length);
});
