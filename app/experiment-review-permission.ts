import {z} from 'zod';
import {NetworkError} from './network-model';
import {parseUniqueJson} from './unique-json';

const reviewerIds=z.array(z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/)).max(16);

/** A separate server permission. Participation and moderation confer no grant. */
export function experimentReviewerAllowed(userId:string,configuration:unknown){
 if(configuration===undefined||configuration===null||configuration==='')return false;
 try{
  if(typeof configuration!=='string')throw Error();
  const ids=reviewerIds.parse(parseUniqueJson(configuration,4096,2));
  if(new Set(ids).size!==ids.length)throw Error();
  return ids.includes(userId);
 }catch{throw new NetworkError('Experiment review configuration unavailable.',503);}
}
