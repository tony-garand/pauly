import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { fetchLogContent } from "../api/endpoints.js";

interface LogViewerProps {
  logName: string;
  onBack: () => void;
}

export function LogViewer({ logName, onBack }: LogViewerProps) {
  const { inputMode } = useKeyboard();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tailLines] = useState(200);

  const { data } = usePolling(
    useCallback(
      () => fetchLogContent(logName, tailLines).then((r) => r.log),
      [logName, tailLines],
    ),
    autoRefresh ? 3000 : 999999,
  );

  const lines = data?.content.split("\n") ?? [];
  const termHeight = process.stdout.rows - 8; // header + footer + borders
  const maxScroll = Math.max(0, lines.length - termHeight);

  useInput(
    (input, key) => {
      if (inputMode) return;

      if (key.escape || input === "q") {
        onBack();
        return;
      }

      if (input === "j" || key.downArrow) {
        setScrollOffset((s) => Math.min(s + 1, maxScroll));
      } else if (input === "k" || key.upArrow) {
        setScrollOffset((s) => Math.max(s - 1, 0));
      } else if (input === "g") {
        setScrollOffset(0);
      } else if (input === "G") {
        setScrollOffset(maxScroll);
      } else if (input === "f") {
        setAutoRefresh((v) => !v);
      } else if (input === " ") {
        // Page down
        setScrollOffset((s) => Math.min(s + termHeight, maxScroll));
      }
    },
    { isActive: true },
  );

  // When auto-refresh is on, always show the tail
  if (autoRefresh && data) {
    const displayOffset = maxScroll;
    const visible = lines.slice(displayOffset, displayOffset + termHeight);

    return (
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        <Box gap={2} marginBottom={1}>
          <Text bold color="cyan">{logName}</Text>
          <Text dimColor>
            {lines.length} lines | f:auto-refresh [{autoRefresh ? "ON" : "OFF"}] | j/k:scroll | Space:page down
          </Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {visible.map((line, i) => (
            <Text key={displayOffset + i} wrap="truncate">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  const visible = lines.slice(scrollOffset, scrollOffset + termHeight);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={2} marginBottom={1}>
        <Text bold color="cyan">{logName}</Text>
        <Text dimColor>
          [{scrollOffset + 1}-{Math.min(scrollOffset + termHeight, lines.length)}/{lines.length}] |
          f:auto-refresh [{autoRefresh ? "ON" : "OFF"}] | j/k:scroll | Space:page down
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {visible.map((line, i) => (
          <Text key={scrollOffset + i} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
