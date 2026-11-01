/** Source metadata is public; original bytes are in the verified private checkout. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseInventory} from './verify-source-archive.mjs';

export function sourceInventory(root=process.cwd()){
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'docs/assets/source-archive.json'),'utf8'));
 const bytes=fs.readFileSync(path.join(root,'docs/assets/source-inventory.jsonl'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.inventorySHA256,'source inventory SHA256');
 return new Map(parseInventory(bytes.toString('utf8'),receipt).map(row=>[row.source,row]));
}
export function originalPath(relative){
 assert.ok(typeof relative==='string'&&relative.startsWith('art/sources/')&&!relative.includes('\\')&&relative.split('/').every(p=>p&&p!=='.'&&p!=='..'),'invalid original source path');
 const root=process.env.TANGSONGPAI_ASSETS_ROOT;
 if(!root)throw Error('Set TANGSONGPAI_ASSETS_ROOT to the verified tangsongpai-assets checkout before reading original artwork');
 return path.join(path.resolve(root),relative);
}
