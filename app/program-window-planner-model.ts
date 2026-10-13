import {z} from 'zod';
import {demoTimeframes} from './demo-model';
import {verifyLockedProgramSearchHandoff,createProgramForwardPlan,type LockedProgramSearchHandoff} from './program-forward-plan';
import {verifyLockedProgramDirectionSearchHandoff,createProgramDirectionForwardPlan,type LockedProgramDirectionSearchHandoff} from './program-direction-forward-plan-model';
import {verifySharedProgramForwardPlan,type SharedProgramForwardPlan} from './program-forward-plan-dispatch-model';
import {strategyRecordV2Schema} from './strategy-model';
import {programSessionVersion,type ProgramSessionConfig} from './program-session-model';
import {
 ProgramWindowError,boundedProgramWindowValue,verifyProgramWindowInput,
 createProgramWindowInput,deriveProgramWindowSchedule,programWindowImplementationDeclarationSchema,
 programWindowImplementationDeclarationStatus,programWindowRightsDeclarationSchema,
 type ProgramWindowInput,type ProgramWindowImplementationDeclaration,
} from './program-window-model';

/** Browser capacity is a fitting complete file, never a trimmed Search ledger. */
export const programWindowPlannerLimits=Object.freeze({fileBytes:8388608,depth:44,nodes:1250000,minimumLeadMs:60000});
export type ProgramWindowPlannerHandoff=LockedProgramSearchHandoff|LockedProgramDirectionSearchHandoff;
export type ProgramWindowPlannerImport=
 |{kind:'HANDOFF';handoff:ProgramWindowPlannerHandoff}
 |{kind:'PLAN';plan:SharedProgramForwardPlan}
 |{kind:'WINDOW';input:ProgramWindowInput};
const clock=z.string().datetime().refine(value=>Number.isSafeInteger(Date.parse(value))&&new Date(value).toISOString()===value);
const optionsSchema=z.object({
 sessionId:z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),
 preparedAt:clock,startsAt:clock,endsAt:clock,pollMs:z.number().int().min(60000).max(3600000),cycles:z.number().int().min(3).max(120),
 warmupBars:z.number().int().min(0).max(299),sourceMode:z.enum(['PUBLIC_HTTP','SYNTHETIC_RESPONSES']),
 rights:programWindowRightsDeclarationSchema,newImplementation:programWindowImplementationDeclarationSchema,
}).strict();
export type ProgramWindowPlannerOptions=z.infer<typeof optionsSchema>;
const envelopeOptions=optionsSchema.omit({sessionId:true,startsAt:true,endsAt:true,pollMs:true,cycles:true});
function assert(value:boolean,message:string):asserts value{if(!value)throw new ProgramWindowError(message);}
function bounded(raw:unknown){return boundedProgramWindowValue(raw,programWindowPlannerLimits.fileBytes,programWindowPlannerLimits.depth,programWindowPlannerLimits.nodes);}

/** A fitting import remains a whole original record; synthetic playback plans
 * are never converted into prospective real-receipt plans. No guest runs. */
export async function verifyProgramWindowPlannerImport(raw:unknown):Promise<ProgramWindowPlannerImport>{
 bounded(raw);const value=raw as {kind?:unknown};
 if(value?.kind==='LOCKED_PROGRAM_SEARCH_HANDOFF')return {kind:'HANDOFF',handoff:await verifyLockedProgramSearchHandoff(raw)};
 if(value?.kind==='LOCKED_PROGRAM_DIRECTION_SEARCH_HANDOFF')return {kind:'HANDOFF',handoff:await verifyLockedProgramDirectionSearchHandoff(raw)};
 if(value?.kind==='LOCAL_PROGRAM_FORWARD_PLAN'||value?.kind==='LOCAL_PROGRAM_DIRECTION_FORWARD_PLAN')return {kind:'PLAN',plan:await verifySharedProgramForwardPlan(raw)};
 if(value?.kind==='PROGRAM_FORWARD_WINDOW_INPUT')return {kind:'WINDOW',input:await verifyProgramWindowInput(raw)};
 throw new ProgramWindowError('Import the complete locked program Search handoff, unchanged forward plan or sampled-window input.');
}
export async function verifyProgramWindowPlannerImplementation(raw:unknown):Promise<ProgramWindowImplementationDeclaration>{
 boundedProgramWindowValue(raw,8192,8,256);let value:ProgramWindowImplementationDeclaration;
 try{value=programWindowImplementationDeclarationSchema.parse(raw);}catch{throw new ProgramWindowError('Import the complete six-component controller fingerprint declaration.');}
 assert(JSON.stringify(value)===JSON.stringify(raw),'Original canonical fingerprint fields are required.');
 assert(programWindowImplementationDeclarationStatus(value)==='AUTHOR_DECLARED_ONLY','Every controller component needs its declared physical source hash before this setup can freeze.');return value;
}
function parsedOptions(raw:unknown){bounded(raw);let value:ProgramWindowPlannerOptions;try{value=optionsSchema.parse(raw);}catch{throw new ProgramWindowError('Window setup fields do not match the bounded declared protocol.');}assert(JSON.stringify(raw)===JSON.stringify(value),'Canonical complete setup fields are required.');return value;}
function prospectiveLead(preparedAt:string,startsAt:string){assert(Date.parse(startsAt)-Date.parse(preparedAt)>=programWindowPlannerLimits.minimumLeadMs,'At least 60 seconds must remain before the declared start; publication checks may require additional lead.');}

