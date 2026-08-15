# SDD-010 — Program-Lock Promotion Proposal

> Change: `sdd-010-release-train`  
> Program: Drenyra Dominion  
> Roadmap mapping: Wave 0 — Constitution (`SDD-000`–`SDD-010`)  
> Status: Proposed

## Intent

Promote `openspec/programs/drenyra-dominion/program-lock.json` from a candidate composition to a published, reproducible checkpoint whose current claims are revision-bound, whose verifiable sibling facts are recorded, whose checksums are deterministic, and whose carrying commit is pinned by the external release attestation required by delivery-sequence §7 item 4 / Phase B5.

This proposal advances the Wave 0 release-train governance capability. It does not complete SDD-010: SDD-010 remains active until the federated release train is executed across the ecosystem.

## Context

The release train uses a two-phase delivery process. Phase A lands independent documentary commits in each repository. Phase B refreshes the lock, verifies the exact composition, publishes the host lock commit first, records that commit in an external release manifest or attestation, and promotes the checkpoint.

The program lock cannot contain the SHA of the commit that carries it. It therefore records the inspected host revision and externally verifiable composition, while the Phase B5 attestation pins the carrying commit. Promotion is a governance and release-integrity operation; it does not add a runtime dependency on the lock.

## Current-State Gap

The current lock is not publishable as a promoted checkpoint:

- Its status remains `candidate`.
- `currentVerified.host` is stale at version `0.2.1`, `774` tests, and inspected revision `549ed640…`; the host package is now `0.4.0` with a `915/915` suite.
- Current sibling composition is represented as unknown. The public `drenyra-engram` and `drenyra-pi` repositories can now provide verified `PUBLIC` visibility and fetchable main-branch SHAs, while the private trio still lacks admissible revision evidence.
- The `checksums` object contains only a generation note and no deterministic composition checksums.
- The release-manifest attestation workflow required by delivery-sequence §7 item 4 / Phase B5 remains open.
- The W2 evidence is not fresh enough to support promotion of the current revision.

Without this promotion, operators cannot identify one evidence-backed program checkpoint that connects the verified lock content to the otherwise self-unreferenceable lock commit.

## Proposed First Slice

### 1. Refresh the revision-bound host claim

Refresh `currentVerified` against the exact revision being promoted and record:

- host version `0.4.0`;
- a fresh `915/915` green test result;
- clean typecheck and passing conformance evidence;
- host visibility `PUBLIC`;
- the exact inspected revision and inspection time; and
- resolvable evidence identifiers for every current claim.

`currentVerified.host.commitSha` remains `null`. The inspected revision identifies the verified tree, not the commit that carries the promoted lock.

### 2. Record only verified sibling facts

Record `drenyra-engram` and `drenyra-pi` as verified `PUBLIC` siblings using freshly fetched, immutable commit SHAs and corresponding evidence.

Keep `drenyra-command-center`, `drenyra-skills`, and `drenyra-guardian-angel` explicitly `unknown` / `awaiting evidence` under E-010 unless a credentialed federated runner produces admissible evidence before promotion. Historical snapshot values must not be relabeled as current facts.

Promotion in this slice means publishing the verifiable checkpoint with its evidence boundary made explicit. It does not claim that unknown private-repository revisions were verified.

### 3. Generate deterministic lock checksums

Add a bounded `scripts/checksum-lock.mjs` producer with focused tests. It will generate stable SHA-256 checksum entries for the pinned, verifiable composition using deterministic ordering and fail-closed validation.

The checksum set must exclude `program-lock.json` itself. It must not checksum or otherwise encode the SHA of the commit that carries the lock. Unknown private sibling facts remain represented as unknown rather than receiving invented checksum material.

### 4. Record the Phase B5 release attestation

Add the release-manifest attestation workflow required by delivery-sequence §7 item 4. The external manifest or release artifact pins the SHA of the commit carrying the promoted lock, completing the bootstrap link without introducing self-reference.

The attestation must bind to the exact lock/checksum output and verified revision, and promotion must fail closed when those inputs do not match.

### 5. Promote the checkpoint

After fresh verification and readback gates pass:

- populate the lock checksum block;
- set `status` from `candidate` to `promoted`;
- update supporting release-train, delivery-sequence, capability, and evidence records consistently; and
- record completion of delivery-sequence §7 item 4.

## Business and Architecture Rules

