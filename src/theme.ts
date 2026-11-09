export const THEME = {
  bg: "#1e1e2e",
  surface: "#313244",
  text: "#cdd6f4",
  muted: "#6D7085",
  border: "#cba6f7",
  accent: "#89b4fa",
  heading: "#89b4fa",
  subheading: "#b4befe",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
} as const;

export type ThemeColor = keyof typeof THEME;

export const PREVIEW_BORDER = "round";
export const RULE_BORDER = "single";
