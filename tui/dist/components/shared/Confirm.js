import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from "ink";
export function Confirm({ message, onConfirm, onCancel }) {
    useInput((input) => {
        if (input === "y" || input === "Y")
            onConfirm();
        else if (input === "n" || input === "N" || input === "q")
            onCancel();
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: message }), _jsx(Text, { dimColor: true, children: " (y/n)" })] }));
}
