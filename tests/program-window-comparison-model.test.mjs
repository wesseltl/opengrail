import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programWindowAccountingFixture,reboundProgramWindowAccountingFixture,programWindowMemberContext as context,programWindowLocalReferences as refs} from './program-window-accounting-fixtures.mjs';
const clone=structuredClone;
let pair;
function fixtures(){return pair??=(async()=>[await programWindowAccountingFixture(),await reboundProgramWindowAccountingFixture({pause:true})])();}
const selections=()=>Array.from({length:2},()=>({id:crypto.randomUUID(),references:refs()}));
async function admission(fs){return fs[0].m.createProgramWindowCohortAdmission(selections(),fs.map(context),crypto.randomUUID(),fs[0].inspectedAt);}
const options=f=>({inspectedAt:f.inspectedAt,completedAt:f.inspectedAt});

test('complete frozen selected cohort retains every distinct original/fresh history and exact common raw marks without ranking',async()=>{
 const fs=await fixtures(),m=fs[0].m,a=await admission(fs),r=await m.compareProgramWindowCohort(a,fs.map(context),options(fs[0]));
 assert.equal(r.report.status,'DESCRIPTIVE_COMPLETE');assert.equal(r.report.memberCount,2);assert.equal(r.report.retainedMemberCount,2);assert.equal(r.members.length,2);assert(r.report.members.every(row=>row.status==='ACCOUNTED'));assert.deepEqual(r.report.compatibilityDifferences,[]);assert.match(r.report.commonProtocolDigest,/^[a-f0-9]{64}$/);assert.equal(r.report.financialOrderingEnabled,false);assert.equal(r.report.ranking,null);assert.equal(r.report.qualifiedRanking,false);assert.equal(r.report.reputationAwarded,0);assert.equal(r.report.sourceVisibilityVerified,false);assert.equal(r.report.annualizedSharpe,null);
 for(let n=0;n<2;n++){assert.deepEqual(r.members[n].original,context(fs[n]));assert.equal(r.members[n].accounting.reconstruction.attempt.journal.journalDigest,fs[n].journal.journalDigest);assert.equal(r.report.members[n].identity.id,a.members[n].id);}assert.equal(r.report.members[1].accounting.portfolio.closedTradeCount,0);assert.equal(r.report.members[1].accounting.portfolio.terminalReturnPct,0);assert.equal(a.currentVisibility,'NOT_ESTABLISHED');assert.equal(a.referenceAuthentication,'NOT_ESTABLISHED');assert.deepEqual((await m.verifyProgramWindowCohortReport(r.report,fs.map(context))).report,r.report);
});

test('different captured source bytes/terminal quotes hold the whole table; no intersection, interpolation or alternate winner path',async()=>{
 const f=await programWindowAccountingFixture(),different=await reboundProgramWindowAccountingFixture({pause:true,terminalPrice:96}),fs=[f,different],m=f.m,a=await admission(fs),r=await m.compareProgramWindowCohort(a,fs.map(context),options(f));assert.equal(r.report.status,'HELD');assert.equal(r.members.length,2);assert.equal(r.report.commonProtocolDigest,null);assert(r.report.compatibilityDifferences.some(d=>d.fields.includes('observationPathDigest')&&d.fields.includes('terminalMark')));assert.equal(r.report.members[0].accounting.marks.at(-1).price,95);assert.equal(r.report.members[1].accounting.marks.at(-1).price,96);assert.equal(r.report.financialOrderingEnabled,false);
});

test('missing required accepted quote keeps the member and partial diagnostics but blocks complete cohort comparison',async()=>{
 const f=await programWindowAccountingFixture(),gap=await reboundProgramWindowAccountingFixture({firstQuoteSlot:2}),fs=[f,gap],a=await admission(fs),r=await f.m.compareProgramWindowCohort(a,fs.map(context),options(f));assert.equal(r.report.status,'HELD');assert.equal(r.report.retainedMemberCount,2);assert.equal(r.members[1].original.archive.outbox.length,gap.archive.outbox.length);assert.equal(r.report.members[1].status,'HELD');assert(r.report.members[1].accounting.reasons.includes('BASELINE_ENTRY_UNAVAILABLE'));assert(r.report.compatibilityDifferences.some(d=>d.fields.includes('acceptedQuotePathDigest')));assert.equal(r.report.commonProtocolDigest,null);
});

