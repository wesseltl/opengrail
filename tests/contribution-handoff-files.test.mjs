import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,linkSync,symlinkSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readPrivateHandoffFile} from '../scripts/contribution-handoff-files.mjs';

test('private handoff inputs are caller-selected bounded UTF-8 owned files outside checkouts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'opengrail-handoff-input-'));try{
  const file=join(dir,'input.json');writeFileSync(file,'{"fixture":true}\n',{mode:0o600});
  assert.equal(readPrivateHandoffFile(file,32),'{"fixture":true}\n');chmodSync(file,0o400);assert.equal(readPrivateHandoffFile(file,32),'{"fixture":true}\n');
  for(const cap of [1,0,1048577,1.5])assert.throws(()=>readPrivateHandoffFile(file,cap),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  assert.throws(()=>readPrivateHandoffFile(file,32,[dir]),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  assert.throws(()=>readPrivateHandoffFile('relative.json',32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  assert.throws(()=>readPrivateHandoffFile(dir+'/sub/../input.json',32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('private handoff inputs reject shared permissions, aliases, directories and malformed text',()=>{
 const dir=mkdtempSync(join(tmpdir(),'opengrail-handoff-input-'));try{
  const file=join(dir,'input.json');writeFileSync(file,'{}',{mode:0o644});chmodSync(file,0o644);assert.throws(()=>readPrivateHandoffFile(file,32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  chmodSync(file,0o600);const alias=join(dir,'alias');linkSync(file,alias);assert.throws(()=>readPrivateHandoffFile(file,32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);rmSync(alias);
  symlinkSync(file,alias);assert.throws(()=>readPrivateHandoffFile(alias,32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  const nested=join(dir,'nested');mkdirSync(nested);writeFileSync(join(nested,'input.json'),'{}',{mode:0o600});const linked=join(dir,'linked');symlinkSync(nested,linked);assert.throws(()=>readPrivateHandoffFile(join(linked,'input.json'),32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  assert.throws(()=>readPrivateHandoffFile(nested,32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
  writeFileSync(file,Buffer.from([0xff]));assert.throws(()=>readPrivateHandoffFile(file,32),/PRIVATE_HANDOFF_INPUT_UNAVAILABLE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
