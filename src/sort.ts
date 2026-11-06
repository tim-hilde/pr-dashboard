import type { CodexState, PullRequest } from "./types";

const RANKS: Record<CodexState, number> = {
  changes: 0,
  stale: 1,
  comments: 2,
  none: 3,
  approved: 4,
};

export function attentionRank(state: CodexState): number {
  return RANKS[state];
}

const byRepoAttentionUpdated = (a: PullRequest, b: PullRequest): number =>
  a.repoShort.localeCompare(b.repoShort) ||
  attentionRank(a.codex.state) - attentionRank(b.codex.state) ||
  Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

export function sortPullRequests(
  prs: PullRequest[],
): { open: PullRequest[]; draft: PullRequest[] } {
  return {
    open: prs.filter((p) => !p.isDraft).sort(byRepoAttentionUpdated),
    draft: prs.filter((p) => p.isDraft).sort(byRepoAttentionUpdated),
  };
}
