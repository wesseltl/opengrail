import {z} from 'zod';
import {strategyDigest} from './strategy-model';
import {guardProgramData,programHash,programUuid,programRunMethod,programRunStatuses,programRunReasons,programImplementationSchema,type ProgramRunOutcome} from './program-run-model';
import {validateProgramRunOutcome} from './program-evidence';
import {programSourceFingerprints} from './program-fingerprints';

/** Compact computational claims. Full submitted and reconstructed outcomes remain
 * separately retained; hashes do not establish execution or an independent process. */
export const programComparisonLimits=Object.freeze({reportBytes:131072,differences:50,maximumNodes:2000000});
const finite=z.number().finite(),nullableHash=programHash.nullable();
const implementation=programImplementationSchema;
const summary=z.object({status:z.enum(programRunStatuses),reason:z.enum(programRunReasons),configureCount:z.number().int().min(0).max(16),traceCount:z.number().int().min(0).max(2000),signalCount:z.number().int().min(0).max(500),totalFuel:z.number().int().min(0).max(programRunMethod.totalFuel),stateDigest:nullableHash,artifactDigest:nullableHash,tradingComparisonDigest:nullableHash}).strict();
const difference=z.object({path:z.string().min(1).max(240).regex(/^[A-Za-z][A-Za-z0-9]*(?:(?:\.[A-Za-z][A-Za-z0-9]*)|(?:\[(?:0|[1-9]\d*)\]))*$/),kind:z.enum(['VALUE','TYPE','LENGTH','MISSING']),left:z.union([finite,z.boolean(),z.null()]),right:z.union([finite,z.boolean(),z.null()]),leftDigest:nullableHash,rightDigest:nullableHash}).strict();
const comparison=z.object({matches:z.boolean(),differenceCount:z.number().int().min(0).max(programComparisonLimits.maximumNodes),differences:z.array(difference).max(programComparisonLimits.differences)}).strict().superRefine((value,ctx)=>{
 if(value.matches!==(value.differenceCount===0)||value.differences.length!==Math.min(value.differenceCount,programComparisonLimits.differences)||new Set(value.differences.map(d=>d.path)).size!==value.differences.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Program comparison must retain unique bounded differences and the complete count.'});
});
const body=z.object({version:z.literal(1),kind:z.literal('LOCAL_PROGRAM_COMPARISON'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),generator:z.literal('SAME_IMPLEMENTATION_RECONSTRUCTION'),ordersEnabled:z.literal(false),status:z.enum(['MATCH','MISMATCH','UNSUPPORTED','INTERRUPTED']),reason:z.enum(['MISSING_ACCEPTED_INPUT','RETAINED_INTERRUPTION','RECONSTRUCTION_FAILED','USER_CANCELLED']).nullable(),identity:z.object({attemptId:programUuid,requestId:programUuid.nullable(),claimedOutcome:programHash,input:nullableHash,source:nullableHash,module:nullableHash,dataset:nullableHash,method:programHash}).strict(),implementations:implementation,claimed:summary,reconstructed:summary.nullable(),reconstructedOutcomeDigest:nullableHash,comparison:comparison.nullable()}).strict();
export const programComparisonReportSchema=body.extend({reportDigest:programHash}).superRefine((value,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if((value.reconstructed===null)!==(value.reconstructedOutcomeDigest===null))bad('Reconstructed identity requires its retained summary.');
 const complete=value.status==='MATCH'||value.status==='MISMATCH';
 if(complete&&['CANCELLED','INTERRUPTED'].includes(value.claimed.status))bad('An interrupted retained claim cannot become a complete computational comparison.');
 if(complete&&(value.reason!==null||!value.comparison||!value.reconstructed||value.identity.input===null||value.identity.requestId===null))bad('A complete program comparison requires an accepted input and reconstructed result.');
 if(complete&&((value.status==='MATCH')!==value.comparison?.matches||(value.status==='MATCH')!==(value.identity.claimedOutcome===value.reconstructedOutcomeDigest)))bad('Exact program matching must agree with complete outcome identities.');
 if(!complete&&value.comparison!==null)bad('An incomplete comparison cannot claim evaluated differences.');
 if(value.status==='UNSUPPORTED'&&(!['MISSING_ACCEPTED_INPUT','RECONSTRUCTION_FAILED'].includes(value.reason??'')||value.reconstructed!==null))bad('Unsupported reconstruction requires an explicit unavailable disposition.');
 if(value.status==='INTERRUPTED'&&!['RETAINED_INTERRUPTION','USER_CANCELLED'].includes(value.reason??''))bad('Interruption requires its explicit disposition.');
 if(value.reason==='MISSING_ACCEPTED_INPUT'&&(value.identity.requestId!==null||value.identity.source!==null||value.identity.module!==null||value.identity.dataset!==null||value.claimed.status!=='REJECTED'))bad('Unknown-input reconstruction cannot claim accepted work.');
 if(value.reason==='RETAINED_INTERRUPTION'&&(!['CANCELLED','INTERRUPTED'].includes(value.claimed.status)||value.reconstructed!==null))bad('Retained interrupted work is never rerun as completed evidence.');
});
export type ProgramComparisonReport=z.infer<typeof programComparisonReportSchema>;
export type ProgramComparisonDifference=z.infer<typeof difference>;
export const programComparisonSame=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
/** Distinct actual operators retain their own attempt identity; deterministic
 * semantics for one exact frozen input must otherwise agree before a positive pair. */
export function programOutcomesSemanticallyEqual(left:ProgramRunOutcome,right:ProgramRunOutcome){const {attemptId:_left,outcomeDigest:_leftDigest,...a}=left,{attemptId:_right,outcomeDigest:_rightDigest,...b}=right;void _left;void _leftDigest;void _right;void _rightDigest;return programComparisonSame(a,b);}
export function programOutcomeComparisonSummary(outcome:ProgramRunOutcome){return summary.parse({status:outcome.status,reason:outcome.reason,configureCount:outcome.configure.length,traceCount:outcome.trace.length,signalCount:outcome.signals.length,totalFuel:outcome.totalFuel,stateDigest:outcome.stateDigest,artifactDigest:outcome.artifact?.resultDigest??null,tradingComparisonDigest:outcome.comparison?.reportDigest??null});}
export function programOutcomeComparisonIdentity(outcome:ProgramRunOutcome){return {attemptId:outcome.attemptId,requestId:outcome.input?.requestId??null,claimedOutcome:outcome.outcomeDigest,input:outcome.inputDigest,source:outcome.digests.source,module:outcome.digests.module,dataset:outcome.digests.dataset,method:outcome.digests.method};}
const displayed=(value:unknown)=>typeof value==='number'||typeof value==='boolean'?value:null;
export async function programComparisonOperandDigest(value:unknown):Promise<string|null>{return value===undefined?null:strategyDigest(JSON.stringify(value));}

/** Exact semantic comparison, including fuel and state bits. Only the enclosing
 * self-hash is derived rather than compared; the full outcome hashes must agree. */
export async function compareProgramOutcomeValues(left:ProgramRunOutcome,right:ProgramRunOutcome){
 const {outcomeDigest:_left,...a}=left,{outcomeDigest:_right,...b}=right;void _left;void _right;
 const pending:Array<{path:string;kind:ProgramComparisonDifference['kind'];left:unknown;right:unknown}>=[];let differenceCount=0,nodes=0;
 function differ(path:string,kind:ProgramComparisonDifference['kind'],l:unknown,r:unknown){differenceCount++;if(pending.length<programComparisonLimits.differences)pending.push({path,kind,left:l,right:r});}
 function walk(l:unknown,r:unknown,path:string){
  if(++nodes>programComparisonLimits.maximumNodes)throw Error('Program comparison exceeds its traversal limit.');
  if(l===r)return;
  if(l===null||r===null||typeof l!=='object'||typeof r!=='object'){differ(path,typeof l===typeof r?'VALUE':'TYPE',l,r);return;}
  if(Array.isArray(l)||Array.isArray(r)){
   if(!Array.isArray(l)||!Array.isArray(r)){differ(path,'TYPE',l,r);return;}
   if(l.length!==r.length)differ(path+'.length','LENGTH',l.length,r.length);
   for(let n=0;n<Math.min(l.length,r.length);n++)walk(l[n],r[n],path+'['+n+']');return;
  }
  const aa=l as Record<string,unknown>,bb=r as Record<string,unknown>;
  const priority=['configure','trace','signals','totalFuel','state','stateDigest','status','reason','demoRequest','artifact','comparison'];
  const order=(key:string)=>priority.includes(key)?priority.indexOf(key):priority.length;
  const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
  const keys=[...new Set([...Object.keys(aa),...Object.keys(bb)])].sort((a,b)=>path?lexical(a,b):order(a)-order(b)||lexical(a,b));
  for(const key of keys){
   const next=path?path+'.'+key:key;
   if(!Object.hasOwn(aa,key)||!Object.hasOwn(bb,key))differ(next,'MISSING',aa[key],bb[key]);else walk(aa[key],bb[key],next);
  }
 }
 walk(a,b,'');
 const differences=await Promise.all(pending.map(async row=>({path:row.path,kind:row.kind,left:displayed(row.left),right:displayed(row.right),leftDigest:await programComparisonOperandDigest(row.left),rightDigest:await programComparisonOperandDigest(row.right)})));
 return comparison.parse({matches:differenceCount===0,differenceCount,differences});
}
export async function sealProgramComparisonReport(raw:unknown):Promise<ProgramComparisonReport>{
 guardProgramData(raw,programComparisonLimits.reportBytes);const canonical=body.parse(raw),report=programComparisonReportSchema.parse({...canonical,reportDigest:await strategyDigest(JSON.stringify(canonical))});guardProgramData(report,programComparisonLimits.reportBytes);return report;
}
/** Pure identity checks. No guest invocation, trading evaluation or authority. */
export async function verifyProgramComparisonReport(raw:unknown):Promise<ProgramComparisonReport>{
 guardProgramData(raw,programComparisonLimits.reportBytes);const report=programComparisonReportSchema.parse(raw),{reportDigest,...canonical}=report;
 if(await strategyDigest(JSON.stringify(canonical))!==reportDigest||!programComparisonSame(report.implementations,programSourceFingerprints)||report.identity.method!==await strategyDigest(JSON.stringify(programRunMethod)))throw Error('Program comparison identity differs.');
 return report;
}
function operand(root:unknown,path:string){
 const parts=path.match(/^[A-Za-z][A-Za-z0-9]*|\.[A-Za-z][A-Za-z0-9]*|\[(?:0|[1-9]\d*)\]/g);
 if(!parts||parts.join('')!==path||!['configure','trace','signals','totalFuel','state','stateDigest','status','reason','demoRequest','artifact','comparison'].includes(parts[0]))throw Error('Program difference must name retained semantic evidence.');
 let value=root;
 for(const part of parts){const key=part.startsWith('.')?part.slice(1):part.startsWith('[')?part.slice(1,-1):part;if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))return undefined;value=(value as Record<string,unknown>)[key];}
 return value;
}
/** Bind claims and available operands, without treating self-hashed reconstructed
 * summaries as execution proof. A trusted reviewer separately attests the process. */
