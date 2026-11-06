import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Box, Text, useApp, useInput, useStdin, useWindowSize } from "ink";
import { cacheAge, defaultCachePath, readCache, writeCache } from "./cache";
import { describeGhError } from "./errors";
import { fetchPullRequests, resolveLogin } from "./github";
import type { FetchResult } from "./github";
import { openUrl } from "./open";
import { sortPullRequests } from "./sort";
import { applyRefresh } from "./state";
import type { DashboardState } from "./state";
import type { PullRequest } from "./types";
import { ciColor, codexColor } from "./format";
import { buildListRow, buildPreviewLines } from "./view";
import type { PreviewLine } from "./view";
import { PREVIEW_BORDER, RULE_BORDER, THEME } from "./theme";

export type AppProps = {
  load?: () => Promise<FetchResult>;
  open?: (url: string) => void;
  intervalMs?: number;
  now?: () => Date;
  cachePath?: string | null;
  cacheTtlMs?: number;
};

let cachedLogin: string | undefined;

const defaultLoad = async () =>
  fetchPullRequests((cachedLogin ??= await resolveLogin()));
const defaultOpen = openUrl;
const defaultNow = () => new Date();

const PREVIEW_MIN_COLUMNS = 100;
const NUMBER_WIDTH = 6;
const STATUS_WIDTH = 3;
const ROW_CHROME = 14;
const CACHE_TTL_MS = 60_000;

const initialDashboard: DashboardState = {
  data: null,
  error: null,
  lastUpdated: null,
};

