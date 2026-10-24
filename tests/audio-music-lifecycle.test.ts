import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {AudioEngine} from '../src/audio/AudioEngine';
import {chainRate} from '../src/audio/mixPolicy';
import bgmManifest from '../public/assets/audio/bgm/manifest.json';
const savedTracks=[...bgmManifest.tracks];
const tablePlaylist=()=>bgmManifest.tracks.push({...savedTracks.find(t=>t.id==='moon-shop')!,id:'test/table-fallback',scenes:['table']});

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const fixture = (vorbis=false) => {
  const media: any[] = [];
  const param = () => ({value: 0, cancelAndHoldAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()});
  const gain = () => ({gain: param(), connect: vi.fn(), disconnect: vi.fn()});
  class Media {
    src = ''; loop = false; paused = true; ended = false; currentTime = 0;
    events=new Map<string,()=>void>();
    canPlayType=vi.fn(()=>vorbis?'probably':'');
    addEventListener=vi.fn((name:string,fn:()=>void)=>this.events.set(name,fn));
    error: any = null; onerror: any; onended: any; attempts: ReturnType<typeof deferred>[] = [];
    constructor() { media.push(this); }
    play = vi.fn(() => { this.paused = false; this.ended = false; const d = deferred(); this.attempts.push(d); return d.promise; });
    // Deliberately permit late success after pause: obsolete continuations must be inert.
    pause = vi.fn(() => { this.paused = true; });
    load = vi.fn(() => { this.error = null; });
    setAttribute = vi.fn();
    removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = ''; });
    finish() { this.attempts.at(-1)!.resolve(); }
    fail(code=4) { this.error = {code}; this.onerror?.(); }
    end() { if (this.loop) { this.currentTime = 0; return; } this.ended = true; this.paused = true; this.onended?.(); }
  }
  vi.stubGlobal('Audio', Media);
  const engine = new AudioEngine(), inside = engine as any;
  const context = {state: 'running', currentTime: 1, createGain: gain,
    createMediaElementSource: vi.fn(() => ({connect: vi.fn()})),
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; })};
  inside.context = context; inside.gains = {master: gain(), music: gain(), sfx: gain(), ui: gain()};
  inside.loadScoreSamples = vi.fn(async () => {});
  const begin = async () => { await engine.unlock(); return media.at(-1); };
  const finish = async (element = inside.musicElement) => { element.finish(); await flush(); };
  return {engine, inside, context, media, begin, finish};
};
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('window', {});
  vi.stubGlobal('document', {hidden: false, baseURI: 'https://game.test/nested/'});
});
afterEach(() => { bgmManifest.tracks.splice(0,bgmManifest.tracks.length,...savedTracks);vi.useRealTimers(); vi.unstubAllGlobals(); });

it('starts menu music during loading once, without a gesture or score-sample downloads, and keeps its playhead through home/selection',async()=>{
 const {engine,inside,media,context,finish}=fixture();engine.startOpeningMusic();
 expect(context.resume).toHaveBeenCalledOnce();expect(media[0].play).toHaveBeenCalledOnce();expect(inside.loadScoreSamples).not.toHaveBeenCalled();
 await finish();media[0].currentTime=12;const loads=media[0].load.mock.calls.length;
 for(let i=0;i<8;i++){engine.startOpeningMusic();engine.setScene('menu');engine.preloadSceneMusic('menu');}
 expect(media).toHaveLength(1);expect(media[0].currentTime).toBe(12);expect(media[0].play).toHaveBeenCalledOnce();expect(media[0].load).toHaveBeenCalledTimes(loads);
 expect(engine.needsGestureUnlock).toBe(true);await engine.unlock();expect(inside.loadScoreSamples).toHaveBeenCalledOnce();
 expect(engine.needsGestureUnlock).toBe(false);expect(media[0].play).toHaveBeenCalledOnce();expect(media[0].currentTime).toBe(12);
});

