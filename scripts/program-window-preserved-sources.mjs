// Exact preservation locations for the twelve fixed legacy rows changed by the
// capacity/compatibility update. Active root files have separate current guards.
export const windowHistoricalSourcePaths=Object.freeze({
 'app/program-direction-forward-plan-model.ts':'scripts/compat/session-capacity-20261015/app/program-direction-forward-plan-model.ts.source',
 'app/program-forward-plan.ts':'scripts/compat/session-capacity-20261015/app/program-forward-plan.ts.source',
 'app/program-session-fingerprints.ts':'app/compat/session-20261011/program-session-fingerprints.ts',
 'app/program-session-journal.ts':'app/compat/session-20261011/program-session-journal.ts',
 'app/session-engine.ts':'app/compat/session-20261011/session-engine.ts',
 'app/session-fingerprints.ts':'app/compat/session-20261011/session-fingerprints.ts',
 'app/session-journal.ts':'app/compat/session-20261011/session-journal.ts',
 'app/session-model.ts':'app/compat/session-20261011/session-model.ts',
 'scripts/program-session-fingerprint-core.mjs':'scripts/compat/session-capacity-20261015/scripts/program-session-fingerprint-core.mjs.source',
 'scripts/program-session-runtime.mjs':'scripts/compat/session-capacity-20261015/scripts/program-session-runtime.mjs.source',
 'scripts/recorded-direction-program-kraken-core.mjs':'scripts/compat/session-capacity-20261015/scripts/recorded-direction-program-kraken-core.mjs.source',
 'scripts/recorded-program-kraken-core.mjs':'scripts/compat/session-capacity-20261015/scripts/recorded-program-kraken-core.mjs.source',
});
export const windowLegacySourceManifestSha256='9eb9e427e3f21a2acd7ee5604ceb36d33d35e636201d8e7238322a6bbf71b5cf';
export function windowPreservedSourcePath(path){return Object.hasOwn(windowHistoricalSourcePaths,path)?windowHistoricalSourcePaths[path]:path;}
