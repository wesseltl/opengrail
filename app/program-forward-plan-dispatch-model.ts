import {z} from 'zod';
import {programForwardPlanSchema,verifyProgramForwardPlan,type ProgramForwardPlan} from './program-forward-plan-model';
import {programDirectionForwardPlanSchema,verifyProgramDirectionForwardPlan,type ProgramDirectionForwardPlan} from './program-direction-forward-plan-model';

/** Pure strict nested-plan dispatch. Existing V1 canonical evidence is never converted. */
export const sharedProgramForwardPlanSchema=z.discriminatedUnion('version',[programForwardPlanSchema,programDirectionForwardPlanSchema]);
export type SharedProgramForwardPlan=ProgramForwardPlan|ProgramDirectionForwardPlan;

/** Only own data descriptors may select a larger local method-specific bound. */
export function programDirectionForwardPlanTag(raw:unknown):boolean{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const descriptors=Object.getOwnPropertyDescriptors(raw),version=descriptors.version,kind=descriptors.kind,method=descriptors.method;
 return !!version&&'value'in version&&version.value===2&&!!kind&&'value'in kind&&kind.value==='LOCAL_PROGRAM_DIRECTION_FORWARD_PLAN'&&!!method&&'value'in method&&method.value==='DIRECTION_MATCHED_TRAIN_RETURN_V1';
}

export async function verifySharedProgramForwardPlan(raw:unknown):Promise<SharedProgramForwardPlan>{
 // Each selected verifier runs its own full descriptor/schema/byte guard.
 // Inspecting these data descriptors invokes no supplied property getter.
 if(programDirectionForwardPlanTag(raw))return verifyProgramDirectionForwardPlan(raw);
 return verifyProgramForwardPlan(raw);
}
