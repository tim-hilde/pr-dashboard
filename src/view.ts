import {
  ciCell,
  ciColor,
  codexCell,
  codexColor,
  link,
  relativeTime,
  truncate,
} from "./format";
import type { CiState, CodexState, PullRequest } from "./types";
import type { ThemeColor } from "./theme";

export type PreviewLine = {
  text: string;
  color?: ThemeColor;
  dim?: boolean;
  bold?: boolean;
  underline?: boolean;
};

const CI_TEXT: Record<CiState, string> = {
  success: "erfolgreich",
  pending: "laufen",
  failure: "fehlgeschlagen",
  none: "keine Checks",
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
  widths: { title: number },
): { number: string; title: string; ci: string; codex: string } {
  return {
    number: `#${pr.number}`,
    title: truncate(pr.title, widths.title),
    ci: ciCell(pr.ci.state),
    codex: codexCell(pr.codex.state),
  };
}

export function authorCell(author: string, width: number): string {
  return truncate(`@${author}`, width).padEnd(width);
}

export function buildPreviewLines(
  pr: PullRequest,
  now: Date,
  options: { showAuthor?: boolean } = {},
): PreviewLine[] {
  const lines: PreviewLine[] = [];

  lines.push({ text: `#${pr.number} · ${pr.repoShort}`, color: "accent", bold: true });
  lines.push({ text: pr.title, bold: true });

  const state = pr.isDraft ? "Draft" : "offen";
  const author = options.showAuthor === true ? ` · @${pr.author}` : "";
  lines.push({
    text: `${pr.headRef} → ${pr.baseRef} · ${state} · ${relativeTime(pr.updatedAt, now)}${author}`,
    dim: true,
  });
  lines.push({ text: "" });

  const ci = pr.ci;
  const ciText =
    ci.state === "failure" && ci.failed.length > 0
      ? `${CI_TEXT[ci.state]}: ${ci.failed.join(", ")}`
      : CI_TEXT[ci.state];
  lines.push({ text: `CI    ${ciText}`, color: ciColor(ci.state) });

  const codex = pr.codex;
  if (codex.state === "none") {
    lines.push({
      text: "Codex – · Kein Codex-Kommentar (letzte 100 Kommentare geprüft)",
      color: "muted",
    });
  } else {
    const verdict = codex.verdictText ?? CODEX_NAMES[codex.state];
    const when = codex.createdAt === undefined ? "" : ` · ${relativeTime(codex.createdAt, now)}`;
    lines.push({
      text: `Codex ${codexCell(codex.state)} ${verdict}${when}`,
      color: codexColor(codex.state),
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
    lines.push({ text: "Required Changes", color: "border", bold: true });
    for (const item of codex.required) {
      lines.push({ text: `• ${item}` });
    }
  }

  lines.push({ text: link("PR öffnen", pr.url), color: "accent", underline: true });

  return lines;
}
