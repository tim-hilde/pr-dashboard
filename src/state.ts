import type { FetchResult } from "./github";

export type DashboardState = {
  data: FetchResult | null;
  error: string | null;
  lastUpdated: Date | null;
};

export type RefreshOutcome =
  | { ok: true; data: FetchResult; at: Date }
  | { ok: false; error: string };

export function applyRefresh(
  state: DashboardState,
  outcome: RefreshOutcome,
): DashboardState {
  if (outcome.ok) {
    return { data: outcome.data, error: null, lastUpdated: outcome.at };
  }
  return { ...state, error: outcome.error };
}