- **Freshness:** Promotion requires a fresh, revision-bound green verification over the exact inspected revision. W2 results for `0.2.1` / `774` cannot be reused.
- **Bootstrap honesty:** The lock never references the commit that carries it. That commit is pinned only by the external Phase B5 attestation.
- **Checksum honesty:** The lock checksum set excludes the lock file itself and cannot include fabricated inputs.
- **Evidence honesty:** Public sibling SHAs must be fetched and evidenced. Private sibling facts remain unknown unless credentialed evidence is available.
- **Readback:** Before promotion, validate the lock against its schema, parse the capability matrix, verify checksum determinism, and resolve every evidence identifier. Any unsupported current claim blocks promotion.
- **Authority boundary:** This remains release governance in the Drenyra Dominion program tree. It does not alter the AI-advisory versus deterministic-authority boundary, audit ledger versus accounting journal responsibilities, or evidence versus memory semantics.
- **Roadmap boundary:** This closes a Wave 0 checkpoint capability. Runtime consumption of the lock belongs to SDD-020 slice C and is not pulled forward.

## Affected Areas

The implementation is expected to affect:

- `openspec/programs/drenyra-dominion/program-lock.json`;
- program-lock validation only if an existing schema constraint proves insufficient;
- release-train and delivery-sequence governance documentation;
- capability and evidence records supporting current claims;
- a bounded `scripts/checksum-lock.mjs` producer and focused tests; and
- the external release-manifest / attestation workflow or artifact used for Phase B5.

No production runtime path should change.

## Non-Goals

- No runtime or install-time consumption of `program-lock.json`; that is SDD-020 slice C.
- No new producer-consumer contracts or changes to frozen contracts.
- No fabricated SHAs, versions, conformance results, checksums, or visibility claims for inaccessible siblings.
- No assertion that the private trio is verified merely because the checkpoint is promoted.
- No completion or archival of SDD-010 before the federated release train is executed.
- No unrelated Wave 1+ runtime, fiscal, memory, evidence, journal, policy, ingest, or SUNAT-facing capability work.

## Product Tradeoffs

Publishing a promoted checkpoint while the private trio remains explicitly unknown provides an honest, usable boundary for currently verifiable composition facts and unblocks the attested host checkpoint. The tradeoff is that `promoted` does not mean every private repository fact is known; consumers must inspect temporal and evidence status rather than treating the status field alone as proof of full federation.

Waiting for all private credentials would produce a more complete lock but would couple publication to inaccessible infrastructure and encourage stale or fabricated claims. This proposal chooses transparent incompleteness over false certainty.

## Risks and Mitigations

1. **Circular host self-reference — critical.** A naive implementation could include the carrying commit in the lock or its checksums. Mitigation: keep `currentVerified.host.commitSha` null, exclude the lock from its checksum set, and pin the carrying commit only in the external attestation.
2. **Stale verification.** Reusing W2 evidence would promote the wrong host version and suite. Mitigation: require a fresh `0.4.0`, `915/915`, exact-revision verification immediately before promotion.
3. **False sibling certainty.** Historical or inaccessible private facts could be mistaken for current claims. Mitigation: fetch and evidence only the public pair; retain explicit unknown/awaiting-evidence states for the private trio.
4. **Checksum ambiguity or nondeterminism.** Different environments could generate different manifests. Mitigation: define canonical inputs, SHA-256 encoding, deterministic ordering, self-exclusion, and fail-closed verification in focused tests.
5. **Attestation/lock mismatch.** An attestation could pin a different lock commit or checksum set. Mitigation: bind the manifest to the exact promoted lock output and reject mismatches during readback.
6. **Semantic overstatement of `promoted`.** Consumers may infer complete six-repository verification. Mitigation: preserve temporal classes and explicit unknowns, and document that SDD-010 remains active until full federated execution.

## Rollback

If promotion evidence, checksums, or attestation are later found invalid:

1. stop publication and mark the affected checkpoint superseded or revert the promotion change according to repository policy;
2. restore the last valid program-lock composition without rewriting its historical receipt or attestation;
3. withdraw or supersede the invalid external attestation rather than mutating it;
4. rerun revision-bound conformance and checksum verification over the restored composition; and
5. issue a new candidate and attestation for any corrected checkpoint.

Rollback must preserve the historical audit trail and must not retrofit evidence into the invalid checkpoint.

## Success Criteria

The proposal is successful when:

- the lock status is `promoted` only after all promotion gates pass;
- stale host facts (`0.2.1`, `774`, and revision `549ed640…`) are replaced by revision-bound `0.4.0`, `915/915`, `PUBLIC`, and current-revision evidence;
- `drenyra-engram` and `drenyra-pi` have freshly verified `PUBLIC` facts and fetchable immutable SHAs;
- the private trio remains honestly `unknown` / `awaiting evidence` unless admissible credentialed evidence is produced;
- deterministic checksums are populated and verified without lock-file self-inclusion or carrying-commit self-reference;
- the Phase B5 release manifest or attestation pins the carrying lock commit and §7 item 4 is recorded complete;
- schema, capability-matrix, checksum, and evidence-ID readback gates pass;
- the complete test suite remains green at `915/915`; and
- no runtime code path consumes the program lock and no new contract is introduced.
