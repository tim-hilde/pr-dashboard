import { mapCi } from "./ci";
import { parseCodexComment } from "./codex";
import type {
  PullRequest,
  RawPullRequest,
  RawStatusCheckRollup,
  SearchResponse,
} from "./types";

export class GhError extends Error {}

export type GhRunner = (args: string[]) => Promise<string>;

export type FetchResult = { prs: PullRequest[]; total: number };

export const PR_QUERY = `
query($q: String!) {
  search(query: $q, type: ISSUE, first: 100) {
    issueCount
    nodes {
      ... on PullRequest {
        number
        title
        isDraft
        url
        updatedAt
        headRefName
        baseRefName
        author { login }
        repository { nameWithOwner }
        commits(last: 1) {
          nodes {
            commit {
              committedDate
              statusCheckRollup {
                state
                contexts(first: 50) {
                  nodes {
                    __typename
                    ... on CheckRun { name conclusion detailsUrl }
                    ... on StatusContext { context state targetUrl }
                  }
                }
              }
            }
          }
        }
        comments(last: 100) {
          nodes { body url createdAt author { login } }
        }
      }
    }
  }
}
`;

export async function runGh(args: string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new GhError(stderr.trim() || `gh exited with code ${exitCode}`);
  }
  return stdout;
}

export async function resolveLogin(run: GhRunner = runGh): Promise<string> {
  const out = await run(["api", "user", "--jq", ".login"]);
  return out.trim();
}

export async function fetchPullRequests(
  login: string | null,
  run: GhRunner = runGh,
): Promise<FetchResult> {
  const author = login === null ? "" : ` author:${login}`;
  const q = `is:pr is:open${author} org:Merlin-Digital-Solutions`;
  const out = await run([
    "api",
    "graphql",
    "-f",
    `query=${PR_QUERY}`,
    "-f",
    `q=${q}`,
  ]);
  const data = JSON.parse(out) as Partial<SearchResponse>;
  const search = data.data?.search;
  if (search === undefined) {
    throw new GhError("gh returned an unexpected response");
  }
  return mapSearchResponse({ data: { search } });
}

export function mapSearchResponse(data: SearchResponse): FetchResult {
  const prs = data.data.search.nodes.map((node) =>
    mapPullRequest(node),
  );
  return { prs, total: data.data.search.issueCount };
}

function mapPullRequest(node: RawPullRequest): PullRequest {
  const headCommit = node.commits.nodes[0];
  const rollup: RawStatusCheckRollup =
    headCommit === undefined ? null : headCommit.commit.statusCheckRollup;
  const headCommittedAt =
    headCommit === undefined ? "" : headCommit.commit.committedDate;
  return {
    repo: node.repository.nameWithOwner,
    repoShort: node.repository.nameWithOwner.split("/")[1] ?? "",
    author: node.author?.login ?? "unbekannt",
    number: node.number,
    title: node.title,
    url: node.url,
    isDraft: node.isDraft,
    updatedAt: node.updatedAt,
    headRef: node.headRefName,
    baseRef: node.baseRefName,
    headCommittedAt,
    ci: mapCi(rollup),
    codex: parseCodexComment(node.comments.nodes, headCommittedAt),
  };
}
