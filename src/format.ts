import type { CiState, CodexState } from "./types";
import type { ThemeColor } from "./theme";

const CI_SYMBOLS: Record<CiState, string> = {
  success: "✓",
  pending: "…",
  failure: "✗",
  none: "–",
};

const CODEX_SYMBOLS: Record<CodexState, string> = {
  approved: "✓",
  comments: "!",
  changes: "✗",
  stale: "~",
  none: "–",
};

export function truncate(text: string, width: number): string {
  if (width <= 1) return "…";
  if (text.length <= width) return text;
  return text.slice(0, width - 1) + "…";
}

export function relativeTime(iso: string, now = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "–";
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return "gerade eben";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} d`;
  return `vor ${Math.floor(days / 30)} Mon`;
}

export function ciCell(state: CiState): string {
  return CI_SYMBOLS[state];
}

export function codexCell(state: CodexState): string {
  return CODEX_SYMBOLS[state];
}

const CI_COLORS: Record<CiState, ThemeColor> = {
  success: "green",
  pending: "yellow",
  failure: "red",
  none: "muted",
};

const CODEX_COLORS: Record<CodexState, ThemeColor> = {
  approved: "green",
  comments: "yellow",
  changes: "red",
  stale: "yellow",
  none: "muted",
};

export function ciColor(state: CiState): ThemeColor {
  return CI_COLORS[state];
}

export function codexColor(state: CodexState): ThemeColor {
  return CODEX_COLORS[state];
}

export function link(text: string, url: string): string {
  return `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
}
