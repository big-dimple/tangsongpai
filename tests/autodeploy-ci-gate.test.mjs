import {expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const revision='a'.repeat(40),previous='b'.repeat(40),source=fs.readFileSync('scripts/tangsongpai-autodeploy.sh','utf8');
const shellPath=value=>process.platform==='win32'?execFileSync('cygpath',['-u',value],{encoding:'utf8'}).trim():value;
function deployment({ci='17',build='23',artifactRevision=revision,force=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tangsongpai-deploy-test-')),bin=path.join(root,'bin'),state=path.join(root,'state');
  try{
    fs.mkdirSync(bin);fs.mkdirSync(state);fs.mkdirSync(path.join(root,'.git'));fs.writeFileSync(path.join(state,'deployed-revision'),previous+'\n');
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'",script=path.join(root,'deploy.sh');
    let candidate=source.replace('export PATH="','export PATH="'+shellPath(bin)+(process.platform==='win32'?':$PATH':'')+':');
    for(const [name,value]of Object.entries({PROJECT_DIR:root,STATE_DIR:state,LOG_FILE:path.join(root,'log'),LOCK_FILE:path.join(root,'lock')}))candidate=candidate.replace(new RegExp('^'+name+'=.*$','m'),name+'='+quote(shellPath(value)));
    candidate=candidate.replace('/usr/local/bin/deploy-to-cloudflare-pages.py',quote(shellPath(path.join(bin,'upload'))));fs.writeFileSync(script,candidate);
    const stub=(name,text)=>fs.writeFileSync(path.join(bin,name),'#!/usr/bin/env bash\nset -eu\n'+text,{mode:0o755});
    stub('flock','exit 0\n');
    stub('git',`case "$*" in
      'branch --show-current') echo main;;
      'fetch origin main --quiet') exit 0;;
      'rev-parse origin/main') echo "$DEPLOY_TEST_REVISION";;
      *) exit 2;;
    esac\n`);
    stub('gh',`printf '%s\\n' "$*" >> "$DEPLOY_TEST_ROOT/calls"
    case "$*" in
      *'--workflow ci.yml'*)
        case "$*" in *'--status success'*) exit 2;; esac
        printf '%s' "$DEPLOY_TEST_CI";;
      *'--workflow production-build.yml'*) printf '%s' "$DEPLOY_TEST_BUILD";;
      'run download '*)
        while [ "$1" != --dir ]; do shift; done
        mkdir -p "$2"
        cp "$DEPLOY_TEST_ROOT/artifact.json" "$2/build-info.json"
        printf '<html>fixture</html>' > "$2/index.html";;
      *) exit 2;;
    esac\n`);
    stub('curl',`echo curl >> "$DEPLOY_TEST_ROOT/calls"
    if [ -f "$DEPLOY_TEST_ROOT/uploaded" ]; then cat "$DEPLOY_TEST_ROOT/current.json"; else cat "$DEPLOY_TEST_ROOT/previous.json"; fi\n`);
    stub('upload','echo upload >> "$DEPLOY_TEST_ROOT/calls"\ntouch "$DEPLOY_TEST_ROOT/uploaded"\n');
    const info=revision=>JSON.stringify({revision,sourceStatus:'clean',modified:false});
    for(const [file,value]of Object.entries({'artifact.json':artifactRevision,'current.json':revision,'previous.json':previous}))fs.writeFileSync(path.join(root,file),info(value));
    const result=spawnSync('bash',[script,...(force?['--force']:[])],{encoding:'utf8',env:{...process.env,DEPLOY_TEST_ROOT:shellPath(root),DEPLOY_TEST_REVISION:revision,DEPLOY_TEST_CI:ci,DEPLOY_TEST_BUILD:build}});
    const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
    return {status:result.status,stderr:result.stderr,log:read(path.join(root,'log')),calls:read(path.join(root,'calls')),deployed:read(path.join(state,'deployed-revision')).trim()};
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
it.each([false,true])('waits for both checks without publishing or changing the successful revision (force=%s)',force=>{
  for(const missing of [{ci:''},{build:''}]){
    const result=deployment({...missing,force});
    expect(result.status,result.log+result.stderr).toBe(0);expect(result.deployed).toBe(previous);
    expect(result.calls).not.toMatch(/run download|curl|upload/);expect(result.log).toContain('Waiting for GitHub CI and Production build');
    expect(result.calls).toContain('--workflow ci.yml --event push --branch main --commit '+revision);
    expect(result.calls).toContain('--workflow production-build.yml --branch main --commit '+revision);
  }
});
it('downloads the matching artifact and records success only after upload and public-domain verification',()=>{
  const result=deployment();
  expect(result.status,result.log+result.stderr).toBe(0);expect(result.deployed).toBe(revision);
  expect(result.calls).toMatch(/run download 23/);expect(result.calls).toContain('tangsongpai-dist-'+revision);
  expect(result.calls).toMatch(/upload\ncurl/);expect(result.log).toContain('CI=17');expect(result.log).toContain('Successfully deployed '+revision);
});
it('rejects a mismatched artifact without uploading or advancing the success record',()=>{
  const result=deployment({artifactRevision:previous});
  expect(result.status).not.toBe(0);expect(result.deployed).toBe(previous);expect(result.calls).not.toContain('upload');
  expect(result.log).toContain('Artifact build metadata does not match clean origin/main');
});
