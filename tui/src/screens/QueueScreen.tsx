import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import {
  fetchQueueStats,
  fetchQueueJobs,
  fetchDeadLetterStats,
  fetchDeadLetterTasks,
  cancelJob,
  retryDeadLetter,
  resolveDeadLetter,
} from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
import type { QueueJob, DeadLetterTask } from "../api/types.js";

type QueueTab = "jobs" | "deadletter";

export function QueueScreen() {
  const { inputMode } = useKeyboard();
  const [tab, setTab] = useState<QueueTab>("jobs");
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const stats = usePolling(useCallback(() => fetchQueueStats(), []), 5000);
  const dlStats = usePolling(useCallback(() => fetchDeadLetterStats(), []), 10000);
  const jobs = usePolling(
    useCallback(() => fetchQueueJobs().then((r) => r.jobs), []),
    5000,
    { enabled: tab === "jobs" },
  );
  const dlTasks = usePolling(
    useCallback(() => fetchDeadLetterTasks().then((r) => r.tasks), []),
    10000,
    { enabled: tab === "deadletter" },
  );

  useInput(
    (input, key) => {
      if (inputMode || confirmAction) return;

      if (key.tab || input === "l") {
        setTab((t) => (t === "jobs" ? "deadletter" : "jobs"));
      } else if (input === "c" && tab === "jobs") {
        const job = jobs.data?.[highlightedIndex];
        if (job && job.status === "pending") {
          setConfirmAction({
            message: `Cancel job #${job.id} (${job.taskType})?`,
            action: async () => {
              await cancelJob(job.id);
              showToast("Job cancelled", "success");
              jobs.refresh();
            },
          });
        }
      } else if (input === "t" && tab === "deadletter") {
        const task = dlTasks.data?.[highlightedIndex];
        if (task) {
          setConfirmAction({
            message: `Retry dead-letter #${task.id}?`,
            action: async () => {
              await retryDeadLetter(task.id);
              showToast("Retrying task", "success");
              dlTasks.refresh();
            },
          });
        }
      } else if (input === "v" && tab === "deadletter") {
        const task = dlTasks.data?.[highlightedIndex];
        if (task) {
          setConfirmAction({
            message: `Resolve dead-letter #${task.id}?`,
            action: async () => {
              await resolveDeadLetter(task.id);
              showToast("Task resolved", "success");
              dlTasks.refresh();
            },
          });
        }
      } else if (input === "r") {
        stats.refresh();
        dlStats.refresh();
        if (tab === "jobs") jobs.refresh();
        else dlTasks.refresh();
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
      {/* Stats row */}
      <Box gap={2} marginBottom={1}>
        {stats.data && (
          <BorderBox title="Queue Stats">
            <Box gap={3}>
              <Text>Pending: <Text bold color="yellow">{stats.data.pending}</Text></Text>
              <Text>Running: <Text bold color="green">{stats.data.running}</Text></Text>
              <Text>Completed: <Text bold>{stats.data.completed}</Text></Text>
              <Text>Failed: <Text bold color="red">{stats.data.failed}</Text></Text>
            </Box>
          </BorderBox>
        )}
        {dlStats.data && (
          <BorderBox title="Dead Letter">
            <Box gap={3}>
              <Text>Pending: <Text bold color="yellow">{dlStats.data.pending}</Text></Text>
              <Text>Retrying: <Text bold color="cyan">{dlStats.data.retrying}</Text></Text>
              <Text>Resolved: <Text bold>{dlStats.data.resolved}</Text></Text>
            </Box>
          </BorderBox>
        )}
      </Box>

      {/* Tab bar */}
      <Box gap={2} marginBottom={1}>
        <Text bold={tab === "jobs"} color={tab === "jobs" ? "cyan" : undefined}>
          Jobs
        </Text>
        <Text dimColor>|</Text>
        <Text bold={tab === "deadletter"} color={tab === "deadletter" ? "cyan" : undefined}>
          Dead Letter
        </Text>
        <Text dimColor>(Tab to switch{tab === "jobs" ? " | c:cancel job" : " | t:retry v:resolve"})</Text>
      </Box>

      {/* Content */}
      {tab === "jobs" ? (
        <SelectableList
          items={jobs.data ?? []}
          onHighlight={(_item, index) => setHighlightedIndex(index)}
          renderItem={(job: QueueJob, _i, selected) => (
            <Box gap={2}>
              <Box width={6}>
                <Text bold={selected}>#{job.id}</Text>
              </Box>
              <Box width={20}>
                <Text>{job.taskType}</Text>
              </Box>
              <Box width={10}>
                <StatusBadge status={job.status} />
              </Box>
              <Box width={4}>
                <Text dimColor>P{job.priority}</Text>
              </Box>
              <Text dimColor>{new Date(job.createdAt).toLocaleString()}</Text>
            </Box>
          )}
        />
      ) : (
        <SelectableList
          items={dlTasks.data ?? []}
          onHighlight={(_item, index) => setHighlightedIndex(index)}
          renderItem={(task: DeadLetterTask, _i, selected) => (
            <Box gap={2}>
              <Box width={6}>
                <Text bold={selected}>#{task.id}</Text>
              </Box>
              <Box width={20}>
                <Text>{task.taskType}</Text>
              </Box>
              <Box width={12}>
                <StatusBadge status={task.status} />
              </Box>
              <Box width={30}>
                <Text color="red" wrap="truncate">{task.errorMessage}</Text>
              </Box>
            </Box>
          )}
        />
      )}
    </Box>
  );
}
