import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdin, useWindowSize } from "ink";
import { describeGhError } from "./errors";
import { fetchPullRequests, resolveLogin } from "./github";
import type { FetchResult } from "./github";
import { openUrl } from "./open";
import { sortPullRequests } from "./sort";
import type { PullRequest } from "./types";
import { buildListRow, buildPreviewLines } from "./view";
import type { PreviewLine } from "./view";

export type AppProps = {
  load?: () => Promise<FetchResult>;
  open?: (url: string) => void;
  intervalMs?: number;
  now?: () => Date;
};

const defaultLoad = async () => fetchPullRequests(await resolveLogin());
const defaultOpen = openUrl;
const defaultNow = () => new Date();

const PREVIEW_MIN_COLUMNS = 100;
const NUMBER_WIDTH = 6;
const STATUS_WIDTH = 4;

type RowSpec = { pr: PullRequest; section: "open" | "draft" };

function headerTime(date: Date | undefined): string {
  if (date === undefined) return "--:--";
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
  const [data, setData] = useState<FetchResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [lastUpdated, setLastUpdated] = useState<Date>();
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
    try {
      const result = await load();
      setData(result);
      setError(undefined);
      setLastUpdated(now());
      setSelected(
        Math.max(0, Math.min(selectedRef.current, result.prs.length - 1)),
      );
    } catch (err) {
      setError(describeGhError(err));
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
  const rows: RowSpec[] = [
    ...sorted.open.map((pr) => ({ pr, section: "open" as const })),
    ...sorted.draft.map((pr) => ({ pr, section: "draft" as const })),
  ];

  useEffect(() => {
    if (data !== undefined && selectedRef.current >= rows.length) {
      setSelected(Math.max(0, rows.length - 1));
    }
  }, [data, rows.length]);

  const step = (delta: number) => {
    const next = selectedRef.current + delta;
    setSelected(Math.max(0, Math.min(next, rows.length - 1)));
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
      if (row !== undefined) open(row.pr.url);
      return;
    }
    if (input === "c") {
      const row = rows[selectedRef.current];
      if (row !== undefined) open(`${row.pr.url}/checks`);
      return;
    }
    if (input === "v") {
      const row = rows[selectedRef.current];
      if (row === undefined) return;
      if (row.pr.codex.commentUrl === undefined) {
        setStatus("Kein Codex-Kommentar");
      } else {
        open(row.pr.codex.commentUrl);
      }
      return;
    }
    if (input === "p") {
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
  const longestRepo = Math.max(...rows.map((row) => row.pr.repoShort.length), 0);
  const repoWidth = Math.min(20, Math.max(4, longestRepo));
  const titleWidth = Math.max(
    10,
    listWidth - repoWidth - NUMBER_WIDTH - STATUS_WIDTH,
  );

  const selectedRow = rows[selectedRef.current];
  const previewLines =
    selectedRow === undefined ? [] : buildPreviewLines(selectedRow.pr, now());

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>
          Merlin-Digital-Solutions · {data?.prs.length ?? 0} PRs ·{" "}
          {headerTime(lastUpdated)}
        </Text>
      </Box>
      {error !== undefined && (
        <Box>
          <Text color="red">{error}</Text>
        </Box>
      )}
      {status !== undefined && (
        <Box>
          <Text color="yellow">{status}</Text>
        </Box>
      )}
      {data !== undefined && data.total > data.prs.length && (
        <Box>
          <Text dimColor>
            Nur die ersten {data.prs.length} von {data.total} PRs
          </Text>
        </Box>
      )}

      {data === undefined ? (
        error !== undefined ? (
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
            {rows.length === 0 ? (
              <Text dimColor>keine</Text>
            ) : (
              rows.map((row, index) => {
                const cells = buildListRow(row.pr, {
                  repo: repoWidth,
                  title: titleWidth,
                });
                const previous = index === 0 ? undefined : rows[index - 1];
                const header =
                  previous === undefined || previous.section !== row.section ? (
                    <Text bold>
                      {row.section === "open" ? "OPEN" : "DRAFT"}
                    </Text>
                  ) : null;
                const marker =
                  index === selectedRef.current ? "▸ " : "  ";
                const highlighted = index === selectedRef.current;
                const label = `${marker}${cells.repo}${cells.number.padEnd(
                  NUMBER_WIDTH,
                )}`;
                return (
                  <Box key={row.pr.url} flexDirection="column">
                    {header}
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
                      <Box width={STATUS_WIDTH} justifyContent="space-between">
                        <Text>{cells.ci}</Text>
                        <Text>{cells.codex}</Text>
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
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
