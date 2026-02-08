import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { fetchQueueStats, fetchQueueJobs, fetchDeadLetterStats, fetchDeadLetterTasks, cancelJob, retryDeadLetter, resolveDeadLetter, } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
export function QueueScreen() {
    const { inputMode } = useKeyboard();
    const [tab, setTab] = useState("jobs");
    const [confirmAction, setConfirmAction] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const stats = usePolling(useCallback(() => fetchQueueStats(), []), 5000);
    const dlStats = usePolling(useCallback(() => fetchDeadLetterStats(), []), 10000);
    const jobs = usePolling(useCallback(() => fetchQueueJobs().then((r) => r.jobs), []), 5000, { enabled: tab === "jobs" });
    const dlTasks = usePolling(useCallback(() => fetchDeadLetterTasks().then((r) => r.tasks), []), 10000, { enabled: tab === "deadletter" });
    useInput((input, key) => {
        if (inputMode || confirmAction)
            return;
        if (key.tab || input === "l") {
            setTab((t) => (t === "jobs" ? "deadletter" : "jobs"));
        }
        else if (input === "c" && tab === "jobs") {
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
        }
        else if (input === "t" && tab === "deadletter") {
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
        }
        else if (input === "v" && tab === "deadletter") {
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
        }
        else if (input === "r") {
            stats.refresh();
            dlStats.refresh();
            if (tab === "jobs")
                jobs.refresh();
            else
                dlTasks.refresh();
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
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsxs(Box, { gap: 2, marginBottom: 1, children: [stats.data && (_jsx(BorderBox, { title: "Queue Stats", children: _jsxs(Box, { gap: 3, children: [_jsxs(Text, { children: ["Pending: ", _jsx(Text, { bold: true, color: "yellow", children: stats.data.pending })] }), _jsxs(Text, { children: ["Running: ", _jsx(Text, { bold: true, color: "green", children: stats.data.running })] }), _jsxs(Text, { children: ["Completed: ", _jsx(Text, { bold: true, children: stats.data.completed })] }), _jsxs(Text, { children: ["Failed: ", _jsx(Text, { bold: true, color: "red", children: stats.data.failed })] })] }) })), dlStats.data && (_jsx(BorderBox, { title: "Dead Letter", children: _jsxs(Box, { gap: 3, children: [_jsxs(Text, { children: ["Pending: ", _jsx(Text, { bold: true, color: "yellow", children: dlStats.data.pending })] }), _jsxs(Text, { children: ["Retrying: ", _jsx(Text, { bold: true, color: "cyan", children: dlStats.data.retrying })] }), _jsxs(Text, { children: ["Resolved: ", _jsx(Text, { bold: true, children: dlStats.data.resolved })] })] }) }))] }), _jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsx(Text, { bold: tab === "jobs", color: tab === "jobs" ? "cyan" : undefined, children: "Jobs" }), _jsx(Text, { dimColor: true, children: "|" }), _jsx(Text, { bold: tab === "deadletter", color: tab === "deadletter" ? "cyan" : undefined, children: "Dead Letter" }), _jsxs(Text, { dimColor: true, children: ["(Tab to switch", tab === "jobs" ? " | c:cancel job" : " | t:retry v:resolve", ")"] })] }), tab === "jobs" ? (_jsx(SelectableList, { items: jobs.data ?? [], onHighlight: (_item, index) => setHighlightedIndex(index), renderItem: (job, _i, selected) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 6, children: _jsxs(Text, { bold: selected, children: ["#", job.id] }) }), _jsx(Box, { width: 20, children: _jsx(Text, { children: job.taskType }) }), _jsx(Box, { width: 10, children: _jsx(StatusBadge, { status: job.status }) }), _jsx(Box, { width: 4, children: _jsxs(Text, { dimColor: true, children: ["P", job.priority] }) }), _jsx(Text, { dimColor: true, children: new Date(job.createdAt).toLocaleString() })] })) })) : (_jsx(SelectableList, { items: dlTasks.data ?? [], onHighlight: (_item, index) => setHighlightedIndex(index), renderItem: (task, _i, selected) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 6, children: _jsxs(Text, { bold: selected, children: ["#", task.id] }) }), _jsx(Box, { width: 20, children: _jsx(Text, { children: task.taskType }) }), _jsx(Box, { width: 12, children: _jsx(StatusBadge, { status: task.status }) }), _jsx(Box, { width: 30, children: _jsx(Text, { color: "red", wrap: "truncate", children: task.errorMessage }) })] })) }))] }));
}
