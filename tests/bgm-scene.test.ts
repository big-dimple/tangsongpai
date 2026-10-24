import {it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AudioEngine,type AudioScene} from '../src/audio/AudioEngine';
import bgm from '../public/assets/audio/bgm/manifest.json';
import preparation from '../docs/production/evidence/user-four-bgm-2026-10-18/preparation.json';
import retired from '../docs/production/evidence/user-four-bgm-2026-10-18/retired-bgm.json';

it('ships only the four selected complete songs with verified Vorbis and MP3 deliveries',()=>{
 expect(bgm.tracks.map(t=>t.id)).toEqual(['tianhu-begin','moon-shop','go-cake','vsboss']);
 for(const t of bgm.tracks){
  for(const [path,bytes,hash]of [[t.runtimePath,t.bytes,t.sha256],[t.fallbackRuntimePath,t.fallbackBytes,t.fallbackSha256]] as const){
   const file=readFileSync('public/'+path);expect(file.length).toBe(bytes);expect(createHash('sha256').update(file).digest('hex')).toBe(hash);
  }
  const p=preparation.tracks.find(r=>r.name===t.id)!;expect(t.durationSeconds).toBe(p.source.decodedDuration);expect(t.durationSeconds).toBeGreaterThan(40);
  for(const delivered of p.outputs){expect(delivered.decodedFrames).toBe(p.source.decodedFrames);expect(delivered.fullDecodeExit).toBe(0);expect(Math.abs(delivered.integratedLufs+16)).toBeLessThan(.4);expect(delivered.truePeakDbTP).toBeLessThan(-1);expect(Math.min(...delivered.completeSongWindows.map(w=>w.correlation??0))).toBeGreaterThan(.98);}
  expect(p.sourceUnchanged).toBe(true);
 }
 for(const old of retired.removed)expect(existsSync(old.file),old.file).toBe(false);
});

it('maps every actual music scene to the supplied songs and lets endings inherit the real battle',()=>{
 const audio=new AudioEngine(),expectTrack=(scene:AudioScene,name:string)=>expect(audio.getTrackForScene(scene).runtimePath).toContain('/'+name+'.ogg');
 expectTrack('menu','tianhu-begin');expectTrack('shop','moon-shop');expectTrack('table','go-cake');expectTrack('boss','vsboss');
 for(const battle of ['table','boss'] as const){audio.setScene(battle);for(const end of ['success','failure'] as const){expectTrack(end,battle==='boss'?'vsboss':'go-cake');audio.setScene(end);}}
});

it('keeps preload harmless before a gesture and uses the declared three-second repeat gap',()=>{
 expect(bgm.repeatGapMs).toBe(3000);const audio=new AudioEngine();for(const scene of ['menu','shop','table','boss','success','failure'] as const)expect(()=>audio.preloadSceneMusic(scene)).not.toThrow();
});
