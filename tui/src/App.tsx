import React, { useState } from "react";
import { Box, useApp, useInput } from "ink";
import { KeyboardProvider, useKeyboard, type ScreenTab } from "./context/KeyboardContext.js";
import { ApiProvider } from "./context/ApiContext.js";
import { Header } from "./components/layout/Header.js";
import { Footer } from "./components/layout/Footer.js";
import { HelpOverlay } from "./components/shared/HelpOverlay.js";
import { ToastContainer } from "./components/shared/Toast.js";
import { Confirm } from "./components/shared/Confirm.js";
import { CommandBar } from "./commands/CommandBar.js";
import { DashboardScreen } from "./screens/DashboardScreen.js";
import { ProjectsScreen } from "./screens/ProjectsScreen.js";
import { LogsScreen } from "./screens/LogsScreen.js";
import { QueueScreen } from "./screens/QueueScreen.js";
import { ConfigScreen } from "./screens/ConfigScreen.js";
import { SessionsScreen } from "./screens/SessionsScreen.js";
import { killAllProcesses } from "./api/endpoints.js";
import { showToast } from "./components/shared/Toast.js";

function ScreenRouter() {
  const { activeTab } = useKeyboard();

  switch (activeTab) {
    case 1:
      return <DashboardScreen />;
    case 2:
      return <ProjectsScreen />;
    case 3:
      return <LogsScreen />;
    case 4:
      return <QueueScreen />;
    case 5:
      return <ConfigScreen />;
    case 6:
      return <SessionsScreen />;
  }
}

function GlobalKeyHandler() {
  const { exit } = useApp();
  const {
    activeTab,
    setActiveTab,
    inputMode,
    showHelp,
    setShowHelp,
    commandMode,
    setCommandMode,
    setInputMode,
  } = useKeyboard();
  const [killConfirm, setKillConfirm] = useState(false);

  useInput(
    (input, key) => {
      if (inputMode || commandMode) return;

      // Help toggle
      if (input === "?") {
        setShowHelp(!showHelp);
        return;
      }

      if (showHelp) return;

      // Command bar
      if (input === ":") {
        setCommandMode(true);
        setInputMode(true);
        return;
      }

      // Tab switching via number keys
      const num = parseInt(input, 10);
      if (num >= 1 && num <= 6) {
        setActiveTab(num as ScreenTab);
        return;
      }

      // Tab/Shift+Tab
      if (key.tab) {
        if (key.shift) {
          setActiveTab(activeTab === 1 ? 6 : ((activeTab - 1) as ScreenTab));
        } else {
          setActiveTab(activeTab === 6 ? 1 : ((activeTab + 1) as ScreenTab));
        }
        return;
      }

      // Quit
      if (input === "q") {
        exit();
        return;
      }

      // Emergency killswitch
      if (input === "K") {
        setKillConfirm(true);
        return;
      }
    },
    { isActive: !killConfirm },
  );

  if (killConfirm) {
    return (
      <Confirm
        message="KILL ALL Claude processes? This cannot be undone."
        onConfirm={async () => {
          try {
            const result = await killAllProcesses();
            showToast(`Killed ${result.killed} processes`, "success");
          } catch (err) {
            showToast(String(err), "error");
          }
          setKillConfirm(false);
        }}
        onCancel={() => setKillConfirm(false)}
      />
    );
  }

  return null;
}

export function App() {
  return (
    <KeyboardProvider>
      <ApiProvider>
        <AppShell />
      </ApiProvider>
    </KeyboardProvider>
  );
}

function AppShell() {
  const { exit } = useApp();
  const { commandMode, setActiveTab } = useKeyboard();

  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor="gray"
        borderTop={true}
        borderBottom={true}
        borderLeft={false}
        borderRight={false}
      >
        {commandMode ? (
          <CommandBar
            onNavigate={(tab) => setActiveTab(tab)}
            onExit={() => exit()}
          />
        ) : (
          <AppContent />
        )}
      </Box>
      <Footer />
      <ToastContainer />
      <GlobalKeyHandler />
    </Box>
  );
}

function AppContent() {
  const { showHelp } = useKeyboard();

  if (showHelp) {
    return <HelpOverlay />;
  }

  return <ScreenRouter />;
}
