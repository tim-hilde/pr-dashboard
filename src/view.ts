import { ciCell, codexCell, link, relativeTime, truncate } from "./format";
import type { CiState, CodexState, PullRequest } from "./types";

export type PreviewLine = {
  text: string;
  color?: "green" | "yellow" | "red" | "gray" | "blue";
  dim?: boolean;
};

const CI_TEXT: Record<CiState, string> = {
  success: "erfolgreich",
  pending: "laufen",
  failure: "fehlgeschlagen",
  none: "keine Checks",
};

const CI_COLORS: Record<CiState, PreviewLine["color"]> = {
  success: "green",
  pending: "blue",
  failure: "red",
  none: "gray",
};

const CODEX_COLORS: Record<CodexState, PreviewLine["color"]> = {
  approved: "green",
  comments: "yellow",
  changes: "red",
  stale: "yellow",
  none: "gray",
};

const CODEX_NAMES: Record<CodexState, string> = {
  approved: "Approve",
  comments: "Comment",
  changes: "Request Changes",
  stale: "Stale",
  none: "Kein Codex-Kommentar",
};

export function buildListRow(
  pr: PullRequest,
  widths: { repo: number; title: number },
): { repo: string; number: string; title: string; ci: string; codex: string } {
  return {
    repo: truncate(pr.repoShort, widths.repo).padEnd(widths.repo),
    number: `#${pr.number}`,
    title: truncate(pr.title, widths.title),
    ci: ciCell(pr.ci.state),
    codex: codexCell(pr.codex.state),
  };
}

export function buildPreviewLines(pr: PullRequest, now: Date): PreviewLine[] {
  const lines: PreviewLine[] = [];

  lines.push({ text: `#${pr.number} · ${pr.repoShort}`, color: "blue" });
  lines.push({ text: pr.title });

  const state = pr.isDraft ? "Draft" : "offen";
  lines.push({
    text: `${pr.headRef} → ${pr.baseRef} · ${state} · ${relativeTime(pr.updatedAt, now)}`,
    dim: true,
  });
  lines.push({ text: "" });

  const ci = pr.ci;
  const ciText =
    ci.state === "failure" && ci.failed.length > 0
      ? `${CI_TEXT[ci.state]}: ${ci.failed.join(", ")}`
      : CI_TEXT[ci.state];
  lines.push({ text: `CI    ${ciText}`, color: CI_COLORS[ci.state] });

  const codex = pr.codex;
  if (codex.state === "none") {
    lines.push({
      text: "Codex – · Kein Codex-Kommentar (letzte 100 Kommentare geprüft)",
      color: "gray",
    });
  } else {
    const verdict = codex.verdictText ?? CODEX_NAMES[codex.state];
    const when = codex.createdAt === undefined ? "" : ` · ${relativeTime(codex.createdAt, now)}`;
    lines.push({
      text: `Codex ${codexCell(codex.state)} ${verdict}${when}`,
      color: CODEX_COLORS[codex.state],
    });
  }

  if (codex.state === "stale" && codex.createdAt !== undefined) {
    lines.push({
      text: `Review veraltet: Kommentar ${relativeTime(codex.createdAt, now)} · letzter Commit ${relativeTime(pr.headCommittedAt, now)}`,
      color: "yellow",
    });
  }

  if (codex.required.length > 0) {
    lines.push({ text: "" });
    lines.push({ text: "Required Changes", dim: true });
    for (const item of codex.required) {
      lines.push({ text: `• ${item}` });
    }
  }

  lines.push({ text: link("PR öffnen", pr.url) });

  return lines;
}
