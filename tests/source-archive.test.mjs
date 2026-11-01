import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyArchive} from '../scripts/verify-source-archive.mjs';

const roots=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'source-archive-test-'));roots.push(root);
 const project=path.join(root,'project'),archive=path.join(root,'archive');await mkdir(path.join(project,'docs/assets'),{recursive:true});await mkdir(path.join(archive,'art/sources/batch'),{recursive:true});
 const bytes=Buffer.from('original bytes'),relative='art/sources/batch/原图.png';await writeFile(path.join(archive,relative),bytes);
 execFileSync('git',['init','-q',archive]);execFileSync('git',['-C',archive,'add','.']);execFileSync('git',['-C',archive,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);
 const revision=execFileSync('git',['-C',archive,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),inventory=JSON.stringify({source:relative,destination:relative,bytes:bytes.length,sha256:sha(bytes)})+'\n';
 await writeFile(path.join(project,'docs/assets/source-inventory.jsonl'),inventory);
 await writeFile(path.join(project,'docs/assets/source-archive.json'),JSON.stringify({schemaVersion:1,revision,sourceRoot:'art/sources',inventory:'docs/assets/source-inventory.jsonl',inventorySHA256:sha(inventory),fileCount:1,totalBytes:bytes.length}));
 return {project,archive,relative};
}
it('verifies the pinned commit and actual source bytes',async()=>{
 const {project,archive}=await fixture();expect(await verifyArchive(project,archive)).toMatchObject({files:1,status:'PASS'});
});
it('rejects modified bytes and extra files even if the checked-out commit has not changed',async()=>{
 const {project,archive,relative}=await fixture();await writeFile(path.join(archive,relative),'different bytes');
 await expect(verifyArchive(project,archive)).rejects.toThrow(/bytes|SHA256/);
 await writeFile(path.join(archive,relative),'original bytes');await writeFile(path.join(archive,'art/sources/batch/extra'),'unexpected');
 await expect(verifyArchive(project,archive)).rejects.toThrow('source archive paths');
});
