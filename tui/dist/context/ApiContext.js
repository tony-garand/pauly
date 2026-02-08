import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useCallback } from "react";
import { usePolling } from "../hooks/usePolling.js";
import { fetchHealth, fetchSessions, fetchPaulyStatus } from "../api/endpoints.js";
const ApiContext = createContext(null);
export function ApiProvider({ children }) {
    const health = usePolling(useCallback(() => fetchHealth(), []), 10000);
    const sessions = usePolling(useCallback(() => fetchSessions(), []), 5000);
    const status = usePolling(useCallback(() => fetchPaulyStatus(), []), 30000);
    return (_jsx(ApiContext, { value: {
            serverOnline: health.data?.status === "ok" && !health.error,
            sessions: sessions.data,
            paulyStatus: status.data,
            refreshSessions: sessions.refresh,
            refreshStatus: status.refresh,
        }, children: children }));
}
export function useApi() {
    const ctx = useContext(ApiContext);
    if (!ctx)
        throw new Error("useApi must be used within ApiProvider");
    return ctx;
}
