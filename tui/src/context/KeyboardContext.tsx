import React, { createContext, useContext, useState } from "react";

export type ScreenTab = 1 | 2 | 3 | 4 | 5 | 6;

export const TAB_NAMES: Record<ScreenTab, string> = {
  1: "Dashboard",
  2: "Projects",
  3: "Logs",
  4: "Queue",
  5: "Config",
  6: "Sessions",
};

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

const KeyboardContext = createContext<KeyboardState | null>(null);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<ScreenTab>(1);
  const [inputMode, setInputMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [commandMode, setCommandMode] = useState(false);

  return (
    <KeyboardContext value={{
      activeTab,
      setActiveTab,
      inputMode,
      setInputMode,
      showHelp,
      setShowHelp,
      commandMode,
      setCommandMode,
    }}>
      {children}
    </KeyboardContext>
  );
}

export function useKeyboard(): KeyboardState {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}
