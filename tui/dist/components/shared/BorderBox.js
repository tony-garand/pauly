import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
export function BorderBox({ title, children, width, flexGrow }) {
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, width: width, flexGrow: flexGrow, children: [title && (_jsx(Text, { bold: true, color: "cyan", children: title })), children] }));
}
