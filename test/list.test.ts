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

test("builds the mine sections with an open and a draft part", () => {
  const items = buildListItems(
    [pr({ number: 1 }), pr({ number: 2, isDraft: true })],
    "mine",
  );
  expect(items.map((item) => item.kind)).toEqual([
    "section",
    "pr",
    "gap",
    "section",
    "pr",
  ]);
  expect(prRows(items).map((row) => row.number)).toEqual([1, 2]);
});

test("shows keine for empty mine sections", () => {
  const items = buildListItems([], "mine");
  expect(items).toEqual([
    { kind: "section", name: "OPEN", count: 0, indent: 0 },
    { kind: "empty", indent: 0 },
    { kind: "gap" },
    { kind: "section", name: "DRAFT", count: 0, indent: 0 },
    { kind: "empty", indent: 0 },
  ]);
});

test("groups all pull requests by repository with open and draft subheadings", () => {
  const input = [
    pr({ number: 1, repoShort: "merlin-spricht", author: "anna-schmidt" }),
    pr({ number: 2 }),
    pr({ number: 3, isDraft: true }),
    pr({ number: 4 }),
  ];
  const items = buildListItems(input, "all");
  expect(items).toEqual([
    { kind: "repo", repo: "merlin-dashboard", count: 3 },
    { kind: "section", name: "OPEN", count: 2, indent: 2 },
    { kind: "pr", pr: input[1], index: 0, indent: 2 },
    { kind: "pr", pr: input[3], index: 1, indent: 2 },
    { kind: "section", name: "DRAFT", count: 1, indent: 2 },
    { kind: "pr", pr: input[2], index: 2, indent: 2 },
    { kind: "repo", repo: "merlin-spricht", count: 1 },
    { kind: "section", name: "OPEN", count: 1, indent: 2 },
    { kind: "pr", pr: input[0], index: 3, indent: 2 },
  ]);
  expect(prRows(items).map((row) => row.number)).toEqual([2, 4, 3, 1]);
});

test("finds the selected pull request and reports keine without rows", () => {
  const items = buildListItems([pr({ number: 7 })], "mine");
  expect(selectedItemIndex(items, 0)).toBe(1);
  expect(selectedItemIndex(items, 9)).toBe(0);
  expect(buildListItems([], "all")).toEqual([{ kind: "empty", indent: 0 }]);
});

test("windows the list around the selected line", () => {
  expect(windowRange(10, 0, 4)).toEqual({ start: 0, end: 4 });
  expect(windowRange(10, 5, 4)).toEqual({ start: 3, end: 7 });
  expect(windowRange(10, 9, 4)).toEqual({ start: 6, end: 10 });
  expect(windowRange(3, 2, 4)).toEqual({ start: 0, end: 3 });
});
