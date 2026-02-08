import React from "react";
import { Box, Text } from "ink";
import { useKeyboard, TAB_NAMES, type ScreenTab } from "../../context/KeyboardContext.js";

export function Header() {
  const { activeTab } = useKeyboard();

  return (
    <Box paddingX={1} gap={1}>
      <Text bold color="cyan">PAULY</Text>
      {([1, 2, 3, 4, 5, 6] as ScreenTab[]).map((tab) => (
        <Box key={`tab-${tab}`} gap={0}>
          <Text dimColor>[{tab}]</Text>
          <Text bold={activeTab === tab} color={activeTab === tab ? "cyan" : undefined} dimColor={activeTab !== tab}>
            {TAB_NAMES[tab]}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
