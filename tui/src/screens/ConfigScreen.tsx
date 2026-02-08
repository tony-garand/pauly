import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { usePolling } from "../hooks/usePolling.js";
import { useKeyboard } from "../context/KeyboardContext.js";
import { fetchConfig, updateConfig, deleteConfig } from "../api/endpoints.js";
import { SelectableList } from "../components/shared/SelectableList.js";
import { Confirm } from "../components/shared/Confirm.js";
import { showToast } from "../components/shared/Toast.js";

interface ConfigEntry {
  key: string;
  value: string;
}

type EditState =
  | { type: "none" }
  | { type: "editing"; key: string; originalValue: string }
  | { type: "adding-key" }
  | { type: "adding-value"; key: string }
  | { type: "confirm-delete"; key: string };

export function ConfigScreen() {
  const { setInputMode } = useKeyboard();
  const [editState, setEditState] = useState<EditState>({ type: "none" });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const config = usePolling(
    useCallback(() => fetchConfig().then((r) => r.config), []),
    15000,
  );

  const entries: ConfigEntry[] = Object.entries(config.data ?? {}).map(
    ([key, value]) => ({ key, value }),
  );

  useInput(
    (input, key) => {
      if (editState.type !== "none") return;

      if (input === "e" && entries.length > 0) {
        const entry = entries[highlightedIndex];
        if (entry) {
          setEditState({ type: "editing", key: entry.key, originalValue: entry.value });
          setInputMode(true);
        }
      } else if (input === "a") {
        setEditState({ type: "adding-key" });
        setInputMode(true);
      } else if (input === "d" && entries.length > 0) {
        const entry = entries[highlightedIndex];
        if (entry) {
          setEditState({ type: "confirm-delete", key: entry.key });
        }
      } else if (input === "r") {
        config.refresh();
      }
    },
    { isActive: editState.type === "none" },
  );

  const finishEdit = () => {
    setEditState({ type: "none" });
    setInputMode(false);
  };

  if (editState.type === "editing") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Edit: {editState.key}</Text>
        <TextInput
          defaultValue={editState.originalValue}
          onSubmit={async (value) => {
            try {
              await updateConfig(editState.key, value);
              showToast("Config updated", "success");
              config.refresh();
            } catch (err) {
              showToast(String(err), "error");
            }
            finishEdit();
          }}
        />
        <Text dimColor>Enter to save, Ctrl+C to cancel</Text>
      </Box>
    );
  }

  if (editState.type === "adding-key") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>New config key:</Text>
        <TextInput
          placeholder="key name"
          onSubmit={(key) => {
            if (key.trim()) {
              setEditState({ type: "adding-value", key: key.trim() });
            } else {
              finishEdit();
            }
          }}
        />
      </Box>
    );
  }

  if (editState.type === "adding-value") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Value for "{editState.key}":</Text>
        <TextInput
          placeholder="value"
          onSubmit={async (value) => {
            try {
              await updateConfig(editState.key, value);
              showToast("Config added", "success");
              config.refresh();
            } catch (err) {
              showToast(String(err), "error");
            }
            finishEdit();
          }}
        />
      </Box>
    );
  }

  if (editState.type === "confirm-delete") {
    return (
      <Confirm
        message={`Delete config key "${editState.key}"?`}
        onConfirm={async () => {
          try {
            await deleteConfig(editState.key);
            showToast("Config deleted", "success");
            config.refresh();
          } catch (err) {
            showToast(String(err), "error");
          }
          setEditState({ type: "none" });
        }}
        onCancel={() => setEditState({ type: "none" })}
      />
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={2} marginBottom={1}>
        <Text bold>Config ({entries.length})</Text>
        <Text dimColor>e:edit  a:add  d:delete  r:refresh</Text>
      </Box>
      <SelectableList
        items={entries}
        onHighlight={(_item, index) => setHighlightedIndex(index)}
        renderItem={(entry, _i, selected) => (
          <Box gap={2}>
            <Box width={30}>
              <Text bold={selected} color={selected ? "cyan" : "yellow"}>
                {entry.key}
              </Text>
            </Box>
            <Text>{entry.value}</Text>
          </Box>
        )}
      />
    </Box>
  );
}
