/** Navigation references carry no plan, credentials or execution authority. */
export type ProgramCommitmentReference={id:string;digest:string};
export const programCommitmentLinkLimits=Object.freeze({queryBytes:512});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
export function programCommitmentSelectionFromQuery(query:string|URLSearchParams):ProgramCommitmentReference|null{
 let serialized:string;
 try{serialized=typeof query==='string'?query:URLSearchParams.prototype.toString.call(query);}catch{throw Error('Invalid commitment query.');}
 if(new TextEncoder().encode(serialized).byteLength>programCommitmentLinkLimits.queryBytes)throw Error('Commitment query exceeds its bound.');
 const params=new URLSearchParams(serialized),keys=[...params.keys()];if(keys.length===0)return null;
 if(keys.length!==2||keys.some(key=>!['manifest','digest'].includes(key))||params.getAll('manifest').length!==1||params.getAll('digest').length!==1)throw Error('Use one exact commitment manifest and digest.');
 const id=params.get('manifest')!,digest=params.get('digest')!;if(!uuid.test(id)||!hash.test(digest))throw Error('Invalid exact commitment reference.');return {id,digest};
}
export function programCommitmentHref(reference:ProgramCommitmentReference):string{
 if(!reference||typeof reference!=='object'||Object.getOwnPropertySymbols(reference).length)throw Error('An exact commitment reference is required.');
 const prototype=Object.getPrototypeOf(reference),descriptors=Object.getOwnPropertyDescriptors(reference),keys=Object.keys(descriptors);
 if((prototype!==Object.prototype&&prototype!==null)||keys.sort().join(',')!=='digest,id'||keys.some(key=>!('value'in descriptors[key])||!descriptors[key].enumerable)||typeof descriptors.id.value!=='string'||typeof descriptors.digest.value!=='string'||!uuid.test(descriptors.id.value)||!hash.test(descriptors.digest.value))throw Error('An exact commitment reference is required.');
 return '/commitments?manifest='+descriptors.id.value+'&digest='+descriptors.digest.value;
}
