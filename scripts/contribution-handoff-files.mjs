import {openSync,closeSync,fstatSync,lstatSync,readSync,realpathSync,constants} from 'node:fs';
import {resolve,dirname,relative,sep,parse} from 'node:path';
import {fileURLToPath} from 'node:url';

const checkout=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const within=(path,directory)=>{const part=relative(directory,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const same=(a,b)=>['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>a[key]===b[key]);
const sameDirectory=(a,b)=>['dev','ino','mode','uid','gid'].every(key=>a[key]===b[key]);

/** Bounded private, caller-selected JSON bytes only. No provider, secret lookup or code execution. */
export function readPrivateHandoffFile(path,maximum,protectedDirectories=[]){
 const descriptors=[];let bytes;
 try{
  if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||path.includes('\0')||!Number.isSafeInteger(maximum)||maximum<1||maximum>1048576)throw Error();
  const absolute=resolve(path);if(absolute!==path)throw Error();
  const root=parse(absolute).root,parts=absolute.slice(root.length).split(sep),denied=[checkout,process.cwd(),...protectedDirectories].map(directory=>realpathSync(resolve(directory)));
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..')||denied.some(directory=>within(absolute,directory)))throw Error();
  const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;
  let directory=openSync(root,flags);descriptors.push(directory);
  const chain=[{path:root,stat:fstatSync(directory,{bigint:true})}];let traversed=root;
  for(const part of parts.slice(0,-1)){
   directory=openSync(`/proc/self/fd/${directory}/${part}`,flags);descriptors.push(directory);traversed=resolve(traversed,part);
   const stat=fstatSync(directory,{bigint:true});if(!stat.isDirectory()||!sameDirectory(stat,lstatSync(traversed,{bigint:true})))throw Error();chain.push({path:traversed,stat});
  }
  const fd=openSync(`/proc/self/fd/${directory}/${parts.at(-1)}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);descriptors.push(fd);
  const before=fstatSync(fd,{bigint:true}),uid=process.getuid?.(),mode=before.mode&0o7777n;
  if(uid===undefined||!before.isFile()||before.uid!==BigInt(uid)||before.nlink!==1n||![0o400n,0o600n].includes(mode)||before.size<1n||before.size>BigInt(maximum)||!same(before,lstatSync(absolute,{bigint:true}))||realpathSync(absolute)!==absolute)throw Error();
  bytes=Buffer.alloc(Number(before.size)+1);let size=0;
  for(;;){const count=readSync(fd,bytes,size,bytes.length-size,null);if(!count)break;size+=count;if(size===bytes.length)throw Error();}
  const after=fstatSync(fd,{bigint:true});
  if(size!==Number(before.size)||!same(before,after)||!same(after,lstatSync(absolute,{bigint:true}))||chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path,{bigint:true}))))throw Error();
  // A BOM must not disappear before the caller hashes exact admitted file bytes.
  if(size>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)throw Error();
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,size));
 }catch{throw Error('PRIVATE_HANDOFF_INPUT_UNAVAILABLE');}
 finally{bytes?.fill(0);for(const fd of descriptors.reverse())try{closeSync(fd);}catch{}}
}
