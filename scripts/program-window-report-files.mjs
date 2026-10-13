import {openSync,closeSync,fstatSync,lstatSync,readSync,writeSync,realpathSync,mkdirSync,readdirSync,fsyncSync,statfsSync,linkSync,unlinkSync,constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pinProgramPrivatePath} from './program-session-files.mjs';

export const reportFileSha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const reportFileEnsure=(value,code)=>{if(!value)throw Error(code);};
const same=(a,b)=>['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'].every(key=>a[key]===b[key]);
export function reportDirectory(path){
 reportFileEnsure(typeof path==='string'&&path.length<=4096&&!/[\x00-\x1f\x7f]/.test(path)&&resolve(path)===path&&realpathSync(path)===path,'PRIVATE_DIRECTORY_REQUIRED');
 const pin=pinProgramPrivatePath(join(path,'.report-directory-pin'));let stat;
 const check=()=>{pin.assertFresh();const now=lstatSync(path,{bigint:true});reportFileEnsure(now.isDirectory()&&now.uid===BigInt(process.getuid())&&(now.mode&0o7777n)===0o700n&&['dev','ino','mode','uid','gid'].every(key=>now[key]===stat[key]),'PRIVATE_DIRECTORY_CHANGED');};
 try{stat=lstatSync(path,{bigint:true});check();return {path,check,sync(){check();fsyncSync(pin.directory);check();},close:pin.close};}catch(error){pin.close();throw error;}
}
export function newReportDirectory(path){
 const parent=reportDirectory(dirname(path));
 try{parent.check();mkdirSync(path,{mode:0o700});parent.sync();const child=reportDirectory(path);try{child.sync();return child;}catch(error){child.close();throw error;}}finally{parent.close();}
}
export function reserveReportSpace(directory,bytes){const space=statfsSync(directory,{bigint:true});reportFileEnsure(space.bavail*space.bsize>=BigInt(bytes),'REPORT_STORAGE_RESERVATION_REFUSED');}
export function holdReportFile(path,maximum){
 const pin=pinProgramPrivatePath(path);let fd;
 try{
  const parent=fstatSync(pin.directory,{bigint:true});reportFileEnsure(parent.isDirectory()&&parent.uid===BigInt(process.getuid())&&(parent.mode&0o7777n)===0o700n,'PRIVATE_PARENT_REQUIRED');
  fd=openSync(pin.target,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=fstatSync(fd,{bigint:true});
  reportFileEnsure(stat.isFile()&&stat.uid===BigInt(process.getuid())&&stat.nlink===1n&&(stat.mode&0o7777n)===0o600n&&stat.size>0n&&stat.size<=BigInt(maximum),'PRIVATE_COMPLETE_FILE_REQUIRED');
  const read=()=>{pin.assertFresh();reportFileEnsure(same(stat,fstatSync(fd,{bigint:true}))&&same(stat,lstatSync(path,{bigint:true})),'REPORT_FILE_CHANGED');const buffer=Buffer.alloc(Number(stat.size)+1);let size=0;for(;;){const count=readSync(fd,buffer,size,buffer.length-size,size);if(!count)break;size+=count;reportFileEnsure(size<buffer.length,'REPORT_FILE_CHANGED');}pin.assertFresh();reportFileEnsure(size===Number(stat.size)&&same(stat,fstatSync(fd,{bigint:true}))&&same(stat,lstatSync(path,{bigint:true})),'REPORT_FILE_CHANGED');return Buffer.from(buffer.subarray(0,size));};
  const bytes=read(),digest=reportFileSha(bytes);return {path,bytes,digest,descriptor:{name:path.split('/').at(-1),bytes:bytes.length,digest},check(){reportFileEnsure(reportFileSha(read())===digest,'REPORT_FILE_CHANGED');},close(){if(fd!==undefined){closeSync(fd);fd=undefined;}pin.close();}};
 }catch(error){if(fd!==undefined)closeSync(fd);pin.close();throw error;}
}
/** Larger fixed report ceilings than the protected forward-file helper. */
export function writeReportFile(path,raw,maximum){
 reportFileEnsure(Number.isSafeInteger(maximum)&&maximum>0&&maximum<=419430400&&(Buffer.isBuffer(raw)||raw instanceof Uint8Array)&&raw.byteLength>0&&raw.byteLength<=maximum,'WHOLE_REPORT_CAPACITY');
 const bytes=Buffer.from(raw),pin=pinProgramPrivatePath(path);let temporary,fd,published=false;
 const checkParent=()=>{pin.assertFresh();const parent=fstatSync(pin.directory,{bigint:true});reportFileEnsure(parent.isDirectory()&&parent.uid===BigInt(process.getuid())&&(parent.mode&0o7777n)===0o700n,'PRIVATE_PARENT_REQUIRED');};
 const absent=()=>{checkParent();try{lstatSync(pin.target);throw Error('REPORT_OUTPUT_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}};
 try{
  absent();temporary='/proc/self/fd/'+pin.directory+'/.opengrail-report-'+randomUUID()+'.tmp';fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
  for(let offset=0;offset<bytes.length;){const count=writeSync(fd,bytes,offset,bytes.length-offset);reportFileEnsure(count>0,'REPORT_PUBLICATION_UNCERTAIN');offset+=count;}
  fsyncSync(fd);const written=fstatSync(fd,{bigint:true});reportFileEnsure(written.isFile()&&written.uid===BigInt(process.getuid())&&(written.mode&0o7777n)===0o600n&&written.nlink===1n&&written.size===BigInt(bytes.length),'REPORT_PUBLICATION_UNCERTAIN');closeSync(fd);fd=undefined;
  absent();const staged=lstatSync(temporary,{bigint:true});reportFileEnsure(staged.dev===written.dev&&staged.ino===written.ino&&staged.nlink===1n&&staged.size===written.size&&staged.mode===written.mode&&staged.uid===written.uid,'REPORT_PUBLICATION_UNCERTAIN');linkSync(temporary,pin.target);published=true;unlinkSync(temporary);temporary=undefined;fsyncSync(pin.directory);checkParent();const committed=lstatSync(pin.target,{bigint:true});reportFileEnsure(committed.dev===written.dev&&committed.ino===written.ino&&committed.nlink===1n&&committed.size===written.size,'REPORT_PUBLICATION_UNCERTAIN');
  const held=holdReportFile(path,maximum);try{reportFileEnsure(held.bytes.equals(bytes),'REPORT_PUBLICATION_UNCERTAIN');checkParent();return held;}catch(error){held.close();throw error;}
 }catch(error){if(published)throw Error('REPORT_PUBLICATION_UNCERTAIN');throw error;}
 finally{if(fd!==undefined)closeSync(fd);if(temporary)try{unlinkSync(temporary);}catch{}pin.close();}
}
export function reportNames(directory,allowed,required=[]){const names=readdirSync(directory).sort();reportFileEnsure(names.every(name=>allowed.includes(name))&&required.every(name=>names.includes(name)),'UNEXPECTED_OR_INCOMPLETE_REPORT_FILES');for(const name of names){const stat=lstatSync(join(directory,name),{bigint:true});reportFileEnsure(stat.uid===BigInt(process.getuid())&&(name==='original'?stat.isDirectory()&&(stat.mode&0o7777n)===0o700n:stat.isFile()&&stat.nlink===1n&&(stat.mode&0o7777n)===0o600n),'PRIVATE_COMPLETE_FILE_REQUIRED');}return names;}
