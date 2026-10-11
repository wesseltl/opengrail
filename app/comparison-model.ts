import {z} from 'zod';
import {demoAuditSchema,demoTradeSchema,demoEquitySchema,demoMetricsSchema,demoBenchmarkSchema,demoReasons,demoLimits,demoEvaluatorMethod} from './demo-model';
import {strategyDigest} from './strategy-model';
import {evaluatorSourceFingerprints} from './evaluator-fingerprints';

export const comparisonLimits={artifactBytes:demoLimits.artifactBytes,reportBytes:131072,differences:50,attempts:16} as const;
export const evaluatorComparisonPolicy=Object.freeze({version:'opengrail-comparison-v1' as const,absoluteTolerance:1e-8,relativeTolerance:1e-9,maximumDifferences:comparisonLimits.differences,ignoredFields:['audit[].details'] as const,exactNumericFields:['barIndex','entryBar','exitBar','gridLevel','openPositions','trades','wins','losses','initialCapital','allocationPct'] as const});
const hash=z.string().regex(/^[a-f0-9]{64}$/),nullableHash=hash.nullable(),finite=z.number().finite();
const status=z.enum(['COMPLETED','NO_TRADES','HALTED','REJECTED','FAILED']);
export const referenceResultSchema=z.object({status,reason:z.enum(demoReasons).nullable(),audit:z.array(demoAuditSchema.omit({details:true})).max(demoLimits.audit),trades:z.array(demoTradeSchema).max(demoLimits.trades),equity:z.array(demoEquitySchema).max(demoLimits.bars),metrics:demoMetricsSchema.nullable(),benchmark:demoBenchmarkSchema.nullable()}).strict();
const summary=z.object({status,reason:z.enum(demoReasons).nullable(),metrics:demoMetricsSchema.nullable(),benchmark:demoBenchmarkSchema.nullable()}).strict();
const difference=z.object({path:z.string().min(1).max(200),kind:z.enum(['VALUE','TYPE','LENGTH','MISSING']),left:z.union([finite,z.boolean(),z.null()]),right:z.union([finite,z.boolean(),z.null()])}).strict();
const pair=z.object({pair:z.enum(['CLAIM_PRIMARY','CLAIM_REFERENCE','PRIMARY_REFERENCE']),matches:z.boolean(),differenceCount:z.number().int().min(0).max(2000000),differences:z.array(difference).max(comparisonLimits.differences)}).strict().superRefine((v,c)=>{
 if(v.matches!==(v.differenceCount===0)||v.differences.length!==Math.min(v.differenceCount,comparisonLimits.differences))c.addIssue({code:z.ZodIssueCode.custom,message:'Comparison disposition must retain its bounded differences.'});
});
const reportBody=z.object({version:z.literal(1),kind:z.literal('LOCAL_EVALUATOR_COMPARISON'),classification:z.literal('AUTHOR_REPORTED'),qualification:z.literal('NONE'),independence:z.literal('NOT_ESTABLISHED'),ordersEnabled:z.literal(false),status:z.enum(['MATCH','MISMATCH','UNRECONSTRUCTIBLE','FAILED']),reason:z.enum(['MISSING_ACCEPTED_INPUT','EVALUATOR_FAILURE']).nullable(),identity:z.object({requestId:z.string().uuid().nullable(),claimedArtifact:hash,request:nullableHash,strategy:nullableHash,dataset:nullableHash,signals:nullableHash,declaredMethod:hash}).strict(),implementations:z.object({primary:z.object({version:z.literal('opengrail-demo-v1'),sourceSha256:hash}).strict(),reference:z.object({version:z.literal('opengrail-reference-v1'),sourceSha256:hash}).strict()}).strict(),policy:z.object({version:z.literal('opengrail-comparison-v1'),absoluteTolerance:z.literal(1e-8),relativeTolerance:z.literal(1e-9),maximumDifferences:z.literal(50),ignoredFields:z.tuple([z.literal('audit[].details')]),exactNumericFields:z.tuple([z.literal('barIndex'),z.literal('entryBar'),z.literal('exitBar'),z.literal('gridLevel'),z.literal('openPositions'),z.literal('trades'),z.literal('wins'),z.literal('losses'),z.literal('initialCapital'),z.literal('allocationPct')])}).strict(),sharedDependencies:z.tuple([z.literal('METHOD_SPECIFICATION'),z.literal('JAVASCRIPT_NUMBER_RUNTIME'),z.literal('INPUT_SCHEMAS_AND_HASHING'),z.literal('INPUT_DATA_AND_OPERATOR'),z.literal('REVIEW_OF_PRIMARY_SOURCE')]),summaries:z.object({claimed:summary,primary:summary.nullable(),reference:summary.nullable()}).strict(),pairs:z.array(pair).max(3)}).strict();
export const comparisonReportSchema=reportBody.extend({reportDigest:hash}).superRefine((r,c)=>{
 const evaluated=r.status==='MATCH'||r.status==='MISMATCH';
 if(evaluated&&(r.reason!==null||!r.summaries.primary||!r.summaries.reference||r.pairs.length!==3||r.pairs.some((p,n)=>p.pair!==['CLAIM_PRIMARY','CLAIM_REFERENCE','PRIMARY_REFERENCE'][n])||(r.status==='MATCH')!==r.pairs.every(p=>p.matches)))c.addIssue({code:z.ZodIssueCode.custom,message:'Complete comparison pairs required.'});
 if(!evaluated&&(r.pairs.length!==0||r.status==='UNRECONSTRUCTIBLE'&&r.reason!=='MISSING_ACCEPTED_INPUT'||r.status==='FAILED'&&r.reason!=='EVALUATOR_FAILURE'))c.addIssue({code:z.ZodIssueCode.custom,message:'Incomplete comparison cannot claim matched pairs.'});
 const accepted=[r.identity.strategy,r.identity.dataset,r.identity.signals];
 if(r.status==='UNRECONSTRUCTIBLE'&&(r.summaries.primary!==null||r.summaries.reference!==null||accepted.some(v=>v!==null)||r.summaries.claimed.status!=='REJECTED'))c.addIssue({code:z.ZodIssueCode.custom,message:'An unknown-input rejection has no evaluated input or rerun summaries.'});
 if(r.status!=='UNRECONSTRUCTIBLE'&&(r.identity.requestId===null||r.identity.request===null||accepted.some(v=>v===null)))c.addIssue({code:z.ZodIssueCode.custom,message:'Reconstructible reports require complete accepted-input identities.'});
});
export type ComparisonReport=z.infer<typeof comparisonReportSchema>;
export type ComparisonPair=z.infer<typeof pair>;
type Pair=ComparisonPair;