function headerTime(date: Date | null): string {
  if (date === null) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function previewLineProps(line: PreviewLine) {
  return {
    color: line.color ? THEME[line.color] : line.dim ? THEME.muted : undefined,
    bold: line.bold,
    underline: line.underline,
  };
}

export function App({
  load = defaultLoad,
  open = defaultOpen,
  intervalMs = 60_000,
  now = defaultNow,
  cachePath = defaultCachePath(),
  cacheTtlMs = CACHE_TTL_MS,
}: AppProps) {
  const cacheEntry = useMemo(
    () => (cachePath === null ? null : readCache(cachePath)),
    [cachePath],
  );
  const initial: DashboardState =
    cacheEntry === null
      ? initialDashboard
      : {
          data: cacheEntry.result,
          error: null,
          lastUpdated: new Date(cacheEntry.fetchedAt),
        };
  const [{ data, error, lastUpdated }, dispatch] = useReducer(
    applyRefresh,
    initial,
  );
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(cacheEntry !== null);
  const [selected, setSelectedState] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [status, setStatus] = useState<string>();
  const inFlightRef = useRef(false);
  const selectedRef = useRef(0);
  const { columns, rows } = useWindowSize();
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const setSelected = (index: number) => {
    selectedRef.current = index;
    setSelectedState(index);
  };

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setStatus(undefined);
    try {
      const result = await load();
      const at = now();
      dispatch({ ok: true, data: result, at });
      setCached(false);
      if (cachePath !== null) {
        try {
          writeCache(cachePath, {
            version: 1,
            fetchedAt: at.toISOString(),
            result,
          });
        } catch {
          // A failed cache write must not break the refresh.
        }
      }
      setSelected(
        Math.max(0, Math.min(selectedRef.current, result.prs.length - 1)),
      );
    } catch (err) {
      dispatch({ ok: false, error: describeGhError(err) });
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [load, now, cachePath]);

  const initialDelay = useMemo(() => {
    if (cacheEntry === null) return 0;
    return Math.max(0, cacheTtlMs - cacheAge(cacheEntry, now()));
  }, [cacheEntry, cacheTtlMs, now]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          await refresh();
          if (cancelled) return;
          schedule(intervalMs);
        })();
      }, delay);
    };
    schedule(initialDelay);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [refresh, intervalMs, initialDelay]);

  const sorted = sortPullRequests(data?.prs ?? []);
  const sections: { name: "OPEN" | "DRAFT"; prs: PullRequest[] }[] = [
    { name: "OPEN", prs: sorted.open },
    { name: "DRAFT", prs: sorted.draft },
  ];
  const allRows = [...sorted.open, ...sorted.draft];
  const count = data?.prs.length ?? 0;

  useEffect(() => {
    if (data !== null && selectedRef.current >= allRows.length) {
      setSelected(Math.max(0, allRows.length - 1));
    }
  }, [data, allRows.length]);

  const step = (delta: number) => {
    const next = selectedRef.current + delta;
    setSelected(Math.max(0, Math.min(next, allRows.length - 1)));
    setStatus(undefined);
  };

  useInput((input, key) => {
    if (input === "q" || input === "\x03") {
      exit();
      return;
    }
    if (key.upArrow || input === "k") {
      step(-1);
      return;
    }
    if (key.downArrow || input === "j") {
      step(1);
      return;
    }
    if (key.return || input === "o") {
      const row = allRows[selectedRef.current];
      if (row !== undefined) open(row.url);
      return;
    }
    if (input === "c") {
      const row = allRows[selectedRef.current];
      if (row !== undefined) open(`${row.url}/checks`);
      return;
    }
    if (input === "v") {
      const row = allRows[selectedRef.current];
      if (row === undefined) return;
      if (row.codex.commentUrl === undefined) {
        setStatus("Kein Codex-Kommentar");
      } else {
        open(row.codex.commentUrl);
      }
      return;
    }
    if (input === "p") {
      setStatus(undefined);
      setPreviewOpen((current) => !current);
      return;
    }
    if (input === "r") {
      void refresh();
    }
  }, { isActive: isRawModeSupported });

  const previewVisible = previewOpen && columns >= PREVIEW_MIN_COLUMNS;
  const previewWidth = previewVisible
    ? Math.min(70, Math.max(40, Math.floor(columns * 0.45)))
    : 0;
  const listWidth = Math.max(20, columns - previewWidth - (previewVisible ? 1 : 0));
  const longestRepo = Math.max(...allRows.map((row) => row.repoShort.length), 0);
  const repoWidth = Math.min(20, Math.max(4, longestRepo));
  const titleWidth = Math.max(1, listWidth - repoWidth - ROW_CHROME);

  const selectedRow = allRows[selectedRef.current];
  const previewLines =
    selectedRow === undefined ? [] : buildPreviewLines(selectedRow, now());
  const firstLoadError = data === null && error !== null;

  return (
    <Box flexDirection="column" height={rows}>
      <Box
        justifyContent="space-between"
        borderStyle={RULE_BORDER}
        borderBottom
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor={THEME.muted}
      >
        <Text bold color={THEME.text}>
          Merlin-Digital-Solutions
        </Text>
        <Text>
          <Text color={THEME.text}>{count} PRs</Text>
          <Text color={THEME.muted}> · </Text>
          <Text color={cached ? THEME.accent : THEME.muted}>
            {cached ? "Cache" : "Stand"}
          </Text>
          <Text color={THEME.muted}> {headerTime(lastUpdated)}</Text>
          {loading && <Text color={THEME.accent}> · lädt</Text>}
        </Text>
      </Box>
      {data !== null && error !== null && (
        <Box>
          <Text color={THEME.red}>! {error}</Text>
        </Box>
      )}
      {status !== undefined && (
        <Box>
          <Text color={THEME.yellow}>{status}</Text>
        </Box>
      )}
      {data !== null && data.total > data.prs.length && (
        <Box>
          <Text color={THEME.muted}>
            Nur die ersten {data.prs.length} von {data.total} PRs
          </Text>
        </Box>
      )}

      <Box flexGrow={1} alignItems="flex-start">
        {data === null ? (
          firstLoadError ? (
            <Box width="100%" justifyContent="center">
              <Box
                borderStyle={PREVIEW_BORDER}
                borderColor={THEME.red}
                paddingX={1}
                flexDirection="column"
              >
                <Text color={THEME.red}>! {error}</Text>
                <Text color={THEME.muted}>r neu laden · q beenden</Text>
              </Box>
            </Box>
          ) : (
            <Box width="100%" justifyContent="center">
              <Text color={THEME.muted}>Lade Pull Requests…</Text>
            </Box>
          )
        ) : (
          <>
            <Box
              flexDirection="column"
              width={listWidth}
              flexShrink={0}
            >
              {sections.map((section, sectionIndex) => {
                const offset = sections
                  .slice(0, sectionIndex)
                  .reduce((sum, previous) => sum + previous.prs.length, 0);
                return (
                  <Box
                    key={section.name}
                    flexDirection="column"
                    marginTop={section.name === "DRAFT" ? 1 : 0}
                  >
                    <Box>
                      <Text bold color={THEME.border}>
                        {section.name}
                      </Text>
                      <Text color={THEME.muted}>  {section.prs.length}</Text>
                    </Box>
                    {section.prs.length === 0 ? (
                      <Text color={THEME.muted}>  keine</Text>
                    ) : (
                      section.prs.map((pr, rowIndex) => {
                        const index = offset + rowIndex;
                        const cells = buildListRow(pr, {
                          repo: repoWidth,
                          title: titleWidth,
                        });
                        const marker =
                          index === selectedRef.current ? "▸ " : "  ";
                        return (
                          <Box key={pr.url} flexDirection="column">
                            <Box>
                              <Text color={THEME.border}>{marker}</Text>
                              <Text color={THEME.text}>{cells.repo} </Text>
                              <Text color={THEME.muted}>
                                {cells.number.padStart(NUMBER_WIDTH)}{" "}
                              </Text>
                              <Box
                                width={titleWidth}
                                flexShrink={1}
                                flexDirection="column"
                              >
                                <Text color={THEME.text} wrap="truncate">
                                  {cells.title}
                                </Text>
                              </Box>
                              <Text> </Text>
                              <Box width={STATUS_WIDTH}>
                                <Text color={THEME[ciColor(pr.ci.state)]}>
                                  {cells.ci}
                                </Text>
                                <Text> </Text>
                                <Text color={THEME[codexColor(pr.codex.state)]}>
                                  {cells.codex}
                                </Text>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                );
              })}
            </Box>
            {previewVisible && selectedRow !== undefined && (
              <Box
                flexDirection="column"
                width={previewWidth}
                flexShrink={0}
                borderStyle={PREVIEW_BORDER}
                borderColor={THEME.border}
                paddingX={1}
                marginLeft={1}
              >
                {previewLines.map((line, index) => (
                  <Text key={index} wrap="wrap" {...previewLineProps(line)}>
                    {line.text}
                  </Text>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {!firstLoadError && (
        <Box
          flexDirection="column"
          borderStyle={RULE_BORDER}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor={THEME.muted}
        >
          {columns >= 90 ? (
            <Text color={THEME.muted}>
              j/k wählen · Enter PR · c Checks · v Codex · p Vorschau · r neu
              laden · q beenden
            </Text>
          ) : (
            <Box flexDirection="column">
              <Text color={THEME.muted}>
                j/k wählen · Enter PR · c Checks · v Codex · p Vorschau
              </Text>
              <Text color={THEME.muted}>r neu laden · q beenden</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
