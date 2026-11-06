import { expect, test } from "bun:test";
import { mapCi } from "../src/ci";

test("maps success", () => {
  expect(mapCi({ state: "SUCCESS", contexts: { nodes: [] } })).toEqual({
    state: "success",
    failed: [],
  });
});

test("collects failed check runs and status contexts", () => {
  const ci = mapCi({
    state: "FAILURE",
    contexts: {
      nodes: [
        { __typename: "CheckRun", name: "unit", conclusion: "FAILURE" },
        { __typename: "CheckRun", name: "lint", conclusion: "TIMED_OUT" },
        { __typename: "StatusContext", context: "deploy", state: "ERROR" },
        { __typename: "CheckRun", name: "typecheck", conclusion: "SUCCESS" },
      ],
    },
  });
  expect(ci.state).toBe("failure");
  expect(ci.failed).toEqual(["unit", "lint", "deploy"]);
});

test("caps the failed list at five names and removes duplicates", () => {
  const nodes = Array.from({ length: 7 }, (_, i) => ({
    __typename: "CheckRun" as const,
    name: `check-${i}`,
    conclusion: "FAILURE",
  }));
  nodes.push({ __typename: "CheckRun", name: "check-0", conclusion: "FAILURE" });
  const ci = mapCi({ state: "FAILURE", contexts: { nodes } });
  expect(ci.failed).toHaveLength(5);
  expect(new Set(ci.failed).size).toBe(5);
});

test("maps pending, null, and no checks", () => {
  expect(mapCi({ state: "PENDING", contexts: { nodes: [] } }).state).toBe("pending");
  expect(mapCi(null)).toEqual({ state: "none", failed: [] });
  expect(mapCi({ state: null, contexts: null })).toEqual({ state: "none", failed: [] });
});
