# fiscal-authority/kernel — feature-branch chain tracker

This branch is the integration tracker for the fiscal-authority kernel program,
following the feature-branch-chain strategy.

## Chain

| PR | Branch | Base | Deliverable |
|----|--------|------|-------------|
| tracker | `fiscal-authority/kernel` | `main` | Integration (draft, no-merge) |
| 1B | `fiscal-authority/evidence` | `fiscal-authority/kernel` | Accepted-evidence surface + boundary tests |
| 1C | `fiscal-authority/journal` | `fiscal-authority/evidence` | Accounting journal (record/post/supersede/revoke) |
| 1D | `fiscal-authority/candidate-ordering` | `fiscal-authority/journal` | Candidate-ordering adapter |
| 1E | `fiscal-authority/policy-cdr` | `fiscal-authority/candidate-ordering` | PE policy + CDR successor composition |

Tenant authority (1A/1A2) was already merged to `main` (`2601a2a`).

The tracker accumulates the final integration; child PRs are reviewed as focused
slices against their immediate parent. The tracker merges to main only after the
chain completes.

## Excluded

- `cbcdc8e` docs(openspec) for `gentle-ai-quality-parity` — a separate change,
  not part of this kernel chain.
