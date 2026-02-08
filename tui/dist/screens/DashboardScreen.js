import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { Box, Text } from "ink";
import { useApi } from "../context/ApiContext.js";
import { usePolling } from "../hooks/usePolling.js";
import { fetchProjects } from "../api/endpoints.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
export function DashboardScreen() {
    const { serverOnline, sessions, paulyStatus } = useApi();
    const projects = usePolling(useCallback(() => fetchProjects().then((r) => r.projects), []), 10000);
    const totalSessions = sessions?.totalProcesses ?? 0;
    const devRunning = projects.data?.filter((p) => p.devStatus?.status === "running").length ?? 0;
    const devErrors = projects.data?.filter((p) => p.devStatus?.status === "error").length ?? 0;
    return (_jsxs(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, children: [_jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsxs(BorderBox, { title: "System", flexGrow: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Server:" }), _jsx(StatusBadge, { status: serverOnline ? "ok" : "error", label: serverOnline ? "Online" : "Offline" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Claude Sessions:" }), _jsx(Text, { bold: true, children: totalSessions })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Scheduled Jobs:" }), _jsx(Text, { bold: true, children: paulyStatus?.jobs.length ?? "—" })] })] }), _jsxs(BorderBox, { title: "Dev Processes", flexGrow: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Running:" }), _jsx(Text, { bold: true, color: "green", children: devRunning })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Errors:" }), _jsx(Text, { bold: true, color: devErrors > 0 ? "red" : undefined, children: devErrors })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Total Projects:" }), _jsx(Text, { bold: true, children: projects.data?.length ?? "—" })] })] })] }), _jsx(BorderBox, { title: "Session Groups", children: sessions && sessions.groups.length > 0 ? (sessions.groups.map((group) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 20, children: _jsx(Text, { bold: true, children: group.project }) }), _jsxs(Text, { children: [group.processes.length, " proc"] }), _jsxs(Text, { dimColor: true, children: ["CPU: ", group.totalCpu.toFixed(1), "%"] }), _jsxs(Text, { dimColor: true, children: ["MEM: ", group.totalMem.toFixed(1), "%"] })] }, group.project)))) : (_jsx(Text, { dimColor: true, children: "No active sessions" })) }), paulyStatus && paulyStatus.jobs.length > 0 && (_jsx(BorderBox, { title: "Scheduled Jobs", children: paulyStatus.jobs.map((job) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 20, children: _jsx(Text, { children: job.name }) }), _jsx(Text, { dimColor: true, children: job.schedule })] }, job.name))) })), projects.data && projects.data.some((p) => p.devStatus?.status === "running") && (_jsx(BorderBox, { title: "Active Dev", children: projects.data
                    .filter((p) => p.devStatus?.status === "running")
                    .map((p) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 20, children: _jsx(Text, { bold: true, children: p.name }) }), _jsx(StatusBadge, { status: p.devStatus.status })] }, p.name))) }))] }));
}
