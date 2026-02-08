import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useApi } from "../context/ApiContext.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { killSession, killAllProcesses } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
import type { ClaudeProcess } from "../api/types.js";

interface FlatProcess extends ClaudeProcess {
  project: string;
}

export function SessionsScreen() {
  const { inputMode } = useKeyboard();
  const { sessions, refreshSessions } = useApi();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    action: () => Promise<unknown>;
  } | null>(null);

  // Flatten groups into a list
  const processes: FlatProcess[] = (sessions?.groups ?? []).flatMap((group) =>
    group.processes.map((p) => ({ ...p, project: group.project })),
  );

  useInput(
    (input) => {
      if (inputMode || confirmAction) return;

      if (input === "x" && processes.length > 0) {
        const proc = processes[highlightedIndex];
        if (proc) {
          setConfirmAction({
            message: `Kill PID ${proc.pid} (${proc.project})?`,
            action: async () => {
              await killSession(proc.pid);
              showToast(`Killed PID ${proc.pid}`, "success");
              refreshSessions();
            },
          });
        }
      } else if (input === "X") {
        setConfirmAction({
          message: `Kill ALL ${processes.length} Claude processes?`,
          action: async () => {
            const result = await killAllProcesses();
            showToast(`Killed ${result.killed} processes`, "success");
            refreshSessions();
          },
        });
      } else if (input === "r") {
        refreshSessions();
      }
    },
    { isActive: confirmAction === null },
  );

  if (confirmAction) {
    return (
      <Confirm
        message={confirmAction.message}
        onConfirm={async () => {
          try {
            await confirmAction.action();
          } catch (err) {
            showToast(String(err), "error");
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={2} marginBottom={1}>
        <Text bold>Claude Sessions ({sessions?.totalProcesses ?? 0})</Text>
        <Text dimColor>x:kill  X:kill all  r:refresh</Text>
      </Box>

      {/* Group summaries */}
      {sessions?.groups.map((group) => (
        <Box key={group.project} gap={2} marginBottom={0}>
          <Text bold color="cyan">{group.project}</Text>
          <Text dimColor>
            {group.processes.length} proc | CPU: {group.totalCpu.toFixed(1)}% | MEM: {group.totalMem.toFixed(1)}%
          </Text>
        </Box>
      ))}

      {(sessions?.groups.length ?? 0) > 0 && <Text> </Text>}

      <SelectableList
        items={processes}
        onHighlight={(_item, index) => setHighlightedIndex(index)}
        renderItem={(proc: FlatProcess, _i, selected) => (
          <Box gap={2}>
            <Box width={8}>
              <Text bold={selected}>{proc.pid}</Text>
            </Box>
            <Box width={18}>
              <Text>{proc.project}</Text>
            </Box>
            <Box width={10}>
              <StatusBadge status={proc.mode === "unknown" ? "idle" : "running"} label={proc.mode} />
            </Box>
            <Box width={10}>
              <Text dimColor>CPU: {proc.cpu.toFixed(1)}%</Text>
            </Box>
            <Box width={10}>
              <Text dimColor>MEM: {proc.mem.toFixed(1)}%</Text>
            </Box>
            <Text dimColor>{proc.uptime}</Text>
          </Box>
        )}
      />
    </Box>
  );
}
