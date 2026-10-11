import {loadSearchModules,searchFixture} from './search-fixtures.mjs';
import {loadForwardDemoModules} from '../scripts/forward-demo-core.mjs';

/** Invented snapshots/prices only. This helper grants no provider or execution permission. */
export async function forwardDemoFixture({interruptedTest=false}={}){
 const search=await loadSearchModules(),model=await loadForwardDemoModules(),fixture=await searchFixture();
 let ledger=await search.createSearchLedger(await search.createSearchPlan(fixture.admission));
 for(const candidate of fixture.admission.candidates){ledger=await search.admitSearchTrain(ledger,candidate.source.id,ledger.events.at(-1).at);ledger=await search.finishSearchAttempt(ledger,await search.evaluateSearchAttempt(search.pendingSearchAttempt(ledger),{finishedAt:ledger.events.at(-1).at}));}
 const locked=await search.lockSearchSelection(ledger,ledger.events.at(-1).at),testAt=fixture.testInput.dataset.bars.at(-1).closedAt,pending=await search.admitSearchTest(locked,fixture.testInput,testAt);
 if(interruptedTest)ledger=await search.recoverSearchLedger(pending,testAt);else ledger=await search.finishSearchAttempt(pending,await search.evaluateSearchAttempt(search.pendingSearchAttempt(pending),{finishedAt:testAt}));
 const handoff=await model.createLockedSearchHandoff(ledger),config=model.boundedSessionConfig({version:1,sessionId:'f2600000-0000-4000-8000-000000000001',methodVersion:'opengrail-session-v1',clockMode:'SYSTEM_RECEIPT',origin:'PUBLIC_STRATEGY',strategy:{record:handoff.winner.source.record,digest:handoff.winner.source.digest},initialCapital:handoff.initialCapital,provenance:'USER_SUPPLIED',rights:{permission:'AUTHORIZED_USE',acknowledged:true,note:'Synthetic acceptance declaration only; no real provider permission or market results.'},sourceLabel:'Invented acceptance inputs',ordersEnabled:false,liveEnabled:false}).config;
 return {search,model,fixture,locked,pending,ledger,handoff,config};
}
