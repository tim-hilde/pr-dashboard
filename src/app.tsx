import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Box, Text, useApp, useInput, useStdin, useWindowSize } from "ink";
import { describeGhError } from "./errors";
import { fetchPullRequests, resolveLogin } from "./github";
import type { FetchResult } from "./github";
import { openUrl } from "./open";
import { sortPullRequests } from "./sort";
import { applyRefresh } from "./state";
import type { DashboardState } from "./state";
import type { PullRequest } from "./types";
import { buildListRow, buildPreviewLines } from "./view";
import type { PreviewLine } from "./view";

export type AppProps = {
  load?: () => Promise<FetchResult>;
  open?: (url: string) => void;
  intervalMs?: number;
  now?: () => Date;
};

let cachedLogin: string | undefined;

const defaultLoad = async () =>
  fetchPullRequests((cachedLogin ??= await resolveLogin()));
const defaultOpen = openUrl;
const defaultNow = () => new Date();

const PREVIEW_MIN_COLUMNS = 100;
const NUMBER_WIDTH = 6;
const STATUS_WIDTH = 4;
const CELL_GAPS = 4;

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
  return { color: line.color, dimColor: line.dim };
}

export function App({
  load = defaultLoad,
  open = defaultOpen,
  intervalMs = 60_000,
  now = defaultNow,
}: AppProps) {
  const [{ data, error, lastUpdated }, dispatch] = useReducer(
    applyRefresh,
    initialDashboard,
  );
  const [loading, setLoading] = useState(false);
  const [selected, setSelectedState] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [status, setStatus] = useState<string>();
  const inFlightRef = useRef(false);
  const selectedRef = useRef(0);
  const { columns } = useWindowSize();
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
      dispatch({ ok: true, data: result, at: now() });
      setSelected(
        Math.max(0, Math.min(selectedRef.current, result.prs.length - 1)),
      );
    } catch (err) {
      dispatch({ ok: false, error: describeGhError(err) });
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [load, now]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  const sorted = sortPullRequests(data?.prs ?? []);
  const sections: { name: "OPEN" | "DRAFT"; prs: PullRequest[] }[] = [
    { name: "OPEN", prs: sorted.open },
    { name: "DRAFT", prs: sorted.draft },
  ];
  const rows = [...sorted.open, ...sorted.draft];

  useEffect(() => {
    if (data !== null && selectedRef.current >= rows.length) {
      setSelected(Math.max(0, rows.length - 1));
    }
  }, [data, rows.length]);

  const step = (delta: number) => {
    const next = selectedRef.current + delta;
    setSelected(Math.max(0, Math.min(next, rows.length - 1)));
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
      const row = rows[selectedRef.current];
      if (row !== undefined) open(row.url);
      return;
    }
    if (input === "c") {
      const row = rows[selectedRef.current];
      if (row !== undefined) open(`${row.url}/checks`);
      return;
    }
    if (input === "v") {
      const row = rows[selectedRef.current];
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
  const listWidth = Math.max(20, columns - previewWidth - 3);
  const longestRepo = Math.max(...rows.map((row) => row.repoShort.length), 0);
  const repoWidth = Math.min(20, Math.max(4, longestRepo));
  const titleWidth = Math.max(
    10,
    listWidth - repoWidth - NUMBER_WIDTH - STATUS_WIDTH - CELL_GAPS,
  );

  const selectedRow = rows[selectedRef.current];
  const previewLines =
    selectedRow === undefined ? [] : buildPreviewLines(selectedRow, now());

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>
          Merlin-Digital-Solutions · {data?.prs.length ?? 0} PRs ·{" "}
          {headerTime(lastUpdated)}
        </Text>
      </Box>
      {error !== null && (
        <Box>
          <Text color="red">{error}</Text>
        </Box>
      )}
      {status !== undefined && (
        <Box>
          <Text color="yellow">{status}</Text>
        </Box>
      )}
      {data !== null && data.total > data.prs.length && (
        <Box>
          <Text dimColor>
            Nur die ersten {data.prs.length} von {data.total} PRs
          </Text>
        </Box>
      )}

      {data === null ? (
        error !== null ? (
          <Box flexDirection="column">
            <Text>r neu laden · q beenden</Text>
          </Box>
        ) : (
          <Text dimColor>Lade Pull Requests…</Text>
        )
      ) : (
        <Box>
          <Box
            flexDirection="column"
            flexGrow={1}
            width={listWidth}
            flexShrink={0}
          >
            {sections.map((section, sectionIndex) => {
              const offset = sections
                .slice(0, sectionIndex)
                .reduce((sum, previous) => sum + previous.prs.length, 0);
              return (
                <Box key={section.name} flexDirection="column">
                  <Text bold>{section.name}</Text>
                  {section.prs.length === 0 ? (
                    <Text dimColor>keine</Text>
                  ) : (
                    section.prs.map((pr, rowIndex) => {
                      const index = offset + rowIndex;
                      const cells = buildListRow(pr, {
                        repo: repoWidth,
                        title: titleWidth,
                      });
                      const marker =
                        index === selectedRef.current ? "▸ " : "  ";
                      const highlighted = index === selectedRef.current;
                      const label = `${marker}${cells.repo} ${cells.number.padEnd(
                        NUMBER_WIDTH,
                      )} `;
                      return (
                        <Box key={pr.url} flexDirection="column">
                          <Box>
                            <Text inverse={highlighted}>{label}</Text>
                            <Box
                              width={titleWidth}
                              flexShrink={1}
                              flexDirection="column"
                            >
                              <Text inverse={highlighted} wrap="wrap">
                                {cells.title}
                              </Text>
                            </Box>
                            <Text inverse={highlighted}> </Text>
                            <Box width={STATUS_WIDTH}>
                              <Text>{cells.ci}</Text>
                              <Text> </Text>
                              <Text>{cells.codex}</Text>
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
            <>
              <Box width={1} />
              <Box
                flexDirection="column"
                width={previewWidth}
                flexShrink={0}
                borderStyle="single"
                borderColor="gray"
                paddingX={1}
              >
                {previewLines.map((line, index) => (
                  <Text key={index} wrap="wrap" {...previewLineProps(line)}>
                    {line.text}
                  </Text>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          j/k wählen · Enter PR · c Checks · v Codex · p Vorschau · r neu laden ·
          q beenden
        </Text>
      </Box>
    </Box>
  );
}