/** New caller-selected plan, preserving the complete locked Search winner,
 * capital, costs, risk and method. Never alters an already frozen old plan. */
export async function createProgramWindowPlannerInput(rawHandoff:unknown,rawOptions:unknown):Promise<ProgramWindowInput>{
 const imported=await verifyProgramWindowPlannerImport(rawHandoff);assert(imported.kind==='HANDOFF','Create a fresh plan only from the whole locked Search handoff.');
 const options=parsedOptions(rawOptions);prospectiveLead(options.preparedAt,options.startsAt);await verifyProgramWindowPlannerImplementation(options.newImplementation);
 const record=strategyRecordV2Schema.parse(imported.handoff.winner.source.record);
 const config:ProgramSessionConfig={version:1,kind:'LOCAL_PROGRAM_SESSION_CONFIG',sessionId:options.sessionId,methodVersion:programSessionVersion,
  clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record,digest:imported.handoff.winner.source.digest},
  initialCapital:imported.handoff.initialCapital,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:options.rights.note},
  sourceLabel:options.sourceMode==='SYNTHETIC_RESPONSES'?'Declared synthetic sampled Demo observations':'Declared authorized sampled market snapshots',ordersEnabled:false,liveEnabled:false};
 const planOptions={mode:'PROSPECTIVE' as const,handoff:imported.handoff,config,preparedAt:options.preparedAt,startsAt:options.startsAt,endsAt:options.endsAt,pollMs:options.pollMs,cycles:options.cycles};
 const plan=imported.handoff.version===2?await createProgramDirectionForwardPlan(planOptions):await createProgramForwardPlan(planOptions);
 const input=await createProgramWindowInput({plan,preparedAt:options.preparedAt,warmupBars:options.warmupBars,sourceMode:options.sourceMode,rights:options.rights,newImplementation:options.newImplementation,declaration:null});
 bounded(input);return input;
}
export async function createProgramWindowEnvelopeFromPlan(rawPlan:unknown,rawOptions:unknown):Promise<ProgramWindowInput>{
 bounded(rawPlan);bounded(rawOptions);let options:z.infer<typeof envelopeOptions>;
 try{options=envelopeOptions.parse(rawOptions);}catch{throw new ProgramWindowError('Use complete explicit protocol fields for the unchanged plan.');}
 assert(JSON.stringify(rawOptions)===JSON.stringify(options),'Original canonical envelope fields are required.');
 const plan=await verifySharedProgramForwardPlan(rawPlan);prospectiveLead(options.preparedAt,plan.startsAt);await verifyProgramWindowPlannerImplementation(options.newImplementation);
 const input=await createProgramWindowInput({plan,...options,declaration:null});bounded(input);return input;
}
/** Read-only feasibility includes actual old poll/cycle settings. Failures are
 * displayed before freezing; no silently adjusted interval or capacity. */
export async function inspectProgramWindowPlanFeasibility(rawPlan:unknown,warmupBars:number){bounded(rawPlan);return deriveProgramWindowSchedule(rawPlan,warmupBars);}
export function programWindowPlannerDefaults(timeframe:keyof typeof demoTimeframes,now:string){
 clock.parse(now);const duration=demoTimeframes[timeframe];assert(Number.isSafeInteger(duration)&&duration>0,'Unknown source timeframe.');
 const startsAt=new Date(Math.ceil((Date.parse(now)+300000)/duration)*duration).toISOString(),endsAt=new Date(Date.parse(startsAt)+2*duration).toISOString();
 const horizon=2*duration;let pollMs=60000;while(pollMs<=3600000&&(horizon%pollMs!==0||horizon/pollMs>118))pollMs+=60000;
 assert(pollMs<=3600000,'This proposed horizon does not fit the unchanged cycle/poll capacity.');
 return {startsAt,endsAt,pollMs,cycles:horizon/pollMs+2,warmupBars:0};
}
