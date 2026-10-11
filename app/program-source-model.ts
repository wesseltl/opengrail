import {z} from 'zod';
import {parseProgramModule} from './program-wasm';

export const programProfile='opengrail-wasm-i32-f64-v1' as const;
export const programAbi='opengrail-causal-signal-wasm-v1' as const;
export const programSourceLimits={moduleBytes:4096,parameters:16,parameterMagnitude:1e12} as const;
/** Bounded canonical binary data. This conversion never compiles or executes guest bytes. */
export function programSourceBytes(bytesHex:string):Uint8Array<ArrayBuffer>{
 if(typeof bytesHex!=='string'||bytesHex.length<16||bytesHex.length>programSourceLimits.moduleBytes*2||!/^([a-f0-9]{2})+$/.test(bytesHex))throw new ProgramSourceError('The program must use bounded canonical lowercase binary hex.');
 const bytes=new Uint8Array(bytesHex.length/2);for(let n=0;n<bytes.length;n++)bytes[n]=Number.parseInt(bytesHex.slice(n*2,n*2+2),16);return bytes;
}
function hasRecognizableCredentials(bytes:Uint8Array):boolean{
 let text=new TextDecoder().decode(bytes);
 for(let n=0;n<32;n++){if(/og_(?:agent|local_owner|local_producer)_/i.test(text))return true;const decoded=text.replace(/%[a-f0-9]{2}/gi,escape=>String.fromCharCode(Number.parseInt(escape.slice(1),16)));if(decoded===text)return false;text=decoded;}
 throw new ProgramSourceError('Program byte metadata exceeds bounded credential inspection.');
}
/** Bounded recognizable prefixes only; this does not detect arbitrary covert encodings. */
export function programBinaryHasCredential(bytesHex:string):boolean{return hasRecognizableCredentials(programSourceBytes(bytesHex));}
export const programSourceSchema=z.object({profile:z.literal(programProfile),abi:z.literal(programAbi),bytesHex:z.string().min(16).max(programSourceLimits.moduleBytes*2).regex(/^([a-f0-9]{2})+$/),digest:z.string().regex(/^[a-f0-9]{64}$/),parameters:z.array(z.number().finite().min(-programSourceLimits.parameterMagnitude).max(programSourceLimits.parameterMagnitude).refine(value=>!Object.is(value,-0),'Program parameters require canonical positive zero.')).max(programSourceLimits.parameters)}).strict().superRefine((source,ctx)=>{
 try{const bytes=programSourceBytes(source.bytesHex);if(hasRecognizableCredentials(bytes))throw new ProgramSourceError('Credentials cannot be retained in public program bytes.');parseProgramModule(bytes);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,path:['bytesHex'],message:'The program is invalid or unsupported by the restricted binary profile and ABI.'});}
});
export type ProgramSource=z.infer<typeof programSourceSchema>;
export class ProgramSourceError extends Error{constructor(message:string){super(message);}}
export async function programBinaryDigest(bytesHex:string):Promise<string>{const bytes=programSourceBytes(bytesHex),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
/** Structural validation plus raw binary identity, without running the program. */
export async function verifyProgramSource(raw:unknown):Promise<ProgramSource>{const source=programSourceSchema.parse(raw);if(await programBinaryDigest(source.bytesHex)!==source.digest)throw new ProgramSourceError('The exact raw program binary digest does not match.');return source;}
