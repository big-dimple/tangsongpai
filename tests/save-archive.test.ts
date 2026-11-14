import {describe,expect,it} from 'vitest';
import {archiveSlots,archiveWithCandidate,readSaveArchive} from '../src/application/SaveArchive';
import {makeCheckpoint,restoreSlots} from '../src/application/checkpoint';
import {r2ModeStorageKey} from '../src/content/r2Modes';
import {createRun} from '../src/domain/run';

const checkpoint=(seed:string)=>makeCheckpoint(createRun({seed,characterId:'amo',runId:seed,rulesVersion:'r2'}),[]);

describe('complete save files',()=>{
  it('keeps an unsaved candidate and the entire former slot, including damaged data',()=>{
    const candidate=checkpoint('candidate'),key=r2ModeStorageKey(candidate.state,candidate.state.contentHash);
    const old={current:{format:'old-or-damaged'},previous:checkpoint('older')};
    const archive=readSaveArchive({format:'tangsongpai-storage-backup',records:[{key:'meta',value:{revision:7,slotKey:key}},{key,value:old}]});
    archiveWithCandidate(archive,candidate);
    expect(restoreSlots(archiveSlots(archive)).checkpoint).toEqual(candidate);
    expect(archive.records.find(row=>row.key.startsWith('retained:'))?.value).toEqual(old);
  });
  it('accepts legacy backups and rejects malformed, duplicate or mismatched slots',()=>{
    const saved=checkpoint('saved'),key=r2ModeStorageKey(saved.state,saved.state.contentHash),records=[{key:'meta',value:{revision:1,slotKey:key}},{key,value:{current:saved,previous:null}}];
    expect(restoreSlots(archiveSlots(readSaveArchive({format:'tangsongpai-storage-backup',records}))).checkpoint).toEqual(saved);
    expect(()=>readSaveArchive({format:'tangsongpai-storage-backup',records:[...records,records[1]]})).toThrow();
    expect(()=>readSaveArchive({format:'tangsongpai-storage-backup',records:[{key:'meta',value:{revision:1,slotKey:'missing'}}]})).toThrow();
    expect(()=>readSaveArchive({format:'tangsongpai-storage-backup',records:[{key:'meta',value:{revision:1,slotKey:'wrong'}},{key:'wrong',value:{current:saved,previous:null}}]})).toThrow();
    expect(()=>readSaveArchive({format:'tangsongpai-storage-backup',version:2,records})).toThrow();
  });
});
