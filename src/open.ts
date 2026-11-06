export function openUrl(url: string): void {
  Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
}
