import React, { createContext, useContext, useCallback } from "react";
import { usePolling } from "../hooks/usePolling.js";
import { fetchHealth, fetchSessions, fetchPaulyStatus } from "../api/endpoints.js";
import type { ClaudeSessionsResponse, PaulyStatus } from "../api/types.js";

interface ApiState {
  serverOnline: boolean;
  sessions: ClaudeSessionsResponse | null;
  paulyStatus: PaulyStatus | null;
  refreshSessions: () => void;
  refreshStatus: () => void;
}

const ApiContext = createContext<ApiState | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const health = usePolling(
    useCallback(() => fetchHealth(), []),
    10000,
  );

  const sessions = usePolling(
    useCallback(() => fetchSessions(), []),
    5000,
  );

  const status = usePolling(
    useCallback(() => fetchPaulyStatus(), []),
    30000,
  );

  return (
    <ApiContext value={{
      serverOnline: health.data?.status === "ok" && !health.error,
      sessions: sessions.data,
      paulyStatus: status.data,
      refreshSessions: sessions.refresh,
      refreshStatus: status.refresh,
    }}>
      {children}
    </ApiContext>
  );
}

export function useApi(): ApiState {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used within ApiProvider");
  return ctx;
}
