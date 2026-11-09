import { sortPullRequests } from "./sort";
import type { PullRequest } from "./types";

export type ListMode = "mine" | "all";

export type ListItem =
  | { kind: "repo"; repo: string; count: number }
  | { kind: "section"; name: "OPEN" | "DRAFT"; count: number }
  | { kind: "pr"; pr: PullRequest; index: number }
  | { kind: "empty" };

export function buildListItems(prs: PullRequest[]): ListItem[] {
  const sorted = sortPullRequests(prs);
  const groups = new Map<string, { OPEN: PullRequest[]; DRAFT: PullRequest[] }>();
  const groupOf = (repo: string) => {
    let group = groups.get(repo);
    if (group === undefined) {
      group = { OPEN: [], DRAFT: [] };
      groups.set(repo, group);
    }
    return group;
  };
  for (const pr of sorted.open) groupOf(pr.repoShort).OPEN.push(pr);
  for (const pr of sorted.draft) groupOf(pr.repoShort).DRAFT.push(pr);

  if (groups.size === 0) return [{ kind: "empty" }];

  const items: ListItem[] = [];
  let index = 0;
  const repos = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [repo, group] of repos) {
    items.push({
      kind: "repo",
      repo,
      count: group.OPEN.length + group.DRAFT.length,
    });
    for (const name of ["OPEN", "DRAFT"] as const) {
      const sectionPrs = group[name];
      if (sectionPrs.length === 0) continue;
      items.push({ kind: "section", name, count: sectionPrs.length });
      for (const pr of sectionPrs) {
        items.push({ kind: "pr", pr, index });
        index += 1;
      }
    }
  }
  return items;
}

export function prRows(items: ListItem[]): PullRequest[] {
  const rows: PullRequest[] = [];
  for (const item of items) {
    if (item.kind === "pr") rows.push(item.pr);
  }
  return rows;
}

export function selectedItemIndex(items: ListItem[], selected: number): number {
  const found = items.findIndex(
    (item) => item.kind === "pr" && item.index === selected,
  );
  return found < 0 ? 0 : found;
}

export function windowRange(
  total: number,
  anchor: number,
  height: number,
): { start: number; end: number } {
  if (total <= height) return { start: 0, end: total };
  const start = Math.max(
    0,
    Math.min(anchor - Math.floor(height / 2), total - height),
  );
  return { start, end: start + height };
}
