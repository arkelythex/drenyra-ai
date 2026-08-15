# SDD-020 · Slice 2 (Host Integration) — Exploration

> Status: exploration · Change: `sdd-020-host-integration` · Repo: `drenyra-ai`
> Predecessor: slice 1 delivered under `sdd-020-configurator` (PRs #34/#35), 798/798 green. SDD-020 record: `openspec/programs/drenyra-dominion/sdds/sdd-020-configurator/README.md`.
> This map establishes the **current host-integration state** and the **slice-2 gap** (per-host pinned runtime/model/tool, four-host E2E, program-lock-aware install).

## 1. Executive summary

Slice 1 delivered the full **package-level composition core** but left host-facing work deferred. Today:

- **Three hosts** are detected/configured (`codex`, `claude-code`, `opencode`) — **no Drenyra Pi host**. Marker + skills-asset writing only.
- **No per-host runtime/model/tool pinning** anywhere (`pinned-ai-runtime` absent in code). The only "pin" is a package-level `package-pin` doctor diagnostic.
- **`program-lock` is never read** by any command. `program-lock.json` sits at `status: candidate` (never promoted); nothing in `drenyra-ai` consumes it at install/sync/upgrade/rollback time.
- **No four-host E2E.** Tests cover three-host detection/install; no Pi, no per-host pin, no program-lock resolution.
- `capabilities.ts` still labels host integrations `"(planned)"` — stale wording now that three hosts are configured.

Slice 2 must add: (A) per-host pinned runtime/model/tool composition, (B) the Drenyra Pi host + four-host E2E, (C) program-lock-aware install. A is the bounded first-slice candidate; B is a natural companion; C is the largest and cross-cutting (SDD-010 boundary).

## 2. Current host-integration inventory (file/symbol-cited)

### 2.1 Hosts detected today — three, no Pi

`configurator/managed-config.ts`:

- `HOST_DIR_MAP` (lines 46–50): `codex → ".codex"`, `"claude-code" → ".claude"`, `opencode → ".config/opencode"`.
- `type HostName = "codex" | "claude-code" | "opencode"` (line 58) — the **type-level** allowed set. Adding a host is a type change.
- `ASSET_FILENAMES` (lines 53–56): `marker: ".drenyra-managed"`, `skills: ".drenyra-skills.json"` — the only managed assets written into each present host's config dir.
- `reDeriveHostConfigDir(homeDir, name)` (line ~185) = `join(homeDir, HOST_DIR_MAP[name])`.
- `detectHosts(homeDir)` (line ~199) — read-only `existsSync` probe per host; returns `DetectedHost { name, configDir, present }`.
- `classifyManifest` (line ~240) fails closed on any host whose recorded `configDir` is not the re-derived managed dir (`redirected-host-path`).

`cmd/commands/install.ts`:

- `installIntegrations(homeDir, now?)` — for each **present** host, writes `.drenyra-managed` + `.drenyra-skills.json` **only when absent** (never overwrites foreign changes); persists `~/.drenyra/managed.json` (`MANAGED_DIR=".drenyra"`, `MANAGED_FILE="managed.json"`) with the composition record (`sequence 0`, `previous null` on fresh install).
- `installCommand(args)` — JSON `{status:"installed", version, detectedHosts, configured, note}`; exit 0.

`cmd/commands/sync.ts`:

- `syncManaged(homeDir)` — per-host marker compare vs `expectedMarkerContent`; **preserves** foreign-modified markers (`preserved`), recreates missing, reports `missing` for absent hosts, `not-installed` without a manifest.

### 2.2 Markers written today

| Host | Config dir | Managed assets |
| --- | --- | --- |
| `codex` | `~/.codex` | `.drenyra-managed`, `.drenyra-skills.json` |
| `claude-code` | `~/.claude` | `.drenyra-managed`, `.drenyra-skills.json` |
| `opencode` | `~/.config/opencode` | `.drenyra-managed`, `.drenyra-skills.json` |
| `drenyra-pi` | **none** | **none** — not a recognized host |

### 2.3 Command surface — all five registered

`cmd/cli.ts` (lines 72–85, 122–131): `doctor`, `install`, `sync`, `upgrade`, `rollback` all registered and runnable. `upgrade run <version>`, `rollback run` in `cmd/commands/upgrade.ts` / `rollback.ts`.

## 3. Per-host pinning — ABSENT

Grep across `configurator/` and `cmd/` for `runtime|model|tool` pinning returns **no per-host pin** code. The only pin-shaped logic:

- `ConfigDiagnostic.name = "package-pin"` (`managed-config.ts` ~line 901) — compares **recorded composition version** against the **packaged drenyra-ai version**. Package-level only; **no per-host runtime/model/tool**.
- `pinned-ai-runtime` appears **only in program docs / capability matrix**, never in code.

**Gap**: slice 2 must introduce a per-host pinned composition record (runtime + model + tool versions) written by install/sync and read by doctor — the `drenyra-pi`-consumable contract (`pinned-ai-runtime`).

## 4. Program-lock-aware install — ABSENT

- Grep for `program-lock|programLock` in `cmd/`, `configurator/`, `scripts/` → **no code matches**. Nothing reads the lock at runtime or install time.
- The promoted artifact: `openspec/programs/drenyra-dominion/program-lock.json` — `status: "candidate"` (**never promoted**), with `currentVerified.host` and a top-level `host { repository, programBaseCommit }` binding (schema: `program-lock.schema.json`). It pins repo SHAs, versions, contracts, checksums.
- `delivery-sequence.md`: **bootstrap rule** — the lock never self-references the commit carrying it; any "pin to current composition" logic must respect this to avoid circular installs.
- The SDD-020 record requires "every host consumes the **promoted artifact**, never a copy of `main`."

**Gap**: slice 2 must add install-time resolution of the promoted `program-lock` artifact to derive the version/composition to pin to. Because the lock is a program doc (not shipped in the npm package), the configurator must consume a **published artifact manifest** — the mechanism for how the configurator obtains and verifies the promoted lock is an open design question.

## 5. The four hosts & the drenyra-pi boundary

| Host | Config dir today | Marker today |
| --- | --- | --- |
| Codex | `~/.codex` | `.drenyra-managed` + skills |
| Claude Code | `~/.claude` | `.drenyra-managed` + skills |
| OpenCode | `~/.config/opencode` | `.drenyra-managed` + skills |
| Drenyra Pi | **none** | **none** |

- `capabilities.ts` (line 28): `integrations: ["MCP (planned)", "Codex/Claude Code/OpenCode (planned)"]` — **stale "(planned)"** wording; three hosts are already configured.
- The `drenyra-pi` relationship per slice-1 exploration and `docs/architecture.md`: drenyra-pi is a **sibling consumer** that consumes released, versioned `drenyra-ai` artifacts and pins a version package-locally. `capability-matrix.yaml` records `configurator-install-doctor-sync` and `pinned-ai-runtime` **on the `drenyra-pi` row** — the configurator is a `drenyra-pi`-served capability.
- **Boundary**: `drenyra-ai` = deterministic commands (authority-core ships `install`/`doctor`/`sync`/`upgrade`/`rollback` + published candidates). `drenyra-pi` = host-serving integration (serves the configurator capability, pins versions, writes host runtime/model/tool). The "Pi host" in the four-host E2E is a host **drenyra-ai configures** (a marker/config dir), while the actual serving of the integration happens on the Pi side.

## 6. Tests — current coverage

| File | Covers |
| --- | --- |
| `cmd/__tests__/install-sync.test.ts` | `detectHosts`, `installIntegrations`, `readInstallManifest`, `syncManaged`. Three-host detection; foreign marker preserved; not-installed; composition record (`sequence`/`schemaVersion`/hashes/`previous null`/version mirror); legacy-manifest sync. |
| `cmd/__tests__/configurator-transitions.test.ts` | upgrade/rollback engines: current/previous/sequence/version mirror; byte-for-byte idempotency; `COMPOSITION_NOT_PACKAGED`; `ROLLBACK_UNAVAILABLE`; fail-closed state paths; legacy hydration; foreign preservation across transitions; atomic fail-closed commit; boundary compliance (no host binary, no authz, allowlisted paths, frozen contracts/program docs untouched). |
| `cmd/__tests__/capabilities-doctor.test.ts` | doctor: clean checkout; packaged-contract resolution; SDD-020 diagnostics (`managed-state`, `managed-drift`, `package-pin`, `host-prerequisites`). |

**Gap**: no Drenyra Pi host test; no per-host runtime/model/tool pin test; no program-lock resolution test; **no four-host E2E** (install→doctor→sync→upgrade→rollback across all four hosts).

## 7. The slice-2 gap (what must be added)

| SDD-020 scope item | Exists today | Slice-2 delta |
| --- | --- | --- |
| Host integration: Codex / Claude / OpenCode | ✅ three hosts, marker+skills | (complete) |
| Host integration: **Drenyra Pi** | ❌ none | Add Pi host to `HostName` + `HOST_DIR_MAP` + detection + marker; boundary: Pi serves the integration, drenyra-ai configures the host |
| **Per-host pinned runtime/model/tool** (`pinned-ai-runtime`) | ❌ absent | Per-host pin record written by install/sync, read by doctor; `drenyra-pi`-consumable contract |
| **Four-host E2E** (install→doctor→sync→upgrade→rollback) | ❌ absent | E2E across all four hosts incl. Pi |
| **Program-lock-aware install** (promoted artifact, never `main`) | ❌ absent | install resolves the promoted `program-lock` artifact to pin the version/composition |
| `capabilities.ts` `"(planned)"` wording | stale | reconcile to "configured" once hosts + Pi are in |

## 8. First-slice candidates (bounded, ≤400 lines/review → chained PRs)

**A. Per-host pinned runtime/model/tool composition (`pinned-ai-runtime`).**
Extend `managed-config.ts` with a per-host pin record (`runtime`, `model`, `tool` versions), render it into install/sync assets and the composition snapshot, and surface it in doctor (`pinned-ai-runtime` diagnostic). Library-first, no reverse imports. **~150–250 changed lines + tests. Recommended first slice.** Directly closes the `pinned-ai-runtime` gap; smallest surface.

**B. Drenyra Pi host + four-host E2E.**
Add `drenyra-pi` to `HostName` + `HOST_DIR_MAP` + detection + marker; add a four-host E2E test (install→doctor→sync→upgrade→rollback across all four). **~120–200 changed lines + tests.** Natural companion to A; touches the `drenyra-pi` serving boundary — confirm whether the Pi host config dir lives in this repo or on the Pi side.

**C. Program-lock-aware install (promoted artifact).**
Read the promoted `program-lock` at install to derive the pinned version/composition; verify every host consumes the promoted artifact, never a copy of `main`. **Largest and most cross-cutting (SDD-010 boundary).** Recommend a later slice / chained PR, not first-slice — it must resolve how the configurator obtains and verifies the published lock manifest (it is a program doc, not shipped in the package) and respect the lock bootstrap rule (no self-reference).

Recommended: **A → B** as the first slice pair; **C** as a following chained PR.

## 9. Risks / boundary notes

- **Foreign preservation**: install/sync must never clobber foreign markers. New per-host pin assets must preserve foreign content (same `preserved` contract as marker/skills).
- **Never-install-host invariant**: slice 2 only configures managed markers/pins; it must never install, upgrade, remove, or replace a host binary. Pin writing is runtime configuration only.
- **Layer model**: `managed-config.ts` imports only `node:*` + `skills/` (no `cmd/`/`agents/`). Per-host pins and program-lock resolution must stay in the library layer to avoid reverse imports.
- **Program-lock bootstrap**: the lock never self-references the commit carrying it; "pin to current composition" must avoid circular installs. Lock `status` is `candidate`, not `promoted` — resolution should only accept a genuinely promoted checkpoint.
- **Pi ownership ambiguity**: is the Pi host a config dir in this repo, or served entirely on the `drenyra-pi` side? The capability matrix puts `configurator-install-doctor-sync` on the `drenyra-pi` row. The boundary: `drenyra-ai` = deterministic commands; `drenyra-pi` = host-serving integration.
- **400-line review limit** → plan chained PRs (slice-1 precedent was two chained PRs on the line overage).
- **Stale wording**: `capabilities.ts` `"(planned)"` for already-configured hosts is a doc/accuracy defect to reconcile in slice 2.

## 10. Evidence class

All current-state facts above are `current-claim` from reading this checkout (HEAD); not a fresh `bun run test` run. Suite totals (798) are cited from the slice-1 verify report, not re-proven here.