it('autoplay denial waits quietly for a real unlock, does not poison the track or retry on navigation/foreground',async()=>{
 const {engine,inside,context,media,finish}=fixture();const changed=vi.fn(),stop=engine.onMusicStateChange(changed);
 engine.startOpeningMusic();media[0].attempts[0].reject(new DOMException('policy','NotAllowedError'));await flush();
 expect(engine.musicNeedsGesture).toBe(true);expect(inside.musicFailures.size).toBe(0);expect(media[0].src).not.toBe('');
 engine.setScene('shop');engine.setScene('menu');engine.setSuspended(true);await flush();engine.setSuspended(false);engine.startOpeningMusic();await vi.advanceTimersByTimeAsync(60000);
 expect(media[0].play).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
 const task=engine.unlock();expect(media[0].play).toHaveBeenCalledTimes(2);await task;await finish();
 expect(inside.context).toBe(context);expect(engine.musicNeedsGesture).toBe(false);expect(changed).toHaveBeenCalled();stop();
});

it('a policy-suspended opening cannot swallow a later click and calls resume/play before awaiting either promise',async()=>{
 const {engine,context,media,finish}=fixture();context.state='suspended';const initial=deferred();context.resume.mockImplementationOnce(()=>initial.promise);
 engine.startOpeningMusic();expect(engine.musicNeedsGesture).toBe(true);expect(media[0].play).toHaveBeenCalledOnce();
 const task=engine.unlock();expect(context.resume).toHaveBeenCalledTimes(2);expect(media[0].play).toHaveBeenCalledTimes(2);await task;await finish();
 initial.reject(new DOMException('obsolete resume','NotAllowedError'));await flush();expect(media[0].paused).toBe(false);expect(engine.musicNeedsGesture).toBe(false);
});

it.each(['master mute','music mute','music zero'] as const)('opening preserves saved %s without context resume or a media request',mode=>{
 const {engine,media,context}=fixture();if(mode==='master mute')engine.muted=true;else if(mode==='music mute')engine.musicMuted=true;else engine.setVolume('music',0);
 engine.startOpeningMusic();engine.setSuspended(true);engine.setSuspended(false);
 expect(context.resume).not.toHaveBeenCalled();expect(media).toHaveLength(0);expect(engine.musicNeedsGesture).toBe(false);
 if(mode==='music zero')expect(engine.getVolume('music')).toBe(0);
});

