import React from "react";
import { Text } from "ink";

const STATUS_COLORS: Record<string, string> = {
  running: "green",
  success: "green",
  completed: "green",
  ok: "green",
  idle: "yellow",
  pending: "yellow",
  retrying: "yellow",
  error: "red",
  failed: "red",
  abandoned: "red",
  resolved: "blue",
  unknown: "gray",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? "gray";
  const display = label ?? status;
  return (
    <Text color={color} bold>
      {display.toUpperCase()}
    </Text>
  );
}
