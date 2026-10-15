import {sessionSourceFingerprints} from './session-fingerprints';
import {programSessionSourceFingerprints} from './program-session-fingerprints';
import {programSourceFingerprints} from './program-fingerprints';
import {sessionSourceFingerprints as legacySessionFingerprints} from './compat/session-20261011/session-fingerprints';
import {programSessionSourceFingerprints as legacyForwardFingerprints} from './compat/session-20261011/program-session-fingerprints';

// These identify distinct physical implementations. Recognition never permits
// one implementation to execute a journal claiming the other implementation.
export type SessionImplementationKind='CURRENT'|'LEGACY_20261011';
export const legacySessionImplementation=()=>({version:'opengrail-session-v1' as const,...legacySessionFingerprints});
export const legacyProgramSessionImplementation=()=>({version:'opengrail-program-session-v1' as const,forward:legacyForwardFingerprints,program:programSourceFingerprints,kernel:legacySessionFingerprints});
function exact(raw:unknown,expected:unknown):boolean{
 if(typeof expected!=='object'||expected===null)return raw===expected;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)return false;
 const keys=Object.keys(expected),descriptors=Object.getOwnPropertyDescriptors(raw);
 if(Object.keys(descriptors).length!==keys.length)return false;
 return keys.every(key=>{const descriptor=descriptors[key];return descriptor&&'value'in descriptor&&descriptor.enumerable&&exact(descriptor.value,(expected as Record<string,unknown>)[key]);});
}
export function sessionImplementationKind(raw:unknown):SessionImplementationKind|null{
 if(exact(raw,{version:'opengrail-session-v1',...sessionSourceFingerprints}))return 'CURRENT';
 return exact(raw,legacySessionImplementation())?'LEGACY_20261011':null;
}
export function programSessionImplementationKind(raw:unknown):SessionImplementationKind|null{
 if(exact(raw,{version:'opengrail-program-session-v1',forward:programSessionSourceFingerprints,program:programSourceFingerprints,kernel:sessionSourceFingerprints}))return 'CURRENT';
 return exact(raw,legacyProgramSessionImplementation())?'LEGACY_20261011':null;
}
