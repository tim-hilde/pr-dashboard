# pr-dashboard

A read-only terminal dashboard for your open pull requests and every open pull request in the Merlin-Digital-Solutions organization.

The dashboard shows one row per pull request, grouped under repository headings with `OPEN` and `DRAFT` subheadings. Each row lists the pull request number, the CI state, the Codex review state, and the title. The all-authors view also shows the author. A preview pane on the right shows details of the selected pull request. The preview hides when the terminal is narrower than 100 columns.

## Install

The project uses Bun and Ink.

```bash
bun install
bun link
```

`bun link` puts the `prs` command in `~/.bun/bin`. That directory must be in your PATH.

## Run

```bash
prs
```

## Keys

| Key | Action |
| --- | --- |
| `j`, `k` | Move down and up. |
| `Enter`, `o` | Open the selected pull request in the browser. |
| `y` | Copy the URL of the selected pull request to the clipboard. |
| `a` | Open every listed pull request in the browser. |
| `Tab` | Switch between your pull requests and all open pull requests in the organization. |
| `c` | Open the Checks page of the selected pull request. |
| `v` | Open the Codex review comment, when one exists. |
| `p` | Toggle the preview pane. |
| `r` | Refresh the list now. |
| `q`, `Ctrl-C` | Quit. |

## tmux popup

`prefix + g` opens the dashboard in a centered popup that covers 70 percent of the width and 55 percent of the height. The popup closes when the dashboard exits.

## Cache

- The first start fetches the pull requests.
- Later starts show the cache immediately.
- The mine cache lives at `~/.cache/pr-dashboard/prs.json`.
- The all-authors cache lives at `~/.cache/pr-dashboard/prs-all.json`.
- The cache refreshes every 60 seconds and on `r`.
- The cache is local and read-only.
- Every fetch also writes one file per pull request to `~/.cache/pr-data/`, so the OpenCode pr sidebar reads the same data.

## Tests

```bash
bun test
```

## Limits

The dashboard is read-only. It never changes a pull request.

The dashboard reads GitHub through the `gh` command. You must install the GitHub CLI and run `gh auth login` once. The dashboard never reads or stores your GitHub token.

The cache is a local copy of the last successful response.
