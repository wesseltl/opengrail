import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const bundle=await build({stdin:{contents:`import * as route from './app/api/network/capabilities/route.ts';export default {fetch(request){const method=route[request.method];return method?method(request):new Response(null,{status:405,headers:{Allow:'GET'}});}}`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
// Actual route, no auth shim, runtime secrets or storage bindings.
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15'});
before(async()=>await mf.ready);
after(async()=>await mf.dispose());
const endpoint='https://network.test/api/network/capabilities';
const get=options=>mf.dispatchFetch(endpoint,options);

test('anonymous actual route returns the current API specification without identity or storage bindings',async()=>{
 const response=await get();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Content-Type'),/application\/json/);
 const spec=await response.json();assert.equal(spec.version,1);assert.equal(spec.product,'OpenGrail');assert.equal(spec.executionEnabled,false);assert.match(spec.specification,/hosted authentication and public launch remain unverified/);
 assert.deepEqual(spec.endpoints.slice(0,3).map(value=>[value.path,value.methods,value.authentication]),[
  ['/api/network/capabilities',['GET'],'NONE'],['/api/network/agents',['GET','POST'],'SIGNED_IN_HUMAN'],['/api/network/agent',['GET'],'AGENT_BEARER'],
 ]);assert(spec.endpoints.slice(0,3).every(value=>value.queryParameters===false));
 assert.deepEqual(spec.endpoints.slice(3).map(value=>[value.path,value.methods]),[['/api/research',['GET','POST']],['/api/research/agent',['POST']],['/api/research/me',['GET']],['/api/research/reports',['GET']],['/api/strategies',['GET','POST']],['/api/strategies/agent',['POST']],['/api/strategies/me',['GET']],['/api/strategies/reports',['GET']],['/api/experiments',['GET','POST']],['/api/experiments/agent',['POST']],['/api/experiments/me',['GET']],['/api/experiments/reports',['GET']],['/api/experiments/reviews',['GET','POST']],['/api/experiments/reviews/me',['GET']],['/api/experiments/reviews/reports',['GET']],['/api/experiments/reviews/agent',['POST']],['/api/network/quickstart',['GET']],['/api/contributions',['GET','POST']],['/api/contributions/agent',['POST']],['/api/contributions/me',['GET']],['/api/contributions/work',['GET']],['/api/contributions/work/agent',['GET']],['/api/strategies/evidence',['GET']],['/api/network/strategy-quickstart',['GET']],['/api/assistance',['GET','POST']],['/api/assistance/agent',['POST']],['/api/assistance/me',['GET']],['/api/assistance/reports',['GET']],['/api/network/research-assistance-quickstart',['GET']],['/api/contributions/discussion',['GET','POST']],['/api/contributions/discussion/agent',['POST']],['/api/contributions/discussion/me',['GET']],['/api/contributions/discussion/reports',['GET']]]);
 for(const endpoint of spec.endpoints.slice(3))assert(readFileSync('.'+endpoint.path.replace('/api/','/app/api/')+'/route.ts','utf8').length>0);
 const dependencies=Object.keys(bundle.metafile.inputs);assert(dependencies.some(value=>value.endsWith('app/api/network/capabilities/route.ts')));
 for(const forbidden of ['app/network-store.ts','app/network-http.ts','app/chatgpt-auth.ts','db/index.ts'])assert(!dependencies.some(value=>value.endsWith(forbidden)));
 assert(!bundle.outputFiles[0].text.includes('cloudflare:workers'));assert(!bundle.outputFiles[0].text.includes('node:crypto'));
});

test('specification documents actual digest-only enrollment, fixed permissions, retained caps and planned services',async()=>{
 const spec=await (await get()).json();
 assert.deepEqual(spec.enrollment.register.requiredFields,['action','requestId','id','credentialId','name','tokenDigest','days']);assert.equal(spec.enrollment.register.unknownFieldsAccepted,false);assert.deepEqual(spec.enrollment.register.fields.days,[1,7,30]);assert.match(spec.enrollment.register.fields.tokenDigest,/SHA-256 of the complete client-generated token/);
 assert.deepEqual(spec.enrollment.revoke.requiredFields,['action','requestId','id','revision']);assert.equal(spec.enrollment.revoke.fields.revision,1);assert.equal(spec.enrollment.revoke.irreversible,true);
 assert.equal(spec.credentials.secretBits,256);assert.equal(spec.credentials.enrollmentMaterial,'SHA256_FULL_TOKEN_DIGEST_ONLY');assert.equal(spec.credentials.serverStoresPlaintext,false);assert.equal(spec.credentials.rawTokenRecovery,false);assert.deepEqual(spec.credentials.expirationDays,[1,7,30]);assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(spec.credentials.scopeIsEditable,false);assert.equal(spec.credentials.researchSubmissionAvailable,true);assert.equal(spec.credentials.rotationAvailable,false);
 assert.deepEqual(spec.limits,{requestBytes:8192,storedPayloadBytes:4096,retainedAgentsPerHuman:8,retainedAgentsNetwork:1000,policy:'Explicit beta resource limits. Expired and revoked registrations remain retained and count toward these limits; no automatic pruning.'});
 assert(spec.planned.length>=3);assert(spec.planned.every(value=>value.implemented===false&&value.endpoint===null));
 assert.equal(spec.research.verification,'UNVERIFIED');assert.equal(spec.research.sourceRetrieval,false);assert.equal(spec.research.submittedCodeExecution,false);assert.equal(spec.research.limits.stored,3000);assert.equal(spec.research.limits.publishPerSponsorDay,20);
 assert.deepEqual(spec.research.discussions,{selection:'EXACT_ID_AND_DIGEST',incomingRelations:['REVISION','FORK','CHALLENGE'],pageSize:20,recursive:false,frozenSnapshot:false,suppressedTarget:'TOMBSTONE_AND_EMPTY_PAGE',agreementIsVerification:false,newWriteAuthority:false});
 assert.deepEqual(spec.endpoints.find(endpoint=>endpoint.path==='/api/research').queryParameters,['cursor','id','root','target','digest','domain']);
 assert.deepEqual(spec.research.publicationVersions,[1,2]);
 assert.equal(spec.venture.page,'/venture');assert.equal(spec.venture.publicationVersion,2);assert.equal(spec.venture.readPath,'/api/research?domain=VENTURE');assert.equal(spec.venture.verification,'UNVERIFIED');assert.equal(spec.venture.accessIsAuthorReported,true);assert.equal(spec.venture.accessJurisdiction,'NETHERLANDS');assert.equal(spec.venture.partialScoreTotal,null);assert.equal(Object.values(spec.venture.scoreWeights).reduce((sum,value)=>sum+value,0),100);
 for(const field of ['qualifiedRankings','recommendations','sourceRetrieval','automaticDiscovery','newPermissions','executionEnabled'])assert.equal(spec.venture[field],false);
 assert.equal(spec.strategies.verification,'UNTESTED');assert.equal(spec.strategies.limits.publishPerSponsorDay,10);assert.equal(spec.strategies.limits.stored,1000);
 assert.deepEqual(spec.strategies.families,['TREND','RSI','BREAKOUT','DCA','GRID','SIGNAL','RULES']);assert.equal(spec.strategies.webhookReceiver,false);assert.equal(spec.strategies.evaluationRunner,false);assert.equal(spec.strategies.executionEnabled,false);assert.equal(spec.strategies.submittedCodeExecution,false);
 assert.equal(spec.demo.page,'/demo');assert.equal(spec.demo.mode,'LOCAL_REPLAY');assert.equal(spec.demo.hostedCompute,false);assert.equal(spec.demo.forwardTrading,false);assert.equal(spec.demo.independentQualification,false);assert.equal(spec.demo.publicRegistry,false);assert.equal(spec.demo.executionEnabled,false);
 assert.equal(spec.demo.experimentRegistryPath,'/experiments');assert.equal(spec.demo.automaticSubmission,false);
 assert.equal(spec.experiments.page,'/experiments');assert.equal(spec.experiments.policyPath,'/experiment-policy');assert.equal(spec.experiments.classification,'AUTHOR_REPORTED');assert.equal(spec.experiments.immutableManifests,true);assert.equal(spec.experiments.appendOnlyOutcomes,true);assert.equal(spec.experiments.hostedCompute,false);assert.equal(spec.experiments.submittedCodeExecution,false);assert.equal(spec.experiments.independentQualification,false);assert.equal(spec.experiments.rankings,false);assert.equal(spec.experiments.forwardTrading,false);assert.equal(spec.experiments.executionEnabled,false);
 assert.equal(spec.experiments.limits.requestBytes,786432);assert.equal(spec.experiments.limits.artifactBytes,524288);assert.equal(spec.experiments.limits.registerPerSponsorDay,5);assert.equal(spec.experiments.limits.outcomePerSponsorDay,10);assert.equal(spec.experiments.limits.manifestStored,250);assert.equal(spec.experiments.limits.outcomeStored,500);assert.equal(spec.credentials.experimentResearchSubmissionAvailable,true);
 assert.match(spec.experiments.registrationEvidence,/no proof of execution order/);assert.match(spec.experiments.sourceFingerprint,/Author declaration/);
 assert.equal(spec.localComparison.page,'/validation');assert.equal(spec.localComparison.methodologyPath,'/reference-methodology');assert.equal(spec.localComparison.classification,'AUTHOR_REPORTED');assert.equal(spec.localComparison.qualification,'NONE');assert.equal(spec.localComparison.independence,'NOT_ESTABLISHED');assert.equal(spec.localComparison.hostedCompute,false);assert.equal(spec.localComparison.sourceRetrieval,false);assert.equal(spec.localComparison.submittedCodeExecution,false);assert.equal(spec.localComparison.publicReportSubmission,false);assert.equal(spec.localComparison.ordersEnabled,false);
 assert.equal(spec.planned[0].capability,'SIGNAL_INGESTION_AND_FORWARD_DEMO');
 for(const target of ['/api/network/agents','/api/network/agent'])assert(readFileSync('app/network.tsx','utf8').includes(target));
  const serialized=JSON.stringify(spec),links=serialized.match(/https:\/\/[^"]+/g);assert.deepEqual(links,['https://github.com/wesseltl/opengrail','https://github.com/wesseltl/opengrail/tree/e727f28ad9772abd8f8c165dd016c02c22715fbc','https://github.com/wesseltl/opengrail/issues/1','https://github.com/wesseltl/opengrail/issues/2','https://github.com/wesseltl/opengrail/issues/3']);assert(!serialized.includes('siwc_bypass_bearer_token'));assert(!serialized.includes('DASHBOARD_INGEST_KEY'));assert(links.every(link=>!/og_agent_|token=/.test(link)));
});

test('local continuous sessions confer no hosted, provider or credential execution authority',async()=>{
 const spec=await (await get()).json(),session=spec.localSession;
 assert.equal(session.page,'/session');assert.equal(session.methodologyPath,'/session-methodology');assert.equal(session.method,'opengrail-session-v1');assert.equal(session.mode,'LOCAL_INCREMENTAL');
 assert.deepEqual(session.intake,['BROWSER_MANUAL','SPONSOR_STDIO_NDJSON','SPONSOR_LOOPBACK_HTTP']);assert.deepEqual(session.clockModes,['SYSTEM_RECEIPT','SYNTHETIC_PLAYBACK']);assert.equal(session.recovery,'FULL_EVENT_RECONSTRUCTION');assert.equal(session.openPositionsPersist,true);assert.equal(session.durableCheckpoint,'SPONSOR_LOCAL_FILE_ONLY');
 const receiver=spec.localSessionReceiver;assert.equal(receiver.bind,'127.0.0.1');assert.equal(receiver.hostedEndpoint,null);assert.equal(receiver.publicAgentCredentialsAccepted,false);assert.equal(receiver.newPublicPermissions,false);assert.equal(receiver.marketAuthenticity,'UNKNOWN');assert.equal(receiver.ordersEnabled,false);assert.equal(receiver.liveEnabled,false);
 assert.equal(session.classification,'AUTHOR_REPORTED');assert.equal(session.qualification,'NONE');
 for(const key of ['providerAuthentication','providerAdapter','sourceRetrieval','hostedCompute','webhookReceiver','publicSubmission','submittedCodeExecution','ordersEnabled','liveEnabled'])assert.equal(session[key],false,key);
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');assert(spec.credentials.noAuthority.includes('ORDERS'));assert(!spec.endpoints.some(endpoint=>endpoint.path.includes('session')));
 assert.equal(spec.planned[0].implemented,false);assert.equal(spec.planned[0].endpoint,null);assert.equal(spec.planned[0].localFoundation,'/session');
 for(const file of ['app/session/page.tsx','app/session-methodology/page.tsx','scripts/session-runtime.mjs'])assert(readFileSync(file,'utf8').length>0);
});

test('comparison arena describes bounded public cohorts without granting evaluation or financial authority',async()=>{
 const spec=await (await get()).json(),arena=spec.comparisonArena;
 assert.equal(arena.page,'/arena');assert.equal(arena.selection,'USER_SELECTED_EXACT_PUBLIC_COHORT');
 assert.equal(arena.localCommand,'node scripts/compare-arena.mjs compare MEMBERS.json NEW_REPORT.json');assert.equal(arena.offlineVisibility,'SUPPLIED_SNAPSHOTS_NOT_CURRENTLY_VERIFIED');assert.equal(arena.offlineReviewHeads,'SUPPLIED_NOT_AUTHENTICATED_OR_CURRENT');
 assert.deepEqual(arena.methods,['BATCH_DEMO','PROGRAM_DEMO']);assert.equal(arena.commonProtocol,'METHOD_SPECIFIC_EXACT_COMMON_PROTOCOL');assert.match(arena.protocols.BATCH_DEMO,/EXACT_DATASET_SIGNALS/);assert.match(arena.protocols.PROGRAM_DEMO,/PER_PROGRAM_GENERATED_SIGNALS/);assert.equal(arena.programGenerator,'FULL_SAME_IMPLEMENTATION_RECONSTRUCTION');assert.equal(arena.continuousEvidence,'RETAINED_NONCOMPARABLE_MEMBER');
 assert.equal(arena.riskRanking,'DESCRIPTIVE_NONANNUALIZED_PERIOD_SHARPE');assert.equal(arena.classification,'AUTHOR_REPORTED');assert.equal(arena.qualification,'NONE');assert.equal(arena.independence,'NOT_ESTABLISHED');
 for(const key of ['allMembersRequired','adverseAttemptsRetained','currentReviewHistory'])assert.equal(arena[key],true,key);
 for(const key of ['completeExternalSearchHistory','independentCustody','qualifiedRankings','publicReportSubmission','hostedCompute','submittedCodeExecution','newPermissions','ordersEnabled','liveEnabled'])assert.equal(arena[key],false,key);
 assert.equal(spec.planned.find(value=>value.capability==='INDEPENDENT_EVALUATION_AND_AGENT_ARENA').implemented,false);
 assert(!spec.endpoints.some(endpoint=>endpoint.path.includes('arena')));
 // Existing capability imports already include the fixed experiment runner's
 // engines. The arena adds its pure contract, never its evaluation entrypoint.
 const inputs=Object.keys(bundle.metafile.inputs);assert(!inputs.some(value=>value.endsWith('app/arena-evaluator.ts')));
 for(const file of ['app/arena/page.tsx','docs/comparison-arena.md','scripts/compare-arena.mjs'])assert(readFileSync(file,'utf8').length>0);
});

test('locked forward source specification preserves local-only execution and unqualified evidence at the actual anonymous route',async()=>{
 const spec=await (await get()).json(),forward=spec.forwardDemo;
 assert.equal(forward.page,'/session');assert.equal(forward.guide,'/agent-guide/forward-demo');
 assert.equal(forward.handoff,'LOCKED_SEARCH_HANDOFF');assert.equal(forward.plan,'LOCAL_FORWARD_DEMO_PLAN');
 assert.equal(forward.classification,'AUTHOR_REPORTED');assert.equal(forward.qualification,'NONE');assert.equal(forward.clockEvidence,'AUTHOR_DECLARED');assert.equal(forward.providerAuthenticity,'NOT_ESTABLISHED');
 for(const key of ['signalCollection','budgetCompletionIsHorizonCompletion','automaticProviderStart','independentCustody','qualifiedRankings','hostedCompute','newPermissions','ordersEnabled','liveEnabled'])assert.equal(forward[key],false,key);
 assert(forward.limits.handoffBytes>spec.strategySearch.limits.ledgerBytes,'A complete legitimate search must fit without stripping adverse evidence.');
 assert(!spec.endpoints.some(endpoint=>/forward|recorded|kraken|session/.test(endpoint.path)),'A local evidence workflow cannot imply a hosted collector or receiver.');
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');assert.equal(spec.planned[0].implemented,false);
});

test('computational reviews document separately assigned human attestation and preserve unqualified results',async()=>{
 const spec=await (await get()).json(),review=spec.experimentReviews;
 assert.equal(review.readPath,'/api/experiments/reviews');assert.equal(review.classification,'REVIEW_ATTESTATION');assert.equal(review.executionAssurance,'TRUSTED_HUMAN_ATTESTATION');assert.equal(review.qualification,'NONE');assert.equal(review.independence,'NOT_ESTABLISHED');assert.equal(review.authorResultsUnchanged,true);
 for(const field of ['reviewerGrantedByDefault','agentReviewAuthority','automaticDecisions','hostedCompute','rankings','ordersEnabled','continuousPositiveReview'])assert.equal(review[field],false,field);
 assert.deepEqual(review.decisions,['REPRODUCED','DISPUTED','HELD','REJECTED']);assert.equal(review.limits.reviewsPerOutcome,32);assert.equal(review.limits.page,20);assert.equal(review.limits.retained,250);
 assert.equal(spec.endpoints.find(endpoint=>endpoint.path===review.readPath).write.requiredExpectedAuthorHeader.startsWith('X-Experiment-Review-Author:'),true);
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');assert.match(review.availability,/no grant is configured/);
});

test('verified public foundation and actual issue metadata establish no hosted CI, platform tasks or credential access',async()=>{
 const spec=await (await get()).json(),guide=spec.agentQuickstart,contributions=spec.contributions;
 assert.equal(guide.page,'/agent-guide');assert.equal(guide.specificationPath,'/api/network/quickstart');assert.equal(guide.deployedOrigin,null);
 for(const field of ['sourceAccessRequired','tokenIntake','automaticSubmission','newPermissions','hostedConnectivityVerified'])assert.equal(guide[field],false,field);
  assert.deepEqual(contributions.sourceRepository,{visibility:'PUBLIC',publicSourceAllowed:true,url:'https://github.com/wesseltl/opengrail',repositoryId:1414301089,invitedAccessRequired:false,connectionEstablished:true,applicationSourcePublished:true,applicationSourceBranch:'source/opengrail-foundation',applicationSourceCommit:'e727f28ad9772abd8f8c165dd016c02c22715fbc',applicationSourceTree:'551a50f9aa25807458a7f8c2fad3f9653c301d56',applicationSourceUrl:'https://github.com/wesseltl/opengrail/tree/e727f28ad9772abd8f8c165dd016c02c22715fbc',applicationSourceFileCount:575,defaultBranch:'main',defaultBranchApplicationSourcePublished:false,verifiedAt:'2026-10-11',hostedCiVerified:false});
  assert.deepEqual(contributions.starterIssues,[{number:1,url:'https://github.com/wesseltl/opengrail/issues/1',title:'Keyboard and mobile discussion usability'},{number:2,url:'https://github.com/wesseltl/opengrail/issues/2',title:'Schema-safe contributor onboarding'},{number:3,url:'https://github.com/wesseltl/opengrail/issues/3',title:'Independent retained-retry review'}]);
  assert.equal(contributions.starterIssueSourceCommit,contributions.sourceRepository.applicationSourceCommit);assert.equal(contributions.sourceBaselines.starterIssues,contributions.starterIssueSourceCommit);assert.deepEqual(contributions.sourceBaselines.lastVerified,{commit:'3740a4d242951e1ea0268d17d313df813f76351b',tree:'5c24fd5db2382552af924de398500ca7d75ec5b6',files:695,verifiedAt:'2026-10-11',scope:'BEFORE_TASK_032',hostedAvailabilityVerified:false});
  assert.equal(contributions.platformTaskMapping,'OPERATOR_DECLARED_NOT_VERIFIED');
  assert.deepEqual(contributions.publicHandoff,{format:'PUBLIC_CONTRIBUTION_HANDOFF',guide:'docs/public-contribution-handoff.md',cli:'scripts/contribution-public-handoff.mjs',transport:'SPONSOR_LOCAL_OFFLINE',platformSubmissionField:'handoffDigest',optionalPublicCi:true,publicCiPolicyVersion:1,snapshotProvenance:'OFFLINE_UNAUTHENTICATED_SNAPSHOT',issueTaskCorrespondence:'OPERATOR_DECLARED_NOT_VERIFIED',classification:'AUTHOR_REPORTED',qualification:'NONE',networkRequests:false,credentialIntake:false,checkerExecution:false,artifactRetrieval:false,mergeAuthority:false,deploymentAuthority:false,reputationAwarded:false,privateHandoffPreserved:true});
 const evidence=contributions.privateCiEvidence;assert.equal(evidence.policyVersion,2);assert.equal(evidence.transport,'SPONSOR_LOCAL_REPOSITORY_PINNED_GET');assert.equal(evidence.evidence,'PRIVATE_LOCAL_MODE_0600');
 for(const field of ['credentialIntakeOnPlatform','contributedCodeExecution','productionCredentialInstalled','repositoryVerified','hostedCiVerified','mergeAuthority','deploymentAuthority','researchQualification'])assert.equal(evidence[field],false,field);
 assert.equal(contributions.taskClaims,true);assert.equal(contributions.implementation,'SOURCE_PREPARED');const endpoint=spec.endpoints.find(value=>value.path===guide.specificationPath);assert.deepEqual(endpoint.methods,['GET']);assert.equal(endpoint.authentication,'NONE');assert.equal(endpoint.queryParameters,false);
 const inputs=Object.keys(bundle.metafile.inputs);assert(!inputs.some(value=>value.includes('contribution-private-credential')||value.includes('contribution-github-read')));
});

test('contribution coordination advertises retained claims and separate human review without source or execution access',async()=>{
 const spec=await (await get()).json(),desk=spec.contributions,read=spec.endpoints.find(item=>item.path==='/api/contributions'),agent=spec.endpoints.find(item=>item.path==='/api/contributions/agent');
 assert.equal(desk.policy,'public-contributions-v1');assert.equal(desk.policyPath,'/contribution-policy');assert.equal(desk.claimLeaseHours,72);assert.equal(desk.oneCurrentClaimPerTask,true);assert.equal(desk.immutableTasks,true);assert.equal(desk.retainedAttempts,true);assert.equal(desk.publicSubmission,'SHA256_LOCAL_HANDOFF_BYTES_ONLY');
 for(const field of ['maintainerGrantedByDefault','agentReviewAuthority','repositoryAccessGranted','automaticMerge','reputationAwarded','ordersEnabled'])assert.equal(desk[field],false,field);
 assert.equal(desk.limits.tasksStored,500);assert.equal(desk.limits.claimsStored,2000);assert.equal(desk.limits.claimsPerTask,32);assert.equal(desk.limits.activePerSponsor,2);assert.equal(desk.limits.claimsPerSponsorDay,10);
 assert.deepEqual(read.queryParameters,['cursor','id','claim','task','digest']);assert.equal(read.write.requiredExpectedAuthorHeader.startsWith('X-Contribution-Author:'),true);assert.equal(agent.httpsRequired,true);assert.equal(agent.authentication,'AGENT_BEARER');
 assert.equal(desk.privateHandoff.currentness,'NOT_RECHECKED');assert.equal(desk.privateHandoff.issueMapping,'OPERATOR_DECLARED_NOT_VERIFIED');for(const field of ['providerRead','codeExecution','automaticSubmission'])assert.equal(desk.privateHandoff[field],false,field);
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');assert.match(desk.availability,/rollout approval/);
});

test('all non-GET route methods are read-only refusals with an explicit GET allow header',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){
  const response=await get({method});assert.equal(response.status,405,method);assert.equal(response.headers.get('Allow'),'GET');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 }
});

test('participant work discovery exposes exact read scopes without extending writer authority',async()=>{
 const spec=await (await get()).json(),inbox=spec.contributions.workInbox;
 const human=spec.endpoints.find(item=>item.path===inbox.humanReadPath),agent=spec.endpoints.find(item=>item.path===inbox.agentReadPath);
 assert.deepEqual(human.methods,['GET']);assert.deepEqual(agent.methods,['GET']);
 assert.equal(human.authentication,'SIGNED_IN_HUMAN');assert.equal(agent.authentication,'AGENT_BEARER');assert.equal(agent.httpsRequired,true);
 assert.deepEqual(human.queryParameters,['cursor']);assert.deepEqual(agent.queryParameters,['cursor']);
 assert.equal(inbox.humanScope,'OWN_AND_SPONSORED_AGENT_CLAIMS');assert.equal(inbox.agentScope,'EXACT_AUTHENTICATED_AGENT_CLAIMS');
 assert.equal(inbox.cursorScope,'AUTHENTICATED_PARTICIPANT');assert.equal(inbox.limits.page,5);assert.equal(inbox.limits.responseBytes,524288);
 assert.equal(inbox.retainedTerminalAttempts,true);
 for(const field of ['frozenSnapshot','automaticPolling','automaticClaims','newWritePermissions','schemaChanged','reputationAwarded','hostedAcceptanceVerified'])assert.equal(inbox[field],false,field);
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');
});

test('exact strategy evidence is an anonymous retained read without evaluation or qualification authority',async()=>{
 const spec=await (await get()).json(),workspace=spec.strategies.evidenceWorkspace,route=spec.endpoints.find(item=>item.path===workspace.readPath);
 assert.deepEqual(route.methods,['GET']);assert.equal(route.authentication,'NONE');assert.deepEqual(route.queryParameters,['strategy','digest','cursor']);assert.equal(workspace.selection,'EXACT_ID_AND_DIGEST');assert.deepEqual(workspace.records,['MANIFEST','OUTCOME']);assert.equal(workspace.legacyIdOnly,'RESOLVE_CANONICAL_THEN_PIN');
 assert.equal(workspace.classification,'AUTHOR_REPORTED');assert.equal(workspace.qualification,'NONE');assert.equal(workspace.independence,'NOT_ESTABLISHED');assert.equal(workspace.compactMetricsAuthentication,'NOT_INDEPENDENTLY_ESTABLISHED');assert.equal(workspace.reviews,'EXISTING_LAZY_ORIGINAL_OUTCOME_WORKFLOW');
 for(const field of ['profitFiltering','rankings','reputation','newWritePermissions','schemaChanged'])assert.equal(workspace[field],false,field);
 assert.equal(workspace.limits.responseBytes,131072);assert.equal(workspace.limits.preferredPage,10);assert.equal(workspace.limits.canonicalRows,36);assert.equal(workspace.limits.sqlStatements,50);assert.equal(spec.strategies.verification,'UNTESTED');assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');
 // Existing capabilities also import the fixed experiment-runner limits. Check
 // the added projection model separately rather than attributing that old graph to it.
 const admission=await build({entryPoints:['app/strategy-evidence-model.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
 const dependencies=Object.keys(admission.metafile.inputs);assert(!dependencies.some(name=>/session-(engine|journal)\.ts$|demo-engine\.ts$|experiment-store\.ts$|strategy-evidence-http\.ts$/.test(name)));
});

test('queries are rejected without echoing credentials, sponsor identifiers or supplied fields',async()=>{
 for(const query of ['?token=do-not-echo-this-secret','?ownerId=private-human','?anything=1&anything=2','?']){
  const response=await mf.dispatchFetch(endpoint+query);
  if(query==='?'){assert.equal(response.status,200);continue;}
  assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'This specification takes no query parameters.'});assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 }
});

test('identity and secret-bearing headers cannot personalize or leak through the anonymous specification',async()=>{
 const plain=await (await get()).text(),supplied=await (await get({headers:{Authorization:'Bearer never-print-this-token','Cookie':'private=session','oai-authenticated-user-id':'private-human','oai-authenticated-user-email':'private@example.test'}})).text();
 assert.equal(supplied,plain);for(const value of ['never-print-this-token','private-human','private@example.test','private=session'])assert(!supplied.includes(value));
 const route=readFileSync('app/api/network/capabilities/route.ts','utf8'),handler=readFileSync('app/network-capabilities.ts','utf8');for(const value of ['getNetworkDb','getChatGPTUser','NetworkRepository','env.','headers()']){assert(!route.includes(value));assert(!handler.includes(value));}
});


test('public agent strategy workflow documents existing deliberate writes without source or execution access',async()=>{
 const spec=await (await get()).json(),guide=spec.agentStrategyQuickstart,endpoint=spec.endpoints.find(value=>value.path===guide.specificationPath);
 assert.equal(guide.page,'/agent-guide/strategies');assert.deepEqual(endpoint.methods,['GET']);assert.equal(endpoint.authentication,'NONE');assert.equal(endpoint.queryParameters,false);assert.deepEqual(guide.stages,['STRATEGY','MANIFEST','OUTCOME']);assert.equal(guide.outcome,'ARTIFACT_UNAVAILABLE');
 for(const field of ['sourceAccessRequired','evaluationAttempted','tokenIntake','automaticSubmission','newPermissions','hostedCompute','executionEnabled','hostedConnectivityVerified'])assert.equal(guide[field],false,field);
 assert.equal(guide.deployedOrigin,null);assert.equal(guide.limits.responseBytes,49152);assert.equal(guide.classification,'AUTHOR_REPORTED');assert.equal(guide.qualification,'NONE');assert.equal(guide.independence,'NOT_ESTABLISHED');assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');
});


test('assistance specification separates external reasoning, public coordination and deliberate human adoption', async () => {
 const spec=await (await get()).json(),assist=spec.assistance;
 assert.equal(assist.page,'/assistance');assert.equal(assist.guide,'/agent-guide/assistance');
 assert.deepEqual(assist.artifacts,['REQUEST','RESPONSE']);assert.equal(assist.limits.page,12);
 for(const key of ['automaticAdoption','builtInModel','paidInferenceRequired','guaranteedResponse','ordersEnabled','liveEnabled'])assert.equal(assist[key],false);
 assert.equal(assist.reasoning,'EXTERNALLY_HOSTED_AGENT');assert.equal(assist.adoption,'EXPLICIT_HUMAN_STRATEGY_FORK');assert.equal(assist.qualification,'NONE');
 const endpoint=spec.endpoints.find(item=>item.path===assist.readPath);
 assert(endpoint.write.requiredExpectedAuthorHeader.startsWith('X-Assistance-Author:'));
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');
});

test('research assistance contract retains domain separation, human review and existing authority bounds',async()=>{
 const spec=await (await get()).json(),assist=spec.researchAssistance;
 assert.deepEqual(assist.domains,['RESEARCH','VENTURE']);assert.equal(assist.recordVersion,2);
 assert.equal(assist.maximumObjectives,5);assert.equal(assist.adoption,'EXPLICIT_EDITABLE_HUMAN_RESEARCH_FORK');
 assert.deepEqual(assist.stances,['SUPPORTS','CONTRADICTS','UNKNOWN']);
 for(const field of ['automaticAdoption','builtInModel','paidInferenceRequired','guaranteedResponse','newPermissions','ordersEnabled','liveEnabled'])assert.equal(assist[field],false);
 assert.equal(assist.defaultStrategyFeedUnchanged,true);assert.equal(assist.qualification,'NONE');
 const endpoint=spec.endpoints.find(item=>item.path===assist.readPath);assert.deepEqual(endpoint.queryParameters,['cursor','id','request','domain']);
 assert.match(endpoint.readSelection,/No domain preserves the strategy feed/);
 assert.equal(spec.endpoints.find(item=>item.path===assist.machineGuide).authentication,'NONE');
 assert.equal(spec.credentials.fixedScope,'PUBLIC_RESEARCH_SUBMIT');
});


test('programmable search advertises real local generation and durable admission without public authority',async()=>{
 const spec=await (await get()).json(),search=spec.programmableStrategies.search;
 assert.equal(search.page,'/search');assert.equal(search.guide,'/agent-guide/program-search');assert.equal(search.cli,'scripts/program-search.mjs');assert.equal(search.method,'LOCAL_PROGRAM_SEARCH');assert.equal(search.sourceVersion,2);
 assert.equal(search.limits.attemptBytes,22*1024*1024);assert.equal(search.limits.ledgerBytes,128*1024*1024);assert.equal(search.limits.candidates,4);
 for(const key of ['allCandidateOutcomesRetained','wholeGeneratorReconstruction','freshStatePerPhase','oneTestAdmission','admissionBeforeWorker'])assert.equal(search[key],true,key);
 for(const key of ['suppliedSignals','mixedRuleProgramCohort','automaticPublication','hostedCompute'])assert.equal(search[key],false,key);
 assert.equal(search.browserPersistence,'OWNER_SCOPED_INDEXEDDB');assert.equal(search.generator,'SAME_IMPLEMENTATION_RECONSTRUCTION');assert.equal(search.qualification,'NONE');assert.equal(search.unseen,'NOT_ESTABLISHED');assert.equal(spec.programmableStrategies.forward,'LOCAL_PERSISTENT_DEMO');
 assert.equal(spec.strategySearch.browserPersistence,'PAGE_MEMORY_AND_EXPLICIT_EXPORT');assert.equal(spec.strategySearch.limits.ledgerBytes,64*1024*1024);
 assert.equal(spec.executionEnabled,false);assert(!spec.endpoints.some(endpoint=>endpoint.path.includes('program-search')));
 // Actual anonymous route must only describe local computation, never perform it.
 for(const name of ['evaluateProgramSearchAttempt','runProgramReplay','compareProgramOutcome'])assert(!bundle.outputFiles[0].text.includes('function '+name),name);
});

test('anonymous capability route describes persistent Demo and inert forward registration without loading the execution kernel or granting execution authority',async()=>{
 const spec=await (await get()).json(),forward=spec.programForwardDemo;
 assert.equal(forward.page,'/session');assert.equal(forward.plansPage,'/plans');assert.equal(forward.sourceVersion,2);
 assert.equal(forward.method.version,'opengrail-program-session-v1');assert.equal(forward.handoff,'COMPLETE_LOCKED_PROGRAM_SEARCH_WITH_TERMINAL_TEST');
 assert.equal(forward.signalAvailability,'RECORDED_POST_GUEST_COMPLETION');assert.equal(forward.internalProjection,'DISTINCT_PRIVATE_V1');
 assert.deepEqual(forward.producerInputs,['CLOSED_BAR','QUOTE']);assert.deepEqual(forward.ownerControls,['PAUSE','RESUME','EMERGENCY']);
 for(const field of ['originalSourceRetained','oneRetainedGuest','admissionBeforeGuest','outerAndInnerSequencesSeparate','completeAdverseEvidence'])assert.equal(forward[field],true,field);
 for(const field of ['externalSignals','hostedCompute','automaticProviderStart','automaticPublication','newPermissions','ordersEnabled','liveEnabled'])assert.equal(forward[field],false,field);
 assert.equal(forward.publicRegistration,true);assert.equal(forward.publicMethod,'PROGRAM_FORWARD_DEMO');assert.equal(forward.publicRecordVersion,4);assert.equal(forward.completeFittingPublicEvidenceOnly,true);assert.equal(forward.classification,'AUTHOR_REPORTED');assert.equal(forward.providerAuthentication,'UNKNOWN');assert.match(forward.availability,/Source preparation/);
 const evidence=spec.programForwardEvidence;
 assert.equal(evidence.method,'PROGRAM_FORWARD_DEMO');assert.equal(evidence.recordVersion,4);assert.equal(evidence.serverAdmission,'INERT_IDENTITY_AND_CORRELATION_ONLY');assert.equal(evidence.localReconstruction,'EXPLICIT_WORKER_OR_FILE_ONLY_CLI');assert.equal(evidence.publicRawCollectorArchive,'NOT_ESTABLISHED');assert.equal(evidence.guidePage,'/agent-guide/program-forward');
 assert.deepEqual(evidence.publicLimits,{inputBytes:192*1024,artifactBytes:512*1024,manifestBytes:256*1024,outcomeBytes:576*1024,reviewReportBytes:131072,bodyDepth:40,legacyBodyDepth:16});
 for(const field of ['automaticPublication','hostedCompute','newPermissions','ordersEnabled','liveEnabled','pendingWorkAutomaticallyExecuted'])assert.equal(evidence[field],false,field);
 assert.equal(evidence.classification,'AUTHOR_REPORTED');assert.equal(evidence.qualification,'NONE');assert.equal(evidence.independence,'NOT_ESTABLISHED');assert.match(evidence.availability,/public availability.*independently useful operators.*approved rollout/);
 assert.equal(forward.qualification,'NONE');assert.equal(forward.independence,'NOT_ESTABLISHED');assert.equal(forward.browserPersistence,'OWNER_SCOPED_STRICT_INDEXEDDB');
 assert(forward.limits.configBytes>=32768);assert(forward.limits.journalBytes>forward.limits.reservedBytes);assert(forward.limits.totalFuel>forward.limits.perInvocationFuel);
 const inputs=Object.keys(bundle.metafile?.inputs??{});
 for(const name of ['app/session-engine.ts','app/session-journal.ts','app/program-session-engine.ts','app/program-session-journal.ts','app/program-forward-evidence.ts','app/program-forward-evidence.worker.ts'])assert(!inputs.some(path=>path.endsWith(name)),name);
 for(const name of ['executeProgramSessionPending','runProgramReplay','invokeProgram'])assert(!bundle.outputFiles[0].text.includes('function '+name),name);
 assert(!spec.endpoints.some(endpoint=>/program-session|program-forward|recorded-program/.test(endpoint.path)));
});
