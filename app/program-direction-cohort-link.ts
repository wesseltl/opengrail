/** Exact references only. A link cannot supply a source, dataset or permission. */
export type ProgramDirectionCohortReference={id:string;digest:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash=/^[a-f0-9]{64}$/;
export const programDirectionCohortLinkLimits=Object.freeze({queryBytes:512});
export function programDirectionCohortHref(reference:ProgramDirectionCohortReference):string{
 if(!reference||typeof reference!=='object'||Object.getOwnPropertySymbols(reference).length)throw Error('An exact program cohort reference is required.');
 const descriptors=Object.getOwnPropertyDescriptors(reference),keys=Object.keys(descriptors),prototype=Object.getPrototypeOf(reference);
 if((prototype!==Object.prototype&&prototype!==null)||keys.sort().join(',')!=='digest,id'||keys.some(key=>!('value'in descriptors[key])||!descriptors[key].enumerable)||typeof descriptors.id.value!=='string'||typeof descriptors.digest.value!=='string'||!uuid.test(descriptors.id.value)||!hash.test(descriptors.digest.value))throw Error('An exact program cohort reference is required.');
 return '/search?method=programs&selection=direction-matched-v2&strategy='+descriptors.id.value+'&digest='+descriptors.digest.value;
}
export function programDirectionCohortSelectionFromQuery(params:URLSearchParams):ProgramDirectionCohortReference|null{
 if(!(params instanceof URLSearchParams)||new TextEncoder().encode(params.toString()).byteLength>programDirectionCohortLinkLimits.queryBytes)throw Error('Invalid cohort query.');
 const hasSource=params.has('strategy')||params.has('digest');
 if(!hasSource)return null;
 const keys=[...params.keys()];
 if(keys.length!==4||keys.some(key=>!['method','selection','strategy','digest'].includes(key))||['method','selection','strategy','digest'].some(key=>params.getAll(key).length!==1)||params.get('method')!=='programs'||params.get('selection')!=='direction-matched-v2')throw Error('An exact direction-matched Programs route is required for a cohort source.');
 const value={id:params.get('strategy')!,digest:params.get('digest')!};
 programDirectionCohortHref(value);return value;
}
