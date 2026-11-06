import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cacheAge,
  defaultCachePath,
  isFresh,
  readCache,
  writeCache,
} from "../src/cache";
import type { CacheEntry } from "../src/cache";
import type { FetchResult } from "../src/github";
import type { PullRequest } from "../src/types";

const sample: PullRequest = {
  repo: "Merlin-Digital-Solutions/merlin-dashboard",
  repoShort: "merlin-dashboard",
  number: 876,
  title: "feat(krise): let admins add web pages of approved domains",
  url: "https://github.com/Merlin-Digital-Solutions/merlin-dashboard/pull/876",
  isDraft: false,
  updatedAt: "2026-11-06T11:00:00Z",
  headRef: "feat/krise",
  baseRef: "main",
  headCommittedAt: "2026-11-06T10:00:00Z",
  ci: { state: "failure", failed: ["unit", "lint"] },
  codex: {
    state: "changes",
    createdAt: "2026-11-06T10:30:00Z",
    commentUrl: "https://example.test/comment",
    verdictText: "Request Changes — address both findings",
    required: ["🔴 [blocking] Mask numbers"],
  },
};

const result: FetchResult = { prs: [sample], total: 1 };

const entry: CacheEntry = {
  version: 1,
  fetchedAt: "2026-11-06T12:00:00.000Z",
  result,
};

test("round-trips a cache entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-cache-"));
  const path = join(dir, "prs.json");
  try {
    expect(readCache(path)).toBeNull();
    writeCache(path, entry);
    expect(readCache(path)).toEqual(entry);
    expect(readFileSync(path, "utf8")).toContain("\"version\":1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ignores corrupt and old cache files", () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-cache-"));
  const path = join(dir, "prs.json");
  try {
    writeFileSync(path, "{not json");
    expect(readCache(path)).toBeNull();
    writeFileSync(path, JSON.stringify({ ...entry, version: 2 }));
    expect(readCache(path)).toBeNull();
    writeFileSync(path, JSON.stringify({ ...entry, fetchedAt: "not-a-date" }));
    expect(readCache(path)).toBeNull();
    writeFileSync(
      path,
      JSON.stringify({ ...entry, result: { prs: "x", total: 1 } }),
    );
    expect(readCache(path)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ignores an entry with a malformed pull request", () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-cache-"));
  const path = join(dir, "prs.json");
  try {
    writeFileSync(
      path,
      JSON.stringify({ ...entry, result: { prs: [{ repo: "x" }], total: 1 } }),
    );
    expect(readCache(path)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("computes the cache age and freshness", () => {
  expect(cacheAge(entry, new Date("2026-11-06T12:00:30Z"))).toBe(30_000);
  expect(cacheAge(entry, new Date("2026-11-06T11:59:00Z"))).toBe(0);
  expect(isFresh(entry, new Date("2026-11-06T12:00:30Z"), 60_000)).toBe(true);
  expect(isFresh(entry, new Date("2026-11-06T12:01:30Z"), 60_000)).toBe(false);
});

test("uses the XDG cache directory when set", () => {
  const previous = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = "/tmp/prs-cache-home";
  try {
    expect(defaultCachePath()).toBe(
      "/tmp/prs-cache-home/pr-dashboard/prs.json",
    );
  } finally {
    if (previous === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = previous;
  }
});
