import type { CodexInfo, RawComment } from "./types";

export function extractSection(body: string, heading: string): string {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    section.push(line);
  }
  return section.join("\n").trim();
}

export function stripMarkdown(text: string): string {
  return text
    .trim()
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^[-*>]\s*/, "");
}

export function parseCodexComment(
  comments: RawComment[],
  headCommittedAt: string,
): CodexInfo {
  const matches = comments.filter(
    (comment) =>
      comment.author.login === "github-actions" &&
      comment.body.includes("<!-- codex-review -->"),
  );
  if (matches.length === 0) return { state: "none", required: [] };

  const chosen = [...matches].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )[matches.length - 1];

  const info: CodexInfo = {
    state: "none",
    required: [],
    commentUrl: chosen.url,
    createdAt: chosen.createdAt,
  };

  const verdict = extractSection(chosen.body, "Verdict")
    .split("\n")
    .filter((line) => !line.includes("[ ]"))
    .join("\n");
  const verdictLine = verdict
    .split("\n")
    .map(stripMarkdown)
    .find((line) => line !== "");
  if (verdictLine !== undefined) info.verdictText = verdictLine;

  if (verdict.includes("Request Changes")) {
    info.state = "changes";
  } else if (verdict.includes("Approve")) {
    info.state = "approved";
  } else if (verdict.includes("Comment")) {
    info.state = "comments";
  }

  const requiredSection = extractSection(chosen.body, "Required Changes");
  const requiredTrimmed = requiredSection.trim();
  if (
    requiredTrimmed === "" ||
    requiredTrimmed.startsWith("None") ||
    requiredTrimmed.startsWith("No blocking")
  ) {
    info.required = [];
  } else {
    info.required = requiredSection
      .split("\n")
      .map(stripMarkdown)
      .filter((line) => line !== "")
      .slice(0, 4);
  }

  const headTime = Date.parse(headCommittedAt);
  const commentTime = Date.parse(chosen.createdAt);
  if (
    !Number.isNaN(headTime) &&
    !Number.isNaN(commentTime) &&
    commentTime < headTime
  ) {
    info.state = "stale";
  }

  return info;
}
