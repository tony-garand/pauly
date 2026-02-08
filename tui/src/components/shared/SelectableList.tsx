import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useKeyboard } from "../../context/KeyboardContext.js";

interface SelectableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  onSelect?: (item: T, index: number) => void;
  onHighlight?: (item: T, index: number) => void;
  maxVisible?: number;
  active?: boolean;
}

export function SelectableList<T>({
  items,
  renderItem,
  onSelect,
  onHighlight,
  maxVisible = 15,
  active = true,
}: SelectableListProps<T>) {
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

  useInput(
    (input, key) => {
      if (inputMode || !active || items.length === 0) return;

      let newIndex = selectedIndex;

      if (input === "j" || key.downArrow) {
        newIndex = Math.min(selectedIndex + 1, items.length - 1);
      } else if (input === "k" || key.upArrow) {
        newIndex = Math.max(selectedIndex - 1, 0);
      } else if (input === "g") {
        newIndex = 0;
      } else if (input === "G") {
        newIndex = items.length - 1;
      } else if (key.return && onSelect) {
        onSelect(items[selectedIndex]!, selectedIndex);
        return;
      }

      if (newIndex !== selectedIndex) {
        setSelectedIndex(newIndex);
        // Adjust viewport
        if (newIndex < viewportStart) {
          setViewportStart(newIndex);
        } else if (newIndex >= viewportStart + maxVisible) {
          setViewportStart(newIndex - maxVisible + 1);
        }
      }
    },
    { isActive: active },
  );

  if (items.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No items</Text>
      </Box>
    );
  }

  const visible = items.slice(viewportStart, viewportStart + maxVisible);

  return (
    <Box flexDirection="column">
      {visible.map((item, i) => {
        const realIndex = viewportStart + i;
        const isSelected = realIndex === selectedIndex;
        return (
          <Box key={realIndex}>
            <Text color={isSelected ? "cyan" : undefined}>
              {isSelected ? ">" : " "}{" "}
            </Text>
            {renderItem(item, realIndex, isSelected)}
          </Box>
        );
      })}
      {items.length > maxVisible && (
        <Text dimColor>
          {" "}  [{selectedIndex + 1}/{items.length}]
        </Text>
      )}
    </Box>
  );
}
