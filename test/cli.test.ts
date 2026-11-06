import { expect, mock, test } from "bun:test";
import * as actualInk from "ink";

const renderCalls: unknown[] = [];

mock.module("ink", () => ({
  ...actualInk,
  render: (_node: unknown, options: unknown) => {
    renderCalls.push(options);
  },
}));

test("enables incremental rendering", async () => {
  await import("../src/cli");
  expect(renderCalls).toHaveLength(1);
  expect(renderCalls[0]).toMatchObject({
    exitOnCtrlC: false,
    incrementalRendering: true,
  });
});
