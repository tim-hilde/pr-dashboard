import { expect, test } from "bun:test";
import { buildListRow, buildPreviewLines, authorCell } from "../src/view";
import type { PullRequest } from "../src/types";

const pr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  repo: "Merlin-Digital-Solutions/merlin-dashboard",
  repoShort: "merlin-dashboard",
  author: "tim-hilde",
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
    required: ["🔴 [blocking] Mask numbers", "Location: src/a.ts:1"],
  },
  ...overrides,
});

test("builds a truncated list row", () => {
  const row = buildListRow(pr(), { repo: 16, title: 20 });
  expect(row.repo).toBe("merlin-dashboard");
  expect(row.number).toBe("#876");
  expect(row.title).toBe("feat(krise): let ad…");
  expect(row.ci).toBe("✗");
  expect(row.codex).toBe("✗");
});

test("builds the preview", () => {
  const text = buildPreviewLines(pr(), new Date("2026-11-06T12:00:00Z"))
    .map((line) => line.text)
    .join("\n");
  expect(text).toContain("#876 · merlin-dashboard");
  expect(text).toContain("feat/krise → main");
  expect(text).toContain("fehlgeschlagen: unit, lint");
  expect(text).toContain("Codex ✗ Request Changes");
  expect(text).toContain("Required Changes");
  expect(text).toContain("• 🔴 [blocking] Mask numbers");
});

test("formats the author cell and adds the author to the preview on request", () => {
  expect(authorCell("tim-hilde", 12)).toBe("@tim-hilde  ");
  expect(authorCell("a-very-long-login", 8)).toBe("@a-very…");

  const meta = buildPreviewLines(pr(), new Date("2026-11-06T12:00:00Z"), {
    showAuthor: true,
  }).find((line) => line.dim === true);
  expect(meta?.text).toContain("@tim-hilde");

  const hidden = buildPreviewLines(pr(), new Date("2026-11-06T12:00:00Z")).find(
    (line) => line.dim === true,
  );
  expect(hidden?.text).not.toContain("@tim-hilde");
});

test("shows missing and stale Codex reviews", () => {
  const missing = buildPreviewLines(
    pr({ codex: { state: "none", required: [] } }),
    new Date("2026-11-06T12:00:00Z"),
  )
    .map((line) => line.text)
    .join("\n");
  expect(missing).toContain("Kein Codex-Kommentar");

  const stale = buildPreviewLines(
    pr({ codex: { state: "stale", createdAt: "2026-11-06T08:00:00Z", required: [] } }),
    new Date("2026-11-06T12:00:00Z"),
  )
    .map((line) => line.text)
    .join("\n");
  expect(stale).toContain("Review veraltet");
});

test("formats the stale warning with both timestamps", () => {
  const lines = buildPreviewLines(
    pr({
      headCommittedAt: "2026-11-06T11:30:00Z",
      codex: { state: "stale", createdAt: "2026-11-06T08:00:00Z", required: [] },
    }),
    new Date("2026-11-06T12:00:00Z"),
  );
  const stale = lines.find((line) => line.text.startsWith("Review veraltet"));
  expect(stale?.text).toBe(
    "Review veraltet: Kommentar vor 4 h · letzter Commit vor 30 min",
  );
  expect(stale?.color).toBe("yellow");
});

test("marks the draft state and successful CI in German", () => {
  const lines = buildPreviewLines(
    pr({ isDraft: true, ci: { state: "success", failed: [] } }),
    new Date("2026-11-06T12:00:00Z"),
  );
  const meta = lines.find((line) => line.dim === true);
  expect(meta?.text).toBe("feat/krise → main · Draft · vor 1 h");
  const ci = lines.find((line) => line.text.startsWith("CI"));
  expect(ci?.text).toBe("CI    erfolgreich");
  expect(ci?.color).toBe("green");
});

test("formats approved Codex without extra separators", () => {
  const lines = buildPreviewLines(
    pr({
      codex: {
        state: "approved",
        createdAt: "2026-11-06T11:00:00Z",
        required: [],
      },
    }),
    new Date("2026-11-06T12:00:00Z"),
  );
  const codex = lines.find((line) => line.text.startsWith("Codex"));
  expect(codex?.text).toBe("Codex ✓ Approve · vor 1 h");
  expect(codex?.color).toBe("green");
});

test("links the pull request URL at the end of the preview", () => {
  const lines = buildPreviewLines(pr(), new Date("2026-11-06T12:00:00Z"));
  const last = lines[lines.length - 1];
  expect(last?.text).toContain("PR öffnen");
  expect(last?.text).toContain(
    "\u001b]8;;https://github.com/Merlin-Digital-Solutions/merlin-dashboard/pull/876\u0007",
  );
});

test("uses the status colors and hierarchy in the preview", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const lines = buildPreviewLines(pr(), now);
  expect(lines[0]).toMatchObject({
    text: "#876 · merlin-dashboard",
    color: "accent",
    bold: true,
  });
  const title = lines.find((line) => line.text === pr().title);
  expect(title?.bold).toBe(true);
  const linkLine = lines.at(-1);
  expect(linkLine?.color).toBe("accent");
  expect(linkLine?.underline).toBe(true);

  const pending = buildPreviewLines(
    pr({ ci: { state: "pending", failed: [] } }),
    now,
  );
  expect(pending.find((line) => line.text.startsWith("CI"))?.color).toBe(
    "yellow",
  );
});
