import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { render, renderToString } from "ink";
import { App } from "../src/app";
import { writeCache, allPrsCachePath } from "../src/cache";
import type { FetchResult } from "../src/github";
import type { PullRequest } from "../src/types";

const sample: PullRequest = {
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
    required: ["🔴 [blocking] Mask numbers"],
  },
};

const longSample: PullRequest = {
  ...sample,
  codex: {
    ...sample.codex,
    required: [
      "Fix the scrolling regression that resets the position on every refresh so that the dashboard keeps its place during the hourly reload",
    ],
  },
};

const result: FetchResult = { prs: [sample], total: 1 };
const draftSample: PullRequest = {
  ...sample,
  number: 700,
  title: "draft: rework the cache",
  url: "https://github.com/Merlin-Digital-Solutions/merlin-dashboard/pull/700",
  isDraft: true,
};
const otherSample: PullRequest = {
  ...sample,
  repo: "Merlin-Digital-Solutions/merlin-spricht",
  repoShort: "merlin-spricht",
  author: "anna-schmidt",
  number: 930,
  title: "feat(crisis): Krisentelefon",
  url: "https://github.com/Merlin-Digital-Solutions/merlin-spricht/pull/930",
};
const allResult: FetchResult = {
  prs: [sample, draftSample, otherSample],
  total: 3,
};
const allLoad = async () => allResult;
const emptyResult: FetchResult = { prs: [], total: 0 };
const load = async () => result;
const longLoad = async () => ({ prs: [longSample], total: 1 });
const emptyLoad = async () => emptyResult;
const failLoad = async () => {
  throw new Error("gh: Not logged in");
};

const cachedSample = { ...sample, number: 999, title: "cached row" };
let loadCalls = 0;
const countingLoad = async () => {
  loadCalls += 1;
  return result;
};

const open = () => {};
const now = () => new Date("2026-11-06T12:00:00Z");
const stripAnsi = (text: string) =>
  text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");

function renderLive(
  element: React.ReactElement,
  columns = 80,
  until: (output: string) => boolean = (output) =>
    output.includes("keine") ||
    output.includes("#876") ||
    output.includes("gh auth login"),
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
      if (until(output)) {
        finish();
      }
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

test("puts the status cells behind the pull request number", async () => {
  const output = stripAnsi(
    await renderLive(
      <App
        load={load}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={null}
      />,
      120,
    ),
  );
  expect(output).toMatch(/#876\s+✗ ✗\s+feat\(krise\)/);
});

test("opens every listed pull request on a", async () => {
  const opened: string[] = [];
  const second: PullRequest = {
    ...sample,
    repo: "Merlin-Digital-Solutions/merlin-spricht",
    repoShort: "merlin-spricht",
    number: 930,
    url: "https://github.com/Merlin-Digital-Solutions/merlin-spricht/pull/930",
  };
  const twoLoad = async () => ({ prs: [sample, second], total: 2 });
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    }) as Writable & { columns: number; rows: number };
    stdout.columns = 120;
    stdout.rows = 40;
    const stdin = new PassThrough() as PassThrough & {
      setRawMode: (enabled: boolean) => PassThrough;
      isTTY: boolean;
    };
    stdin.setRawMode = () => stdin;
    stdin.isTTY = true;
    const instance = render(
      <App
        load={twoLoad}
        open={(url) => opened.push(url)}
        now={now}
        intervalMs={60_000}
        cachePath={null}
      />,
      {
        stdout,
        stdin,
        stderr: new Writable({ write: (_c, _e, cb) => cb() }),
        patchConsole: false,
        debug: true,
      },
    );
    const timer = setInterval(() => {
      if (!output.includes("#930")) return;
      clearInterval(timer);
      clearTimeout(timeout);
      stdin.write("a");
      setTimeout(() => {
        instance.unmount();
        void instance.waitUntilExit().then(
          () => resolve(),
          reject,
        );
      }, 50);
    }, 20);
    const timeout = setTimeout(() => {
      clearInterval(timer);
      instance.unmount();
      reject(
        new Error(`render did not show both rows: ${JSON.stringify(output)}`),
      );
    }, 2_000);
  });
  expect(opened).toEqual([sample.url, second.url]);
});

