import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { FetchResult } from "./github";

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
