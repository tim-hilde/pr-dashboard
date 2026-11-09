import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { FetchResult } from "./github";
import type { PullRequest } from "./types";

const CI_STATES = new Set(["success", "failure", "pending", "none"]);
const CODEX_STATES = new Set(["approved", "comments", "changes", "stale", "none"]);

function isPullRequest(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const pr = value as Record<string, unknown>;
  const ci = pr.ci as Record<string, unknown> | undefined;
  const codex = pr.codex as Record<string, unknown> | undefined;
  return (
    typeof pr.repo === "string" &&
    typeof pr.repoShort === "string" &&
    typeof pr.author === "string" &&
    typeof pr.title === "string" &&
    typeof pr.url === "string" &&
    typeof pr.updatedAt === "string" &&
    typeof pr.headRef === "string" &&
    typeof pr.baseRef === "string" &&
    typeof pr.headCommittedAt === "string" &&
    typeof pr.number === "number" &&
    typeof pr.isDraft === "boolean" &&
    ci !== undefined &&
    typeof ci.state === "string" &&
    CI_STATES.has(ci.state) &&
    Array.isArray(ci.failed) &&
    codex !== undefined &&
    typeof codex.state === "string" &&
    CODEX_STATES.has(codex.state) &&
    Array.isArray(codex.required)
  );
}

export type CacheEntry = {
  version: 1;
  fetchedAt: string;
  result: FetchResult;
};

export function defaultCachePath(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "pr-dashboard", "prs.json");
}

export function sharedCacheBase(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(base, "pr-data");
}

export function sharedPrPath(
  url: string,
  base: string = sharedCacheBase(),
): string | undefined {
  const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/.exec(url);
  if (match === null) return undefined;
  return join(base, `${match[1]}__${match[2]}__${match[3]}.json`);
}

// The OpenCode pr sidebar reads these files, so both programs share one cache.
export function writeSharedPullRequests(
  prs: PullRequest[],
  at: Date,
  base: string = sharedCacheBase(),
): void {
  for (const pr of prs) {
    const path = sharedPrPath(pr.url, base);
    if (path === undefined) continue;
    const record = {
      version: 1,
      fetchedAt: at.toISOString(),
      pr: {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        kind: pr.isDraft ? "draft" : "open",
        closedAt: null,
        ci: pr.ci.state,
        review: pr.codex.state,
      },
    };
    try {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
      renameSync(temporary, path);
    } catch {
      // A failed cache write must not break the refresh.
    }
  }
}

export function allPrsCachePath(path: string): string {
  const suffix = ".json";
  return path.endsWith(suffix)
    ? `${path.slice(0, -suffix.length)}-all${suffix}`
    : `${path}-all`;
}

export function readCache(path: string): CacheEntry | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<CacheEntry>;
    if (
      parsed.version !== 1 ||
      typeof parsed.fetchedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.fetchedAt)) ||
      parsed.result === undefined ||
      !Array.isArray(parsed.result.prs) ||
      !parsed.result.prs.every(isPullRequest) ||
      typeof parsed.result.total !== "number"
    ) {
      return null;
    }
    return {
      version: 1,
      fetchedAt: parsed.fetchedAt,
      result: parsed.result,
    };
  } catch {
    return null;
  }
}

export function writeCache(path: string, entry: CacheEntry): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(entry), { mode: 0o600 });
  renameSync(temporary, path);
}

export function cacheAge(entry: CacheEntry, now: Date): number {
  return Math.max(0, now.getTime() - Date.parse(entry.fetchedAt));
}

export function isFresh(entry: CacheEntry, now: Date, ttlMs: number): boolean {
  return cacheAge(entry, now) < ttlMs;
}
