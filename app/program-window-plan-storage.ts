import {z} from 'zod';
import {boundedProgramWindowValue,programWindowInputSchema,verifyProgramWindowInput,type ProgramWindowInput} from './program-window-model';
import {programWindowPlannerLimits} from './program-window-planner-model';
import {readProgramWindowLocalValue,compareAndSetProgramWindowLocalValue,ProgramWindowLocalStoreError} from './program-window-local-store';

export type ProgramWindowPlanOwner='ANONYMOUS'|`human_${string}`;
const rowSchema=z.object({version:z.literal(1),owner:z.union([z.literal('ANONYMOUS'),z.string().regex(/^human_[a-f0-9]{64}$/)]),input:programWindowInputSchema}).strict();
export type ProgramWindowPlanRow=z.infer<typeof rowSchema>;
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
async function verified(raw:unknown,owner:ProgramWindowPlanOwner):Promise<ProgramWindowPlanRow>{
 try{boundedProgramWindowValue(raw,programWindowPlannerLimits.fileBytes,44,programWindowPlannerLimits.nodes);const row=rowSchema.parse(raw);if(row.owner!==owner||!same(row,raw))throw Error();await verifyProgramWindowInput(row.input);return row;}catch{throw new ProgramWindowLocalStoreError('INVALID');}
}
export async function readProgramWindowPlan(owner:ProgramWindowPlanOwner,signal:AbortSignal):Promise<ProgramWindowPlanRow|null>{const raw=await readProgramWindowLocalValue('PLAN',owner,signal);if(raw===null)return null;const row=await verified(raw,owner);signal.throwIfAborted();return row;}
export async function saveProgramWindowPlan(owner:ProgramWindowPlanOwner,rawInput:unknown,expected:ProgramWindowPlanRow|null,signal:AbortSignal):Promise<ProgramWindowPlanRow>{
 const input:ProgramWindowInput=await verifyProgramWindowInput(rawInput),next=await verified({version:1,owner,input},owner),before=expected?await verified(expected,owner):null;
 if(before&&!same(before,next))throw new ProgramWindowLocalStoreError('CONFLICT');
 signal.throwIfAborted();await compareAndSetProgramWindowLocalValue('PLAN',owner,next,before,signal);signal.throwIfAborted();return next;
}
/** Explicit local abandonment only; original external journals/archives and
 * public records are separate and are never altered by removing this setup. */
export async function clearProgramWindowPlan(expected:ProgramWindowPlanRow,signal:AbortSignal):Promise<void>{boundedProgramWindowValue(expected,programWindowPlannerLimits.fileBytes,44,programWindowPlannerLimits.nodes);const row=await verified(expected,expected.owner as ProgramWindowPlanOwner);signal.throwIfAborted();await compareAndSetProgramWindowLocalValue('PLAN',row.owner,null,row,signal);}
