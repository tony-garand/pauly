import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Text } from "ink";
export function ProgressBar({ percentage, width = 20 }) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const color = percentage === 100 ? "green" : percentage > 50 ? "yellow" : "cyan";
    return (_jsxs(Text, { children: [_jsx(Text, { color: color, children: "█".repeat(filled) }), _jsx(Text, { dimColor: true, children: "░".repeat(empty) }), _jsxs(Text, { dimColor: true, children: [" ", percentage, "%"] })] }));
}
