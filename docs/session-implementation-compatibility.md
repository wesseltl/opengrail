# Session implementation compatibility

The capacity fix removes two repeated schema parses of snapshots that have just
passed the same strict schema. Public checkpoint hashing still parses its input;
input descriptors, complete schemas, receipt chains, state hashes, journal
reconstruction, retained history and all capacity limits remain enforced. The
2,000-event test and its 32 emergency/risk slots retain their original deadline.

New Session and programmable-forward journals declare the actual current source
hashes. Their method and data schemas retain their existing interpretation. The
current source differs from the archived source; matching outputs do not make
their physical implementation identities interchangeable.

The exact previous Session and programmable-forward engine/model/journal source
files and their fingerprint declarations are retained under
`app/compat/session-20261011/`. Six transparent reexports resolve only unchanged
shared dependencies. `scripts/session-legacy-fingerprint-core.mjs` verifies the
archive bytes, bridge bytes and original shared dependency hashes. Current evidence and controller loaders also retain their actual bundled
source graphs during an operation.

Only the complete current tuple or the complete retained tuple is recognized.
Mixed or unknown tuples are refused. Imports remain inert. Explicit local
reconstruction and continuation select the implementation actually declared by
the journal; reconstruction reports retain that identity. Programmable-forward
evidence therefore uses `SAME_IMPLEMENTATION_RECONSTRUCTION` only when the actual
replay uses the exact declared graph. Plans retain their original hashes and
complete Search history, and browser startup selects their declared engine.

The three JSON journals in `examples/sessions/20261011/` remain byte-for-byte
unchanged and reconstruct through the archive. The older root-level examples
remain unsupported. Existing original physical-source pin tables retain their
bytes and hashes. Where a protected source now has a new implementation, the
historical resolver verifies the original table entry against an exact preserved
copy, while the current operation separately guards the actual new graph. These
are preserved historical sources, not a claim that all original paths are
unchanged.

Compatibility covers Session journals, historical forward-plan identity and V4
programmable-forward evidence. Existing raw market-data collector archives still
require their original full physical source graph; current collectors retain
their strict source checks and explicitly bind current plans to matching receiver
implementations, rejecting unsupported old contexts. Fresh collection
requires a current plan and matching current receiver. No collector resumption,
quota, runtime scheduling, permission, provider or financial authority changes
follow from this fix.

All examples and compatibility exercises use invented local data. Their results
remain `AUTHOR_REPORTED`, qualification `NONE`, with independence and authentic
market observations unestablished.
