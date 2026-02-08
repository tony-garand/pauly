import React from "react";
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

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      borderStyle="double"
      borderColor="cyan"
    >
      <Text bold color="cyan">
        Keyboard Shortcuts
      </Text>
      <Text> </Text>
      {HELP_SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold underline>
            {section.title}
          </Text>
          {section.keys.map(([key, desc]) => (
            <Box key={key} gap={1}>
              <Box width={20}>
                <Text color="yellow">{key}</Text>
              </Box>
              <Text>{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Text dimColor>Press ? or Esc to close</Text>
    </Box>
  );
}
