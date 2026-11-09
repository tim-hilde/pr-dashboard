import { expect, test } from "bun:test";
import { mapCi } from "../src/ci";

const check = (
  name: string,
  conclusion: string | null,
  startedAt = "2026-11-09T12:00:00Z",
  status = "COMPLETED",
) => ({ __typename: "CheckRun" as const, name, status, conclusion, startedAt });

test("maps success when every check passed", () => {
  expect(
    mapCi({ state: "SUCCESS", contexts: { nodes: [check("unit", "SUCCESS")] } }),
  ).toEqual({ state: "success", failed: [] });
});

test("collects failed check runs and status contexts", () => {
  const ci = mapCi({
    state: "FAILURE",
    contexts: {
      nodes: [
        { __typename: "CheckRun", name: "unit", status: "COMPLETED", conclusion: "FAILURE", startedAt: "2026-11-09T12:00:00Z" },
        { __typename: "CheckRun", name: "lint", status: "COMPLETED", conclusion: "TIMED_OUT", startedAt: "2026-11-09T12:00:00Z" },
        { __typename: "StatusContext", context: "deploy", state: "ERROR" },
        check("typecheck", "SUCCESS"),
      ],
    },
  });
  expect(ci.state).toBe("failure");
  expect(ci.failed).toEqual(["unit", "lint", "deploy"]);
});

test("caps the failed list at five names and removes duplicates", () => {
  const nodes = Array.from({ length: 7 }, (_, i) => check(`check-${i}`, "FAILURE"));
  nodes.push(check("check-0", "FAILURE"));
  const ci = mapCi({ state: "FAILURE", contexts: { nodes } });
  expect(ci.failed).toHaveLength(5);
  expect(new Set(ci.failed).size).toBe(5);
});

test("maps null and no checks to none", () => {
  expect(mapCi(null)).toEqual({ state: "none", failed: [] });
  expect(mapCi({ state: null, contexts: null })).toEqual({ state: "none", failed: [] });
  expect(mapCi({ state: null, contexts: { nodes: [] } })).toEqual({ state: "none", failed: [] });
});

test("falls back to GitHub's overall state when the check list is missing or cut off", () => {
  expect(mapCi({ state: "SUCCESS", contexts: { nodes: [] } }).state).toBe("success");
  expect(
    mapCi({ state: "FAILURE", contexts: { nodes: [], pageInfo: { hasNextPage: true } } }).state,
  ).toBe("failure");
  expect(
    mapCi({
      state: "PENDING",
      contexts: { nodes: [check("unit", null, "2026-11-09T12:00:00Z", "IN_PROGRESS")], pageInfo: { hasNextPage: true } },
    }).state,
  ).toBe("pending");
});

test("keeps a job with the same name in different workflows apart", () => {
  const suite = (event: string, workflow: string) => ({ workflowRun: { event, workflow: { name: workflow } } });
  const failedRun = { ...check("test", "FAILURE", "2026-11-09T12:31:17Z"), checkSuite: suite("push", "ci") };
  const passed = { ...check("test", "SUCCESS", "2026-11-09T12:32:25Z"), checkSuite: suite("pull_request", "ci") };
  expect(mapCi({ state: "FAILURE", contexts: { nodes: [failedRun, passed] } }).state).toBe("failure");
  expect(mapCi({ state: "SUCCESS", contexts: { nodes: [passed, failedRun] } }).state).toBe("failure");
});

test("stays pending while a check still runs, even after another check failed", () => {
  const ci = mapCi({
    state: "FAILURE",
    contexts: { nodes: [check("data-layer", "FAILURE"), check("unit", null, "2026-11-09T12:05:00Z", "IN_PROGRESS")] },
  });
  expect(ci.state).toBe("pending");
  expect(ci.failed).toEqual(["data-layer"]);
});

test("stays pending while a status context is pending", () => {
  const ci = mapCi({
    state: "FAILURE",
    contexts: {
      nodes: [check("unit", "FAILURE"), { __typename: "StatusContext", context: "deploy", state: "PENDING" }],
    },
  });
  expect(ci.state).toBe("pending");
});

test("is a failure once every check has finished", () => {
  const ci = mapCi({
    state: "FAILURE",
    contexts: { nodes: [check("unit", "FAILURE"), check("lint", "SUCCESS")] },
  });
  expect(ci.state).toBe("failure");
});

test("counts only the newest run of a re-run check, like gh pr checks", () => {
  const cancelled = check("data-layer", "CANCELLED", "2026-11-09T15:48:18Z");
  const passed = check("data-layer", "SUCCESS", "2026-11-09T15:57:23Z");
  expect(mapCi({ state: "FAILURE", contexts: { nodes: [cancelled, passed] } })).toEqual({
    state: "success",
    failed: [],
  });
  expect(mapCi({ state: "FAILURE", contexts: { nodes: [passed, cancelled] } })).toEqual({
    state: "success",
    failed: [],
  });
});

test("shows a failure when the newest run of a check failed", () => {
  const passed = check("tests", "SUCCESS", "2026-11-09T12:31:17Z");
  const failedRun = check("tests", "FAILURE", "2026-11-09T12:32:25Z");
  expect(mapCi({ state: "FAILURE", contexts: { nodes: [passed, failedRun] } }).state).toBe("failure");
});

test("judges a status context by its newest state", () => {
  const failedRun = { __typename: "StatusContext" as const, context: "deploy", state: "FAILURE", createdAt: "2026-11-09T12:31:17Z" };
  const passed = { __typename: "StatusContext" as const, context: "deploy", state: "SUCCESS", createdAt: "2026-11-09T12:32:25Z" };
  expect(mapCi({ state: "FAILURE", contexts: { nodes: [failedRun, passed] } }).state).toBe("success");
});
