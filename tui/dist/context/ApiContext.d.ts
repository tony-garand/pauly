import React from "react";
import type { ClaudeSessionsResponse, PaulyStatus } from "../api/types.js";
interface ApiState {
    serverOnline: boolean;
    sessions: ClaudeSessionsResponse | null;
    paulyStatus: PaulyStatus | null;
    refreshSessions: () => void;
    refreshStatus: () => void;
}
export declare function ApiProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useApi(): ApiState;
export {};
