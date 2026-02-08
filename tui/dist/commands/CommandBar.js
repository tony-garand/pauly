import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { useKeyboard } from "../context/KeyboardContext.js";
import { executeCommand } from "./executor.js";
export function CommandBar({ onNavigate, onExit }) {
    const { commandMode, setCommandMode, setInputMode } = useKeyboard();
    const [history, setHistory] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [cmdHistory, setCmdHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef("");
    // Calculate visible area
    const termHeight = process.stdout.rows - 4; // header + footer + input + border
    const maxOutputLines = Math.max(5, termHeight - 2);
    const closeCommandBar = useCallback(() => {
        setCommandMode(false);
        setInputMode(false);
    }, [setCommandMode, setInputMode]);
    // Handle Esc to close when not running
    useInput((input, key) => {
        if (!commandMode)
            return;
        if (key.escape && !isRunning) {
            closeCommandBar();
            return;
        }
        // Scroll output with Ctrl+j/k when not in text input
        if (isRunning) {
            if (input === "j" || key.downArrow) {
                setScrollOffset((s) => s + 1);
            }
            else if (input === "k" || key.upArrow) {
                setScrollOffset((s) => Math.max(0, s - 1));
            }
        }
    }, { isActive: commandMode });
    const handleSubmit = useCallback(async (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
            closeCommandBar();
            return;
        }
        // Save to command history
        setCmdHistory((prev) => {
            const filtered = prev.filter((h) => h !== trimmed);
            return [trimmed, ...filtered].slice(0, 50);
        });
        setHistoryIndex(-1);
        // Add entry
        const entryIndex = history.length;
        setHistory((prev) => [
            ...prev,
            { input: trimmed, output: "", streaming: true },
        ]);
        setIsRunning(true);
        setScrollOffset(0);
        outputRef.current = "";
        const onStream = (chunk) => {
            outputRef.current += chunk;
            setHistory((prev) => {
                const updated = [...prev];
                const entry = updated[entryIndex];
                if (entry) {
                    updated[entryIndex] = { ...entry, output: outputRef.current };
                }
                return updated;
            });
        };
        try {
            const result = await executeCommand(trimmed, onStream);
            // Handle special cases
            if (result.output === "__EXIT__") {
                onExit();
                return;
            }
            if (result.navigate) {
                onNavigate(result.navigate);
                closeCommandBar();
                return;
            }
            // Update final output
            setHistory((prev) => {
                const updated = [...prev];
                const entry = updated[entryIndex];
                if (entry) {
                    updated[entryIndex] = {
                        ...entry,
                        output: result.output,
                        error: result.error,
                        streaming: false,
                    };
                }
                return updated;
            });
        }
        catch (err) {
            setHistory((prev) => {
                const updated = [...prev];
                const entry = updated[entryIndex];
                if (entry) {
                    updated[entryIndex] = {
                        ...entry,
                        output: err instanceof Error ? err.message : String(err),
                        error: true,
                        streaming: false,
                    };
                }
                return updated;
            });
        }
        finally {
            setIsRunning(false);
        }
    }, [history.length, closeCommandBar, onNavigate, onExit]);
    if (!commandMode)
        return null;
    // Render output history
    const allLines = [];
    for (const entry of history) {
        allLines.push({ text: `> ${entry.input}`, color: "cyan" });
        if (entry.output) {
            const outputLines = entry.output.split("\n");
            for (const line of outputLines) {
                allLines.push({
                    text: line,
                    color: entry.error ? "red" : undefined,
                });
            }
        }
        if (entry.streaming) {
            allLines.push({ text: "...", color: "yellow" });
        }
        allLines.push({ text: "" }); // spacer
    }
    // Apply scrolling - show the tail by default
    const totalLines = allLines.length;
    const effectiveOffset = scrollOffset > 0
        ? Math.max(0, totalLines - maxOutputLines - scrollOffset)
        : Math.max(0, totalLines - maxOutputLines);
    const visibleLines = allLines.slice(effectiveOffset, effectiveOffset + maxOutputLines);
    return (_jsxs(Box, { flexDirection: "column", flexGrow: 1, children: [visibleLines.length > 0 && (_jsx(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1, children: visibleLines.map((line, i) => (_jsx(Text, { color: line.color, wrap: "truncate", children: line.text }, `${effectiveOffset + i}`))) })), _jsxs(Box, { paddingX: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: ": " }), isRunning ? (_jsx(Text, { dimColor: true, children: "(streaming... Esc when done)" })) : (_jsx(TextInput, { placeholder: "Type a command or ask Claude...", onSubmit: handleSubmit }))] })] }));
}
