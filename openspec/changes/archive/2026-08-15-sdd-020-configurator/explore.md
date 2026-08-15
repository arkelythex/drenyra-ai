# SDD-020 — Universal Agent Configurator · Exploration

> Status: exploration · Change: `sdd-020-configurator` · Repo: `drenyra-ai`
> Gate 0 is `satisfied` (gate-0.md §4) — SDD-020 is PERMITTED. This map
> establishes the current-state gap against the SDD-020 declared scope.

## 1. Executive summary

`drenyra-ai` already ships a **partial, marker-based configurator**: `install`,
`doctor`, and `sync` commands exist, are registered in the CLI dispatcher, and
are covered by two test files. Their scope is deliberately narrow: they
detect/configure existing Codex/Claude Code/OpenCode hosts, write **managed
markers and a skills asset** into each host's config dir, and never install a
host nor touch foreign config files.

The SDD-020 declared scope is **substantially wider** than what exists. There is
**no `upgrade` or `rollback` code at all** (not even a stub), **no
program-lock-aware installation or pin verification**, **no
`pinned-ai-runtime` per-host composition**, and **no doctor diagnostics for
configuration drift / pin mismatch / missing prerequisites** — the current
doctor checks node engine, package version, contract files, CLI surface, and
mission-store reachability only. Host integration is detection-only; there is no
runtime/model/tool pinning. The `drenyra-pi` relationship is a **sibling
consumer** (it consumes released, versioned `drenyra-ai` artifacts and pins a
version package-locally), not something this repo integrates with.

The gap is therefore: the SDD-020 record's commands (install/doctor/sync) exist
in name but only at "Design 03" depth; the SDD-020-scope additions
(upgrade/rollback, program-lock pinning, per-host pinned runtime/model/tool,
drift/pin-mismatch/prereq doctor checks) are entirely absent.

## 2. Current-state inventory (file/symbol-cited)

### 2.1 CLI dispatcher & declared surface

| File | Key symbols | Behavior |
| --- | --- | --- |
| `cmd/cli.ts` | `COMMANDS` map, `main()`, `helpText()` | Top-level `<command> <subcommand>` dispatcher. Registers `install.run`, `sync.run`, `doctor.run`, `capabilities.show`. Exit codes: 0 success, 1 business error, 2 usage/IO. `--help` prints text and exits 0. |
| `cmd/declared-surface.ts` | `DECLARED_CONTRACTS`, `DECLARED_CONTRACT_FILES`, `getDeclaredCapabilities()`, `DECLARED_ADAPTERS` | Six frozen contracts; `PE` jurisdiction; **empty** `DECLARED_ADAPTERS`. Shared common facts (version, contracts, jurisdictions, adapters) used by CLI + MCP. |
| `cmd/commands/capabilities.ts` | `capabilitiesCommand()` | Returns declared capabilities + skills (from `BASE_PE_SKILLS`) + `integrations: ["MCP (planned)", "Codex/Claude Code/OpenCode (planned)"]`. Note the "(planned)" wording. |

### 2.2 install — detection + managed markers (EXISTS)

`cmd/commands/install.ts`:

- `DetectedHost` interface: `name: "codex" | "claude-code" | "opencode"`, `configDir`, `present`.
- `HOST_DIRS`: `codex → .codex`, `claude-code → .claude`, `opencode → .config/opencode`.
- `detectHosts(homeDir)`: read-only `existsSync` probe of each host config dir.
- `installIntegrations(homeDir, now?) → InstallManifest`: creates `~/.drenyra/managed.json`, writes a `~/.drenyra-managed` marker + `~/.drenyra-skills.json` asset **into each present host's config dir**, only when absent (never overwrites foreign changes).
- `readInstallManifest(homeDir)`, `installCommand(args)`, `homeFromArgs(args)` (`--home` override, else `$HOME`).
- Philosophy (header + code): "Drenyra AI DETECTS and CONFIGURES hosts that already exist; it never installs Codex, Claude Code, or OpenCode."

### 2.3 doctor — read-only health check (EXISTS, shallow)

`cmd/commands/doctor.ts` — `doctorCommand()`:

- Checks: `node-engine` (>=22), `version` (package metadata present), `contracts` (six frozen files present under installed package root, not cwd), `cli` (hardcoded 11-command list), `mission-store` (cwd-relative `drenyra-missions.json` present/absent).
- Exit 0 healthy, 1 with JSON report of failing checks. `readonly: true`.
- **No** drift, pin-mismatch, or missing-prerequisite diagnostics. The `cli` check is a static list, not a live invocation.

### 2.4 sync — refresh managed markers (EXISTS)

`cmd/commands/sync.ts`:

