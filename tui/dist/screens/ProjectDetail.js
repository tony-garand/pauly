import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { fetchProjectDetail, fetchDevStatus, startDev, stopDev, restartDev, addTask, toggleTask, deleteTask, } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { BorderBox } from "../components/shared/BorderBox.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
export function ProjectDetail({ projectName, onBack }) {
    const { inputMode, setInputMode } = useKeyboard();
    const [addingTask, setAddingTask] = useState(false);
    const [taskText, setTaskText] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [highlightedTask, setHighlightedTask] = useState(0);
    const project = usePolling(useCallback(() => fetchProjectDetail(projectName), [projectName]), 5000);
    const devStatus = usePolling(useCallback(() => fetchDevStatus(projectName), [projectName]), 3000);
    const tasks = project.data?.tasks ?? [];
    const handleAction = useCallback(async (action, successMsg) => {
        try {
            await action();
            showToast(successMsg, "success");
            project.refresh();
        }
        catch (err) {
            showToast(String(err), "error");
        }
    }, [project]);
    useInput((input, key) => {
        if (inputMode)
            return;
        if (key.escape || (input === "q" && !addingTask)) {
            onBack();
            return;
        }
        if (input === "s") {
            handleAction(() => startDev(projectName), "Dev started");
        }
        else if (input === "S") {
            handleAction(() => stopDev(projectName), "Dev stopped");
        }
        else if (input === "R") {
            handleAction(() => restartDev(projectName), "Dev restarted");
        }
        else if (input === "a") {
            setAddingTask(true);
            setInputMode(true);
        }
        else if (input === "t" && tasks.length > 0) {
            handleAction(() => toggleTask(projectName, highlightedTask), "Task toggled");
        }
        else if (input === "d" && tasks.length > 0) {
            setConfirmDelete(highlightedTask);
        }
        else if (input === "r") {
            project.refresh();
        }
    }, { isActive: !addingTask && confirmDelete === null });
    const handleTaskSubmit = useCallback(async (value) => {
        setAddingTask(false);
        setInputMode(false);
        setTaskText("");
        if (value.trim()) {
            await handleAction(() => addTask(projectName, value.trim()), "Task added");
        }
    }, [projectName, handleAction, setInputMode]);
    if (!project.data) {
        return (_jsx(Box, { paddingX: 1, children: _jsxs(Text, { dimColor: true, children: ["Loading ", projectName, "..."] }) }));
    }
    const p = project.data;
    const dev = devStatus.data;
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: p.name }), p.gitBranch && _jsxs(Text, { dimColor: true, children: ["(", p.gitBranch, ")"] }), dev && _jsx(StatusBadge, { status: dev.status })] }), _jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsxs(BorderBox, { title: "Info", flexGrow: 1, children: [_jsxs(Text, { children: ["Path: ", p.path] }), p.gitStatus && (_jsxs(Text, { dimColor: true, children: ["modified:", p.gitStatus.modified, " untracked:", p.gitStatus.untracked, " staged:", p.gitStatus.staged] })), p.githubUrl && _jsx(Text, { dimColor: true, children: p.githubUrl }), _jsx(Text, { dimColor: true, children: "Keys: s:start S:stop R:restart a:add t:toggle d:delete" })] }), dev && dev.status !== "idle" && (_jsxs(BorderBox, { title: "Dev Process", flexGrow: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { children: "Status:" }), _jsx(StatusBadge, { status: dev.status })] }), dev.iteration && (_jsxs(Text, { children: ["Iteration: ", dev.iteration.current, "/", dev.iteration.max] })), dev.startedAt && (_jsxs(Text, { dimColor: true, children: ["Started: ", new Date(dev.startedAt).toLocaleTimeString()] })), dev.error && (_jsxs(Text, { color: "red", children: ["Error: ", dev.error.phase, " \u2014 ", dev.error.message] }))] }))] }), _jsx(BorderBox, { title: `Tasks (${tasks.length})`, flexGrow: 1, children: addingTask ? (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "New task: " }), _jsx(TextInput, { placeholder: "Task description...", onSubmit: handleTaskSubmit })] })) : confirmDelete !== null ? (_jsx(Confirm, { message: `Delete task: "${tasks[confirmDelete]?.text}"?`, onConfirm: () => {
                        handleAction(() => deleteTask(projectName, confirmDelete), "Task deleted");
                        setConfirmDelete(null);
                    }, onCancel: () => setConfirmDelete(null) })) : (_jsx(SelectableList, { items: tasks, onHighlight: (_item, index) => setHighlightedTask(index), renderItem: (task, _i, selected) => (_jsxs(Text, { bold: selected, strikethrough: task.completed, dimColor: task.completed, children: [task.completed ? "[x]" : "[ ]", " ", task.text] })) })) })] }));
}
