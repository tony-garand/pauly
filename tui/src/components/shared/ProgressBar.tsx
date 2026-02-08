import React from "react";
import { Text } from "ink";

interface ProgressBarProps {
  percentage: number;
  width?: number;
}

export function ProgressBar({ percentage, width = 20 }: ProgressBarProps) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const color = percentage === 100 ? "green" : percentage > 50 ? "yellow" : "cyan";

  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      <Text dimColor> {percentage}%</Text>
    </Text>
  );
}
