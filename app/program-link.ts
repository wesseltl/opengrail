import {boundedStrategyRecord,strategyDigest,strategyPublicItemSchema,type StrategyPublicItem} from './strategy-model';
import {guardProgramData} from './program-run-model';
import {verifyProgramSource as verifyProgramDefinition} from './program-source-model';
import {parseStrategyHandoff,type StrategyHandoffReference} from './strategy-handoff';

/** The destination and query are fixed. Neither URLs nor source bytes enter a link. */
export function programHref(reference:StrategyHandoffReference):string {
 const search='?strategy='+reference.id+'&digest='+reference.digest;
 const value=parseStrategyHandoff(search);
 if(!value)throw Error('An exact programmable source reference is required.');
 return '/program?strategy='+value.id+'&digest='+value.digest;
}
export const parseProgramLink=parseStrategyHandoff;

/** Fresh public snapshots are required by the caller before admission and export. */
export async function verifyProgramSource(reference:StrategyHandoffReference,raw:unknown):Promise<StrategyPublicItem>{
 const value=parseProgramLink('?strategy='+reference.id+'&digest='+reference.digest);
 guardProgramData(raw,65_536);
 const item=strategyPublicItemSchema.parse(raw);
 if(!value||item.id!==value.id||item.digest!==value.digest)throw Error('The programmable source does not match its exact reference.');
 if(item.state!=='VISIBLE'||!item.record)throw Error('The exact programmable source is unavailable.');
 if(item.record.version!==2)throw Error('Choose a version-two programmable source.');
 await verifyProgramDefinition(item.record.content.program);
 const canonical=boundedStrategyRecord(item.record);
 if(await strategyDigest(canonical.payload)!==value.digest)throw Error('The programmable source digest is inconsistent.');
 return item;
}
