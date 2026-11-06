import type { CiInfo, CiState, RawStatusCheckRollup } from "./types";

const FAILED_CONCLUSIONS = new Set(["FAILURE", "TIMED_OUT", "CANCELLED"]);
const FAILED_CONTEXT_STATES = new Set(["FAILURE", "ERROR"]);
const MAX_FAILED = 5;

export function mapCi(rollup: RawStatusCheckRollup): CiInfo {
  if (rollup === null || rollup.state === null) {
    return { state: "none", failed: [] };
  }

  let state: CiState;
  if (rollup.state === "SUCCESS") state = "success";
  else if (rollup.state === "FAILURE" || rollup.state === "ERROR") state = "failure";
  else state = "pending";

  const failed: string[] = [];
  for (const node of rollup.contexts?.nodes ?? []) {
    let name: string | undefined;
    if (node.__typename === "CheckRun") {
      if (node.conclusion !== null && FAILED_CONCLUSIONS.has(node.conclusion)) {
        name = node.name;
      }
    } else if (FAILED_CONTEXT_STATES.has(node.state)) {
      name = node.context;
    }
    if (name !== undefined && !failed.includes(name) && failed.length < MAX_FAILED) {
      failed.push(name);
    }
  }

  return { state, failed };
}
