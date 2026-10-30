import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const revision='a'.repeat(40),previous='b'.repeat(40),source=fs.readFileSync('scripts/tangsongpai-autodeploy.sh','utf8');
const shellPath=value=>process.platform==='win32'?execFileSync('cygpath',['-u',value],{encoding:'utf8'}).trim():value;
function deployment({fail='',buildRevision=revision,servedRevision=previous,already=false,pending=false,force=true,advance=false,diverged=false,dirty=false,cooldown=false,cooldownAge=0,cooldownCount=null,cooldownRevision=revision,propagated=true,cacheFails=false,firstAge=null,lastAge=null}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tangsongpai-deploy-test-')),bin=path.join(root,'bin'),state=path.join(root,'state');
  try {
    fs.mkdirSync(bin);fs.mkdirSync(state);fs.writeFileSync(path.join(state,'deployed-revision'),(already?revision:previous)+'\n');
    if(pending)fs.writeFileSync(path.join(state,'pending-revision'),revision+'\n');
    if(cooldown)fs.writeFileSync(path.join(state,'failed-revision'),cooldownRevision+' '+(Math.floor(Date.now()/1000)-cooldownAge)+(cooldownCount===null?'':' '+cooldownCount)+'\n');
    if(firstAge!==null){const now=Math.floor(Date.now()/1000);fs.writeFileSync(path.join(state,'observed-revision'),`${revision} ${now-firstAge} ${now-lastAge}\n`);}
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'",script=path.join(root,'deploy.sh');
    let candidate=source.replace('export PATH="','export PATH="'+shellPath(bin)+(process.platform==='win32'?':$PATH':'')+':');
    for(const [name,value] of Object.entries({PROJECT_DIR:root,STATE_DIR:state,LOG_FILE:path.join(root,'log'),LOCK_FILE:path.join(root,'lock')}))candidate=candidate.replace(new RegExp('^'+name+'=.*$','m'),name+'='+quote(shellPath(value)));
    candidate=candidate.replace('/usr/local/bin/deploy-to-cloudflare-pages.py',quote(shellPath(path.join(bin,'upload')))).replace('/usr/local/bin/tangsongpai-cache-cloudflare.py',quote(shellPath(path.join(bin,'cache'))));fs.writeFileSync(script,candidate);
    const stub=(name,text)=>fs.writeFileSync(path.join(bin,name),'#!/usr/bin/env bash\nset -eu\n'+text,{mode:0o755});
    stub('flock','exit 0\n');
    stub('timeout','shift 2\nif [ "$DEPLOY_FAIL" = timeout ] && [ "${1:-}" = npx ]; then exit 124; fi\nexec "$@"\n');
    stub('git',`echo "git $*" >> "$DEPLOY_TEST_ROOT/calls"
if [ "\${1:-}" = -C ]; then shift 2; fi
case "$*" in
  'fetch origin main --quiet') echo fetch >> "$DEPLOY_TEST_ROOT/fetches";;
  'rev-parse origin/main') if [ "$DEPLOY_ADVANCE" = 1 ] && [ "$(wc -l < "$DEPLOY_TEST_ROOT/fetches")" -gt 1 ]; then echo "$DEPLOY_PREVIOUS"; else echo "$DEPLOY_REVISION"; fi;;
  'worktree add --detach '*) mkdir -p "$4/dist";;
  'worktree remove --force '*) :;;
  'cat-file -e '*) exit 0;;
  'merge-base --is-ancestor '*) if [ "$DEPLOY_DIVERGED" = 1 ]; then exit 1; fi;;
  'status --porcelain') if [ "$DEPLOY_DIRTY" = 1 ]; then echo ' M source'; fi;;
  *) echo "unexpected git: $*" >&2; exit 2;;
esac\n`);
    stub('npm','echo "npm $*" >> "$DEPLOY_TEST_ROOT/calls"\nif [ "$DEPLOY_FAIL" = install ]; then exit 1; fi\n');
    stub('npx','echo "npx $*" >> "$DEPLOY_TEST_ROOT/calls"\nif [ "$DEPLOY_FAIL" = build ]; then exit 1; fi\ncp "$DEPLOY_TEST_ROOT/build.json" dist/build-info.json\necho fixture > dist/index.html\n');
    stub('sleep',':\n');
    stub('cache','echo cache >> "$DEPLOY_TEST_ROOT/calls"\nif [ "$DEPLOY_CACHE_FAIL" = 1 ]; then exit 1; fi\n');
    stub('curl','echo curl >> "$DEPLOY_TEST_ROOT/calls"\nif [ -f "$DEPLOY_TEST_ROOT/uploaded" ] && [ "$DEPLOY_PROPAGATED" = 1 ]; then cat "$DEPLOY_TEST_ROOT/current.json"; else cat "$DEPLOY_TEST_ROOT/served.json"; fi\n');
    stub('upload','echo upload >> "$DEPLOY_TEST_ROOT/calls"\ntouch "$DEPLOY_TEST_ROOT/uploaded"\n');
    const info=rev=>JSON.stringify({revision:rev,sourceStatus:'clean',modified:false});
    for(const [file,rev] of Object.entries({'build.json':buildRevision,'current.json':revision,'served.json':servedRevision}))fs.writeFileSync(path.join(root,file),info(rev));
    const env={...process.env,DEPLOY_TEST_ROOT:shellPath(root),DEPLOY_REVISION:revision,DEPLOY_PREVIOUS:previous,DEPLOY_FAIL:fail,DEPLOY_ADVANCE:advance?'1':'0',DEPLOY_DIVERGED:diverged?'1':'0',DEPLOY_DIRTY:dirty?'1':'0',DEPLOY_PROPAGATED:propagated?'1':'0',DEPLOY_CACHE_FAIL:cacheFails?'1':'0'};
    const result=spawnSync('bash',[script,...(force?['--force']:[])],{encoding:'utf8',env});
    const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
    return {status:result.status,stderr:result.stderr,log:read(path.join(root,'log')),calls:read(path.join(root,'calls')),deployed:read(path.join(state,'deployed-revision')).trim(),failed:read(path.join(state,'failed-revision')).trim()};
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
it('builds in a separate worktree before uploading and verifying the public revision',()=>{
  const r=deployment();expect(r.status,r.log+r.stderr).toBe(0);expect(r.deployed).toBe(revision);
  expect(r.calls).toMatch(/worktree add --detach/);expect(r.calls).toMatch(/npm ci[\s\S]*npx vite build[\s\S]*upload[\s\S]*curl/);
  expect(r.calls).not.toContain('verify:ci');expect(r.log).toContain('CI not run');
  expect(r.calls).not.toMatch(/reset --hard/);
});
it.each(['build','install','timeout'])('does not publish after failed %s',fail=>{
  const r=deployment({fail});
  expect(r.status).not.toBe(0);expect(r.deployed).toBe(previous);expect(r.calls).not.toContain('upload');
});
it('rejects mismatched metadata and a dirty checkout',()=>{
  for(const options of [{buildRevision:previous},{dirty:true}]){const r=deployment(options);expect(r.status).not.toBe(0);expect(r.deployed).toBe(previous);expect(r.calls).not.toContain('upload');}
});
it('finishes a checked revision when main advances, but rejects rewritten history',()=>{
  const r=deployment({advance:true});expect(r.status,r.log).toBe(0);expect(r.deployed).toBe(revision);expect(r.calls).toContain('upload');
  const rewritten=deployment({advance:true,diverged:true});expect(rewritten.status).toBe(0);expect(rewritten.deployed).toBe(previous);expect(rewritten.calls).not.toContain('upload');
});
it('skips an already deployed revision unless forced',()=>{
  const r=deployment({already:true,force:false});expect(r.status).toBe(0);expect(r.calls).not.toMatch(/npm|upload/);
  const forced=deployment({already:true,force:true});expect(forced.status,forced.log).toBe(0);expect(forced.calls).toContain('npx vite build');
});
it('only accepts an already served revision when this machine recorded a pending upload',()=>{
  const pending=deployment({pending:true,servedRevision:revision,force:false});expect(pending.deployed).toBe(revision);expect(pending.calls).not.toMatch(/npm|upload/);
  const unproven=deployment({servedRevision:revision});expect(unproven.deployed).toBe(revision);expect(unproven.calls).toContain('npx vite build');
});

it('keeps the previous success record until the uploaded revision reaches the public domain',()=>{
  const r=deployment({propagated:false});expect(r.status).not.toBe(0);expect(r.deployed).toBe(previous);expect(r.calls).toContain('upload');
});
it('honors the retry cooldown and allows force to bypass it',()=>{
  const waiting=deployment({cooldown:true,force:false});expect(waiting.status).toBe(0);expect(waiting.calls).not.toMatch(/npm|upload/);
  const forced=deployment({cooldown:true,force:true});expect(forced.status,forced.log).toBe(0);expect(forced.calls).toContain('npx vite build');
});
it('backs off repeated failures of the same revision, but not a new revision',()=>{
  const first=deployment({fail:'build'});expect(first.failed.split(' ')[2]).toBe('1');expect(first.log).toContain('Retry after 10 minutes');
  const again=deployment({fail:'build',cooldown:true,cooldownAge:601});expect(again.failed.split(' ')[2]).toBe('2');expect(again.log).toContain('Retry after 20 minutes');
  const waiting=deployment({force:false,cooldown:true,cooldownAge:601,cooldownCount:2,firstAge:601,lastAge:601});expect(waiting.calls).not.toMatch(/npm|upload/);
  const newRevision=deployment({force:false,cooldown:true,cooldownRevision:previous,firstAge:601,lastAge:601});expect(newRevision.status,newRevision.log).toBe(0);expect(newRevision.calls).toContain('upload');
  const capped=deployment({fail:'build',cooldown:true,cooldownAge:4000,cooldownCount:4});expect(capped.failed.split(' ')[2]).toBe('4');expect(capped.log).toContain('Retry after 60 minutes');
});

it('coalesces pushes for five quiet minutes but starts after at most ten minutes',()=>{
  const fresh=deployment({force:false});expect(fresh.status).toBe(0);expect(fresh.calls).not.toMatch(/npm|upload/);
  const quiet=deployment({force:false,firstAge:301,lastAge:301});expect(quiet.status,quiet.log).toBe(0);expect(quiet.calls).toContain('upload');
  const busy=deployment({force:false,firstAge:601,lastAge:1});expect(busy.status,busy.log).toBe(0);expect(busy.calls).toContain('upload');
});

it('keeps a verified deployment successful if cache registration fails',()=>{
  const r=deployment({cacheFails:true});expect(r.status,r.log).toBe(0);expect(r.deployed).toBe(revision);expect(r.log).toContain('Asset cache registration failed');
});
