import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from "react";
export const TAB_NAMES = {
    1: "Dashboard",
    2: "Projects",
    3: "Logs",
    4: "Queue",
    5: "Config",
    6: "Sessions",
};
const KeyboardContext = createContext(null);
export function KeyboardProvider({ children }) {
    const [activeTab, setActiveTab] = useState(1);
    const [inputMode, setInputMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [commandMode, setCommandMode] = useState(false);
    return (_jsx(KeyboardContext, { value: {
            activeTab,
            setActiveTab,
            inputMode,
            setInputMode,
            showHelp,
            setShowHelp,
            commandMode,
            setCommandMode,
        }, children: children }));
}
export function useKeyboard() {
    const ctx = useContext(KeyboardContext);
    if (!ctx)
        throw new Error("useKeyboard must be used within KeyboardProvider");
    return ctx;
}
