import { expect, test } from "bun:test";
import type { FetchResult } from "../src/github";
import { applyEvent, applyRefresh } from "../src/state";
import type { DashboardState } from "../src/state";

const result: FetchResult = { prs: [], total: 0 };
const at = new Date("2026-11-06T12:00:00Z");

test("a success replaces the data and clears the error", () => {
  const state = applyRefresh(
    { data: null, error: "HTTP 502", lastUpdated: null },
    { ok: true, data: result, at },
  );
  expect(state).toEqual({ data: result, error: null, lastUpdated: at });
});

test("a failure after a success keeps the data and the timestamp", () => {
  const state = applyRefresh(
    { data: result, error: null, lastUpdated: at },
    { ok: false, error: "HTTP 502" },
  );
  expect(state).toEqual({ data: result, error: "HTTP 502", lastUpdated: at });
});

test("a first failure keeps the data null and sets the error", () => {
  const state: DashboardState = applyRefresh(
    { data: null, error: null, lastUpdated: null },
    { ok: false, error: "HTTP 502" },
  );
  expect(state).toEqual({ data: null, error: "HTTP 502", lastUpdated: null });
});

test("a reset replaces the whole state", () => {
  const reset: DashboardState = { data: result, error: null, lastUpdated: at };
  expect(
    applyEvent(
      { data: null, error: "HTTP 502", lastUpdated: null },
      { kind: "reset", state: reset },
    ),
  ).toEqual(reset);
});
