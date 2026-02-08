import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from "ink";
import { useKeyboard } from "../../context/KeyboardContext.js";
const HELP_SECTIONS = [
    {
        title: "Navigation",
        keys: [
            [":", "Open command bar"],
            ["1-6", "Switch screen"],
            ["Tab / Shift+Tab", "Next / prev screen"],
            ["q", "Quit (top) / back (detail)"],
            ["?", "Toggle help"],
            ["r", "Refresh current screen"],
        ],
    },
    {
        title: "Command Bar (: to open)",
        keys: [
            ["dev start <proj>", "Start dev process"],
            ["dev stop <proj>", "Stop dev process"],
            ["kill <pid>", "Kill Claude session"],
            ["kill all", "Kill all sessions"],
            ["task <proj> <text>", "Add task"],
            ["config set <k> <v>", "Set config"],
            ["go <screen>", "Navigate to screen"],
            ["status / ps / queue", "Show info"],
            ["<anything else>", "Ask Claude"],
        ],
    },
    {
        title: "Lists",
        keys: [
            ["j / k", "Move down / up"],
            ["Enter", "Select item"],
            ["Esc", "Go back"],
            ["g / G", "Jump to top / bottom"],
            ["/", "Filter"],
        ],
    },
    {
        title: "Projects",
        keys: [
            ["s", "Start dev"],
            ["S", "Stop dev"],
            ["R", "Restart dev"],
            ["a", "Add task"],
            ["t", "Toggle task"],
            ["d", "Delete task"],
            ["i", "Create issue"],
        ],
    },
    {
        title: "Sessions",
        keys: [
            ["x", "Kill selected"],
            ["X", "Kill all"],
        ],
    },
    {
        title: "Danger",
        keys: [["K", "Emergency killswitch (confirm)"]],
    },
];
export function HelpOverlay() {
    const { setShowHelp } = useKeyboard();
    useInput((input, key) => {
        if (input === "?" || key.escape) {
            setShowHelp(false);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, borderStyle: "double", borderColor: "cyan", children: [_jsx(Text, { bold: true, color: "cyan", children: "Keyboard Shortcuts" }), _jsx(Text, { children: " " }), HELP_SECTIONS.map((section) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, underline: true, children: section.title }), section.keys.map(([key, desc]) => (_jsxs(Box, { gap: 1, children: [_jsx(Box, { width: 20, children: _jsx(Text, { color: "yellow", children: key }) }), _jsx(Text, { children: desc })] }, key)))] }, section.title))), _jsx(Text, { dimColor: true, children: "Press ? or Esc to close" })] }));
}
