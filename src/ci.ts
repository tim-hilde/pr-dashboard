import type { CiInfo, CiState, RawCheckContext, RawStatusCheckRollup } from "./types";

const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const FAILED_CONTEXT_STATES = new Set(["FAILURE", "ERROR"]);
const PENDING_CONTEXT_STATES = new Set(["PENDING", "EXPECTED"]);
const MAX_FAILED = 5;

// The same rule as the OpenCode pr sidebar (`opencode/lib/pull-request.js` ciState), so both show one state.
const completed = (node: RawCheckContext): boolean =>
  node.__typename === "StatusContext" || node.status == null || node.status === "COMPLETED";

const running = (node: RawCheckContext): boolean =>
  node.__typename === "StatusContext"
    ? PENDING_CONTEXT_STATES.has(node.state)
    : !completed(node);

const failed = (node: RawCheckContext): boolean =>
  node.__typename === "StatusContext"
    ? FAILED_CONTEXT_STATES.has(node.state)
    : completed(node) && !PASSED_CONCLUSIONS.has(node.conclusion ?? "");

// A run without a start time is unfinished, so it is newer than any finished run.
const startedAt = (node: RawCheckContext): number => {
  const time = Date.parse(
    (node.__typename === "CheckRun" ? node.startedAt : node.createdAt) ?? "",
  );
  if (time > 0) return time;
  return running(node) ? Infinity : 0;
};

// GitHub lists every run on the head commit, so a re-run check appears more than once. Only the newest run counts.
function newestChecks(nodes: RawCheckContext[]): RawCheckContext[] {
  const newest = new Map<string, RawCheckContext>();
  for (const node of nodes) {
    const key = node.__typename === "StatusContext" ? `context:${node.context}` : `run:${node.name}`;
    const seen = newest.get(key);
    if (seen === undefined || startedAt(node) >= startedAt(seen)) newest.set(key, node);
  }
  return [...newest.values()];
}

export function mapCi(rollup: RawStatusCheckRollup): CiInfo {
  const nodes = rollup?.contexts?.nodes ?? [];
  if (nodes.length === 0) return { state: "none", failed: [] };

  const newest = newestChecks(nodes);
  const failedNames: string[] = [];
  for (const node of newest) {
    if (!failed(node)) continue;
    const name = node.__typename === "CheckRun" ? node.name : node.context;
    if (!failedNames.includes(name) && failedNames.length < MAX_FAILED) failedNames.push(name);
  }

  let state: CiState;
  if (newest.some(running)) state = "pending";
  else if (failedNames.length > 0) state = "failure";
  else state = "success";

  return { state, failed: failedNames };
}
