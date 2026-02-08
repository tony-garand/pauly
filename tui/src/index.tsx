#!/usr/bin/env node
import { render } from "ink";
import React from "react";
import { App } from "./App.js";

// Enter alternate screen buffer (preserves terminal content on exit)
process.stdout.write("\x1b[?1049h");

// Ensure we restore terminal on exit
function cleanup() {
  process.stdout.write("\x1b[?1049l");
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// Check terminal size
const { columns, rows } = process.stdout;
if (columns < 80 || rows < 24) {
  cleanup();
  console.error(`Terminal too small: ${columns}x${rows} (minimum 80x24)`);
  process.exit(1);
}

const instance = render(<App />, {
  exitOnCtrlC: true,
});

instance.waitUntilExit().then(cleanup).catch(() => cleanup());
