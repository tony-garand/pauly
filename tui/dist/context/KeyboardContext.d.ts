import React from "react";
export type ScreenTab = 1 | 2 | 3 | 4 | 5 | 6;
export declare const TAB_NAMES: Record<ScreenTab, string>;
interface KeyboardState {
    activeTab: ScreenTab;
    setActiveTab: (tab: ScreenTab) => void;
    inputMode: boolean;
    setInputMode: (mode: boolean) => void;
    showHelp: boolean;
    setShowHelp: (show: boolean) => void;
    commandMode: boolean;
    setCommandMode: (mode: boolean) => void;
}
export declare function KeyboardProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useKeyboard(): KeyboardState;
export {};
