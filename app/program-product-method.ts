export type ProgramProductMethod='LEGACY'|'DIRECTION';
/** Unknown or repeated discriminator values must never fall through to V1. */
export function programProductMethod(selection:unknown):ProgramProductMethod{
 if(selection===undefined)return 'LEGACY';
 if(selection==='direction-matched-v2')return 'DIRECTION';
 throw Error('Unknown program evaluation method. Choose a supported method before importing evidence.');
}
