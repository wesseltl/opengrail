import {AsyncLocalStorage} from 'node:async_hooks';

/** Server-only identity data. This shape carries no role or execution grant. */
export type HumanAuthIdentity={userId:string;displayName:string;email:string;fullName:string|null};
export type HumanAuthContext=
 | {kind:'SITES_DISPATCH';user:HumanAuthIdentity|null}
 | {kind:'SELF_HOSTED';currentUser:()=>Promise<HumanAuthIdentity|null>};

const contexts=new AsyncLocalStorage<Readonly<HumanAuthContext>>();
const limits={userId:256,email:320,displayName:512,fullName:512,headerBytes:8192} as const;
function data(value:unknown,keys:string[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('INVALID_HUMAN_AUTH_CONTEXT');
 if(Reflect.ownKeys(value).some(key=>typeof key!=='string'))throw Error('INVALID_HUMAN_AUTH_CONTEXT');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(descriptors).sort().join(',')!==[...keys].sort().join(',')||Object.values(descriptors).some(row=>!('value'in row)))throw Error('INVALID_HUMAN_AUTH_CONTEXT');
 return Object.fromEntries(Object.entries(descriptors).map(([key,row])=>[key,row.value]));
}
function text(value:unknown,maximum:number):value is string{return typeof value==='string'&&value.length>0&&value.length<=maximum&&!/[\u0000-\u001f\u007f]/.test(value);}
function identity(value:unknown):HumanAuthIdentity|null{
 if(value===null)return null;
 const row=data(value,['userId','displayName','email','fullName']);
 if(!text(row.userId,limits.userId)||!text(row.displayName,limits.displayName)||!text(row.email,limits.email)||row.fullName!==null&&!text(row.fullName,limits.fullName))throw Error('INVALID_HUMAN_AUTH_IDENTITY');
 return Object.freeze({userId:row.userId,displayName:row.displayName,email:row.email,fullName:row.fullName as string|null});
}

/** Only reviewed server entrypoints may establish this context. Never from request JSON. */
export function runWithHumanAuthContext<T>(context:HumanAuthContext,run:()=>T):T{
 const kind=Object.getOwnPropertyDescriptor(context,'kind');
 if(!kind||!('value'in kind))throw Error('INVALID_HUMAN_AUTH_CONTEXT');
 let trusted:Readonly<HumanAuthContext>;
 if(kind.value==='SITES_DISPATCH'){const row=data(context,['kind','user']);trusted=Object.freeze({kind:'SITES_DISPATCH',user:identity(row.user)});}
 else if(kind.value==='SELF_HOSTED'){const row=data(context,['kind','currentUser']);if(typeof row.currentUser!=='function')throw Error('INVALID_HUMAN_AUTH_CONTEXT');trusted=Object.freeze({kind:'SELF_HOSTED',currentUser:row.currentUser as ()=>Promise<HumanAuthIdentity|null>});}
 else throw Error('INVALID_HUMAN_AUTH_CONTEXT');
 return contexts.run(trusted,run);
}
export function getHumanAuthContext():Readonly<HumanAuthContext>|undefined{return contexts.getStore();}
/** Every standalone call refreshes session validity; verifier errors propagate closed. */
export async function currentHumanAuthIdentity():Promise<HumanAuthIdentity|null>{
 const context=getHumanAuthContext();if(!context)return null;
 return context.kind==='SITES_DISPATCH'?context.user:identity(await context.currentUser());
}

/** Parses the documented Sites dispatch snapshot, not proof of caller authenticity.
 * A direct public Worker needs its separately verified dispatcher boundary. */
export function sitesDispatchHumanContext(headers:Headers):HumanAuthContext{
 const names=['oai-authenticated-user-id','oai-authenticated-user-email','oai-authenticated-user-full-name','oai-authenticated-user-full-name-encoding'],values=names.map(name=>headers.get(name));
 if(values.some(value=>value!==null&&value.includes(','))||new TextEncoder().encode(values.map(value=>value??'').join('')).byteLength>limits.headerBytes)return {kind:'SITES_DISPATCH',user:null};
 const [userId,email,encodedFullName,encoding]=values;if(!text(userId,limits.userId)||!text(email,limits.email))return {kind:'SITES_DISPATCH',user:null};
 let fullName:string|null=null;
 if(encodedFullName&&encoding==='percent-encoded-utf-8'){try{const decoded=decodeURIComponent(encodedFullName);if(text(decoded,limits.fullName))fullName=decoded;}catch{}}
 return {kind:'SITES_DISPATCH',user:identity({userId,email,fullName,displayName:fullName??email})};
}
