import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Box, Text, useApp, useInput, useStdin, useWindowSize } from "ink";
import { cacheAge, allPrsCachePath, defaultCachePath, readCache, writeCache } from "./cache";
import { describeGhError } from "./errors";
import { fetchPullRequests, resolveLogin } from "./github";
import type { FetchResult } from "./github";
import { openUrl } from "./open";
import { copyText } from "./clipboard";
import { applyEvent } from "./state";
import type { DashboardState } from "./state";
import type { PullRequest } from "./types";
import { ciColor, codexColor } from "./format";
import { buildListRow, buildPreviewLines, authorCell } from "./view";
import type { PreviewLine } from "./view";
import {
  buildListItems,
  prRows,
  selectedItemIndex,
  windowRange,
} from "./list";
import type { ListMode } from "./list";
import { PREVIEW_BORDER, RULE_BORDER, THEME } from "./theme";

export type AppProps = {
  load?: () => Promise<FetchResult>;
  loadAll?: () => Promise<FetchResult>;
  open?: (url: string) => void;
  copy?: (text: string) => void;
  intervalMs?: number;
  now?: () => Date;
  cachePath?: string | null;
  cacheTtlMs?: number;
};

let cachedLogin: string | undefined;

const defaultLoad = async () =>
  fetchPullRequests((cachedLogin ??= await resolveLogin()));
const defaultLoadAll = async () => fetchPullRequests(null);
const defaultOpen = openUrl;
const defaultNow = () => new Date();