- `SyncResult` interface: `host`, `action: "synced" | "preserved" | "missing" | "not-installed"`, `reason`.
- `syncManaged(homeDir)`: compares each host marker to expected content; **preserves** foreign-modified markers (reports `preserved`), recreates missing ones, reports `missing` for absent hosts, `not-installed` when no manifest.
- `syncCommand(args)`: JSON `{status:"synced", results}`, exit 0.

### 2.5 upgrade / rollback — ABSENT

No code, no stub, no registration. Grep for `upgrade|rollback` in `cmd/` returns **no matches**. The SDD-020 scope lists these as required commands; nothing exists today.

### 2.6 Tests

| File | Covers |
| --- | --- |
| `cmd/__tests__/install-sync.test.ts` | `detectHosts`, `installIntegrations`, `readInstallManifest`, `syncManaged`. Verifies: present-host-only configuration; foreign marker preserved; not-installed without manifest; synced vs preserved. |
| `cmd/__tests__/capabilities-doctor.test.ts` | `capabilitiesCommand`, `doctorCommand`, `getDeclaredCapabilities`, MCP server handshake + drift guard. Verifies: doctor healthy on clean checkout, contracts resolved from non-root cwd. |

No tests for upgrade, rollback, pinning, drift, or per-host runtime composition.

## 3. Package/bin surface

`package.json`:

- `bin: { "drenyra-ai": "./dist/cmd/cli.js" }`.
- `build`: `node scripts/build.mjs` → `bunx tsc -p tsconfig.build.json` (ESM, NodeNext) then patches `dist/cmd/cli.js` shebang from `#!/usr/bin/env bun` → `#!/usr/bin/env node`.
- `prepare`: same build (so `npm install`/pack triggers build).
- `files`: `dist`, `contracts`, `fixtures`, `README.md`, `LICENSE`.
- `engines.node: ">=22"`.
- Distribution today: **Node >= 22** without a loader (shebang patched to node). Source runs on Bun (dev shebang). No host-install path — the `bin` is a standard npm bin consumed by installing the package; there is no installer that places/pins it into host runtimes.

## 4. Pinned runtime composition — ABSENT in code

- Grep for `program-lock|programLock|pinned-ai-runtime|pin` in `cmd/`, `scripts/` returns **no code matches**. The only pinning references are in `package.json` (`@biomejs/biome` exact `2.3.15`, `nanoid` override) and in program docs.
- `program-lock.json` + `program-lock.schema.json` + `release-train.md` (SDD-010 artifact) define the **ecosystem** composition (repos, SHAs, versions, contracts) — but **nothing in `drenyra-ai` reads it** at runtime or install time.
- `capability-matrix.yaml` records `pinned-ai-runtime: partial` and `configurator-install-doctor-sync: planned # SDD-020` **on the `drenyra-pi` row**, not on `drenyra-ai`. The configurator is a `drenyra-pi`-served capability; this repo (`drenyra-ai`) is the authority-core that provides the artifacts (`install`/`doctor`/`sync` commands + published candidates).

## 5. Host integration / drenyra-pi relationship

- Host detection in `install.ts` covers Codex, Claude Code, OpenCode. **No Drenyra Pi host** in `HOST_DIRS` (Pi is a sibling runtime that consumes drenyra-ai, not a host drenyra-ai configures). No runtime/model/tool pinning per host.
- `docs/architecture.md` Consumer contract: "Drenyra and Drenyra Pi consume **released, versioned** artifacts — never a checkout of this repo. Drenyra Pi additionally pins an exact verified version package-locally." This is the intended `drenyra-ai → drenyra-pi` boundary: drenyra-ai publishes; drenyra-pi consumes + pins.
- No integration code for Codex/Claude/OpenCode beyond marker/skills-asset writing — no vendor-specific config, no runtime/model/tool setup. `capabilities.ts` still labels them "(planned)".

## 6. The gap (what exists vs SDD-020 scope)

| SDD-020 scope item | Exists today? | Current state / gap |
| --- | --- | --- |
| `install` | ✅ partial | Marker + skills-asset detection/configuration; no program-lock-aware artifact install, no pinning. |
| `doctor` | ✅ partial | Node/version/contracts/cli/mission-store only; **no** drift, pin-mismatch, or missing-prerequisite checks. |
| `sync` | ✅ partial | Refreshes managed markers; preserves foreign changes. No composition/version sync, no pin verification. |
| `upgrade` | ❌ absent | No code, no stub, no registration. |
| `rollback` | ❌ absent | No code, no stub, no registration. |
| Host integration (Codex/Claude/OpenCode/Pi) | 🔶 minimal | Detection + marker only; "(planned)" wording remains; no Pi host; no vendor config. |
| Pinned agent runtime/model/tool per host (`pinned-ai-runtime`) | ❌ absent | No per-host runtime/model/tool pinning. |
| Program-lock-aware install (promoted artifact, never a copy of `main`) | ❌ absent | No runtime reads of `program-lock`. |
| Doctor: config drift / pin mismatch / missing prerequisites | ❌ absent | Doctor is package-health only. |
| Idempotent upgrade/rollback between pinned compositions | ❌ absent | Nothing. |

