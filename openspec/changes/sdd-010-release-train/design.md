# SDD-010 — Program-Lock Promotion Design

## Scope

This design promotes the Drenyra Dominion program lock as a release-governance checkpoint. It adds deterministic checksum tooling, refreshes revision-bound evidence, and defines the external Phase B5 attestation that pins the otherwise self-unreferenceable carrying commit.

The change is documentation and tooling only. It does not add runtime or install-time consumption of `program-lock.json`; that remains SDD-020 slice C.

## Decisions

| Decision | Resolution | Rationale |
| --- | --- | --- |
| Checksum representation | Store a structured `checksums` object directly in `program-lock.json`; do not commit a checksum sidecar. | The lock remains the single composition record. A second committed manifest would create synchronization and self-inclusion ambiguity. |
| Checksum inputs | Require the published host `.tgz`; include immutable sibling release artifacts only when they are locally available and supported by evidence. Omit repositories with no referenced artifact, including the unknown private trio. | A repository SHA is already an immutable composition pin, but it is not an artifact digest. Missing artifacts must not be fabricated. |
| Producer interface | `scripts/checksum-lock.mjs` reads the lock and explicit `repository=path` artifact bindings. It emits canonical checksum JSON to stdout or an explicitly requested staging path, and verifies an existing lock block in check mode. | Explicit inputs make the operation bounded, testable, independent of the working directory, and fail-closed. No temporary sidecar is part of the committed contract. |
| Canonical order | Sort entries by Unicode code-point order of `repository`, then `artifact`; serialize the checksum entries with a fixed property order and LF newline. | Filesystem enumeration and locale must not affect output. |
| Self-inclusion | Reject `program-lock.json` (including aliases resolving to it) as an artifact input. Never inspect or emit `HEAD`, a tag target, or any carrying-commit SHA. | This enforces both the checksum self-inclusion rule and the bootstrap rule in tooling rather than relying only on operator discipline. |
| Current host revision | Resolve and corroborate the immutable host revision during apply; do not hard-code it in this design. Record version `0.4.0`, `915/915`, clean typecheck, passing conformance, and `PUBLIC` only after all evidence is revision-bound. Keep `host.commitSha: null`. | The current revision and evidence timestamps are operational facts, not design-time assumptions. |
| Sibling facts | Fetch `drenyra-engram` and `drenyra-pi` default-branch SHAs and visibility through `gh api` during apply and record source, fetch time, and evidence ID. Keep the private trio explicitly `unknown` / `awaiting-evidence` with `commitSha: null`. | This records only facts available from admissible evidence and does not relabel historical snapshot entries as current. |
| Historical repository array | Preserve `repositories[]` as the historical snapshot; put current sibling facts only under `currentVerified.siblingRepositories`. | Rewriting snapshot values would destroy their temporal meaning and blur current versus historical claims. |
| Promotion status | Prepare commit B with `status: "promoted"` only after every local gate passes. Treat publication as incomplete until the signed external B5 attestation is created and read back successfully. | Commit B must exist before its SHA can be attested. The release operation therefore fails closed as a two-step publication gate even though the committed lock cannot name commit B. |
| Attestation location | Predeclare the expected signed-tag/release coordinates and binding in the lock, but record the carrying commit only in an external GitHub Release attestation asset referenced by a signed annotated tag. | The external asset can pin commit B without changing commit B. Recording the carrying SHA inside the lock would recreate the circular reference. |
| Schema evolution | Amend the draft-07 schema with bounded definitions for current siblings, checksums, and attestation, plus an `if`/`then` rule requiring them for `status: promoted`. | The current schema accepts unconstrained checksums and cannot validate the promoted structure or honesty rules. Draft-07 supports conditional validation. |
| Fresh verification | Capture suite, typecheck, conformance, package-version, visibility, and sibling-fetch evidence during apply against named immutable revisions; every lock evidence ID must resolve before promotion. | W2 evidence for `0.2.1` / `774` is stale and cannot support the new checkpoint. |

## Data Flow and Promotion Sequence

