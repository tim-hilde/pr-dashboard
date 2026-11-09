export type CodexState = "approved" | "comments" | "changes" | "stale" | "none";
export type CiState = "success" | "failure" | "pending" | "none";

export type CiInfo = {
  state: CiState;
  failed: string[];
};

export type CodexInfo = {
  state: CodexState;
  commentUrl?: string;
  createdAt?: string;
  verdictText?: string;
  required: string[];
};

export type PullRequest = {
  repo: string;
  repoShort: string;
  author: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  headRef: string;
  baseRef: string;
  headCommittedAt: string;
  ci: CiInfo;
  codex: CodexInfo;
};

export type RawComment = {
  body: string;
  url: string;
  createdAt: string;
  author: { login: string };
};

export type RawCheckContext =
  | {
      __typename: "CheckRun";
      name: string;
      status: string | null;
      conclusion: string | null;
      startedAt?: string | null;
      detailsUrl?: string | null;
    }
  | { __typename: "StatusContext"; context: string; state: string; createdAt?: string | null; targetUrl?: string | null };

export type RawStatusCheckRollup = {
  state: string | null;
  contexts: { nodes: RawCheckContext[] } | null;
} | null;

export type RawPullRequest = {
  number: number;
  title: string;
  isDraft: boolean;
  url: string;
  updatedAt: string;
  headRefName: string;
  baseRefName: string;
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  commits: {
    nodes: {
      commit: {
        committedDate: string;
        statusCheckRollup: RawStatusCheckRollup;
      };
    }[];
  };
  comments: { nodes: RawComment[] };
};

export type SearchResponse = {
  data: {
    search: {
      issueCount: number;
      nodes: RawPullRequest[];
    };
  };
};
