import { describe, expect, test } from "bun:test";
import { parseCodexComment } from "../src/codex";
import type { RawComment } from "../src/types";

const HEAD = "2026-11-06T09:00:00Z";

const read = (name: string) =>
  Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).text();

const comment = (
  body: string,
  createdAt = "2026-11-06T10:00:00Z",
  login = "github-actions",
): RawComment => ({
  body,
  createdAt,
  url: "https://example.test/comment",
  author: { login },
});

describe("parseCodexComment", () => {
  test("maps approve", async () => {
    const info = parseCodexComment([comment(await read("codex-approve.md"))], HEAD);
    expect(info.state).toBe("approved");
    expect(info.required).toEqual([]);
    expect(info.verdictText).toContain("Approve");
    expect(info.commentUrl).toBe("https://example.test/comment");
  });

  test("ignores the unticked options of a checklist verdict", () => {
    const body = (approve: string, comment: string, changes: string) =>
      [
        "<!-- codex-review -->",
        "## Verdict",
        `**[${approve}] ✅ Approve**  `,
        `**[${comment}] 💬 Comment**  `,
        `**[${changes}] 🔄 Request Changes** — text`,
        "",
        "## Required Changes",
        "None",
      ].join("\n");
    const state = (text: string) =>
      parseCodexComment([comment(text)], HEAD);
    expect(state(body("x", " ", " ")).state).toBe("approved");
    expect(state(body(" ", "x", " ")).state).toBe("comments");
    expect(state(body(" ", " ", "x")).state).toBe("changes");
    expect(state(body(" ", " ", "x")).verdictText).toContain("Request Changes");
    expect(state(body("x", " ", " ")).verdictText).toContain("Approve");
  });

  test("takes the first option named in the verdict, not a later mention", () => {
    const state = (verdict: string) =>
      parseCodexComment(
        [comment(`<!-- codex-review -->\n## Verdict\n${verdict}\n\n## Required Changes\nNone`)],
        HEAD,
      ).state;
    expect(state("**💬 Comment** — No blockers. Approve after the nits.")).toBe("comments");
    expect(state("**✅ Approve** — nothing here warrants Request Changes.")).toBe("approved");
    expect(state("**🔄 Request Changes** — do not Approve yet.")).toBe("changes");
  });

  test("maps comment to approved with comments", async () => {
    const info = parseCodexComment([comment(await read("codex-comment.md"))], HEAD);
    expect(info.state).toBe("comments");
  });

  test("maps request changes without the checked prefix", async () => {
    const info = parseCodexComment([comment(await read("codex-changes.md"))], HEAD);
    expect(info.state).toBe("changes");
    expect(info.required).toHaveLength(4);
    expect(info.required.join("\n")).not.toContain("**");
  });

  test("maps request changes with the checked prefix", async () => {
    const info = parseCodexComment(
      [comment(await read("codex-changes-checked.md"))],
      HEAD,
    );
    expect(info.state).toBe("changes");
  });

  test("treats None and No blocking as no required changes", async () => {
    const info = parseCodexComment([comment(await read("codex-none.md"))], HEAD);
    expect(info.state).toBe("comments");
    expect(info.required).toEqual([]);
  });

  test("marks a review older than the head as stale", async () => {
    const info = parseCodexComment(
      [comment(await read("codex-approve.md"), "2026-11-06T08:00:00Z")],
      HEAD,
    );
    expect(info.state).toBe("stale");
  });

  test("ignores a human comment that quotes the marker", async () => {
    const body = "<!-- codex-review -->\n## Verdict\n\n**🔄 Request Changes**";
    const info = parseCodexComment([comment(body, HEAD, "tim-hilde")], HEAD);
    expect(info.state).toBe("none");
  });

  test("ignores the security review marker", async () => {
    const body =
      "<!-- codex-security-review -->\n## Verdict\n\n**🔄 Request Changes**";
    const info = parseCodexComment([comment(body)], HEAD);
    expect(info.state).toBe("none");
  });

  test("returns none without a marker", () => {
    const info = parseCodexComment([comment("ordinary comment")], HEAD);
    expect(info.state).toBe("none");
    expect(info.required).toEqual([]);
  });

  test("handles a missing verdict section", async () => {
    const body = "<!-- codex-review -->\n## Required Changes\n\nNone.";
    const info = parseCodexComment([comment(body)], HEAD);
    expect(info.state).toBe("none");
    expect(info.commentUrl).toBe("https://example.test/comment");
  });
});
