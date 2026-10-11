import {openSync,closeSync,fstatSync,lstatSync,readSync,realpathSync,constants,writeFileSync,fsyncSync,linkSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,dirname,relative,sep,parse} from 'node:path';
import {fileURLToPath} from 'node:url';

const checkout=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const privateForwardFileLimit=83886080;
export class PrivateForwardFileError extends Error{constructor(uncertain=false){super(uncertain?'PRIVATE_FORWARD_OUTPUT_UNCERTAIN':'PRIVATE_FORWARD_FILE_UNAVAILABLE');this.code=this.message;}}
const within=(path,directory)=>{const part=relative(directory,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const same=(a,b)=>['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>a[key]===b[key]);
const sameDirectory=(a,b)=>['dev','ino','mode','uid','gid'].every(key=>a[key]===b[key]);
function jsonBytes(raw,maximum){
 let nodes=0;const ancestors=new Set();
 function walk(value,depth){
  if(++nodes>1800000||depth>32)throw new PrivateForwardFileError();
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||ancestors.has(value)||Object.getOwnPropertySymbols(value).length)throw new PrivateForwardFileError();
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new PrivateForwardFileError();
  if(array&&Object.keys(descriptors).length!==value.length+1)throw new PrivateForwardFileError();ancestors.add(value);
  for(const [key,descriptor] of Object.entries(descriptors)){if(array&&key==='length')continue;if(!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))throw new PrivateForwardFileError();walk(descriptor.value,depth+1);}ancestors.delete(value);
 }
 walk(raw,0);const bytes=Buffer.from(JSON.stringify(raw)+'\n');if(bytes.length>maximum)throw new PrivateForwardFileError();return bytes;
}
function pinned(path,maximum,protectedDirectories){
 const descriptors=[];
 try{
  if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||path.includes('\0')||resolve(path)!==path||!Number.isSafeInteger(maximum)||maximum<1||maximum>privateForwardFileLimit)throw Error();
  const root=parse(path).root,parts=path.slice(root.length).split(sep),denied=[checkout,process.cwd(),...protectedDirectories].map(directory=>realpathSync(resolve(directory)));
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..')||denied.some(directory=>within(path,directory)))throw Error();
  const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;
  let directory=openSync(root,flags);descriptors.push(directory);const chain=[{path:root,stat:fstatSync(directory,{bigint:true})}];let traversed=root;
  for(const part of parts.slice(0,-1)){directory=openSync(`/proc/self/fd/${directory}/${part}`,flags);descriptors.push(directory);traversed=resolve(traversed,part);const stat=fstatSync(directory,{bigint:true});if(!stat.isDirectory()||!sameDirectory(stat,lstatSync(traversed,{bigint:true})))throw Error();chain.push({path:traversed,stat});}
  let closed=false;
  const assertFresh=()=>{if(closed||chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path,{bigint:true})))||realpathSync(dirname(path))!==dirname(path))throw Error();};
  const close=()=>{if(closed)return;closed=true;for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}};
  assertFresh();return {path,directory,target:`/proc/self/fd/${directory}/${parts.at(-1)}`,assertFresh,close};
 }catch{for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}throw new PrivateForwardFileError();}
}
/** Exact bounded body bytes, including an explicitly permitted empty failed response. */
export function readPrivateForwardBytes(path,maximum,{allowEmpty=false,protectedDirectories=[]}={}){
 const pin=pinned(path,maximum,protectedDirectories);let fd,bytes;
 try{
  fd=openSync(pin.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const before=fstatSync(fd,{bigint:true}),uid=process.getuid?.();
  if(uid===undefined||!before.isFile()||before.uid!==BigInt(uid)||before.nlink!==1n||![0o400n,0o600n].includes(before.mode&0o7777n)||before.size<BigInt(allowEmpty?0:1)||before.size>BigInt(maximum)||!same(before,lstatSync(path,{bigint:true}))||realpathSync(path)!==path)throw Error();
  bytes=Buffer.alloc(Number(before.size)+1);let size=0;
  for(;;){const count=readSync(fd,bytes,size,bytes.length-size,null);if(!count)break;size+=count;if(size===bytes.length)throw Error();}
  const after=fstatSync(fd,{bigint:true});pin.assertFresh();
  if(size!==Number(before.size)||!same(before,after)||!same(after,lstatSync(path,{bigint:true})))throw Error();
  return Buffer.from(bytes.subarray(0,size));
 }catch{throw new PrivateForwardFileError();}
 finally{bytes?.fill(0);if(fd!==undefined)try{closeSync(fd);}catch{}pin.close();}
}
export function readPrivateForwardFile(path,maximum,protectedDirectories=[]){
 const bytes=readPrivateForwardBytes(path,maximum,{protectedDirectories});
 try{if(bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)throw Error();return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new PrivateForwardFileError();}finally{bytes.fill(0);}
}
/** Exclusive private publication. Late failure preserves a possibly committed target. */
export function preparePrivateForwardOutput(path,maximum,protectedDirectories=[]){
 const pin=pinned(path,maximum,protectedDirectories);let used=false;
 const absent=()=>{pin.assertFresh();try{lstatSync(pin.target);throw Error();}catch(error){if(error?.code!=='ENOENT')throw Error();}};
 try{absent();}catch{pin.close();throw new PrivateForwardFileError();}
 return {close:pin.close,assertFresh:pin.assertFresh,write(value){return this.writeBytes(jsonBytes(value,maximum));},writeBytes(raw){
  let temporary,fd,published=false;
  try{
   if(used||!Buffer.isBuffer(raw)&&!(raw instanceof Uint8Array)||raw.byteLength>maximum)throw Error();used=true;absent();
   const bytes=Buffer.from(raw);temporary=`/proc/self/fd/${pin.directory}/.opengrail-forward-${randomUUID()}.tmp`;
   fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);writeFileSync(fd,bytes);fsyncSync(fd);const stat=fstatSync(fd,{bigint:true});if((stat.mode&0o7777n)!==0o600n)throw Error();closeSync(fd);fd=undefined;
   absent();linkSync(temporary,pin.target);published=true;unlinkSync(temporary);temporary=undefined;fsyncSync(pin.directory);pin.assertFresh();
   const committed=lstatSync(pin.target,{bigint:true});if(committed.dev!==stat.dev||committed.ino!==stat.ino||committed.nlink!==1n||committed.size!==BigInt(bytes.length))throw Error();
   const actual=readPrivateForwardBytes(path,maximum,{allowEmpty:true,protectedDirectories});if(!actual.equals(bytes))throw Error();pin.assertFresh();return;
  }catch{throw new PrivateForwardFileError(published);}
  finally{if(fd!==undefined)try{closeSync(fd);}catch{}if(temporary)try{unlinkSync(temporary);}catch{}}
 }};
}
