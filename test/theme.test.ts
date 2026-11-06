import { expect, test } from "bun:test";
import { PREVIEW_BORDER, RULE_BORDER, THEME } from "../src/theme";

test("uses the catppuccin mocha fzf palette", () => {
  expect(THEME.bg).toBe("#1e1e2e");
  expect(THEME.surface).toBe("#313244");
  expect(THEME.text).toBe("#cdd6f4");
  expect(THEME.muted).toBe("#6D7085");
  expect(THEME.border).toBe("#cba6f7");
  expect(THEME.accent).toBe("#89b4fa");
  expect(THEME.green).toBe("#a6e3a1");
  expect(THEME.yellow).toBe("#f9e2af");
  expect(THEME.red).toBe("#f38ba8");
});

test("uses the agent switcher border styles", () => {
  expect(PREVIEW_BORDER).toBe("round");
  expect(RULE_BORDER).toBe("single");
});
