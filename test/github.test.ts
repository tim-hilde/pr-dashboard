import { expect, test } from "bun:test";
import {
  fetchPullRequests,
  mapSearchResponse,
  PR_QUERY,
  resolveLogin,
  type GhRunner,
} from "../src/github";

const fixture = await Bun.file(
  new URL("./fixtures/graphql-response.json", import.meta.url),
).json();

test("resolves the login", async () => {
  const run: GhRunner = async () => "tim-hilde\n";
  expect(await resolveLogin(run)).toBe("tim-hilde");
});

test("keeps the comment window and author field in the query", () => {
  expect(PR_QUERY).toContain("comments(last: 100)");
  expect(PR_QUERY).toContain("author { login }");
  expect(PR_QUERY).toContain("statusCheckRollup");
});

test("maps the search response", () => {
  const result = mapSearchResponse(fixture);
  expect(result.total).toBe(3);
  expect(result.prs).toHaveLength(3);

  const changed = result.prs.find((pr) => pr.number === 876)!;
  expect(changed.author).toBe("tim-hilde");
  expect(changed.ci.state).toBe("failure");
  expect(changed.ci.failed).toEqual(["unit", "lint"]);
  expect(changed.codex.state).toBe("changes");

  const approved = result.prs.find((pr) => pr.number === 930)!;
  expect(approved.isDraft).toBe(true);
  expect(approved.ci.state).toBe("pending");
  expect(approved.codex.state).toBe("approved");

  const none = result.prs.find((pr) => pr.number === 643)!;
  expect(none.ci.state).toBe("none");
  expect(none.codex.state).toBe("none");
});

test("fetches with the explicit login", async () => {
  const calls: string[][] = [];
  const run: GhRunner = async (args) => {
    calls.push(args);
    return JSON.stringify(fixture);
  };
  const result = await fetchPullRequests("tim-hilde", run);
  expect(result.total).toBe(3);
  expect(calls[0]).toContain("q=is:pr is:open author:tim-hilde org:Merlin-Digital-Solutions");
});

test("fetches every author without a login", async () => {
  const calls: string[][] = [];
  const run: GhRunner = async (args) => {
    calls.push(args);
    return JSON.stringify(fixture);
  };
  await fetchPullRequests(null, run);
  expect(calls[0]).toContain("q=is:pr is:open org:Merlin-Digital-Solutions");
});

test("returns an empty result", async () => {
  const empty = await Bun.file(
    new URL("./fixtures/graphql-response-empty.json", import.meta.url),
  ).json();
  expect(mapSearchResponse(empty)).toEqual({ prs: [], total: 0 });
});