export async function bindProgramComparisonReport(raw:unknown,claimRaw:unknown):Promise<ProgramComparisonReport>{
 const report=await verifyProgramComparisonReport(raw),claim=await validateProgramRunOutcome(claimRaw);
 if(!programComparisonSame(report.identity,programOutcomeComparisonIdentity(claim))||!programComparisonSame(report.claimed,programOutcomeComparisonSummary(claim))||!programComparisonSame(report.implementations,claim.implementations))throw Error('Program comparison does not bind the exact retained outcome.');
 if(report.status==='MATCH'&&!programComparisonSame(report.claimed,report.reconstructed))throw Error('Matching reconstruction summaries contradict retained evidence.');
 if(report.status==='MISMATCH'&&report.reconstructed&&programComparisonSame(report.claimed,report.reconstructed)&&report.comparison?.differenceCount===0)throw Error('A dispute requires an actual retained difference.');
 const summaryPaths={'status':'status','reason':'reason','totalFuel':'totalFuel','stateDigest':'stateDigest','configure.length':'configureCount','trace.length':'traceCount','signals.length':'signalCount','artifact.resultDigest':'artifactDigest','comparison.reportDigest':'tradingComparisonDigest'} as const;
 if(report.comparison&&report.reconstructed){const minimalDifferences=Object.keys(report.claimed).filter(key=>!programComparisonSame(report.claimed[key as keyof typeof report.claimed],report.reconstructed![key as keyof typeof report.claimed])).length;if(report.comparison.differenceCount<minimalDifferences)throw Error('Program comparison omits differences visible in its retained summaries.');}
 for(const row of report.comparison?.differences??[]){
  const value=operand(claim,row.path);
  if(value===undefined&&row.kind!=='MISSING'||row.kind==='LENGTH'&&!row.path.endsWith('.length')||row.left!==displayed(value)||row.leftDigest!==await programComparisonOperandDigest(value))throw Error('Program difference claim operands differ.');
  if(row.leftDigest===row.rightDigest)throw Error('A reported difference cannot retain identical operands.');
  if(report.reconstructed&&Object.hasOwn(summaryPaths,row.path)){const key=summaryPaths[row.path as keyof typeof summaryPaths],right=report.reconstructed[key];if(row.right!==displayed(right)||row.rightDigest!==await programComparisonOperandDigest(right))throw Error('Program difference contradicts its retained reconstructed summary.');}
 }
 return report;
}