1. Resolve the host verification revision `R` at apply time and prove that `package.json` at `R` is version `0.4.0`.
2. Run the complete suite against `R` and require exactly `915 passed / 915 total`; run typecheck and conformance against the same revision. Capture command, revision, timestamp, and outcome in new evidence records.
3. Fetch the public default-branch repository metadata and immutable SHAs for `drenyra-engram` and `drenyra-pi` using `gh api`. Capture endpoint, SHA, visibility, fetch time, and evidence ID. Do not infer facts for inaccessible repositories.
4. Produce the host package `.tgz`. Fetch sibling release artifacts only where an immutable artifact and supporting evidence are available.
5. Run `checksum-lock.mjs` over the explicit artifact bindings. Insert its exact `checksums` object into the candidate lock.
6. Populate `currentVerified`, the attestation declaration, and `status: "promoted"`. Validate the lock against the amended schema, resolve every evidence ID, parse the capability matrix, rerun checksum verification, and confirm that private siblings remain unknown.
7. Create commit B. The lock still contains no commit-B SHA.
8. Create signed tag `drenyra-dominion-v0.4.0` targeting commit B and publish a GitHub Release with `drenyra-dominion-v0.4.0.attestation.json` as an immutable asset.
9. Read the tag target and the lock bytes from commit B, recompute all bindings, and compare them with the attestation. Only then is publication accepted and delivery-sequence §7 item 4 marked complete.

Any missing input, command failure, malformed response, unresolved evidence ID, digest mismatch, schema error, or attestation mismatch stops publication. Existing external attestations are never mutated; a correction uses a new checkpoint/tag.

## `scripts/checksum-lock.mjs`

### Inputs

The script accepts:

```text
node scripts/checksum-lock.mjs \
  --lock openspec/programs/drenyra-dominion/program-lock.json \
  --artifact drenyra-ai=dist/drenyra-ai-0.4.0.tgz \
  [--artifact drenyra-engram=<immutable-artifact>] \
  [--artifact drenyra-pi=<immutable-artifact>] \
  [--output <staging-file>]

node scripts/checksum-lock.mjs --verify \
  --lock openspec/programs/drenyra-dominion/program-lock.json \
  --artifact ...
```

Rules:

- Resolve the repository root from `import.meta.url`, not `process.cwd()`.
- Resolve each supplied file with `realpath`; require a regular, readable, non-symlink file.
- Require exactly one host artifact binding and reject duplicate repository/artifact identities.
- Require every artifact binding to name a repository represented by an admissible current claim in the lock.
- Reject artifacts for an `unknown` repository and reject any path resolving to the lock itself.
- Require the artifact basename to be stable and free of separators, `.`/`..`, control characters, or backslashes.
- Hash raw bytes with `node:crypto` SHA-256 and lowercase hexadecimal output.
- Fail if a lock-declared artifact entry has no supplied readable input or if a supplied input is not admitted by the lock.
- Never call Git or GitHub and never read commit/tag metadata.

Sibling artifacts are optional only when the lock does not declare them. Once an entry is declared, its input is mandatory in generation and verification modes.

### Ordering and canonicalization

1. Build entries with fixed key order: `repository`, `revision`, `artifact`, `sha256`.
2. Sort by `repository`, then `artifact`, using direct code-point comparison with no locale collation.
3. Canonically serialize the `entries` array as compact UTF-8 JSON.
4. Compute `setSha256` over those canonical bytes only.
5. Emit the full `checksums` object as two-space JSON with one trailing LF.

Identical lock facts and artifact bytes therefore produce byte-identical output in any working directory. Timestamps are deliberately excluded from checksum output.

### Output

Generation mode writes the following object to stdout by default. `--output` writes the same bytes to an explicitly named staging file; the script never chooses or commits a sidecar path. Verification mode emits no replacement data and exits non-zero on any difference.

```json
{
  "algorithm": "sha256",
  "canonicalization": "json-entries-v1",
  "entries": [
    {
      "repository": "drenyra-ai",
      "revision": "<APPLY_TIME_VERIFIED_REVISION>",
      "artifact": "drenyra-ai-0.4.0.tgz",
      "sha256": "<64_LOWERCASE_HEX>"
    }
  ],
  "setSha256": "<SHA256_OF_CANONICAL_ENTRIES>"
}
```

