import {timingSafeEqual} from 'node:crypto';
import {NetworkError,networkLimits,networkCommandSchema,networkListSchema,networkWriteSchema,networkDigest,boundedNetworkCommand,boundedNetworkAgent,type NetworkAgent,type NetworkCommand} from './network-model';

type Row={owner_id:string;id:string;credential_id:string;registration_request_id:string;registration_digest:string;token_digest:string;payload:string|null;digest:string;revision:number;created_at:string;expires_at:string;revoked_at:string|null;revocation_request_id:string|null};
type Checked={row:Row;agent:NetworkAgent;registration:Extract<NetworkCommand,{action:'register'}>};
export type NetworkPrincipal={ownerId:string;agentId:string;credentialId:string;name:string;registryDigest:string;tokenDigest:string;payload:string;expiresAt:string};
const columns=`owner_id,id,credential_id,registration_request_id,registration_digest,token_digest,CASE WHEN length(CAST(payload AS BLOB))<=${networkLimits.payloadBytes} THEN payload ELSE NULL END AS payload,digest,revision,created_at,expires_at,revoked_at,revocation_request_id`;
const hash=/^[a-f0-9]{64}$/;
const tokenPattern=/^og_agent_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([a-f0-9]{64})$/;
const invalid=()=>new NetworkError('Agent registry data is inconsistent. Retained records were preserved.',503);
function owner(user:string){if(typeof user!=='string'||!user||user.length>256||/[\u0000-\u001f\u007f]/.test(user))throw new NetworkError('Invalid sponsor identity.',400);}
function clock(at:string){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw new NetworkError('Invalid registration time.',400);}
const receipt=(agent:NetworkAgent)=>networkWriteSchema.parse({version:1,agent,executionEnabled:false});
const original=(agent:NetworkAgent):NetworkAgent=>({...agent,revision:1,revokedAt:null,revocationRequestId:null});

/** Public-network identities only. This database has no private Capital Desk state. */
export class NetworkRepository{
 constructor(private db:D1Database){}

 private async check(row:Row):Promise<Checked>{
  try{
   owner(row.owner_id);
   if(!row.payload||new TextEncoder().encode(row.payload).byteLength>networkLimits.payloadBytes||!hash.test(row.digest)||!hash.test(row.registration_digest)||!hash.test(row.token_digest))throw invalid();
   const {agent,payload}=boundedNetworkAgent(JSON.parse(row.payload));
   if(payload!==row.payload||await networkDigest(payload)!==row.digest||agent.id!==row.id||agent.credentialId!==row.credential_id||agent.registrationRequestId!==row.registration_request_id||agent.revision!==row.revision||agent.createdAt!==row.created_at||agent.expiresAt!==row.expires_at||agent.revokedAt!==row.revoked_at||agent.revocationRequestId!==row.revocation_request_id)throw invalid();
   const days=(Date.parse(agent.expiresAt)-Date.parse(agent.createdAt))/86400000;
   const registration=networkCommandSchema.parse({action:'register',requestId:agent.registrationRequestId,id:agent.id,credentialId:agent.credentialId,name:agent.name,tokenDigest:row.token_digest,days});
   if(registration.action!=='register'||await networkDigest(JSON.stringify(registration))!==row.registration_digest)throw invalid();
   return {row,agent,registration};
  }catch{throw invalid();}
 }

 private async snapshot(user:string){
  owner(user);
  const rows=(await this.db.prepare(`SELECT ${columns} FROM network_agents WHERE owner_id=? ORDER BY created_at,id LIMIT ${networkLimits.perUser+1}`).bind(user).all<Row>()).results;
  if(rows.length>networkLimits.perUser)throw invalid();
  const checked=await Promise.all(rows.map(row=>this.check(row))),requests=new Set<string>(),ids=new Set<string>(),credentials=new Set<string>();
  for(const value of checked){
   if(value.row.owner_id!==user||ids.has(value.agent.id)||credentials.has(value.agent.credentialId))throw invalid();
   ids.add(value.agent.id);credentials.add(value.agent.credentialId);
   for(const requestId of [value.agent.registrationRequestId,value.agent.revocationRequestId])if(requestId){if(requests.has(requestId))throw invalid();requests.add(requestId);}
  }
  return checked;
 }

 private replay(rows:Checked[],command:NetworkCommand,commandDigest:string){
  for(const value of rows){
   if(value.agent.registrationRequestId===command.requestId){
    if(command.action!=='register'||value.row.registration_digest!==commandDigest)throw new NetworkError('Request ID already used for a different agent command.');
    return receipt(original(value.agent));
   }
   if(value.agent.revocationRequestId===command.requestId){
    if(command.action!=='revoke'||command.id!==value.agent.id||command.revision!==1)throw new NetworkError('Request ID already used for a different agent command.');
    return receipt(value.agent);
   }
  }
  return null;
 }

 async list(user:string,at:string){
  clock(at);const agents=(await this.snapshot(user)).map(value=>value.agent);
  return networkListSchema.parse({version:1,agents,maximumPerUser:networkLimits.perUser,maximumNetwork:networkLimits.network,executionEnabled:false});
 }