it('a resume resolving without a running context cannot claim successful playback or loop retries',async()=>{
 const {engine,context,media}=fixture();context.state='suspended';context.resume.mockImplementation(async()=>{});
 engine.startOpeningMusic();media[0].finish();await flush();
 expect(engine.musicNeedsGesture).toBe(true);expect(media[0].paused).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

it('an interrupted foreground resume preserves mute levels and waits for another gesture after policy rejection',async()=>{
 const {engine,context,media,finish}=fixture();engine.setVolume('music',.07);engine.setVolume('sfx',.81);engine.startOpeningMusic();await finish();
 engine.setSuspended(true);await flush();context.resume.mockRejectedValueOnce(new DOMException('locked','NotAllowedError'));
 engine.setSuspended(false);await flush();const plays=media[0].play.mock.calls.length;
 expect(engine.musicNeedsGesture).toBe(true);engine.setSuspended(true);await flush();engine.setSuspended(false);await flush();
 expect(media[0].play).toHaveBeenCalledTimes(plays);expect(engine.getVolume('music')).toBe(.07);expect(engine.getVolume('sfx')).toBe(.81);
 const task=engine.unlock();expect(media[0].play).toHaveBeenCalledTimes(plays+1);await task;await finish();expect(engine.musicNeedsGesture).toBe(false);
});

it('an unresolved context resume has one deadline and never marks the recording corrupt',async()=>{
 const {engine,inside,context,media}=fixture();context.state='suspended';context.resume.mockImplementationOnce(()=>new Promise(()=>{}));engine.startOpeningMusic();
 await vi.advanceTimersByTimeAsync(60000);expect(engine.musicNeedsGesture).toBe(true);expect(inside.musicFailures.size).toBe(0);
 expect(media[0].play).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});

it('preloads a single paused slot before gesture and shares one pending play per requested track', async () => {
  const {engine, inside, media, begin, finish} = fixture();
  for (let i = 0; i < 20; i++) engine.preloadSceneMusic('table');
  expect(media).toHaveLength(1);expect(media[0].play).not.toHaveBeenCalled();expect(media[0].load).toHaveBeenCalledOnce();
  engine.setScene('shop'); expect(media).toHaveLength(1);
  await begin(); const element = inside.musicElement;
  for (let i = 0; i < 10; i++) await engine.unlock();
  expect(element.play).toHaveBeenCalledTimes(1); await finish();
  for (let i = 0; i < 10; i++) await engine.unlock();
  expect(element.play).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});

it('music unmute retries a prior denial and a battle result preserves playback position', async () => {
  const {engine, inside, begin, finish} = fixture();
  engine.setScene('table'); const element = await begin();
  element.attempts[0].reject(new DOMException('gesture required', 'NotAllowedError')); await flush();
  engine.musicMuted = true; engine.musicMuted = false; await flush(); await finish();
  const playing = inside.musicElement; playing.currentTime = 19;
  const calls = playing.play.mock.calls.length;
  engine.setScene('failure');
  expect(inside.musicElement).toBe(playing); expect(playing.currentTime).toBe(19);
  expect(playing.play).toHaveBeenCalledTimes(calls); expect(playing.loop).toBe(false);
});

it('a new scene starts while the previous play is pending, and late success cannot replace it', async () => {
  const {engine, inside, media, begin, finish} = fixture();
  const old = await begin(), obsolete = old.attempts[0];
  engine.setScene('table'); engine.setScene('boss'); engine.setScene('shop');
  const latest = inside.musicElement;
  expect(latest.src).toContain('moon-shop');
  expect(media.length).toBeLessThanOrEqual(2);
  await finish(latest); obsolete.resolve(); await flush();
  expect(inside.musicElement).toBe(latest); expect(latest.paused).toBe(false);
  expect(media.filter(e => e !== latest).every(e => e.paused)).toBe(true);
  expect(media.reduce((n, e) => n + e.play.mock.calls.length, 0)).toBe(4);
});

it('an obsolete play rejection cannot poison or retry the latest recording', async () => {
  const {engine, inside, begin, finish} = fixture();
  const old = await begin(), obsolete = old.attempts[0];
  engine.setScene('shop'); const latest = inside.musicElement;
  await finish(latest); const plays = latest.play.mock.calls.length;
  obsolete.reject(new DOMException('src replaced', 'AbortError')); await flush();
  expect(latest.paused).toBe(false); expect(latest.play).toHaveBeenCalledTimes(plays);
  expect(engine.needsGestureUnlock).toBe(false); expect(vi.getTimerCount()).toBe(0);
});

it('old active media callbacks cannot fail or advance a later request that reuses the same slot', async () => {
  const {engine, inside, begin, finish} = fixture();
  const first = await begin(); await finish();
  const staleError = first.onerror, staleEnded = first.onended;
  engine.setScene('shop'); await finish(); engine.setScene('table'); await finish();
  expect(inside.musicElement).toBe(first);
  const plays = first.play.mock.calls.length;
  staleError(); staleEnded();
  expect(inside.musicElement).toBe(first); expect(first.src).toContain('go-cake');
  expect(first.paused).toBe(false); expect(first.play).toHaveBeenCalledTimes(plays);
});

it('mute during pending play cancels the old generation; unmute starts a fresh attempt immediately', async () => {
  const {engine, inside, begin, finish} = fixture();
  const old = await begin(), obsolete = old.attempts[0];
  engine.muted = true; expect(vi.getTimerCount()).toBe(0);
  engine.setScene('shop'); engine.muted = false; await flush();
  const latest = inside.musicElement; expect(latest.src).toContain('moon-shop');
  await finish(latest); obsolete.resolve(); await flush();
  expect(latest.paused).toBe(false); expect(engine.muted).toBe(false);
});

it('music zero pauses both slots while independent exact sfx settings survive a later resume', async () => {
  const {engine, inside, media, begin, finish} = fixture();
  await begin(); await finish(); engine.setScene('shop'); await finish();
  engine.setVolume('music', 0); engine.setVolume('sfx', 1);
  expect(media.every(e => e.paused)).toBe(true); expect(vi.getTimerCount()).toBe(0);
  engine.setVolume('music', .07); await flush(); await finish();
  expect(engine.getVolume('music')).toBe(.07); expect(engine.getVolume('sfx')).toBe(1);
  expect(inside.musicElement.paused).toBe(false);
});

it('background clears both fades and pending deadlines, then resumes the current scene on foreground', async () => {
  const {engine, inside, media, begin, finish} = fixture();
  await begin(); await finish(); engine.setScene('table'); await finish();
  const table = inside.musicElement;
  engine.setSuspended(true); await flush();
  expect(media.every(e => e.paused)).toBe(true); expect(vi.getTimerCount()).toBe(0);
  engine.setSuspended(false); await flush(); await finish();
  expect(inside.musicElement).toBe(table); expect(table.paused).toBe(false);
  expect(media).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
});

it('play denial waits for a new gesture and can recover without recreating the app context', async () => {
  const {engine, inside, context, media, begin, finish} = fixture();
  const element = await begin();
  element.attempts[0].reject(new DOMException('gesture required', 'NotAllowedError')); await flush();
  expect(element.play).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  expect(engine.needsGestureUnlock).toBe(true);
  await engine.unlock(); await finish();
  expect(inside.context).toBe(context); expect(media).toHaveLength(1);
  expect(inside.musicElement.paused).toBe(false); expect(engine.needsGestureUnlock).toBe(false);
});

it('a failed recording cannot permanently silence another scene or a later same-scene gesture', async () => {
  const {engine, inside, begin, finish} = fixture();
  const first = await begin(), staleError = first.onerror; first.fail();
  expect(engine.needsGestureUnlock).toBe(true); expect(vi.getTimerCount()).toBe(0);
  engine.setScene('shop'); const shop = inside.musicElement; await finish();
  staleError(); expect(shop.paused).toBe(false); expect(inside.musicElement).toBe(shop);
  shop.fail(); expect(engine.needsGestureUnlock).toBe(true);
  await engine.unlock(); await finish(); expect(inside.musicElement.paused).toBe(false);
});

it('a stalled first table track has a finite deadline and falls through once to the second track', async () => {
  tablePlaylist();
  const {engine, inside, media, finish} = fixture();
  engine.setScene('table'); await engine.unlock();
  const first = inside.musicElement, obsolete = first.attempts[0];
  await vi.advanceTimersByTimeAsync(8001);
  const second = inside.musicElement; expect(second.src).toContain('moon-shop');
  await finish(second); obsolete.resolve(); await flush();
  expect(inside.musicElement).toBe(second); expect(second.paused).toBe(false);
  expect(media.length).toBeLessThanOrEqual(2); expect(vi.getTimerCount()).toBe(0);
});

it('an unavailable playlist exhausts each track once without an automatic retry loop', async () => {
  tablePlaylist();
  const {engine, inside, media} = fixture();
  engine.setScene('table'); await engine.unlock();
  await vi.advanceTimersByTimeAsync(100000);
  expect(media.reduce((n, e) => n + e.play.mock.calls.length, 0)).toBe(2);
  expect(vi.getTimerCount()).toBe(0); expect(engine.needsGestureUnlock).toBe(true);
  expect(inside.pendingMusic).toBeUndefined();
});

it('natural playlist completion waits three seconds before either next track or repeat', async () => {
  tablePlaylist();
  const {engine, inside, finish} = fixture();
  engine.setScene('table'); await engine.unlock(); await finish();
  const first = inside.musicElement; expect(first.loop).toBe(false); first.end();
  const plays=first.play.mock.calls.length;engine.setScene('table');await engine.unlock();await vi.advanceTimersByTimeAsync(2999);expect(first.play).toHaveBeenCalledTimes(plays);await vi.advanceTimersByTimeAsync(1);
  expect(inside.musicElement.src).toContain('moon-shop'); await finish();
  inside.musicElement.end();await vi.advanceTimersByTimeAsync(3000);expect(inside.musicElement.src).toContain('go-cake');await finish();
  engine.setScene('menu');await finish();const single=inside.musicElement;expect(single.loop).toBe(false);
  const before=single.play.mock.calls.length;single.end();await vi.advanceTimersByTimeAsync(2999);expect(single.play).toHaveBeenCalledTimes(before);await vi.advanceTimersByTimeAsync(1);expect(single.play).toHaveBeenCalledTimes(before+1);await finish();
});

it.each(['table','boss'] as const)('%s success/failure inherit the same song, position and active rest',async battle=>{
 const {engine,inside,begin,finish}=fixture();engine.setScene(battle);const song=await begin();await finish();song.currentTime=22;const plays=song.play.mock.calls.length;
 engine.setScene('success');engine.setScene('failure');expect(inside.musicElement).toBe(song);expect(song.currentTime).toBe(22);expect(song.play).toHaveBeenCalledTimes(plays);
 song.end();engine.setScene('success');await engine.unlock();expect(inside.musicRest).toBeDefined();await vi.advanceTimersByTimeAsync(2999);expect(song.play).toHaveBeenCalledTimes(plays);await vi.advanceTimersByTimeAsync(1);expect(song.play).toHaveBeenCalledTimes(plays+1);await finish();
});

it.each(['scene','mute','zero','background','exit','generation'] as const)('%s cancels the ended rest and prevents its stale replay',async boundary=>{
 const {engine,inside,begin,finish}=fixture();const song=await begin();await finish();song.end();expect(inside.musicRest).toBeDefined();
 if(boundary==='scene')engine.setScene('shop');if(boundary==='mute')engine.musicMuted=true;if(boundary==='zero')engine.setVolume('music',0);if(boundary==='background'||boundary==='exit')engine.setSuspended(true);if(boundary==='generation')inside.cancelMusicTransition();
 const plays=song.play.mock.calls.length;await vi.advanceTimersByTimeAsync(3001);expect(song.play).toHaveBeenCalledTimes(plays);expect(inside.musicRest).toBeUndefined();
});

it('unsupported Vorbis chooses MP3 without ever attempting the preferred recording',async()=>{
 const {media,begin,finish}=fixture(false);await begin();expect(media[0].src).toContain('tianhu-begin.mp3');expect(media[0].canPlayType).toHaveBeenCalledWith('audio/ogg; codecs="vorbis"');await finish();
});

it('a falsely supported preferred decode falls back once in the same element and late promises cannot replace it',async()=>{
 const {engine,inside,media,begin,finish}=fixture(true);const song=await begin(),obsolete=song.attempts[0];expect(song.src).toContain('.ogg');song.fail(3);expect(song.src).toContain('.mp3');expect(song.play).toHaveBeenCalledTimes(2);expect(media).toHaveLength(1);await finish();obsolete.resolve();await flush();expect(inside.musicElement).toBe(song);expect(song.paused).toBe(false);expect(engine.needsGestureUnlock).toBe(false);
});

it('both formats failing exhausts one recording without an automatic retry storm',async()=>{
 const {engine,inside,media,begin}=fixture(true);const song=await begin();song.fail(3);song.fail(4);await vi.advanceTimersByTimeAsync(60000);expect(song.play).toHaveBeenCalledTimes(2);expect(media).toHaveLength(1);expect(inside.pendingMusic).toBeUndefined();expect(engine.needsGestureUnlock).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

it('a mid-song format failure keeps the actual playhead when fallback metadata arrives',async()=>{
 const {media,begin,finish}=fixture(true);const song=await begin();await finish();song.currentTime=21.4;song.fail(3);song.currentTime=0;song.duration=53.832;song.events.get('loadedmetadata')!();expect(song.currentTime).toBe(21.4);expect(song.src).toContain('tianhu-begin.mp3');await finish();expect(media).toHaveLength(1);
});

it('foreground/unmute after a canceled rest resumes once and cannot replay the stale gap',async()=>{
 const {engine,begin,finish}=fixture();engine.setVolume('music',.07);engine.setVolume('sfx',.81);const song=await begin();await finish();song.end();engine.setSuspended(true);await flush();engine.setSuspended(false);await flush();await finish();const plays=song.play.mock.calls.length;await vi.advanceTimersByTimeAsync(3001);expect(song.play).toHaveBeenCalledTimes(plays);expect(engine.getVolume('music')).toBe(.07);expect(engine.getVolume('sfx')).toBe(.81);
 song.end();engine.musicMuted=true;engine.musicMuted=false;await flush();await finish();const after=song.play.mock.calls.length;await vi.advanceTimersByTimeAsync(3001);expect(song.play).toHaveBeenCalledTimes(after);
});

it('autoplay denial is a gesture boundary and never causes a format fallback',async()=>{
 const {engine,inside,begin}=fixture(true);const song=await begin();song.attempts[0].reject(new DOMException('policy','NotAllowedError'));await flush();expect(song.src).toContain('.ogg');expect(song.play).toHaveBeenCalledOnce();expect(inside.musicFormatFailures.size).toBe(0);expect(engine.needsGestureUnlock).toBe(true);expect(vi.getTimerCount()).toBe(0);
});

it('warm decode failure uses MP3 silently, while double failure cannot loop its warm requests',()=>{
 const {engine,inside,media}=fixture(true);engine.preloadSceneMusic('table');const song=media[0];expect(song.src).toContain('.ogg');song.fail(3);expect(song.src).toContain('.mp3');expect(song.play).not.toHaveBeenCalled();expect(inside.context.createMediaElementSource).not.toHaveBeenCalled();song.fail(4);for(let i=0;i<20;i++)engine.preloadSceneMusic('table');expect(song.src).toBe('');expect(media).toHaveLength(1);
});

it('first song readiness has priority over the one paused next-scene prefetch',async()=>{
 const {engine,inside,media,begin,finish}=fixture(true);const song=await begin();song.readyState=0;engine.preloadSceneMusic('shop');expect(media).toHaveLength(1);expect(inside.musicWarmHint).toBeDefined();song.readyState=2;song.events.get('canplay')!();expect(media).toHaveLength(2);expect(media[1].src).toContain('moon-shop');expect(media[1].paused).toBe(true);expect(media[1].play).not.toHaveBeenCalled();await finish();
});

it('keeps the old song during slow loading and uses complementary 250ms ramps with two reusable slots', async () => {
  const {engine, inside, media, begin, finish} = fixture();
  const first = await begin(); await finish();
  engine.setScene('shop'); const next = inside.musicElement;
  expect(first.paused).toBe(false); await finish(next);
  expect(first.paused).toBe(false);
  const slots = inside.musicSlots;
  expect(slots.find((s: any) => s.element === first).gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.25);
  expect(slots.find((s: any) => s.element === next).gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 1.25);
  await vi.advanceTimersByTimeAsync(251); expect(first.paused).toBe(true);
  for (let i = 0; i < 40; i++) { engine.setScene(i % 2 ? 'table' : 'boss'); await finish(); }
  expect(media).toHaveLength(2); engine.setSuspended(true); expect(vi.getTimerCount()).toBe(0);
});

it('legacy material pitch stays in a narrow register for invalid and arbitrarily long chains', () => {
  expect([chainRate(-1), chainRate(NaN), chainRate(Infinity)]).toEqual([.94, .94, .94]);
  expect(chainRate(1)).toBe(1);expect(chainRate(3.9)).toBe(1.06); expect(chainRate(7)).toBe(1.06); expect(chainRate(100000)).toBe(1.06);
});
it('promotes the preloaded next-song element without another src load or gesture bypass',async()=>{
 const {engine,inside,media,begin,finish}=fixture();engine.preloadSceneMusic('table');const prepared=media[0],loads=prepared.load.mock.calls.length;
 expect(prepared.src).toContain('go-cake');expect(prepared.play).not.toHaveBeenCalled();await begin();await finish();engine.setScene('table');
 expect(inside.musicElement).toBe(prepared);expect(prepared.load).toHaveBeenCalledTimes(loads);await finish();expect(media.length).toBeLessThanOrEqual(2);
});
it('defers a hint while both slots are handing off and prepares it after the old slot retires',async()=>{
 const {engine,inside,media,begin,finish}=fixture();await begin();await finish();engine.setScene('shop');await finish();engine.preloadSceneMusic('table');
 expect(media.some(m=>m.src.includes('go-cake'))).toBe(false);await vi.advanceTimersByTimeAsync(251);
 const warm=inside.musicSlots.find((s:any)=>s.warming);expect(warm.element.src).toContain('go-cake');expect(warm.element.paused).toBe(true);expect(media).toHaveLength(2);
});
it('aborts warm requests on zero/background/new opening and does not loop failed warmups',async()=>{
 const {engine,inside,media}=fixture();engine.preloadSceneMusic('table');media[0].fail();for(let i=0;i<8;i++)engine.preloadSceneMusic('table');expect(media[0].src).toBe('');expect(media[0].play).not.toHaveBeenCalled();
 engine.preloadSceneMusic('boss');engine.setVolume('music',0);expect(media[0].src).toBe('');expect(inside.musicWarmHint).toBeUndefined();engine.setVolume('music',.3);engine.preloadSceneMusic('boss');engine.setSuspended(true);expect(media[0].src).toBe('');
 engine.setSuspended(false);engine.setScene('shop');engine.preloadSceneMusic('boss');engine.setScene('menu');expect(media[0].src).toBe('');
});
it('save-data and slow connections suppress only speculative music, not later explicit playback',async()=>{
 const {engine,media,begin,finish}=fixture();vi.stubGlobal('navigator',{connection:{saveData:true}});engine.preloadSceneMusic('table');expect(media).toHaveLength(0);
 vi.stubGlobal('navigator',{connection:{effectiveType:'2g'}});engine.preloadSceneMusic('boss');expect(media).toHaveLength(0);await begin();await finish();expect(media[0].paused).toBe(false);
});
it.each(['shop','boss'] as const)('repeated %s redraw/UI/preload/unlock calls do not seek or reload the active recording',async scene=>{
 const {engine,inside,begin,finish,media}=fixture();engine.setScene(scene);await begin();await finish();const playing=inside.musicElement;
 let clock=19,src=playing.src,seeks=0,writes=0;Object.defineProperty(playing,'currentTime',{get:()=>clock,set:(value:number)=>{seeks++;clock=value;}});Object.defineProperty(playing,'src',{get:()=>src,set:(value:string)=>{writes++;src=value;}});
 const plays=playing.play.mock.calls.length,loads=playing.load.mock.calls.length;
 for(let i=0;i<24;i++){clock+=.25;engine.setScene(scene);engine.preloadSceneMusic(i%2?'table':'boss');engine.select();engine.cancel();await engine.unlock();await flush();}
 expect(inside.activeMusic.element).toBe(playing);expect(clock).toBe(25);expect(seeks).toBe(0);expect(writes).toBe(0);expect(playing.load).toHaveBeenCalledTimes(loads);expect(playing.play).toHaveBeenCalledTimes(plays);expect(media.length).toBeLessThanOrEqual(2);
 engine.setSuspended(true);await flush();engine.setSuspended(false);await flush();await finish(playing);expect(playing.currentTime).toBe(25);expect(seeks).toBe(0);expect(writes).toBe(0);
});
