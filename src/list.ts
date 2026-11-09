import { sortPullRequests } from "./sort";
import type { PullRequest } from "./types";

export type ListMode = "mine" | "all";

export type ListItem =
  | { kind: "gap" }
  | { kind: "repo"; repo: string; count: number }
  | { kind: "section"; name: "OPEN" | "DRAFT"; count: number; indent: number }
  | { kind: "pr"; pr: PullRequest; index: number; indent: number }
  | { kind: "empty"; indent: number };

export function buildListItems(prs: PullRequest[], mode: ListMode): ListItem[] {
  const sorted = sortPullRequests(prs);
  const items: ListItem[] = [];
  let index = 0;

  const pushSection = (
    name: "OPEN" | "DRAFT",
    sectionPrs: PullRequest[],
    indent: number,
  ) => {
    items.push({ kind: "section", name, count: sectionPrs.length, indent });
    if (sectionPrs.length === 0) {
      items.push({ kind: "empty", indent });
      return;
    }
    for (const pr of sectionPrs) {
      items.push({ kind: "pr", pr, index, indent });
      index += 1;
    }
  };

  if (mode === "mine") {
    pushSection("OPEN", sorted.open, 0);
    items.push({ kind: "gap" });
    pushSection("DRAFT", sorted.draft, 0);
    return items;
  }

  const groups = new Map<
    string,
    { open: PullRequest[]; draft: PullRequest[] }
  >();
  for (const pr of sorted.open) {
    const group = groups.get(pr.repoShort) ?? { open: [], draft: [] };
    group.open.push(pr);
    groups.set(pr.repoShort, group);
  }
  for (const pr of sorted.draft) {
    const group = groups.get(pr.repoShort) ?? { open: [], draft: [] };
    group.draft.push(pr);
    groups.set(pr.repoShort, group);
  }

  const repos = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  if (repos.length === 0) {
    items.push({ kind: "empty", indent: 0 });
    return items;
  }

  repos.forEach((repo) => {
    const group = groups.get(repo);
    if (group === undefined) return;
    items.push({
      kind: "repo",
      repo,
      count: group.open.length + group.draft.length,
    });
    if (group.open.length > 0) pushSection("OPEN", group.open, 2);
    if (group.draft.length > 0) pushSection("DRAFT", group.draft, 2);
  });
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
