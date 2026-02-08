import React, { useCallback } from "react";
import { Box, Text } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { fetchLogs } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import type { LogInfo } from "../api/types.js";

interface LogListProps {
  onSelect: (log: LogInfo) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function LogList({ onSelect }: LogListProps) {
  const { data, loading } = usePolling(
    useCallback(() => fetchLogs().then((r) => r.logs), []),
    10000,
  );

  if (loading && !data) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Loading logs...</Text>
      </Box>
    );
  }

  const logs = data ?? [];

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold>Log Files ({logs.length})</Text>
      </Box>
      <SelectableList
        items={logs}
        onSelect={onSelect}
        renderItem={(log, _i, selected) => (
          <Box gap={2}>
            <Box width={30}>
              <Text bold={selected}>{log.name}</Text>
            </Box>
            <Box width={10}>
              <Text dimColor>{formatSize(log.size)}</Text>
            </Box>
            <Text dimColor>{new Date(log.lastModified).toLocaleString()}</Text>
          </Box>
        )}
      />
    </Box>
  );
}
