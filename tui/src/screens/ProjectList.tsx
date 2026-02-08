import React, { useCallback } from "react";
import { Box, Text } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { fetchProjects } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { ProgressBar } from "../components/shared/ProgressBar.js";
import type { ProjectInfo } from "../api/types.js";

interface ProjectListProps {
  onSelect: (project: ProjectInfo) => void;
}

export function ProjectList({ onSelect }: ProjectListProps) {
  const { data, loading } = usePolling(
    useCallback(() => fetchProjects().then((r) => r.projects), []),
    5000,
  );

  if (loading && !data) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Loading projects...</Text>
      </Box>
    );
  }

  const projects = data ?? [];

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold>Projects ({projects.length})</Text>
      </Box>
      <SelectableList
        items={projects}
        onSelect={onSelect}
        renderItem={(p, _i, selected) => (
          <Box gap={2} width="100%">
            <Box width={22}>
              <Text bold={selected}>{p.name}</Text>
            </Box>
            <Box width={10}>
              {p.devStatus ? (
                <StatusBadge status={p.devStatus.status} />
              ) : (
                <Text dimColor>—</Text>
              )}
            </Box>
            <Box width={30}>
              {p.tasksCompletion ? (
                <ProgressBar percentage={p.tasksCompletion.percentage} width={15} />
              ) : (
                <Text dimColor>no tasks</Text>
              )}
            </Box>
            {p.hasGit && <Text dimColor>git</Text>}
          </Box>
        )}
      />
    </Box>
  );
}
