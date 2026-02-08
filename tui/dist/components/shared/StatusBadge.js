import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from "ink";
const STATUS_COLORS = {
    running: "green",
    success: "green",
    completed: "green",
    ok: "green",
    idle: "yellow",
    pending: "yellow",
    retrying: "yellow",
    error: "red",
    failed: "red",
    abandoned: "red",
    resolved: "blue",
    unknown: "gray",
};
export function StatusBadge({ status, label }) {
    const color = STATUS_COLORS[status] ?? "gray";
    const display = label ?? status;
    return (_jsx(Text, { color: color, bold: true, children: display.toUpperCase() }));
}