test("renders the loading header and footer on first render", () => {
  const output = renderToString(
    <App load={emptyLoad} cachePath={null} />,
    { columns: 120 },
  );
  expect(output).toContain("Merlin-Digital-Solutions");
  expect(output).toContain("0 PRs");
  expect(output).toContain("Stand");
  expect(output).toContain("Lade Pull Requests…");
  expect(output).toContain("j/k wählen");
  expect(output).toContain("q beenden");
});

test("shows keine when there are no pull requests", async () => {
  const output = await renderLive(
    <App
      load={emptyLoad}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
  );
  expect(output).toContain("keine");
  expect(output).not.toContain("OPEN  0");
});

test("renders the rows once loading resolves", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
  );
  expect(output).toContain("Merlin-Digital-Solutions");
  expect(output).toContain("1 PRs");
  expect(output).toContain("OPEN  1");
  expect(output).toContain("merlin-dashboard");
  expect(output).toContain("#876");
  expect(output).toContain("✗");
});

function renderPress(
  element: React.ReactElement,
  key: string,
  before: string,
  after: string,
  columns = 120,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let output = "";
    let pressed = false;
    let finished = false;
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
      if (finished) return;
      finished = true;
      clearInterval(timer);
      clearTimeout(timeout);
      instance.unmount();
      void instance.waitUntilExit().then(
        () => (failure === undefined ? resolve(output) : reject(new Error(failure))),
        reject,
      );
    };
    const timer = setInterval(() => {
      if (!output.includes(before)) return;
      if (!pressed) {
        pressed = true;
        stdin.write(key);
        return;
      }
      if (output.includes(after)) finish();
    }, 20);
    const timeout = setTimeout(() => {
      finish(`renderPress timed out: ${JSON.stringify(output)}`);
    }, 2_000);
  });
}

test("keeps the author column hidden in mine mode", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
    80,
  );
  expect(output).not.toContain("@tim-hilde");
});

test("groups the mine view under repository headings too", async () => {
  const output = stripAnsi(
    await renderLive(
      <App
        load={allLoad}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={null}
      />,
      80,
    ),
  );
  const frame = output.slice(output.lastIndexOf("Merlin-Digital-Solutions"));
  expect(frame).toContain("merlin-dashboard  2");
  expect(frame).toContain("  OPEN  1");
  expect(frame).toContain("  DRAFT  1");
  expect(frame).toContain("merlin-spricht  1");
  expect(frame).toMatch(/▸\s+#876 ✗ ✗ feat\(krise\)/);
});

test("copies the selected pull request URL on y", async () => {
  const copied: string[] = [];
  const output = await renderPress(
    <App
      load={load}
      open={open}
      copy={(text) => copied.push(text)}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
    "y",
    "#876",
    "URL kopiert",
    80,
  );
  expect(output).toContain("URL kopiert");
  expect(copied).toEqual([sample.url]);
});

test("removes the author filter on Tab and groups by repository", async () => {
  const output = stripAnsi(
    await renderPress(
      <App
        load={load}
        loadAll={allLoad}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={null}
      />,
      "\t",
      "#876",
      "@anna-schmidt",
      80,
    ),
  );
  expect(output).toContain("alle Autoren");
  expect(output).toContain("@tim-hilde");
  expect(output).toContain("@anna-schmidt");
  expect(output).toContain("  OPEN  1");
  expect(output).toContain("  DRAFT  1");

  const allPart = output.slice(output.lastIndexOf("alle Autoren"));
  expect(allPart.indexOf("merlin-dashboard")).toBeLessThan(
    allPart.indexOf("merlin-spricht"),
  );
  expect(allPart.indexOf("merlin-dashboard")).toBeLessThan(
    allPart.indexOf("#876"),
  );
});

test("shows the cached all-authors rows on Tab without fetching", async () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-app-cache-"));
  const cachePath = join(dir, "prs.json");
  writeCache(cachePath, {
    version: 1,
    fetchedAt: "2026-11-06T12:00:00.000Z",
    result: {
      prs: [{ ...sample, number: 111, title: "mine row" }],
      total: 1,
    },
  });
  writeCache(allPrsCachePath(cachePath), {
    version: 1,
    fetchedAt: "2026-11-06T12:00:00.000Z",
    result: {
      prs: [
        { ...sample, number: 222, title: "all row", author: "anna-schmidt" },
      ],
      total: 1,
    },
  });
  let calls = 0;
  const mineLoad = async () => {
    calls += 1;
    return result;
  };
  const countedAllLoad = async () => {
    calls += 1;
    return allResult;
  };
  try {
    const output = await renderPress(
      <App
        load={mineLoad}
        loadAll={countedAllLoad}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={cachePath}
        cacheTtlMs={60_000}
      />,
      "\t",
      "#111",
      "#222",
      80,
    );
    expect(output).toContain("#222");
    expect(calls).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renders the preview pane header line once per frame", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
    120,
  );
  const header = "#876 · merlin-dashboard";
  const branchLine = "feat/krise → main";
  const count = (needle: string) => output.split(needle).length - 1;
  expect(count(header)).toBeGreaterThan(0);
  expect(count(header)).toBe(count(branchLine));
});

