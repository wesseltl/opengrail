import {openSync,closeSync,fstatSync,lstatSync,realpathSync,constants} from 'node:fs';
import {resolve,dirname,relative,sep,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
const checkout=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const within=(path,directory)=>{const part=relative(directory,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!part.startsWith(sep);};
const sameDirectory=(a,b)=>['dev','ino','mode','uid','gid'].every(key=>a[key]===b[key]);
/** Hold every canonical parent directory open; refuse relative paths and all parent symlinks. */
export function pinProgramPrivatePath(path){const descriptors=[];try{
 if(process.platform!=='linux'||typeof path!=='string'||path.length>4096||/[\x00-\x1f]/.test(path)||resolve(path)!==path||[checkout,process.cwd()].map(directory=>realpathSync(directory)).some(directory=>within(path,directory)))throw Error();
 const root=parse(path).root,parts=path.slice(root.length).split(sep);if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'))throw Error();const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW|constants.O_NONBLOCK;let directory=openSync(root,flags);descriptors.push(directory);const chain=[{path:root,stat:fstatSync(directory)}];let traversed=root;
 for(const part of parts.slice(0,-1)){directory=openSync('/proc/self/fd/'+directory+'/'+part,flags);descriptors.push(directory);traversed=resolve(traversed,part);const stat=fstatSync(directory);if(!stat.isDirectory()||!sameDirectory(stat,lstatSync(traversed)))throw Error();chain.push({path:traversed,stat});}
 let closed=false;const assertFresh=()=>{if(closed||chain.some(item=>!sameDirectory(item.stat,lstatSync(item.path)))||realpathSync(dirname(path))!==dirname(path))throw Error('INVALID_PRIVATE_PATH');};const close=()=>{if(closed)return;closed=true;for(const descriptor of descriptors.reverse())try{closeSync(descriptor);}catch{}};assertFresh();return {path,directory,target:'/proc/self/fd/'+directory+'/'+parts.at(-1),assertFresh,close};
 }catch{for(const descriptor of descriptors.reverse())try{closeSync(descriptor);}catch{}throw Error('INVALID_PRIVATE_PATH');}}
