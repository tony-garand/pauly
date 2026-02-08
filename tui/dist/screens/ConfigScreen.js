import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { fetchConfig, updateConfig, deleteConfig } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";
export function ConfigScreen() {
    const { setInputMode } = useKeyboard();
    const [editState, setEditState] = useState({ type: "none" });
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const config = usePolling(useCallback(() => fetchConfig().then((r) => r.config), []), 15000);
    const entries = Object.entries(config.data ?? {}).map(([key, value]) => ({ key, value }));
    useInput((input, key) => {
        if (editState.type !== "none")
            return;
        if (input === "e" && entries.length > 0) {
            const entry = entries[highlightedIndex];
            if (entry) {
                setEditState({ type: "editing", key: entry.key, originalValue: entry.value });
                setInputMode(true);
            }
        }
        else if (input === "a") {
            setEditState({ type: "adding-key" });
            setInputMode(true);
        }
        else if (input === "d" && entries.length > 0) {
            const entry = entries[highlightedIndex];
            if (entry) {
                setEditState({ type: "confirm-delete", key: entry.key });
            }
        }
        else if (input === "r") {
            config.refresh();
        }
    }, { isActive: editState.type === "none" });
    const finishEdit = () => {
        setEditState({ type: "none" });
        setInputMode(false);
    };
    if (editState.type === "editing") {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Text, { bold: true, children: ["Edit: ", editState.key] }), _jsx(TextInput, { defaultValue: editState.originalValue, onSubmit: async (value) => {
                        try {
                            await updateConfig(editState.key, value);
                            showToast("Config updated", "success");
                            config.refresh();
                        }
                        catch (err) {
                            showToast(String(err), "error");
                        }
                        finishEdit();
                    } }), _jsx(Text, { dimColor: true, children: "Enter to save, Ctrl+C to cancel" })] }));
    }
    if (editState.type === "adding-key") {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsx(Text, { bold: true, children: "New config key:" }), _jsx(TextInput, { placeholder: "key name", onSubmit: (key) => {
                        if (key.trim()) {
                            setEditState({ type: "adding-value", key: key.trim() });
                        }
                        else {
                            finishEdit();
                        }
                    } })] }));
    }
    if (editState.type === "adding-value") {
        return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Text, { bold: true, children: ["Value for \"", editState.key, "\":"] }), _jsx(TextInput, { placeholder: "value", onSubmit: async (value) => {
                        try {
                            await updateConfig(editState.key, value);
                            showToast("Config added", "success");
                            config.refresh();
                        }
                        catch (err) {
                            showToast(String(err), "error");
                        }
                        finishEdit();
                    } })] }));
    }
    if (editState.type === "confirm-delete") {
        return (_jsx(Confirm, { message: `Delete config key "${editState.key}"?`, onConfirm: async () => {
                try {
                    await deleteConfig(editState.key);
                    showToast("Config deleted", "success");
                    config.refresh();
                }
                catch (err) {
                    showToast(String(err), "error");
                }
                setEditState({ type: "none" });
            }, onCancel: () => setEditState({ type: "none" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, flexGrow: 1, children: [_jsxs(Box, { gap: 2, marginBottom: 1, children: [_jsxs(Text, { bold: true, children: ["Config (", entries.length, ")"] }), _jsx(Text, { dimColor: true, children: "e:edit  a:add  d:delete  r:refresh" })] }), _jsx(SelectableList, { items: entries, onHighlight: (_item, index) => setHighlightedIndex(index), renderItem: (entry, _i, selected) => (_jsxs(Box, { gap: 2, children: [_jsx(Box, { width: 30, children: _jsx(Text, { bold: selected, color: selected ? "cyan" : "yellow", children: entry.key }) }), _jsx(Text, { children: entry.value })] })) })] }));
}
