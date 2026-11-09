import type { FetchResult } from "./github";

export type DashboardState = {
  data: FetchResult | null;
  error: string | null;
  lastUpdated: Date | null;
};

export type RefreshOutcome =
  | { ok: true; data: FetchResult; at: Date }
  | { ok: false; error: string };

export type DashboardEvent =
  | { kind: "refresh"; outcome: RefreshOutcome }
  | { kind: "reset"; state: DashboardState };

export function applyRefresh(
  state: DashboardState,
  outcome: RefreshOutcome,
): DashboardState {
  if (outcome.ok) {
    return { data: outcome.data, error: null, lastUpdated: outcome.at };
  }
  return { ...state, error: outcome.error };
}

export function applyEvent(
  state: DashboardState,
  event: DashboardEvent,
): DashboardState {
  if (event.kind === "reset") return event.state;
  return applyRefresh(state, event.outcome);
}
