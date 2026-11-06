import { expect, test } from "bun:test";
import { describeGhError } from "../src/errors";

test("explains a missing gh", () => {
  expect(describeGhError(new Error("gh: command not found"))).toContain(
    "nicht installiert",
  );
});

test("explains a missing login", () => {
  expect(describeGhError(new Error("gh: not logged in"))).toContain(
    "gh auth login",
  );
  expect(describeGhError(new Error("gh: Bad credentials"))).toContain(
    "gh auth login",
  );
});

test("keeps an unknown message", () => {
  expect(describeGhError(new Error("HTTP 502"))).toBe("HTTP 502");
});
