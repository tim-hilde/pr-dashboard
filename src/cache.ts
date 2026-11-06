import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { FetchResult } from "./github";

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
