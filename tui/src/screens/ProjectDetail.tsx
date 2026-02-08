import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import {
  fetchProjectDetail,
  fetchDevStatus,
  startDev,
  stopDev,
  restartDev,
  addTask,
  toggleTask,
  deleteTask,
} from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
import type { ProjectDetail as ProjectDetailType, TaskItem } from "../api/types.js";

interface ProjectDetailProps {
  projectName: string;
  onBack: () => void;
}

export function ProjectDetail({ projectName, onBack }: ProjectDetailProps) {
  const { inputMode, setInputMode } = useKeyboard();
  const [addingTask, setAddingTask] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [highlightedTask, setHighlightedTask] = useState(0);

  const project = usePolling(
    useCallback(() => fetchProjectDetail(projectName), [projectName]),
    5000,
  );

  const devStatus = usePolling(
    useCallback(() => fetchDevStatus(projectName), [projectName]),
    3000,
  );

  const tasks = project.data?.tasks ?? [];

  const handleAction = useCallback(
    async (action: () => Promise<unknown>, successMsg: string) => {
      try {
        await action();
        showToast(successMsg, "success");
        project.refresh();
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [project],
  );

  useInput(
    (input, key) => {
      if (inputMode) return;

      if (key.escape || (input === "q" && !addingTask)) {
        onBack();
        return;
      }

      if (input === "s") {
        handleAction(() => startDev(projectName), "Dev started");
      } else if (input === "S") {
        handleAction(() => stopDev(projectName), "Dev stopped");
      } else if (input === "R") {
        handleAction(() => restartDev(projectName), "Dev restarted");
      } else if (input === "a") {
        setAddingTask(true);
        setInputMode(true);
      } else if (input === "t" && tasks.length > 0) {
        handleAction(
          () => toggleTask(projectName, highlightedTask),
          "Task toggled",
        );
      } else if (input === "d" && tasks.length > 0) {
        setConfirmDelete(highlightedTask);
      } else if (input === "r") {
        project.refresh();
      }
    },
    { isActive: !addingTask && confirmDelete === null },
  );

  const handleTaskSubmit = useCallback(
    async (value: string) => {
      setAddingTask(false);
      setInputMode(false);
      setTaskText("");
      if (value.trim()) {
        await handleAction(() => addTask(projectName, value.trim()), "Task added");
      }
    },
    [projectName, handleAction, setInputMode],
  );

  if (!project.data) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Loading {projectName}...</Text>
      </Box>
    );
  }

  const p = project.data;
  const dev = devStatus.data;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={2} marginBottom={1}>
        <Text bold color="cyan">{p.name}</Text>
        {p.gitBranch && <Text dimColor>({p.gitBranch})</Text>}
        {dev && <StatusBadge status={dev.status} />}
      </Box>

      <Box gap={2} marginBottom={1}>
        <BorderBox title="Info" flexGrow={1}>
          <Text>Path: {p.path}</Text>
          {p.gitStatus && (
            <Text dimColor>
              modified:{p.gitStatus.modified} untracked:{p.gitStatus.untracked} staged:{p.gitStatus.staged}
            </Text>
          )}
          {p.githubUrl && <Text dimColor>{p.githubUrl}</Text>}
          <Text dimColor>
            Keys: s:start S:stop R:restart a:add t:toggle d:delete
          </Text>
        </BorderBox>

        {dev && dev.status !== "idle" && (
          <BorderBox title="Dev Process" flexGrow={1}>
            <Box gap={1}>
              <Text>Status:</Text>
              <StatusBadge status={dev.status} />
            </Box>
            {dev.iteration && (
              <Text>
                Iteration: {dev.iteration.current}/{dev.iteration.max}
              </Text>
            )}
            {dev.startedAt && (
              <Text dimColor>Started: {new Date(dev.startedAt).toLocaleTimeString()}</Text>
            )}
            {dev.error && (
              <Text color="red">
                Error: {dev.error.phase} — {dev.error.message}
              </Text>
            )}
          </BorderBox>
        )}
      </Box>

      <BorderBox title={`Tasks (${tasks.length})`} flexGrow={1}>
        {addingTask ? (
          <Box>
            <Text color="cyan">New task: </Text>
            <TextInput
              placeholder="Task description..."
              onSubmit={handleTaskSubmit}
            />
          </Box>
        ) : confirmDelete !== null ? (
          <Confirm
            message={`Delete task: "${tasks[confirmDelete]?.text}"?`}
            onConfirm={() => {
              handleAction(
                () => deleteTask(projectName, confirmDelete),
                "Task deleted",
              );
              setConfirmDelete(null);
            }}
            onCancel={() => setConfirmDelete(null)}
          />
        ) : (
          <SelectableList
            items={tasks}
            onHighlight={(_item, index) => setHighlightedTask(index)}
            renderItem={(task: TaskItem, _i, selected) => (
              <Text
                bold={selected}
                strikethrough={task.completed}
                dimColor={task.completed}
              >
                {task.completed ? "[x]" : "[ ]"} {task.text}
              </Text>
            )}
          />
        )}
      </BorderBox>
    </Box>
  );
}
