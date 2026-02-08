import React from "react";
import { useNavigationStack } from "../hooks/useNavigationStack.js";
import { LogList } from "./LogList.js";
import { LogViewer } from "./LogViewer.js";
import type { LogInfo } from "../api/types.js";

type LogView = { type: "list" } | { type: "viewer"; name: string };

export function LogsScreen() {
  const nav = useNavigationStack<LogView>({ type: "list" });

  if (nav.current.type === "viewer") {
    return <LogViewer logName={nav.current.name} onBack={nav.pop} />;
  }

  return (
    <LogList
      onSelect={(log: LogInfo) => nav.push({ type: "viewer", name: log.name })}
    />
  );
}
