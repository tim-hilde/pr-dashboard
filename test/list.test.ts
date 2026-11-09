import { expect, test } from "bun:test";
import {
  buildListItems,
  prRows,
  selectedItemIndex,
  windowRange,
} from "../src/list";
import type { PullRequest } from "../src/types";

const pr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
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

test("groups pull requests by repository with open and draft subheadings", () => {
  const input = [
    pr({ number: 1, repoShort: "merlin-spricht", author: "anna-schmidt" }),
    pr({ number: 2 }),
    pr({ number: 3, isDraft: true }),
    pr({ number: 4 }),
  ];
  const items = buildListItems(input);
  expect(items).toEqual([
    { kind: "repo", repo: "merlin-dashboard", count: 3 },
    { kind: "section", name: "OPEN", count: 2 },
    { kind: "pr", pr: input[1], index: 0 },
    { kind: "pr", pr: input[3], index: 1 },
    { kind: "section", name: "DRAFT", count: 1 },
    { kind: "pr", pr: input[2], index: 2 },
    { kind: "repo", repo: "merlin-spricht", count: 1 },
    { kind: "section", name: "OPEN", count: 1 },
    { kind: "pr", pr: input[0], index: 3 },
  ]);
  expect(prRows(items).map((row) => row.number)).toEqual([2, 4, 3, 1]);
});

test("shows keine once when there are no pull requests", () => {
  expect(buildListItems([])).toEqual([{ kind: "empty" }]);
});

test("finds the selected pull request", () => {
  const items = buildListItems([pr({ number: 7 })]);
  expect(selectedItemIndex(items, 0)).toBe(2);
  expect(selectedItemIndex(items, 9)).toBe(0);
});

test("windows the list around the selected line", () => {
  expect(windowRange(10, 0, 4)).toEqual({ start: 0, end: 4 });
  expect(windowRange(10, 5, 4)).toEqual({ start: 3, end: 7 });
  expect(windowRange(10, 9, 4)).toEqual({ start: 6, end: 10 });
  expect(windowRange(3, 2, 4)).toEqual({ start: 0, end: 3 });
});
