import React, { useCallback } from "react";
import { Box, Text } from "ink";
import { useApi } from "../context/ApiContext.js";
import { usePolling } from "../hooks/usePolling.js";
import { fetchProjects } from "../api/endpoints.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import type { ProjectInfo } from "../api/types.js";

export function DashboardScreen() {
  const { serverOnline, sessions, paulyStatus } = useApi();

  const projects = usePolling(
    useCallback(() => fetchProjects().then((r) => r.projects), []),
    10000,
  );

  const totalSessions = sessions?.totalProcesses ?? 0;
  const devRunning =
    projects.data?.filter((p) => p.devStatus?.status === "running").length ?? 0;
  const devErrors =
    projects.data?.filter((p) => p.devStatus?.status === "error").length ?? 0;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box gap={2} marginBottom={1}>
        <BorderBox title="System" flexGrow={1}>
          <Box gap={1}>
            <Text>Server:</Text>
            <StatusBadge status={serverOnline ? "ok" : "error"} label={serverOnline ? "Online" : "Offline"} />
          </Box>
          <Box gap={1}>
            <Text>Claude Sessions:</Text>
            <Text bold>{totalSessions}</Text>
          </Box>
          <Box gap={1}>
            <Text>Scheduled Jobs:</Text>
            <Text bold>{paulyStatus?.jobs.length ?? "—"}</Text>
          </Box>
        </BorderBox>

        <BorderBox title="Dev Processes" flexGrow={1}>
          <Box gap={1}>
            <Text>Running:</Text>
            <Text bold color="green">{devRunning}</Text>
          </Box>
          <Box gap={1}>
            <Text>Errors:</Text>
            <Text bold color={devErrors > 0 ? "red" : undefined}>{devErrors}</Text>
          </Box>
          <Box gap={1}>
            <Text>Total Projects:</Text>
            <Text bold>{projects.data?.length ?? "—"}</Text>
          </Box>
        </BorderBox>
      </Box>

      <BorderBox title="Session Groups">
        {sessions && sessions.groups.length > 0 ? (
          sessions.groups.map((group) => (
            <Box key={group.project} gap={2}>
              <Box width={20}>
                <Text bold>{group.project}</Text>
              </Box>
              <Text>{group.processes.length} proc</Text>
              <Text dimColor>CPU: {group.totalCpu.toFixed(1)}%</Text>
              <Text dimColor>MEM: {group.totalMem.toFixed(1)}%</Text>
            </Box>
          ))
        ) : (
          <Text dimColor>No active sessions</Text>
        )}
      </BorderBox>

      {paulyStatus && paulyStatus.jobs.length > 0 && (
        <BorderBox title="Scheduled Jobs">
          {paulyStatus.jobs.map((job) => (
            <Box key={job.name} gap={2}>
              <Box width={20}>
                <Text>{job.name}</Text>
              </Box>
              <Text dimColor>{job.schedule}</Text>
            </Box>
          ))}
        </BorderBox>
      )}

      {projects.data && projects.data.some((p) => p.devStatus?.status === "running") && (
        <BorderBox title="Active Dev">
          {projects.data
            .filter((p): p is ProjectInfo & { devStatus: NonNullable<ProjectInfo["devStatus"]> } =>
              p.devStatus?.status === "running",
            )
            .map((p) => (
              <Box key={p.name} gap={2}>
                <Box width={20}>
                  <Text bold>{p.name}</Text>
                </Box>
                <StatusBadge status={p.devStatus.status} />
              </Box>
            ))}
        </BorderBox>
      )}
    </Box>
  );
}
