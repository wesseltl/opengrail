import {openSync,closeSync,fstatSync,readSync,lstatSync,constants,realpathSync,writeFileSync,fsyncSync,linkSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname,resolve,relative,sep,parse} from 'node:path';
import {fileURLToPath} from 'node:url';

// Linux descriptor-relative traversal pins each nonsymlink directory before opening
// its child. Nothing here accepts a credential from argv text, an environment
// variable, policy JSON, a checkout, or a provider response.
const maximumBytes=512,collectorCheckout=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export class PrivateCredentialError extends Error{
 constructor(){super('PRIVATE_CREDENTIAL_UNAVAILABLE');this.name='PrivateCredentialError';}
}
export class PrivateEvidenceOutputError extends Error{
 constructor(uncertain=false){super(uncertain?'PRIVATE_EVIDENCE_OUTPUT_UNCERTAIN':'PRIVATE_EVIDENCE_OUTPUT_UNAVAILABLE');this.name='PrivateEvidenceOutputError';this.code=this.message;}
}
const within=(path,directory)=>{const part=relative(directory,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const same=(left,right)=>['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>left[key]===right[key]);
const sameDirectory=(left,right)=>['dev','ino','mode','uid','gid'].every(key=>left[key]===right[key]);
function acceptable(stat){
 const mode=stat.mode&0o7777n,uid=process.getuid?.();
 return uid!==undefined&&stat.isFile()&&stat.uid===BigInt(uid)&&stat.nlink===1n&&(mode===0o400n||mode===0o600n)&&stat.size>=1n&&stat.size<=BigInt(maximumBytes);
}

/** Validate and pin the output directory before any authenticated GET. An
 * exclusive hard-link publication preserves a new 0600 file without replacing
 * a file or following a caller-supplied symlink. */
export function preparePrivateEvidenceOutput(path,protectedDirectories=[]){
 const descriptors=[];let temporary=null,closed=false;
 try{
  if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||path.includes('\0'))throw new PrivateEvidenceOutputError();
  const absolute=resolve(path);if(absolute!==path)throw new PrivateEvidenceOutputError();
  const root=parse(absolute).root,parts=absolute.slice(root.length).split(sep),denied=[collectorCheckout,process.cwd(),...protectedDirectories].map(directory=>realpathSync(resolve(directory)));
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..')||denied.some(directory=>within(absolute,directory)))throw new PrivateEvidenceOutputError();
  const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;
  let directory=openSync(root,flags);descriptors.push(directory);
  const chain=[{path:root,stat:fstatSync(directory,{bigint:true})}];let traversed=root;
  for(const part of parts.slice(0,-1)){
   directory=openSync(`/proc/self/fd/${directory}/${part}`,flags);descriptors.push(directory);traversed=resolve(traversed,part);
   const stat=fstatSync(directory,{bigint:true});if(!stat.isDirectory()||!sameDirectory(stat,lstatSync(traversed,{bigint:true})))throw new PrivateEvidenceOutputError();
   chain.push({path:traversed,stat});
  }
  const target=`/proc/self/fd/${directory}/${parts.at(-1)}`;
  function check(){
   if(closed||chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path,{bigint:true})))||realpathSync(dirname(absolute))!==dirname(absolute)||denied.some(item=>within(absolute,item)))throw new PrivateEvidenceOutputError();
   try{lstatSync(target);throw new PrivateEvidenceOutputError();}catch(error){if(error?.code!=='ENOENT')throw new PrivateEvidenceOutputError();}
  }
  function close(){if(closed)return;closed=true;for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}}
  check();
  return {close,write(value){
   let fd,published=false;
   try{
    check();const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(bytes.length>1048576)throw new PrivateEvidenceOutputError();
    temporary=`/proc/self/fd/${directory}/.opengrail-private-ci-${randomUUID()}.tmp`;
    fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
    writeFileSync(fd,bytes);fsyncSync(fd);if((fstatSync(fd).mode&0o7777)!==0o600)throw new PrivateEvidenceOutputError();closeSync(fd);fd=undefined;
    check();linkSync(temporary,target);published=true;unlinkSync(temporary);temporary=null;
    if(chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path,{bigint:true}))))throw new PrivateEvidenceOutputError();
    fsyncSync(directory);return;
   }catch{throw new PrivateEvidenceOutputError(published);}
   finally{if(fd!==undefined)try{closeSync(fd);}catch{}if(temporary)try{unlinkSync(temporary);}catch{}}
  }};
 }catch{for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}throw new PrivateEvidenceOutputError();}
}

/** Scope the raw token to the trusted caller's in-process callback. The return
 * value never contains it. Buffer erasure does not claim to erase JS strings. */
export function withPrivateCredentialFile(path,protectedDirectories,use){
 const descriptors=[];let bytes;
 try{
  if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||path.includes('\0')||typeof use!=='function')throw new PrivateCredentialError();
  const absolute=resolve(path);if(absolute!==path)throw new PrivateCredentialError();
  const root=parse(absolute).root,parts=absolute.slice(root.length).split(sep);
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'))throw new PrivateCredentialError();
  const denied=[collectorCheckout,process.cwd(),...(protectedDirectories??[])].map(directory=>realpathSync(resolve(directory)));
  if(denied.some(directory=>within(absolute,directory)))throw new PrivateCredentialError();
  const directoryFlags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;
  let directory=openSync(root,directoryFlags);descriptors.push(directory);
  const chain=[{path:root,stat:fstatSync(directory,{bigint:true})}];let traversed=root;
  for(const part of parts.slice(0,-1)){
   directory=openSync(`/proc/self/fd/${directory}/${part}`,directoryFlags);descriptors.push(directory);
   traversed=resolve(traversed,part);const stat=fstatSync(directory,{bigint:true});
   if(!stat.isDirectory()||!sameDirectory(stat,lstatSync(traversed,{bigint:true})))throw new PrivateCredentialError();
   chain.push({path:traversed,stat});
  }
  const fd=openSync(`/proc/self/fd/${directory}/${parts.at(-1)}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);descriptors.push(fd);
  const before=fstatSync(fd,{bigint:true});
  if(!acceptable(before)||!same(before,lstatSync(absolute,{bigint:true}))||realpathSync(absolute)!==absolute||denied.some(directory=>within(realpathSync(absolute),directory)))throw new PrivateCredentialError();
  bytes=Buffer.alloc(Number(before.size)+1);let count=0;
  for(;;){const n=readSync(fd,bytes,count,bytes.length-count,null);if(!n)break;count+=n;if(count===bytes.length)throw new PrivateCredentialError();}
  const after=fstatSync(fd,{bigint:true});
  if(count!==Number(before.size)||!acceptable(after)||!same(before,after)||!same(after,lstatSync(absolute,{bigint:true}))||chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path,{bigint:true}))))throw new PrivateCredentialError();
  let token=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count));
  if(token.endsWith('\n'))token=token.slice(0,-1);
  if(!/^github_pat_[A-Za-z0-9_]{20,255}$/.test(token))throw new PrivateCredentialError();
  // The prefix restricts the supported format; it cannot establish permissions,
  // repository selection, expiry, or scope. Maintainers must inspect those.
  return use(token);
 }catch{throw new PrivateCredentialError();}
 finally{bytes?.fill(0);for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}}
}