Additional evidenced sibling artifacts appear in the same sorted array. Unknown private siblings never receive entries.

## Promoted Lock Structure

The apply phase replaces every placeholder below with corroborated values. Placeholders are design notation and must never be committed.

```json
{
  "status": "promoted",
  "currentVerified": {
    "temporalClass": "current-claim",
    "inspectedRevision": "<APPLY_TIME_HOST_REVISION_R>",
    "inspectedAt": "<RFC3339_UTC>",
    "evidence": [
      "<HOST_VERSION_EVIDENCE_ID>",
      "<HOST_TEST_EVIDENCE_ID>",
      "<HOST_TYPECHECK_EVIDENCE_ID>",
      "<HOST_CONFORMANCE_EVIDENCE_ID>",
      "<HOST_VISIBILITY_EVIDENCE_ID>",
      "<ENGRAM_FETCH_EVIDENCE_ID>",
      "<PI_FETCH_EVIDENCE_ID>"
    ],
    "host": {
      "repository": "drenyra-ai",
      "role": "authority-core",
      "version": "0.4.0",
      "versionEvidence": "<HOST_VERSION_EVIDENCE_ID>",
      "license": "proprietary",
      "licenseEvidence": "<RESOLVABLE_LICENSE_EVIDENCE_ID>",
      "testTotal": 915,
      "testPassed": 915,
      "testEvidence": "<HOST_TEST_EVIDENCE_ID>",
      "typecheck": "clean",
      "typecheckEvidence": "<HOST_TYPECHECK_EVIDENCE_ID>",
      "conformance": "passing",
      "conformanceEvidence": "<HOST_CONFORMANCE_EVIDENCE_ID>",
      "githubVisibility": "PUBLIC",
      "visibilityEvidence": "<HOST_VISIBILITY_EVIDENCE_ID>",
      "commitSha": null,
      "note": "The inspected revision is verification input; the carrying commit is pinned only by the external Phase B5 attestation."
    },
    "siblingRepositories": {
      "drenyra-engram": {
        "temporalClass": "current-claim",
        "commitSha": "<GH_API_MAIN_SHA>",
        "githubVisibility": "PUBLIC",
        "source": "gh-api",
        "fetchedAt": "<RFC3339_UTC>",
        "evidence": "<ENGRAM_FETCH_EVIDENCE_ID>"
      },
      "drenyra-pi": {
        "temporalClass": "current-claim",
        "commitSha": "<GH_API_MAIN_SHA>",
        "githubVisibility": "PUBLIC",
        "source": "gh-api",
        "fetchedAt": "<RFC3339_UTC>",
        "evidence": "<PI_FETCH_EVIDENCE_ID>"
      },
      "drenyra-command-center": {
        "temporalClass": "unknown",
        "commitSha": null,
        "status": "awaiting-evidence"
      },
      "drenyra-skills": {
        "temporalClass": "unknown",
        "commitSha": null,
        "status": "awaiting-evidence"
      },
      "drenyra-guardian-angel": {
        "temporalClass": "unknown",
        "commitSha": null,
        "status": "awaiting-evidence"
      }
    }
  },
  "checksums": {
    "algorithm": "sha256",
    "canonicalization": "json-entries-v1",
    "entries": ["<SORTED_EVIDENCED_ARTIFACT_ENTRIES>"],
    "setSha256": "<CHECKSUM_SET_SHA256>"
  },
  "attestation": {
    "scheme": "signed-git-tag+github-release-asset-v1",
    "tag": "drenyra-dominion-v0.4.0",
    "asset": "drenyra-dominion-v0.4.0.attestation.json",
    "verifiedRevision": "<APPLY_TIME_HOST_REVISION_R>",
    "checksumSetSha256": "<CHECKSUM_SET_SHA256>",
    "carryingCommitSha": null,
    "note": "The carrying commit is intentionally recorded only in the external signed Phase B5 attestation."
  }
}
```

The external attestation asset has fixed keys `schemaVersion`, `program`, `lockVersion`, `tag`, `carryingCommitSha`, `verifiedRevision`, `checksumSetSha256`, and `lockSha256`. `lockSha256` hashes the exact `program-lock.json` bytes read from commit B. The signed tag targets the same `carryingCommitSha`; release readback rejects any mismatch.

