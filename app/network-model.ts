import {z} from 'zod';

export const networkLimits={requestBytes:8192,payloadBytes:4096,perUser:8,network:1000} as const;
const uuid=z.string().uuid().refine(value=>value===value.toLowerCase(),'Use a canonical lowercase UUID.');
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const clock=z.string().datetime().refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'Use a canonical UTC timestamp.');
const name=z.string().trim().min(1).max(48).regex(/^[^\u0000-\u001f\u007f]+$/);
export const networkCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),requestId:uuid,id:uuid,credentialId:uuid,name,tokenDigest:digest,days:z.union([z.literal(1),z.literal(7),z.literal(30)])}).strict(),
 z.object({action:z.literal('revoke'),requestId:uuid,id:uuid,revision:z.literal(1)}).strict(),
]);
export type NetworkCommand=z.infer<typeof networkCommandSchema>;
export const networkAgentSchema=z.object({
 id:uuid,credentialId:uuid,name,createdAt:clock,expiresAt:clock,revision:z.union([z.literal(1),z.literal(2)]),revokedAt:clock.nullable(),
 scope:z.literal('PUBLIC_RESEARCH_SUBMIT'),registrationRequestId:uuid,revocationRequestId:uuid.nullable(),
}).strict().superRefine((agent,ctx)=>{
 const issue=(path:string,message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,path:[path],message});
 const days=(Date.parse(agent.expiresAt)-Date.parse(agent.createdAt))/86400000;
 if(![1,7,30].includes(days))issue('expiresAt','Credential duration must be one, seven or thirty days.');
 if(agent.revision===1&&(agent.revokedAt!==null||agent.revocationRequestId!==null))issue('revision','Registration cannot include revocation.');
 if(agent.revision===2&&(agent.revokedAt===null||agent.revocationRequestId===null))issue('revision','Revocation requires its dated request identity.');
 if(agent.revokedAt!==null&&Date.parse(agent.revokedAt)<Date.parse(agent.createdAt))issue('revokedAt','Revocation cannot precede registration.');
 if(agent.registrationRequestId===agent.revocationRequestId)issue('revocationRequestId','A request cannot register and revoke an agent.');
});
export type NetworkAgent=z.infer<typeof networkAgentSchema>;
export const networkListSchema=z.object({version:z.literal(1),agents:z.array(networkAgentSchema).max(networkLimits.perUser),maximumPerUser:z.literal(networkLimits.perUser),maximumNetwork:z.literal(networkLimits.network),executionEnabled:z.literal(false)}).strict();
export const networkWriteSchema=z.object({version:z.literal(1),agent:networkAgentSchema,executionEnabled:z.literal(false)}).strict();
export class NetworkError extends Error{constructor(message:string,public status=409){super(message);}}
export async function networkDigest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');}

/** Generate in the sponsor's browser. Only tokenDigest belongs in an API command. */
export async function createNetworkToken(credentialId=crypto.randomUUID()){
 uuid.parse(credentialId);
 const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
 const token=`og_agent_${credentialId}.${secret}`;
 return {credentialId,token,tokenDigest:await networkDigest(token)};
}
export function boundedNetworkCommand(raw:unknown){
 const command=networkCommandSchema.parse(raw),payload=JSON.stringify(command);
 if(new TextEncoder().encode(payload).byteLength>networkLimits.requestBytes)throw new NetworkError('Agent command is too large.',413);
 return {command,payload};
}
export function boundedNetworkAgent(raw:unknown){
 const agent=networkAgentSchema.parse(raw),payload=JSON.stringify(agent);
 if(new TextEncoder().encode(payload).byteLength>networkLimits.payloadBytes)throw new NetworkError('Agent record is too large.',413);
 return {agent,payload};
}
