import {parseContributionJson,parseContributionPolicy,contributionPolicyVisibility} from './contribution-evidence-core.mjs';
import {withPrivateCredentialFile} from './contribution-private-credential.mjs';

export const githubReadLimits=Object.freeze({requests:32,responseBytes:1048576,totalBytes:4194304,requestMs:8000,totalMs:120000,jobs:16,pages:2});
export class ContributionReadError extends Error{
 constructor(code){super(code);this.name='ContributionReadError';this.code=code;}
}
export function makeGithubReader({fetch:fetcher=globalThis.fetch,signal,now=Date.now}={}){
 const began=now();let last=began,requests=0,bytes=0;
 function check(){const at=now();if(!Number.isSafeInteger(at)||at<last)throw new ContributionReadError('CLOCK_REGRESSION');last=at;if(signal?.aborted)throw new ContributionReadError('INTERRUPTED');if(at-began>githubReadLimits.totalMs)throw new ContributionReadError('READ_TIME_LIMIT');}
 async function get(path){
  check();if(typeof path!=='string'||path.length>512||!/^\/repos\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}(?:\/[^#\s]*)?$/.test(path)||path.includes('..')||path.includes('%')||path.includes('\\'))throw new ContributionReadError('INVALID_GITHUB_PATH');
  if(++requests>githubReadLimits.requests)throw new ContributionReadError('READ_REQUEST_LIMIT');
  const response=await fetcher('https://api.github.com'+path,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OpenGrail-read-only-contribution-evidence'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(githubReadLimits.requestMs)]):AbortSignal.timeout(githubReadLimits.requestMs)});
  check();if(!response||response.status!==200)throw new ContributionReadError(response?.status===403||response?.status===429?'GITHUB_RATE_OR_ACCESS_LIMIT':response?.status===404?'GITHUB_RESOURCE_UNAVAILABLE':'GITHUB_RESPONSE_UNAVAILABLE');
  if(!/^application\/(?:json|vnd\.github\+json)(?:\s*;.*)?$/i.test(response.headers.get('content-type')??''))throw new ContributionReadError('INVALID_GITHUB_CONTENT_TYPE');
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>githubReadLimits.responseBytes))throw new ContributionReadError('GITHUB_RESPONSE_BYTE_LIMIT');
  const reader=response.body?.getReader();if(!reader)throw new ContributionReadError('GITHUB_RESPONSE_UNAVAILABLE');let total=0;const parts=[];
  try{for(;;){const {value,done}=await reader.read();check();if(done)break;if(!(value instanceof Uint8Array))throw new ContributionReadError('INVALID_GITHUB_BODY');total+=value.byteLength;bytes+=value.byteLength;if(total>githubReadLimits.responseBytes||bytes>githubReadLimits.totalBytes)throw new ContributionReadError('GITHUB_RESPONSE_BYTE_LIMIT');parts.push(value);}}
  catch(error){try{await reader.cancel();}catch{}throw error;}finally{reader.releaseLock();}
  const content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
  return parseContributionJson(content,githubReadLimits.responseBytes);
 }
 return {get,check,statistics:()=>({requests,bytes})};
}

// Separate from the unchanged credential-free reader. The token remains in this
// trusted process's closure; callers receive only bounded GET and statistics.
export function makePrivateGithubReader(rawPolicy,credentialFile,{fetch:fetcher=globalThis.fetch,signal,now=Date.now,protectedDirectories=[]}={}){
 const policy=parseContributionPolicy(rawPolicy);
 if(contributionPolicyVisibility(policy)!=='PRIVATE')throw new ContributionReadError('PRIVATE_POLICY_REQUIRED');
 const resources=privateResources(policy);
 try{return withPrivateCredentialFile(credentialFile,protectedDirectories,token=>privateReader(policy,resources,token,{fetcher,signal,now}));}
 catch{throw new ContributionReadError('PRIVATE_CREDENTIAL_UNAVAILABLE');}
}
function canonicalPrivatePath(path){
 const url=new URL('https://api.github.com'+path);
 if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||url.pathname+url.search!==path)throw new ContributionReadError('PRIVATE_GITHUB_PATH_NOT_APPROVED');
 return path;
}
function privateResources(policy){
 const base='/repos/'+policy.target.repository.fullName,runPath=`${base}/actions/runs/${policy.target.runId}`;
 const allowed=new Set([base,`${base}/issues/${policy.target.issueNumber}`,`${base}/pulls/${policy.target.pullRequestNumber}`,`${base}/actions/workflows/${policy.trusted.workflowId}`,runPath,`${base}/git/commits/${policy.target.testedSha}`]);
 for(const ref of [policy.target.testedSha,policy.target.head.sha])for(const file of policy.trusted.files)allowed.add(`${base}/contents/${file.path}?ref=${ref}`);
 for(const path of allowed)canonicalPrivatePath(path);
 return {base,runPath,allowed};
}
function privateReader(policy,{base,runPath,allowed},token,{fetcher,signal,now}){
 const clock=()=>{try{const at=now();if(!Number.isSafeInteger(at))throw new Error();return at;}catch{throw new ContributionReadError('CLOCK_UNAVAILABLE');}};
 const began=clock();let last=began,requests=0,bytes=0,attempt=null;
 function check(){const at=clock();if(at<last)throw new ContributionReadError('CLOCK_REGRESSION');last=at;if(signal?.aborted)throw new ContributionReadError('INTERRUPTED');if(at-began>=githubReadLimits.totalMs)throw new ContributionReadError('READ_TIME_LIMIT');}
 const safeCodes=new Set(['CLOCK_UNAVAILABLE','CLOCK_REGRESSION','INTERRUPTED','READ_TIME_LIMIT','READ_REQUEST_LIMIT','PRIVATE_GITHUB_PATH_NOT_APPROVED','GITHUB_REQUEST_TIME_LIMIT','GITHUB_RESPONSE_UNAVAILABLE','PRIVATE_GITHUB_RESPONSE_CONTEXT_MISMATCH','GITHUB_RATE_OR_ACCESS_LIMIT','GITHUB_RESOURCE_UNAVAILABLE','INVALID_GITHUB_CONTENT_TYPE','GITHUB_RESPONSE_BYTE_LIMIT','INVALID_GITHUB_BODY','GITHUB_BODY_UNAVAILABLE','INVALID_GITHUB_JSON']);
 function abortable(promise,active){return new Promise((resolve,reject)=>{
  const stop=()=>reject(new ContributionReadError(signal?.aborted?'INTERRUPTED':'GITHUB_REQUEST_TIME_LIMIT'));
  if(active.aborted)stop();
  active.addEventListener('abort',stop,{once:true});
  Promise.resolve(promise).then(resolve,reject).finally(()=>active.removeEventListener('abort',stop));
 });}
 const discard=response=>{try{void response?.body?.cancel().catch(()=>{});}catch{}};
 async function get(path){try{return await read(path);}catch(error){throw new ContributionReadError(error instanceof ContributionReadError&&safeCodes.has(error.code)?error.code:'GITHUB_RESPONSE_UNAVAILABLE');}}
 async function read(path){
  check();
  if(typeof path!=='string'||!allowed.has(path))throw new ContributionReadError('PRIVATE_GITHUB_PATH_NOT_APPROVED');
  if(++requests>githubReadLimits.requests)throw new ContributionReadError('READ_REQUEST_LIMIT');
  const url='https://api.github.com'+path,timeout=AbortSignal.timeout(Math.min(githubReadLimits.requestMs,githubReadLimits.totalMs-(last-began))),active=signal?AbortSignal.any([signal,timeout]):timeout;
  let response;
  try{response=await abortable(fetcher(url,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OpenGrail-read-only-contribution-evidence',Authorization:'Bearer '+token},signal:active}),active);}
  catch(error){if(signal?.aborted)throw new ContributionReadError('INTERRUPTED');if(active.aborted)throw new ContributionReadError('GITHUB_REQUEST_TIME_LIMIT');throw new ContributionReadError('GITHUB_RESPONSE_UNAVAILABLE');}
  try{check();}catch(error){discard(response);throw error;}
  try{
   if(!response||response.redirected||response.url&&response.url!==url)throw new ContributionReadError('PRIVATE_GITHUB_RESPONSE_CONTEXT_MISMATCH');
   if(response.status!==200)throw new ContributionReadError(response.status===403||response.status===429?'GITHUB_RATE_OR_ACCESS_LIMIT':response.status===404?'GITHUB_RESOURCE_UNAVAILABLE':'GITHUB_RESPONSE_UNAVAILABLE');
   if(!/^application\/(?:json|vnd\.github\+json)(?:\s*;.*)?$/i.test(response.headers.get('content-type')??''))throw new ContributionReadError('INVALID_GITHUB_CONTENT_TYPE');
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>githubReadLimits.responseBytes))throw new ContributionReadError('GITHUB_RESPONSE_BYTE_LIMIT');
  }catch(error){discard(response);if(error instanceof ContributionReadError&&safeCodes.has(error.code))throw error;throw new ContributionReadError('GITHUB_RESPONSE_UNAVAILABLE');}
  let reader;
  try{reader=response.body?.getReader();}catch{throw new ContributionReadError('GITHUB_RESPONSE_UNAVAILABLE');}
  if(!reader)throw new ContributionReadError('GITHUB_RESPONSE_UNAVAILABLE');let total=0;const parts=[];
  try{for(;;){
   let chunk;try{chunk=await abortable(reader.read(),active);}catch{if(signal?.aborted)throw new ContributionReadError('INTERRUPTED');if(active.aborted)throw new ContributionReadError('GITHUB_REQUEST_TIME_LIMIT');throw new ContributionReadError('GITHUB_BODY_UNAVAILABLE');}
   check();const {value,done}=chunk;if(done)break;if(!(value instanceof Uint8Array))throw new ContributionReadError('INVALID_GITHUB_BODY');
   total+=value.byteLength;bytes+=value.byteLength;if(total>githubReadLimits.responseBytes||bytes>githubReadLimits.totalBytes)throw new ContributionReadError('GITHUB_RESPONSE_BYTE_LIMIT');parts.push(value);
  }}catch(error){try{void reader.cancel().catch(()=>{});}catch{}throw error;}finally{try{reader.releaseLock();}catch{}}
  let parsed;
  try{const content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));if(content.includes(token))throw new Error();parsed=parseContributionJson(content,githubReadLimits.responseBytes);}
  catch{throw new ContributionReadError('INVALID_GITHUB_JSON');}
  if(path===runPath&&attempt===null&&Number.isSafeInteger(parsed?.run_attempt)&&parsed.run_attempt>=1&&parsed.run_attempt<=1000){attempt=parsed.run_attempt;for(const page of [1,2])allowed.add(canonicalPrivatePath(`${base}/actions/runs/${policy.target.runId}/attempts/${attempt}/jobs?per_page=8&page=${page}`));}
  return parsed;
 }
 return {get,check,statistics:()=>({requests,bytes})};
}
