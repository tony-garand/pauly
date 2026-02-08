import React from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ message, onConfirm, onCancel }: ConfirmProps) {
  useInput((input) => {
    if (input === "y" || input === "Y") onConfirm();
    else if (input === "n" || input === "N" || input === "q") onCancel();
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="yellow">
        {message}
      </Text>
      <Text dimColor> (y/n)</Text>
    </Box>
  );
}
