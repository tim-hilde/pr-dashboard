export function copyText(text: string): void {
  Bun.spawn(["pbcopy"], {
    stdin: new Blob([text]),
    stdout: "ignore",
    stderr: "ignore",
  });
}
