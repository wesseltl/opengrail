import {strategyDigest} from './strategy-model';
import {verifyProgramSessionJournal,type ProgramSessionJournal} from './program-session-journal';
import {boundedProgramDirectionForwardValue,programDirectionForwardLimits,ProgramDirectionForwardError,verifyProgramDirectionForwardPlan,type ProgramDirectionForwardPlan} from './program-direction-forward-plan-model';

export * from './program-direction-forward-plan-model';

/** Local full history; plan and unchanged stateful guest/kernel journals stay separate. */
export type ProgramDirectionForwardHistory={version:2;kind:'LOCAL_PROGRAM_DIRECTION_FORWARD_HISTORY';method:'DIRECTION_MATCHED_TRAIN_RETURN_V1';plan:ProgramDirectionForwardPlan;journal:ProgramSessionJournal|null;historyDigest:string};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),digest=(value:unknown)=>strategyDigest(JSON.stringify(value));
function assert(ok:boolean,message:string):asserts ok{if(!ok)throw new ProgramDirectionForwardError(message);}
export async function createProgramDirectionForwardHistory(planRaw:unknown,journalRaw:unknown=null):Promise<ProgramDirectionForwardHistory>{
 const plan=await verifyProgramDirectionForwardPlan(planRaw),journal=journalRaw===null?null:await verifyProgramSessionJournal(journalRaw);
 assert(journal===null||same(journal.config,plan.config),'The journal must use the exact frozen direction-matched plan configuration.');
 assert(journal===null||same(journal.implementation,plan.implementation),'The journal must retain the frozen forward, interpreter and kernel source identities.');
 assert(journal===null||Date.parse(journal.startedAt)>=Date.parse(plan.startsAt)&&Date.parse(journal.startedAt)<Date.parse(plan.endsAt),'Session admission must start inside its frozen nominal interval; later protective events remain retained.');
 const value={version:2 as const,kind:'LOCAL_PROGRAM_DIRECTION_FORWARD_HISTORY' as const,method:'DIRECTION_MATCHED_TRAIN_RETURN_V1' as const,plan,journal},sealed={...value,historyDigest:await digest(value)};
 boundedProgramDirectionForwardValue(sealed,programDirectionForwardLimits.historyBytes);return sealed;
}
export async function verifyProgramDirectionForwardHistory(raw:unknown):Promise<ProgramDirectionForwardHistory>{
 boundedProgramDirectionForwardValue(raw,programDirectionForwardLimits.historyBytes);
 assert(!!raw&&typeof raw==='object'&&Object.keys(raw).sort().join(',')==='historyDigest,journal,kind,method,plan,version','Whole direction-matched program forward history is required.');
 const value=raw as ProgramDirectionForwardHistory;
 assert(value.version===2&&value.kind==='LOCAL_PROGRAM_DIRECTION_FORWARD_HISTORY'&&value.method==='DIRECTION_MATCHED_TRAIN_RETURN_V1','Unknown direction-matched program forward history.');
 const expected=await createProgramDirectionForwardHistory(value.plan,value.journal);assert(same(value,expected),'Direction-matched program history digest or original bindings changed.');return expected;
}