## 7. First-slice candidates (bounded, reviewable)

Budget constraint: max 400 authored lines per review unit (SDD-020 Review limit); chained PRs for larger.

**A. `upgrade`/`rollback` command skeleton (foundation).**
Add `cmd/commands/upgrade.ts` + `cmd/commands/rollback.ts` with a version-transition model (record current pinned composition, stage next, apply, revert) operating on the `~/.drenyra/managed.json` manifest. ~120–200 changed lines + tests. No program-lock wiring yet — pins a *packaged version* to a host.

**B. Doctor diagnostics depth: drift / pin-mismatch / missing-prereqs.**
Extend `doctor.ts` (or add `doctor-config.ts`) with checks that: read the install manifest and compare host markers (drift), compare the packaged version against a recorded pin (pin mismatch), and probe host binaries/configs (missing prerequisites). Reuses existing `detectHosts`/`readInstallManifest`. ~80–150 lines + tests.

**C. Pinned runtime composition per host (pinned-ai-runtime).**
Introduce a per-host pinned composition record (runtime/model/tool versions) written by install/sync and read by doctor. This is the `drenyra-pi`-consumable contract. ~150–250 lines + tests. Larger; may warrant its own PR slice.

**D. Program-lock-aware install (promoted artifact).**
Read `program-lock` at install time to resolve the promoted composition. This is the largest and most cross-cutting (touches the SDD-010 contract boundary); recommend it as a later slice or chained PR, **not** first-slice.

Recommended first slice: **A + B** (bounded, independently testable, directly closes the two fully-absent commands + the shallow doctor). C and D follow in later slices.

## 8. Risks / non-goals observed

- **Scope creep**: SDD-020 is served primarily by `drenyra-pi`, but the `install/doctor/sync` commands live in `drenyra-ai`. Confirm the ownership boundary before implementing — does drenyra-ai ship the configurator commands (authority-core provides them) or does drenyra-pi invoke them as a consumer?
- **Program-lock bootstrap** (delivery-sequence.md): `program-lock` never self-references the commit carrying it. Any "pin to current composition" logic must respect this to avoid circular installs.
- **Never-install-host invariant**: `install.ts` explicitly refuses to install Codex/Claude/OpenCode. `upgrade`/`rollback` must preserve this — they operate on *managed markers/artifacts*, not host installation.
- **Foreign-file preservation**: sync/install must never clobber foreign markers; upgrade/rollback inherit this contract.
- **Non-goals (SDD-020)**: no authorization decisions; no vertical-capability packaging; no program-root doc mutation. Keep `upgrade`/`rollback` as runtime-configuration only.
- **`(planned)` stale wording**: `capabilities.ts` integrations still says "planned" while Codex/Claude/OpenCode detection exists — a minor doc/accuracy inconsistency to reconcile.

## 9. Evidence references (status-and-evidence.md §1 five-axis vocabulary)

- **Implementation maturity**: `configurator-install-doctor-sync` on the `drenyra-pi` row = `planned` (capability-matrix.yaml:101); on `drenyra-ai` the install/doctor/sync commands are `implemented` at Design-03 depth, `pinned-ai-runtime` = `partial` (matrix:100). Per vocabulary: maturity `implemented` never implies SDD lifecycle complete (R3).
- **Evidence axis**: test coverage (install-sync + capabilities-doctor, §2.6) is `verified-revision-bound` to this tree's content, not a fresh executable run; the matrix's historical 640 / current 774 totals (E-006/E-002) are cited elsewhere and not re-proven here.
- **Temporal class**: all current-state facts above are `current-claim` from reading this checkout (HEAD); they are not a fresh `bun run test` run and should be re-verified at proposal/verify time.
- **Gate decision**: Gate 0 rows 3–4 `satisfied` (gate-0.md §4, E-009/E-010/E-012) — SDD-020 PERMITTED.

## 10. Open questions for proposal

1. Ownership: are the configurator commands implemented in `drenyra-ai` (shipped authority-core) or served by `drenyra-pi` invoking them? Which repo closes `configurator-install-doctor-sync`?
2. First-slice scope: A+B (upgrade/rollback skeleton + doctor depth) acceptable as the first bounded PR?
3. Does the per-host pin (pinned-ai-runtime) target *packaged drenyra-ai versions* only, or also model/tool versions, and how does it surface to `drenyra-pi`?
