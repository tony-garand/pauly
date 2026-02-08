import React from "react";
import { Box, Text } from "ink";
import { useApi } from "../../context/ApiContext.js";
import { useKeyboard } from "../../context/KeyboardContext.js";

export function Footer() {
  const { serverOnline, sessions } = useApi();
  const { commandMode } = useKeyboard();

  const totalSessions = sessions?.totalProcesses ?? 0;
  const devRunning = sessions?.groups.reduce(
    (n, g) => n + g.processes.filter((p) => p.mode !== "unknown").length,
    0,
  ) ?? 0;

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text dimColor>
        {commandMode
          ? "Esc:close  Enter:run  Ctrl+C:cancel"
          : "::command  q:quit  ?:help  1-6:switch  j/k:nav  r:refresh"}
      </Text>
      <Box gap={2}>
        <Text>
          Server:
          <Text color={serverOnline ? "green" : "red"}>
            {serverOnline ? "OK" : "OFF"}
          </Text>
        </Text>
        <Text dimColor>Sessions:{totalSessions}</Text>
        <Text dimColor>Dev:{devRunning}</Text>
      </Box>
    </Box>
  );
}
