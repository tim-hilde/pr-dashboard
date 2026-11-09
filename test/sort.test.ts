import { expect, test } from "bun:test";
import { attentionRank, sortPullRequests } from "../src/sort";
import type { PullRequest } from "../src/types";

const pr = (overrides: Partial<PullRequest>): PullRequest => ({
  repo: "Merlin-Digital-Solutions/merlin-dashboard",
  repoShort: "merlin-dashboard",
  author: "tim-hilde",
  number: 1,
  title: "title",
  url: "https://example.test",
  isDraft: false,
  updatedAt: "2026-11-06T10:00:00Z",
  headRef: "feat/x",
  baseRef: "main",
  headCommittedAt: "2026-11-06T10:00:00Z",
  ci: { state: "none", failed: [] },
  codex: { state: "none", required: [] },
  ...overrides,
});

test("ranks attention", () => {
  expect(attentionRank("changes")).toBe(0);
  expect(attentionRank("stale")).toBe(1);
  expect(attentionRank("comments")).toBe(2);
  expect(attentionRank("none")).toBe(3);
  expect(attentionRank("approved")).toBe(4);
});

test("breaks same-repo same-attention ties by newest update", () => {
  const input = [
    pr({
      number: 1,
      codex: { state: "approved", required: [] },
      updatedAt: "2026-11-06T09:00:00Z",
    }),
    pr({
      number: 2,
      codex: { state: "approved", required: [] },
      updatedAt: "2026-11-06T11:00:00Z",
    }),
  ];
  const { open } = sortPullRequests(input);
  expect(open.map((p) => p.number)).toEqual([2, 1]);
});

test("splits drafts and sorts by repo, attention, then update time", () => {
  const input = [
    pr({ repoShort: "merlin-spricht", number: 1, codex: { state: "approved", required: [] } }),
    pr({ repoShort: "merlin-dashboard", number: 2, codex: { state: "approved", required: [] } }),
    pr({ repoShort: "merlin-dashboard", number: 3, codex: { state: "changes", required: [] } }),
    pr({ repoShort: "merlin-dashboard", number: 4, isDraft: true }),
    pr({ repoShort: "merlin-dashboard", number: 5, codex: { state: "comments", required: [] } }),
  ];
  const { open, draft } = sortPullRequests(input);
  expect(open.map((p) => p.number)).toEqual([3, 5, 2, 1]);
  expect(draft.map((p) => p.number)).toEqual([4]);
});
