import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { useApi } from "../../context/ApiContext.js";
import { useKeyboard } from "../../context/KeyboardContext.js";
export function Footer() {
    const { serverOnline, sessions } = useApi();
    const { commandMode } = useKeyboard();
    const totalSessions = sessions?.totalProcesses ?? 0;
    const devRunning = sessions?.groups.reduce((n, g) => n + g.processes.filter((p) => p.mode !== "unknown").length, 0) ?? 0;
    return (_jsxs(Box, { paddingX: 1, justifyContent: "space-between", children: [_jsx(Text, { dimColor: true, children: commandMode
                    ? "Esc:close  Enter:run  Ctrl+C:cancel"
                    : "::command  q:quit  ?:help  1-6:switch  j/k:nav  r:refresh" }), _jsxs(Box, { gap: 2, children: [_jsxs(Text, { children: ["Server:", _jsx(Text, { color: serverOnline ? "green" : "red", children: serverOnline ? "OK" : "OFF" })] }), _jsxs(Text, { dimColor: true, children: ["Sessions:", totalSessions] }), _jsxs(Text, { dimColor: true, children: ["Dev:", devRunning] })] })] }));
}
