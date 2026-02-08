import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { Box, Text } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { fetchProjects } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { ProgressBar } from "../components/shared/ProgressBar.js";
export function ProjectList({ onSelect }) {
    const { data, loading } = usePolling(useCallback(() => fetchProjects().then((r) => r.projects), []), 5000);
    if (loading && !data) {
        return (_jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, children: "Loading projects..." }) }));
    }
    const projects = data ?? [];
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { bold: true, children: ["Projects (", projects.length, ")"] }) }), _jsx(SelectableList, { items: projects, onSelect: onSelect, renderItem: (p, _i, selected) => (_jsxs(Box, { gap: 2, width: "100%", children: [_jsx(Box, { width: 22, children: _jsx(Text, { bold: selected, children: p.name }) }), _jsx(Box, { width: 10, children: p.devStatus ? (_jsx(StatusBadge, { status: p.devStatus.status })) : (_jsx(Text, { dimColor: true, children: "\u2014" })) }), _jsx(Box, { width: 30, children: p.tasksCompletion ? (_jsx(ProgressBar, { percentage: p.tasksCompletion.percentage, width: 15 })) : (_jsx(Text, { dimColor: true, children: "no tasks" })) }), p.hasGit && _jsx(Text, { dimColor: true, children: "git" })] })) })] }));
}
