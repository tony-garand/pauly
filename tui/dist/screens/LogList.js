import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { Box, Text } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { fetchLogs } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
export function LogList({ onSelect }) {
    const { data, loading } = usePolling(useCallback(() => fetchLogs().then((r) => r.logs), []), 10000);
    if (loading && !data) {
        return (_jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, children: "Loading logs..." }) }));
    }
    const logs = data ?? [];
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { bold: true, children: ["Log Files (", logs.length, ")"] }) }), _jsx(SelectableList, { items: logs, onSelect: onSelect, renderItem: (log, _i, selected) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 30, children: _jsx(Text, { bold: selected, children: log.name }) }), _jsx(Box, { width: 10, children: _jsx(Text, { dimColor: true, children: formatSize(log.size) }) }), _jsx(Text, { dimColor: true, children: new Date(log.lastModified).toLocaleString() })] })) })] }));
}
