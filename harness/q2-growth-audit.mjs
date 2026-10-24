import {build} from 'esbuild';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';

const out='docs/production/evidence/q2-growth-2026-10-21';
const folder=await mkdtemp(join(tmpdir(),'q2-growth-audit-'));
await mkdir(out,{recursive:true});
try{
 const built=await build({entryPoints:['harness/q2-growth-audit.ts'],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':'"/"'}});
 const file=join(folder,'audit.mjs');await writeFile(file,built.outputFiles[0].contents);
 const {q2GrowthAudit}=await import(pathToFileURL(file).href);
 const {report,checkpoints}=q2GrowthAudit();
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 await writeFile(out+'/audit.json',JSON.stringify({status:'PASS',baseline:git('rev-parse','origin/main'),testedHead:git('rev-parse','HEAD'),srcTree:git('rev-parse','HEAD:src'),scope:'Read-only audit and ordinary domain commands. No product changes or new browser UI proof.',...report},null,2)+'\n');
 await writeFile(out+'/checkpoints.json.gz',gzipSync(JSON.stringify(checkpoints),{mtime:0}));
 console.log(JSON.stringify({status:'PASS',routes:report.current.map(r=>({route:r.route,plays:r.plays,shops:r.subsequentShops,phase:r.final.phase,practice:r.practice})),outputs:[out+'/audit.json',out+'/checkpoints.json.gz']},null,2));
}catch(error){
 const file=out+'/FAIL-'+Date.now()+'.txt';await writeFile(file,String(error.stack??error)+'\n');console.error(file,error);process.exitCode=1;
}finally{await rm(folder,{recursive:true,force:true});}
