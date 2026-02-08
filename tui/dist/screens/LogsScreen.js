import { jsx as _jsx } from "react/jsx-runtime";
import { useNavigationStack } from "../hooks/useNavigationStack.js";
import { LogList } from "./LogList.js";
import { LogViewer } from "./LogViewer.js";
export function LogsScreen() {
    const nav = useNavigationStack({ type: "list" });
    if (nav.current.type === "viewer") {
        return _jsx(LogViewer, { logName: nav.current.name, onBack: nav.pop });
    }
    return (_jsx(LogList, { onSelect: (log) => nav.push({ type: "viewer", name: log.name }) }));
}
