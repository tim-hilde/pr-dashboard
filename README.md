# pr-dashboard

A read-only terminal dashboard for the open pull requests that you authored in the Merlin-Digital-Solutions organization.

The dashboard shows one row per pull request. Each row lists the repository, the pull request number, the title, the CI state, and the Codex review state. A preview pane on the right shows details of the selected pull request. The preview hides when the terminal is narrower than 100 columns.

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
| `c` | Open the Checks page of the selected pull request. |
| `v` | Open the Codex review comment, when one exists. |
| `p` | Toggle the preview pane. |
| `r` | Refresh the list now. |
| `q`, `Ctrl-C` | Quit. |

## tmux popup

`prefix + g` opens the dashboard in a centered popup that covers 90 percent of the width and 85 percent of the height. The popup closes when the dashboard exits.

## Tests

```bash
bun test
```

## Limits

The dashboard is read-only. It never changes a pull request.

The dashboard reads GitHub through the `gh` command. You must install the GitHub CLI and run `gh auth login` once. The dashboard never reads or stores your GitHub token.