const numericExact=new Set<string>(evaluatorComparisonPolicy.exactNumericFields);
export function compareComparisonPair(pairName:Pair['pair'],left:unknown,right:unknown):Pair {
 let count=0;const differences:Pair['differences']=[];
 const display=(value:unknown)=>typeof value==='number'||typeof value==='boolean'?value:null;
 function different(path:string,kind:Pair['differences'][number]['kind'],a:unknown,b:unknown){count++;if(differences.length<comparisonLimits.differences)differences.push({path:path||'result',kind,left:display(a),right:display(b)});}
 function walk(a:unknown,b:unknown,path:string,key:string){
  if(typeof a==='number'&&typeof b==='number'){
   const equal=numericExact.has(key)?a===b:Math.abs(a-b)<=evaluatorComparisonPolicy.absoluteTolerance+evaluatorComparisonPolicy.relativeTolerance*Math.max(Math.abs(a),Math.abs(b));
   if(!equal)different(path,'VALUE',a,b);return;
  }
  if(a===b)return;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){different(path,typeof a===typeof b?'VALUE':'TYPE',a,b);return;}
  if(Array.isArray(a)||Array.isArray(b)){
   if(!Array.isArray(a)||!Array.isArray(b)){different(path,'TYPE',null,null);return;}
   if(a.length!==b.length)different(path+'.length','LENGTH',a.length,b.length);
   for(let n=0;n<Math.min(a.length,b.length);n++)walk(a[n],b[n],path+'['+n+']',key);return;
  }
  const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;
  for(const field of [...new Set([...Object.keys(aa),...Object.keys(bb)])].sort()){
   const next=path?path+'.'+field:field;
   if(!(field in aa)||!(field in bb))different(next,'MISSING',aa[field],bb[field]);else walk(aa[field],bb[field],next,field);
  }
 }
 walk(left,right,'','');return {pair:pairName,matches:count===0,differenceCount:count,differences};
}
export async function sealComparisonReport(body:unknown){const canonical=reportBody.parse(body),report=comparisonReportSchema.parse({...canonical,reportDigest:await strategyDigest(JSON.stringify(canonical))});if(new TextEncoder().encode(JSON.stringify(report)).byteLength>comparisonLimits.reportBytes)throw Error('Comparison report exceeds its bound.');return report;}
export async function verifyComparisonReport(raw:unknown){
 const report=comparisonReportSchema.parse(raw),{reportDigest,...body}=report;
 if(Object.values(evaluatorSourceFingerprints).some(hash=>/^0+$/.test(hash)))throw Error('Evaluator source identities are not prepared.');
 if(new TextEncoder().encode(JSON.stringify(report)).byteLength>comparisonLimits.reportBytes||await strategyDigest(JSON.stringify(body))!==reportDigest)throw Error('Comparison report integrity failed.');
 if(report.identity.declaredMethod!==await strategyDigest(JSON.stringify(demoEvaluatorMethod)))throw Error('Comparison declared method mismatch.');
 if(report.implementations.primary.sourceSha256!==evaluatorSourceFingerprints.primary||report.implementations.reference.sourceSha256!==evaluatorSourceFingerprints.reference)throw Error('Comparison source identity mismatch.');
 return report;
}
