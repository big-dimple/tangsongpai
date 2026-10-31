/** Verify source inventory and every byte in the checked-out private archive. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstat,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseInventory(text,receipt){
 const records=text.split('\n').filter(Boolean).map(line=>JSON.parse(line)),names=new Set();
 for(const row of records){
  assert.equal(typeof row.source,'string');assert.equal(row.source,row.destination);
  assert.ok(row.source.startsWith('art/sources/')&&!row.source.includes('\\')&&row.source.split('/').every(part=>part&&part!=='.'&&part!=='..'),'unsafe source path');
  assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>=0);
  assert.ok(!names.has(row.source),'duplicate source path');names.add(row.source);
 }
 assert.equal(records.length,receipt.fileCount);assert.equal(records.reduce((n,r)=>n+r.bytes,0),receipt.totalBytes);
 return records;
}
async function walk(root,relative){
 const result=[];
 for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
  const p=path.posix.join(relative,entry.name);assert.ok(!entry.isSymbolicLink(),'source archive contains a symlink');
  if(entry.isDirectory())result.push(...await walk(root,p));else {assert.ok(entry.isFile(),'source archive contains a special file');result.push(p);}
 }
 return result;
}
export async function verifyArchive(project,archive){
 const receipt=JSON.parse(await readFile(path.join(project,'docs/assets/source-archive.json'),'utf8'));
 assert.equal(receipt.schemaVersion,1);assert.equal(receipt.sourceRoot,'art/sources');assert.equal(receipt.inventory,'docs/assets/source-inventory.jsonl');
 const text=await readFile(path.join(project,receipt.inventory));assert.equal(digest(text),receipt.inventorySHA256,'source inventory SHA256');
 const records=parseInventory(text.toString('utf8'),receipt),archiveRoot=path.resolve(archive);
 assert.equal(execFileSync('git',['-C',archiveRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),receipt.revision,'source archive commit');
 const actual=(await walk(archiveRoot,receipt.sourceRoot)).sort(),expected=records.map(r=>r.destination).sort();assert.deepEqual(actual,expected,'source archive paths');
 for(const record of records){
  const file=path.join(archiveRoot,record.destination),stat=await lstat(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());
  assert.equal(stat.size,record.bytes,record.source+': bytes');assert.equal(digest(await readFile(file)),record.sha256,record.source+': SHA256');
 }
 return {revision:receipt.revision,files:records.length,bytes:receipt.totalBytes,status:'PASS'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const archive=process.argv[2]??process.env.TANGSONGPAI_ASSETS_ROOT;
 if(!archive||process.argv.length>3){console.error('usage: node scripts/verify-source-archive.mjs <private-asset-checkout>');process.exitCode=1;}
 else try{console.log(JSON.stringify(await verifyArchive(process.cwd(),archive)));}catch(error){console.error(error);process.exitCode=1;}
}
