import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { useKeyboard, TAB_NAMES } from "../../context/KeyboardContext.js";
export function Header() {
    const { activeTab } = useKeyboard();
    return (_jsxs(Box, { paddingX: 1, gap: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "PAULY" }), [1, 2, 3, 4, 5, 6].map((tab) => (_jsxs(Box, { gap: 0, children: [_jsxs(Text, { dimColor: true, children: ["[", tab, "]"] }), _jsx(Text, { bold: activeTab === tab, color: activeTab === tab ? "cyan" : undefined, dimColor: activeTab !== tab, children: TAB_NAMES[tab] })] }, `tab-${tab}`)))] }));
}
