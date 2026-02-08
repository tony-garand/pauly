import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useApi } from "../context/ApiContext.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { killSession, killAllProcesses } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
export function SessionsScreen() {
    const { inputMode } = useKeyboard();
    const { sessions, refreshSessions } = useApi();
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [confirmAction, setConfirmAction] = useState(null);
    // Flatten groups into a list
    const processes = (sessions?.groups ?? []).flatMap((group) => group.processes.map((p) => ({ ...p, project: group.project })));
    useInput((input) => {
        if (inputMode || confirmAction)
            return;
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
        }
        else if (input === "X") {
            setConfirmAction({
                message: `Kill ALL ${processes.length} Claude processes?`,
                action: async () => {
                    const result = await killAllProcesses();
                    showToast(`Killed ${result.killed} processes`, "success");
                    refreshSessions();
                },
            });
        }
        else if (input === "r") {
            refreshSessions();
        }
    }, { isActive: confirmAction === null });
    if (confirmAction) {
        return (_jsx(Confirm, { message: confirmAction.message, onConfirm: async () => {
                try {
                    await confirmAction.action();
                }
                catch (err) {
                    showToast(String(err), "error");
                }
                setConfirmAction(null);
            }, onCancel: () => setConfirmAction(null) }));
    }
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsxs(Text, { bold: true, children: ["Claude Sessions (", sessions?.totalProcesses ?? 0, ")"] }), _jsx(Text, { dimColor: true, children: "x:kill  X:kill all  r:refresh" })] }), sessions?.groups.map((group) => (_jsxs(Box, { gap: 2, marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyan", children: group.project }), _jsxs(Text, { dimColor: true, children: [group.processes.length, " proc | CPU: ", group.totalCpu.toFixed(1), "% | MEM: ", group.totalMem.toFixed(1), "%"] })] }, group.project))), (sessions?.groups.length ?? 0) > 0 && _jsx(Text, { children: " " }), _jsx(SelectableList, { items: processes, onHighlight: (_item, index) => setHighlightedIndex(index), renderItem: (proc, _i, selected) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 8, children: _jsx(Text, { bold: selected, children: proc.pid }) }), _jsx(Box, { width: 18, children: _jsx(Text, { children: proc.project }) }), _jsx(Box, { width: 10, children: _jsx(StatusBadge, { status: proc.mode === "unknown" ? "idle" : "running", label: proc.mode }) }), _jsx(Box, { width: 10, children: _jsxs(Text, { dimColor: true, children: ["CPU: ", proc.cpu.toFixed(1), "%"] }) }), _jsx(Box, { width: 10, children: _jsxs(Text, { dimColor: true, children: ["MEM: ", proc.mem.toFixed(1), "%"] }) }), _jsx(Text, { dimColor: true, children: proc.uptime })] })) })] }));
}