test('frozen selection cannot delete, reorder, replace or duplicate any original member after admission',async()=>{
 const fs=await fixtures(),m=fs[0].m,a=await admission(fs),contexts=fs.map(context);await assert.rejects(m.compareProgramWindowCohort(a,[contexts[0]],options(fs[0])),/two to four/);await assert.rejects(m.compareProgramWindowCohort(a,[contexts[1],contexts[0]],options(fs[0])),/package changed/);await assert.rejects(m.createProgramWindowCohortAdmission(selections(),[contexts[0],contexts[0]],crypto.randomUUID(),fs[0].inspectedAt),/repeated/);const changed=clone(contexts);changed[1].input.inputDigest='a'.repeat(64);await assert.rejects(m.compareProgramWindowCohort(a,changed,options(fs[0])));const changedAdmission=clone(a);changedAdmission.members.pop();await assert.rejects(m.verifyProgramWindowCohortAdmission(changedAdmission));assert.equal(a.members.length,2);
});

test('already cancelled explicit reconstruction retains every frozen member as interrupted without executing any guest',async()=>{
 const fs=await fixtures(),m=fs[0].m,a=await admission(fs),signal=AbortSignal.abort(),r=await m.compareProgramWindowCohort(a,fs.map(context),{...options(fs[0]),signal});assert.equal(r.report.status,'INTERRUPTED');assert.equal(r.report.retainedMemberCount,2);assert(r.report.members.every(row=>row.status==='INTERRUPTED'&&row.reason==='USER_CANCELLED'&&row.accounting===null));assert(r.members.every(row=>row.accounting===null));assert.deepEqual(r.members.map(row=>row.original),fs.map(context));assert.equal(r.report.commonProtocolDigest,null);
});

test('economic protocol changes remain explicit incompatibility even with shared raw source captures',async()=>{
 const fs=await fixtures(),m=fs[0].m,result=await m.compareProgramWindowCohort(await admission(fs),fs.map(context),options(fs[0])),key=m.programWindowCommonComparisonKey(fs[0].input,result.members[0].accounting),changed=clone(fs[1].input);changed.protocol.costs.feeBps+=1;const other=m.programWindowCommonComparisonKey(changed,result.members[1].accounting);assert.notDeepEqual(key.costs,other.costs);assert.deepEqual(key.observationPathDigest,other.observationPathDigest);assert(!('sessionId' in key));assert(!('source' in key));assert(!('planDigest' in key));
});

test('complete cohort contracts refuse hidden/hooks/extra references before serialization and preserve original package budgets',async()=>{
 const fs=await fixtures(),m=fs[0].m,a=await admission(fs);let touched=0;await assert.rejects(m.createProgramWindowCohortAdmission(selections(),[{get input(){touched++;return fs[0].input;},archive:fs[0].archive,artifact:fs[0].artifact},context(fs[1])],crypto.randomUUID(),fs[0].inspectedAt),/fields/);assert.equal(touched,0);await assert.rejects(m.verifyProgramWindowCohortAdmission({...a,token:'Bearer private-material-secret'}));assert.equal(m.programWindowComparisonLimits.members,4);assert.equal(m.programWindowComparisonLimits.allMaximumMemoryFit,'NOT_ESTABLISHED');assert(m.programWindowComparisonLimits.maximumWholeFourMemberPackageBytes>4*m.programWindowComparisonLimits.maximumPackageBytesPerMember);assert(m.programWindowComparisonLimits.maximumPackageBytesPerMember>m.programWindowLimits.inputBytes);assert.equal(m.programWindowComparisonLimits.reportBytes,8388608);
});

test('the complete common-path cohort retains a losing SHORT member beside a genuine no-trade member',async()=>{
 const fs=[await reboundProgramWindowAccountingFixture({activePrices:[100,100,105,105,105],terminalPrice:105,openingPrice:99}),await reboundProgramWindowAccountingFixture({pause:true,activePrices:[100,100,105,105,105],terminalPrice:105,openingPrice:99})],m=fs[0].m,a=await admission(fs),r=await m.compareProgramWindowCohort(a,fs.map(context),options(fs[0]));assert.equal(r.report.status,'DESCRIPTIVE_COMPLETE');assert.equal(r.report.retainedMemberCount,2);assert(r.report.members[0].accounting.portfolio.terminalReturnPct<0);assert.equal(r.report.members[1].accounting.portfolio.terminalReturnPct,0);assert.equal(r.report.financialOrderingEnabled,false);assert.equal(r.report.ranking,null);assert.deepEqual(r.report.members.map(x=>x.identity.id),a.members.map(x=>x.id));
});
