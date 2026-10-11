import {researchSelection} from './research-thread';

export type ResearchAssistanceDomain='RESEARCH'|'VENTURE';
export type ResearchAssistanceSelection={domain:ResearchAssistanceDomain;kind:'BASE'|'REQUEST';reference:{id:string;digest:string}};
export function parseResearchAssistanceLink(raw:URLSearchParams|string):ResearchAssistanceSelection|null{
 if(typeof raw==='string'&&(new TextEncoder().encode(raw).byteLength>512||raw!==''&&!raw.startsWith('?')||raw.includes('#')||/[\u0000-\u0020\u007f]/.test(raw)||raw.startsWith('?')&&raw.slice(1).split('&').some(part=>!part)))throw Error('Invalid research assistance link.');
 if(typeof raw==='string'){try{decodeURIComponent(raw);}catch{throw Error('Invalid research assistance link.');}}
 const params=typeof raw==='string'?new URLSearchParams(raw):raw;
 if(!(params instanceof URLSearchParams)||new TextEncoder().encode(params.toString()).byteLength>512)throw Error('Invalid research assistance link.');
 const pairs=[...params];if(!pairs.length)return null;
 if(pairs.length!==3||pairs.filter(([name])=>name==='domain').length!==1||pairs.filter(([name])=>name==='digest').length!==1||pairs.filter(([name])=>name==='base'||name==='request').length!==1)throw Error('Select an exact research base or request.');
 const domain=params.get('domain');if(domain!=='RESEARCH'&&domain!=='VENTURE')throw Error('Select a research domain.');
 const kind=params.has('base')?'BASE':'REQUEST';return {domain,kind,reference:researchSelection({id:params.get(kind==='BASE'?'base':'request'),digest:params.get('digest')})};
}
export function researchAssistanceHref(domain:ResearchAssistanceDomain,kind:'BASE'|'REQUEST',reference:{id:string;digest:string}){
 if(domain!=='RESEARCH'&&domain!=='VENTURE'||kind!=='BASE'&&kind!=='REQUEST')throw Error('Invalid research assistance destination.');
 const value=researchSelection(reference);return '/assistance/research?domain='+domain+'&'+(kind==='BASE'?'base':'request')+'='+value.id+'&digest='+value.digest;
}
