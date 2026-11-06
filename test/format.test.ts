import { expect, test } from "bun:test";
import {
  ciCell,
  ciColor,
  codexCell,
  codexColor,
  link,
  relativeTime,
  truncate,
} from "../src/format";

test("truncates with an ellipsis", () => {
  expect(truncate("abcdefghij", 10)).toBe("abcdefghij");
  expect(truncate("abcdefghijk", 10)).toBe("abcdefghi…");
  expect(truncate("abc", 1)).toBe("…");
  expect(truncate("abc", 0)).toBe("…");
});

test("formats relative time in German", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  expect(relativeTime("2026-11-06T11:59:30Z", now)).toBe("gerade eben");
  expect(relativeTime("2026-11-06T11:30:00Z", now)).toBe("vor 30 min");
  expect(relativeTime("2026-11-06T09:00:00Z", now)).toBe("vor 3 h");
  expect(relativeTime("2026-11-04T12:00:00Z", now)).toBe("vor 2 d");
  expect(relativeTime("2026-09-01T12:00:00Z", now)).toBe("vor 2 Mon");
  expect(relativeTime("not-a-date", now)).toBe("–");
});

test("builds status cells", () => {
  expect(ciCell("success")).toBe("✓");
  expect(ciCell("pending")).toBe("…");
  expect(ciCell("failure")).toBe("✗");
  expect(ciCell("none")).toBe("–");
  expect(codexCell("approved")).toBe("✓");
  expect(codexCell("comments")).toBe("!");
  expect(codexCell("changes")).toBe("✗");
  expect(codexCell("stale")).toBe("~");
  expect(codexCell("none")).toBe("–");
});

test("wraps text in an OSC 8 hyperlink", () => {
  expect(link("PR", "https://example.test")).toBe(
    "\u001b]8;;https://example.test\u0007PR\u001b]8;;\u0007",
  );
});

test("maps status colors", () => {
  expect(ciColor("success")).toBe("green");
  expect(ciColor("pending")).toBe("yellow");
  expect(ciColor("failure")).toBe("red");
  expect(ciColor("none")).toBe("muted");
  expect(codexColor("approved")).toBe("green");
  expect(codexColor("comments")).toBe("yellow");
  expect(codexColor("changes")).toBe("red");
  expect(codexColor("stale")).toBe("yellow");
  expect(codexColor("none")).toBe("muted");
});