The schema will require non-negative integer `testPassed` and `testTotal` values, lowercase 40-hex current SHAs, `null` for unknown sibling SHAs and host `commitSha`, and lowercase 64-hex checksum digests. The SDD-010 readback gate—not the reusable schema—requires the exact `915/915` result. Cross-field equality and attestation bindings that draft-07 cannot express are enforced by readback tooling/tests, not falsely claimed as schema validation.

## File-by-File Change Plan

| File | Planned change | Estimated authored lines |
| --- | --- | ---: |
| `scripts/checksum-lock.mjs` | Add bounded generation/verification CLI, canonical ordering, SHA-256 hashing, path validation, and fail-closed errors. | 60–70 |
| Focused checksum test under the existing script-test convention | Strict-TDD coverage for determinism, canonical order, digest format, lock self-exclusion, symlink/unreadable/missing input, unknown sibling rejection, and verify mismatch. | 50–60 |
| `openspec/programs/drenyra-dominion/program-lock.json` | Refresh current facts and evidence, preserve historical snapshots, populate checksums/attestation declaration, and promote after gates. | 20–30 |
| `openspec/programs/drenyra-dominion/program-lock.schema.json` | Add bounded definitions and promoted-status conditional requirements while remaining valid draft-07. | 25–35 |
| `openspec/programs/drenyra-dominion/release-train.md` and `delivery-sequence.md` | Document checksum generation/readback, signed-tag/release attestation, two-step publication semantics, and close §7 item 4 only after external readback. | 10–15 |
| Existing evidence/capability records | Add resolvable apply-time evidence IDs and synchronize only claims proven by those records. | 5–10 |
| **Total forecast** | One docs/tooling review unit; split only if apply-time evidence changes exceed the forecast. | **170–220** |

The target is approximately 200 lines. If strict tests or schema constraints push the change above the configured review budget, keep checksum tooling/tests as the first independently verifiable slice and promotion records as the second; do not weaken tests or schema to fit the budget.

## Test and Readback Plan

### Focused automated tests

- Same lock and artifact bytes from two different working directories produce byte-identical JSON.
- Reversed CLI artifact order produces the same sorted entries and `setSha256`.
- Every digest is lowercase 64-character SHA-256 and changes when artifact bytes change.
- Direct, relative, normalized, or symlinked references to `program-lock.json` are rejected.
- Missing, unreadable, non-regular, symlinked, duplicate, unknown-repository, and undeclared inputs fail closed.
- Unknown private siblings produce no entries; a supplied artifact for one is rejected.
- `--verify` passes for the exact lock block and fails for a changed artifact, missing entry, extra entry, wrong revision, or changed ordering/canonicalization.

### Promotion gates

1. Parse both JSON documents and validate the schema itself as draft-07.
2. Validate the promoted lock against `program-lock.schema.json`.
3. Assert `0.4.0`, `915/915`, clean typecheck, passing conformance, `PUBLIC`, exact revision binding, and `host.commitSha === null`.
4. Resolve every evidence ID and verify that each record names the same revision/fetch result claimed by the lock.
5. Confirm public sibling SHAs and visibility from fresh `gh api` evidence; confirm the private trio remains unknown with null current SHAs.
6. Run checksum generation twice and `--verify`; assert no lock path or carrying-commit SHA appears in the checksum output.
7. Parse the capability matrix and run the existing conformance/readback checks.
8. After commit B, verify the signed tag, release asset, tag target, `lockSha256`, `checksumSetSha256`, and `verifiedRevision` as one binding.
9. Confirm the diff contains no runtime/install-time consumer of `program-lock.json` and no frozen contract change.

## Rollout and Failure Handling

Promotion is staged locally, committed as B only after deterministic gates pass, and published only after the external attestation readback succeeds. If B5 fails, do not describe the checkpoint as published and do not mark delivery-sequence §7 item 4 complete. If an already-published binding is later invalid, supersede it with a new lock commit, tag, and attestation; never rewrite the historical tag, release asset, receipt, or evidence record.
