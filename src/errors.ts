const MISSING_GH = /command not found|ENOENT/i;
const MISSING_LOGIN = /not logged in|authentication|gh auth login|HTTP 401|bad credentials/i;

const NOT_INSTALLED =
  "gh ist nicht installiert. Installiere die GitHub CLI und starte erneut.";
const NOT_LOGGED_IN =
  "gh ist nicht angemeldet. Führe `gh auth login` aus.";

export function describeGhError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (MISSING_GH.test(message)) return NOT_INSTALLED;
  if (MISSING_LOGIN.test(message)) return NOT_LOGGED_IN;
  return message;
}