const PREVIEW_MIN_COLUMNS = 100;
const NUMBER_WIDTH = 6;
const STATUS_WIDTH = 3;
const ROW_CHROME = 15;
const AUTHOR_MAX_WIDTH = 18;
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
  loadAll = defaultLoadAll,
  open = defaultOpen,
  copy = copyText,
  intervalMs = 60_000,
  now = defaultNow,
  cachePath = defaultCachePath(),
  cacheTtlMs = CACHE_TTL_MS,
}: AppProps) {
  const cachePaths = useMemo(
    () => ({
      mine: cachePath,
      all: cachePath === null ? null : allPrsCachePath(cachePath),
    }),
    [cachePath],
  );
  const [mode, setMode] = useState<ListMode>("mine");
  const modeRef = useRef<ListMode>("mine");
  const activeCachePath = mode === "all" ? cachePaths.all : cachePaths.mine;
  const cacheEntry = useMemo(
    () => (activeCachePath === null ? null : readCache(activeCachePath)),
    [activeCachePath],
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
    applyEvent,
    initial,
  );
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(cacheEntry !== null);
  const [selected, setSelectedState] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [status, setStatus] = useState<string>();
  const inFlightRef = useRef(new Set<ListMode>());
  const selectedRef = useRef(0);
  const rowsRef = useRef<PullRequest[]>([]);
  const { columns, rows } = useWindowSize();
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const setSelected = (index: number) => {
    selectedRef.current = index;
    setSelectedState(index);
  };

  const refresh = useCallback(async () => {
    const current = mode;
    if (inFlightRef.current.has(current)) return;
    inFlightRef.current.add(current);
    setLoading(true);
    setStatus(undefined);
    const path = current === "all" ? cachePaths.all : cachePaths.mine;
    try {
      const result = await (current === "all" ? loadAll : load)();
      const at = now();
      if (path !== null) {
        try {
          writeCache(path, {
            version: 1,
            fetchedAt: at.toISOString(),
            result,
          });
        } catch {
          // A failed cache write must not break the refresh.
        }
      }
      if (modeRef.current !== current) return;
      const selectedUrl = rowsRef.current[selectedRef.current]?.url;
      const nextRows = prRows(buildListItems(result.prs));
      const kept = nextRows.findIndex((row) => row.url === selectedUrl);
      dispatch({ kind: "refresh", outcome: { ok: true, data: result, at } });
      setCached(false);
      setSelected(
        kept >= 0
          ? kept
          : Math.max(0, Math.min(selectedRef.current, nextRows.length - 1)),
      );
    } catch (err) {
      if (modeRef.current === current) {
        dispatch({
          kind: "refresh",
          outcome: { ok: false, error: describeGhError(err) },
        });
      }
    } finally {
      inFlightRef.current.delete(current);
      if (modeRef.current === current) setLoading(false);
    }
  }, [mode, load, loadAll, now, cachePaths]);

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

  const items = buildListItems(data?.prs ?? []);
  const allRows = prRows(items);
  rowsRef.current = allRows;
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
    if (key.tab) {
      const next: ListMode = modeRef.current === "mine" ? "all" : "mine";
      modeRef.current = next;
      setMode(next);
      const path = next === "all" ? cachePaths.all : cachePaths.mine;
      const entry = path === null ? null : readCache(path);
      dispatch({
        kind: "reset",
        state:
          entry === null
            ? initialDashboard
            : {
                data: entry.result,
                error: null,
                lastUpdated: new Date(entry.fetchedAt),
              },
      });
      setCached(entry !== null);
      setLoading(inFlightRef.current.has(next));
      setSelected(0);
      setStatus(undefined);
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
    if (input === "y") {
      const row = allRows[selectedRef.current];
      if (row === undefined) return;
      copy(row.url);
      setStatus("URL kopiert");
      return;
    }
    if (input === "a") {
      if (allRows.length === 0) {
        setStatus("Keine PRs");
      } else {
        for (const row of allRows) open(row.url);
        setStatus(`${allRows.length} PRs geöffnet`);
      }
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
  const longestAuthor = Math.max(
    ...allRows.map((row) => row.author.length + 1),
    0,
  );
  const authorWidth = Math.min(AUTHOR_MAX_WIDTH, Math.max(6, longestAuthor));
  const titleWidth = Math.max(
    1,
    listWidth - ROW_CHROME - (mode === "all" ? authorWidth + 1 : 0),
  );
  const tabHint = `Tab ${mode === "all" ? "meine" : "alle"}`;
  const keyHints = [
    "j/k wählen",
    "Enter PR",
    "y URL",
    "a alle öffnen",
    tabHint,
    "c Checks",
    "v Codex",
    "p Vorschau",
    "r neu laden",
    "q beenden",
  ];
  const footerOneLine = keyHints.join(" · ").length <= columns;
  const footerSplit = Math.ceil(keyHints.length / 2);
  const noticeRows =
    (data !== null && error !== null ? 1 : 0) +
    (status !== undefined ? 1 : 0) +
    (data !== null && data.total > data.prs.length ? 1 : 0);
  const footerRows = footerOneLine ? 2 : 3;
  const listHeight = Math.max(1, rows - 2 - footerRows - noticeRows);
  const firstItem = selectedItemIndex(items, selectedRef.current);
  const range = windowRange(items.length, firstItem, listHeight);
  const visibleItems = items.slice(range.start, range.end);

  const selectedRow = allRows[selectedRef.current];
  const previewLines =
    selectedRow === undefined
      ? []
      : buildPreviewLines(selectedRow, now(), { showAuthor: mode === "all" });
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
          {mode === "all" && (
            <Text bold={false} color={THEME.muted}>
              {"  "}· alle Autoren
            </Text>
          )}
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
          <Text color={THEME.red} wrap="truncate">
            ! {error}
          </Text>
        </Box>
      )}
      {status !== undefined && (
        <Box>
          <Text color={THEME.yellow} wrap="truncate">
            {status}
          </Text>
        </Box>
      )}
      {data !== null && data.total > data.prs.length && (
        <Box>
          <Text color={THEME.muted} wrap="truncate">
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
                <Text color={THEME.muted}>
                  r neu laden · {tabHint} · q beenden
                </Text>
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
              {visibleItems.map((item, visibleIndex) => {
                const key = `${range.start + visibleIndex}-${item.kind}`;
                if (item.kind === "repo") {
                  return (
                    <Text key={key} wrap="truncate">
                      <Text bold color={THEME.heading}>
                        {item.repo}
                      </Text>
                      <Text color={THEME.muted}>  {item.count}</Text>
                    </Text>
                  );
                }
                if (item.kind === "section") {
                  return (
                    <Text key={key} wrap="truncate">
                      <Text color={THEME.subheading}>  {item.name}</Text>
                      <Text color={THEME.muted}>  {item.count}</Text>
                    </Text>
                  );
                }
                if (item.kind === "empty") {
                  return (
                    <Text key={key} color={THEME.muted}>
                      keine
                    </Text>
                  );
                }
                const pr = item.pr;
                const cells = buildListRow(pr, { title: titleWidth });
                const marker =
                  item.index === selectedRef.current ? "▸ " : "  ";
                return (
                  <Box key={key}>
                    <Text>{"  "}</Text>
                    <Text color={THEME.border}>{marker}</Text>
                    <Text color={THEME.muted}>
                      {cells.number.padStart(NUMBER_WIDTH)}{" "}
                    </Text>
                    <Box width={STATUS_WIDTH}>
                      <Text color={THEME[ciColor(pr.ci.state)]}>
                        {cells.ci}
                      </Text>
                      <Text> </Text>
                      <Text color={THEME[codexColor(pr.codex.state)]}>
                        {cells.codex}
                      </Text>
                    </Box>
                    <Text> </Text>
                    {mode === "all" && (
                      <Text color={THEME.muted}>
                        {authorCell(pr.author, authorWidth)}{" "}
                      </Text>
                    )}
                    <Box
                      width={titleWidth}
                      flexShrink={1}
                      flexDirection="column"
                    >
                      <Text color={THEME.text} wrap="truncate">
                        {cells.title}
                      </Text>
                    </Box>
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
          {footerOneLine ? (
            <Text color={THEME.muted}>{keyHints.join(" · ")}</Text>
          ) : (
            <Box flexDirection="column">
              <Text color={THEME.muted}>
                {keyHints.slice(0, footerSplit).join(" · ")}
              </Text>
              <Text color={THEME.muted}>
                {keyHints.slice(footerSplit).join(" · ")}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