 async write(user:string,raw:unknown,at:string){
  owner(user);clock(at);
  let parsed:ReturnType<typeof boundedNetworkCommand>;try{parsed=boundedNetworkCommand(raw);}catch(error){if(error instanceof NetworkError)throw error;throw new NetworkError('Invalid agent command.',400);}
  const {command,payload:commandPayload}=parsed,commandDigest=await networkDigest(commandPayload),snapshot=await this.snapshot(user),replay=this.replay(snapshot,command,commandDigest);
  if(replay)return replay;
  if(command.action==='register'){
   if(snapshot.length>=networkLimits.perUser)throw new NetworkError('This sponsor has reached the beta limit of eight retained registrations. Revocation does not remove a registration.');
   if(snapshot.some(value=>value.agent.id===command.id))throw new NetworkError('Agent ID already registered.');
   const {agent,payload}=boundedNetworkAgent({id:command.id,credentialId:command.credentialId,name:command.name,createdAt:at,expiresAt:new Date(Date.parse(at)+command.days*86400000).toISOString(),revision:1,revokedAt:null,scope:'PUBLIC_RESEARCH_SUBMIT',registrationRequestId:command.requestId,revocationRequestId:null});
   const digest=await networkDigest(payload);
   try{
    await this.db.prepare(`INSERT INTO network_agents(owner_id,id,credential_id,registration_request_id,registration_digest,token_digest,payload,digest,revision,created_at,expires_at,revoked_at,revocation_request_id)
     SELECT ?1,?2,?3,?4,?5,?6,?7,?8,1,?9,?10,NULL,NULL
     WHERE (SELECT COUNT(*) FROM network_agents WHERE owner_id=?1)<${networkLimits.perUser}
      AND (SELECT COUNT(*) FROM network_agents)<${networkLimits.network}
      AND NOT EXISTS(SELECT 1 FROM network_agents WHERE owner_id=?1 AND (registration_request_id=?4 OR revocation_request_id=?4))
     ON CONFLICT DO NOTHING`).bind(user,agent.id,agent.credentialId,command.requestId,commandDigest,command.tokenDigest,payload,digest,at,agent.expiresAt).run();
   }catch(error){const saved=this.replay(await this.snapshot(user),command,commandDigest);if(saved)return saved;throw error;}
  }else{
   const current=snapshot.find(value=>value.agent.id===command.id);
   if(!current)throw new NetworkError('Agent not found for this sponsor.',404);
   if(current.agent.revision!==1)throw new NetworkError('Agent already revoked. Refresh the registration list.');
   if(Date.parse(at)<Date.parse(current.agent.createdAt))throw new NetworkError('Revocation cannot precede registration.');
   const {agent,payload}=boundedNetworkAgent({...current.agent,revision:2,revokedAt:at,revocationRequestId:command.requestId}),digest=await networkDigest(payload);
   try{
    await this.db.prepare(`UPDATE network_agents SET payload=?1,digest=?2,revision=2,revoked_at=?3,revocation_request_id=?4
     WHERE owner_id=?5 AND id=?6 AND revision=1 AND digest=?7 AND payload=?8
      AND NOT EXISTS(SELECT 1 FROM network_agents WHERE owner_id=?5 AND (registration_request_id=?4 OR revocation_request_id=?4))`).bind(payload,digest,at,command.requestId,user,agent.id,current.row.digest,current.row.payload).run();
   }catch(error){const saved=this.replay(await this.snapshot(user),command,commandDigest);if(saved)return saved;throw error;}
  }
  const saved=this.replay(await this.snapshot(user),command,commandDigest);if(saved)return saved;
  throw new NetworkError('Registration changed, credential identity is unavailable, or beta capacity was reached. Refresh before continuing; no command was confirmed.');
 }

 /** Authentication proves a registered credential, not independently verified research. */
 async authenticate(token:string,at:string):Promise<NetworkPrincipal>{
  clock(at);
  if(typeof token!=='string'||token.length>128)throw new NetworkError('Invalid or expired agent credential.',401);
  const match=tokenPattern.exec(token);if(!match)throw new NetworkError('Invalid or expired agent credential.',401);
  const rows=(await this.db.prepare(`SELECT ${columns} FROM network_agents WHERE credential_id=? LIMIT 2`).bind(match[1]).all<Row>()).results;
  if(rows.length>1)throw invalid();
  const supplied=await networkDigest(token),expected=rows[0]?.token_digest;
  const suppliedBytes=Uint8Array.from(supplied.match(/../g)!,value=>parseInt(value,16)),expectedBytes=Uint8Array.from((expected&&hash.test(expected)?expected:'0'.repeat(64)).match(/../g)!,value=>parseInt(value,16));
  const matches=timingSafeEqual(suppliedBytes,expectedBytes);
  if(!rows.length||!matches)throw new NetworkError('Invalid or expired agent credential.',401);
  const checked=await this.check(rows[0]),agent=checked.agent;
  if(agent.revision!==1||agent.revokedAt!==null||Date.parse(at)<Date.parse(agent.createdAt)||Date.parse(at)>=Date.parse(agent.expiresAt))throw new NetworkError('Invalid or expired agent credential.',401);
  return {ownerId:checked.row.owner_id,agentId:agent.id,credentialId:agent.credentialId,name:agent.name,registryDigest:checked.row.digest,tokenDigest:checked.row.token_digest,payload:checked.row.payload!,expiresAt:agent.expiresAt};
 }
}