test("hides the preview pane on narrow terminals", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
  );
  expect(output).not.toContain("#876 · merlin-dashboard");
});

test("shows the beginning of long preview lines", async () => {
  const output = await renderLive(
    <App
      load={longLoad}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
    120,
  );
  expect(output).toContain("Fix the scrolling regression");
});

test("shows the error box when the first load fails", async () => {
  const output = await renderLive(
    <App
      load={failLoad}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
  );
  expect(output).toContain("gh auth login");
  expect(output).toContain("Stand");
});

test("shows a fresh cache immediately and skips the fetch", async () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-app-cache-"));
  const cachePath = join(dir, "prs.json");
  writeCache(cachePath, {
    version: 1,
    fetchedAt: "2026-11-06T12:00:00.000Z",
    result,
  });
  let calls = 0;
  const load = async () => {
    calls += 1;
    return result;
  };
  try {
    const output = await renderLive(
      <App
        load={load}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={cachePath}
        cacheTtlMs={60_000}
      />,
    );
    expect(output).toContain("#876");
    expect(output).toContain("Cache");
    expect(calls).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shows the stale cache and refreshes it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-app-cache-"));
  const cachePath = join(dir, "prs.json");
  writeCache(cachePath, {
    version: 1,
    fetchedAt: "2026-11-06T11:50:00.000Z",
    result: { prs: [cachedSample], total: 1 },
  });
  loadCalls = 0;
  try {
    const output = await renderLive(
      <App
        load={countingLoad}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={cachePath}
        cacheTtlMs={60_000}
      />,
    );
    expect(output).toContain("#876");
    expect(output).toContain("Stand");
    expect(loadCalls).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("keeps the cached rows when the refresh fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "prs-app-cache-"));
  const cachePath = join(dir, "prs.json");
  writeCache(cachePath, {
    version: 1,
    fetchedAt: "2026-11-06T11:50:00.000Z",
    result: { prs: [cachedSample], total: 1 },
  });
  try {
    const output = await renderLive(
      <App
        load={failLoad}
        open={open}
        now={now}
        intervalMs={60_000}
        cachePath={cachePath}
        cacheTtlMs={60_000}
      />,
      80,
      (out) => out.includes("gh auth login"),
    );
    expect(output).toContain("#999");
    expect(output).toContain("Cache");
    expect(output).toContain("gh auth login");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("marks the selected row with the arrow only", async () => {
  const output = await renderLive(
    <App
      load={load}
      open={open}
      now={now}
      intervalMs={60_000}
      cachePath={null}
    />,
    120,
  );
  expect(output).toContain("▸ ");
  expect(output).not.toContain("\u001b[7m");
});
