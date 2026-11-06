import { expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import { render, renderToString } from "ink";
import { App } from "../src/app";
import type { FetchResult } from "../src/github";
import type { PullRequest } from "../src/types";

const sample: PullRequest = {
  repo: "Merlin-Digital-Solutions/merlin-dashboard",
  repoShort: "merlin-dashboard",
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
    required: ["🔴 [blocking] Mask numbers"],
  },
};

const result: FetchResult = { prs: [sample], total: 1 };
const emptyResult: FetchResult = { prs: [], total: 0 };
const load = async () => result;
const emptyLoad = async () => emptyResult;
const open = () => {};
const now = () => new Date("2026-11-06T12:00:00Z");

function renderLive(
  element: React.ReactElement,
  columns = 80,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    }) as Writable & { columns: number; rows: number };
    stdout.columns = columns;
    stdout.rows = 40;
    const stdin = new PassThrough() as PassThrough & {
      setRawMode: (enabled: boolean) => PassThrough;
      isTTY: boolean;
    };
    stdin.setRawMode = () => stdin;
    stdin.isTTY = true;
    const instance = render(element, {
      stdout,
      stdin,
      stderr: new Writable({ write: (_c, _e, cb) => cb() }),
      patchConsole: false,
      debug: true,
    });
    const finish = (failure?: string) => {
      clearInterval(timer);
      clearTimeout(timeout);
      instance.unmount();
      void instance.waitUntilExit().then(() => {
        if (failure === undefined) resolve(output);
        else reject(new Error(failure));
      });
    };
    const timer = setInterval(() => {
      if (output.includes("keine") || output.includes("#876")) finish();
    }, 20);
    const timeout = setTimeout(() => {
      if (output === "") {
        finish(
          `renderLive captured no output after 2 s: ${JSON.stringify(output)}`,
        );
      } else {
        finish();
      }
    }, 2_000);
  });
}

test("renders the loading header and footer on first render", () => {
  const output = renderToString(
    <App load={emptyLoad} />,
    { columns: 120 },
  );
  expect(output).toContain("Merlin-Digital-Solutions · 0 PRs");
  expect(output).toContain("Lade Pull Requests…");
  expect(output).toContain("j/k wählen");
  expect(output).toContain("q beenden");
});

test("shows both section headers with keine placeholders when empty", async () => {
  const output = await renderLive(
    <App load={emptyLoad} open={open} now={now} intervalMs={60_000} />,
  );
  expect(output).toContain("OPEN");
  expect(output).toContain("DRAFT");
  expect(output).toContain("keine");
});

test("renders the rows once loading resolves", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
    />,
  );
  expect(output).toContain("Merlin-Digital-Solutions · 1 PRs");
  expect(output).toContain("merlin-dashboard");
  expect(output).toContain("#876");
  expect(output).toContain("✗");
});

test("renders the preview pane header line once per frame", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
    />,
    120,
  );
  const header = "#876 · merlin-dashboard";
  const titleLine = "feat(krise): let admins add web pages of approved";
  const count = (needle: string) => output.split(needle).length - 1;
  expect(count(header)).toBeGreaterThan(0);
  expect(count(header)).toBe(count(titleLine));
});
