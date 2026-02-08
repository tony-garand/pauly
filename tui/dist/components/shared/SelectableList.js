import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useKeyboard } from "../../context/KeyboardContext.js";
export function SelectableList({ items, renderItem, onSelect, onHighlight, maxVisible = 15, active = true, }) {
    const { inputMode } = useKeyboard();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [viewportStart, setViewportStart] = useState(0);
    useEffect(() => {
        if (selectedIndex >= items.length) {
            setSelectedIndex(Math.max(0, items.length - 1));
        }
    }, [items.length, selectedIndex]);
    useEffect(() => {
        if (items[selectedIndex]) {
            onHighlight?.(items[selectedIndex], selectedIndex);
        }
    }, [selectedIndex, items, onHighlight]);
    useInput((input, key) => {
        if (inputMode || !active || items.length === 0)
            return;
        let newIndex = selectedIndex;
        if (input === "j" || key.downArrow) {
            newIndex = Math.min(selectedIndex + 1, items.length - 1);
        }
        else if (input === "k" || key.upArrow) {
            newIndex = Math.max(selectedIndex - 1, 0);
        }
        else if (input === "g") {
            newIndex = 0;
        }
        else if (input === "G") {
            newIndex = items.length - 1;
        }
        else if (key.return && onSelect) {
            onSelect(items[selectedIndex], selectedIndex);
            return;
        }
        if (newIndex !== selectedIndex) {
            setSelectedIndex(newIndex);
            // Adjust viewport
            if (newIndex < viewportStart) {
                setViewportStart(newIndex);
            }
            else if (newIndex >= viewportStart + maxVisible) {
                setViewportStart(newIndex - maxVisible + 1);
            }
        }
    }, { isActive: active });
    if (items.length === 0) {
        return (_jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, children: "No items" }) }));
    }
    const visible = items.slice(viewportStart, viewportStart + maxVisible);
    return (_jsxs(Box, { flexDirection: "column", children: [visible.map((item, i) => {
                const realIndex = viewportStart + i;
                const isSelected = realIndex === selectedIndex;
                return (_jsxs(Box, { children: [_jsxs(Text, { color: isSelected ? "cyan" : undefined, children: [isSelected ? ">" : " ", " "] }), renderItem(item, realIndex, isSelected)] }, realIndex));
            }), items.length > maxVisible && (_jsxs(Text, { dimColor: true, children: [" ", "  [", selectedIndex + 1, "/", items.length, "]"] }))] }));
}
