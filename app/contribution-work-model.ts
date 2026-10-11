import {z} from 'zod';
import {contributionAuthorReferenceSchema,contributionClaimItemSchema,contributionTaskItemSchema,contributionLimits,ContributionError,validateContributionClaimItem,validateContributionTaskItem} from './contribution-model';
import {ventureCredentialLike} from './venture-model';

/** Read bounds only. Existing writers, quotas, leases and roles are unchanged. */
export const contributionWorkLimits={page:5,responseBytes:contributionLimits.responseBytes,maximumDepth:20,maximumNodes:32768,reconciliationAttempts:3} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase());
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

export const contributionWorkPageSchema=z.object({
 version:z.literal(1),scope:z.enum(['SPONSOR','AGENT']),participant:contributionAuthorReferenceSchema,checkedAt:clock,
 items:z.array(z.object({task:contributionTaskItemSchema,claim:contributionClaimItemSchema}).strict()).max(contributionWorkLimits.page),
 nextCursor:uuid.nullable(),executionEnabled:z.literal(false),
}).strict().superRefine((page,ctx)=>{
 const bad=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'Contribution work identity, scope, projection and pagination must agree.'});
 if(page.scope==='SPONSOR'?page.participant.kind!=='HUMAN':page.participant.kind!=='AGENT')bad();
 if(new Set(page.items.map(item=>item.claim.id)).size!==page.items.length)bad();
 const tasks=new Map<string,string>();
 for(let index=0;index<page.items.length;index++){
  const {task,claim}=page.items[index],previous=page.items[index-1]?.claim;
  const retained=tasks.get(task.id),snapshot=JSON.stringify(task);if(retained!==undefined&&retained!==snapshot)bad();tasks.set(task.id,snapshot);
  if(!same(claim.task,{id:task.id,digest:task.digest})||claim.taskState!==task.state||claim.checkedAt!==page.checkedAt||task.createdAt>claim.createdAt||claim.createdAt>page.checkedAt)bad();
  if(page.scope==='SPONSOR'?claim.author.sponsorId!==page.participant.id:!same(claim.author,page.participant))bad();
  if(previous&&(claim.createdAt>previous.createdAt||claim.createdAt===previous.createdAt&&claim.id>=previous.id))bad();
 }
 if(page.nextCursor!==null&&(page.items.length!==contributionWorkLimits.page||page.nextCursor!==page.items.at(-1)?.claim.id))bad();
});
export type ContributionWorkPage=z.infer<typeof contributionWorkPageSchema>;

function inspect(raw:unknown){
 let nodes=0;const active=new Set<object>();
 function walk(value:unknown,depth:number){
  if(++nodes>contributionWorkLimits.maximumNodes||depth>contributionWorkLimits.maximumDepth)throw new ContributionError('Contribution work structure exceeds its bound.',400);
  if(typeof value==='string'){if(ventureCredentialLike(value))throw new ContributionError('Credentials cannot enter contribution work material.',400);return;}
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(!value||typeof value!=='object'||active.has(value)||Object.getOwnPropertySymbols(value).length)throw new ContributionError('Contribution work material must be plain finite JSON.',400);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new ContributionError('Contribution work material must be plain JSON.',400);
  if(array&&Object.keys(descriptors).length!==(value as unknown[]).length+1)throw new ContributionError('Contribution work arrays must be complete.',400);
  active.add(value);
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(array&&key==='length')continue;
   if(ventureCredentialLike(key)||!('value'in descriptor)||!descriptor.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw new ContributionError('Contribution work hooks and hidden fields are refused.',400);
   walk(descriptor.value,depth+1);
  }
  active.delete(value);
 }
 walk(raw,0);
}

/** Synchronous structure/canonical bounds only; digests need the validator. */
export function parseContributionWorkPage(raw:unknown):ContributionWorkPage{
 inspect(raw);
 const original=JSON.stringify(raw);
 if(new TextEncoder().encode(original).byteLength>contributionWorkLimits.responseBytes)throw new ContributionError('Contribution work response exceeds its byte bound.',413);
 let page:ContributionWorkPage;
 try{page=contributionWorkPageSchema.parse(raw);}catch{throw new ContributionError('Invalid contribution work projection.',400);}
 if(original!==JSON.stringify(page))throw new ContributionError('Contribution work material must already be canonical.',400);
 return page;
}

/** Content identity is checked; this grants no merge, reputation or execution. */
export async function validateContributionWorkPage(raw:unknown):Promise<ContributionWorkPage>{
 const page=parseContributionWorkPage(raw);
 for(const item of page.items){await validateContributionTaskItem(item.task);await validateContributionClaimItem(item.claim);}
 return page;
}
