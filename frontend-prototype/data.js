export const repository = {
  missions: [
    { id: 'M-2048', title: 'Monthly Close · July 2026', company: 'ACME SAC', status: 'attention', label: 'Approval required', progress: '72%', stage: 'Reconcile', agents: '3 agents', event: 'IGV difference detected', risk: 'Medium risk', type: 'Monthly close', updated: '4m ago', evidence: '17 sources', owner: 'Operator', receipt: 'Draft', workflow: ['Scope', 'Evidence', 'Reconcile', 'Close', 'Receipt'] },
    { id: 'M-2047', title: 'SIRE reconciliation · July', company: 'ACME SAC', status: 'running', label: 'Evidence pending', progress: '91%', stage: 'Evidence', agents: '2 agents', event: 'Waiting for source evidence', risk: 'Low risk', type: 'Reconciliation', updated: '12m ago', evidence: '1 source pending', owner: 'Drenyra', receipt: 'Queued', workflow: ['Scope', 'Evidence', 'Reconcile', 'Review', 'Receipt'] },
    { id: 'M-2044', title: 'Bank reconciliation · June', company: 'ACME SAC', status: 'completed', label: 'Receipt signed', progress: '100%', stage: 'Receipt signed', agents: '1 agent', event: 'Signed receipt available', risk: 'Verified', type: 'Reconciliation', updated: 'Yesterday', evidence: '23 sources', owner: 'System', receipt: 'Signed', workflow: ['Scope', 'Evidence', 'Reconcile', 'Review', 'Receipt'] },
  ],
  attention: [
    { icon: 'Δ', title: 'IGV discrepancy', detail: '{difference} difference · M-2048', tone: 'critical', severity: 'Critical', action: 'Review variance' },
    { icon: '⛨', title: 'Close gate', detail: 'Human authorization required', tone: 'blocking', severity: 'Blocking', action: 'Authorize gate' },
    { icon: '⌁', title: 'Expense classification', detail: 'Approval required · 4 proposals', tone: 'review', severity: 'Review', action: 'Review proposals' },
    { icon: '▱', title: 'SIRE evidence', detail: 'One source still pending', tone: 'info', severity: 'Evidence', action: 'Open evidence' },
  ],
  timeline: [
    { state: 'done', icon: '✓', title: 'Evidence downloaded', detail: '1,248 sales records · SIRE source attached', time: '12 min ago' },
    { state: 'done', icon: '✓', title: 'Reconciliation executed', detail: 'Drenyra agent compared expected and received values', time: '8 min ago' },
    { state: 'warning', icon: 'Δ', title: 'Discrepancy detected', detail: 'IGV variance of {difference} requires human review', time: '4 min ago' },
    { state: 'current', icon: '◌', title: 'Waiting for your decision', detail: 'Open the evidence chain before approving a correction', time: 'Now' },
    { state: 'pending', icon: '○', title: 'Close gate', detail: 'Blocked until review and approval are complete', time: 'Pending' },
  ],
  reviews: [
    { id: 'review-igv', title: 'IGV discrepancy', meta: 'M-2048 · July 2026 · ACME SAC', risk: 'Medium risk', summary: '{difference} difference between expected IGV and SIRE records.', type: 'discrepancy' },
    { id: 'review-expense', title: 'Expense classification', meta: 'M-2048 · 4 proposals', risk: 'Low risk', summary: 'Professional services classification proposed from verified precedent.', type: 'classification' },
    { id: 'review-close', title: 'Monthly close approval', meta: 'M-2048 · Final gate', risk: 'Approval required', summary: 'Mission is ready for a human close decision after evidence review.', type: 'approval' },
  ],
  skills: [
    { icon: '₋', name: 'SIRE reconciliation', detail: 'PE · Verified', status: 'Ready' },
    { icon: '₋', name: 'IGV compliance', detail: 'PE · Verified', status: 'Ready' },
    { icon: '₋', name: 'Ledger integrity', detail: 'Universal · Verified', status: 'Ready' },
    { icon: '₋', name: 'Tenant isolation', detail: 'Universal · Verified', status: 'Ready' },
  ],
  finding: { expectedIgvCents: 3842100n, sireIgvCents: 3861200n },
};

export function createState() {
  return {
    missionFilter: 'running',
    inspectorTab: 'context',
    activity: [...repository.timeline],
    missions: [...repository.missions],
    selectedReview: repository.reviews[0],
  };
}
