import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface ToastMessage {
  id: number;
  text: string;
  type: "info" | "success" | "error";
}

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function showToast(text: string, type: ToastMessage["type"] = "info") {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

const COLORS: Record<string, string> = {
  info: "blue",
  success: "green",
  error: "red",
};

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setMessages((prev) => [...prev.slice(-2), msg]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, 3000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (messages.length === 0) return null;

  return (
    <Box flexDirection="column" position="absolute" marginTop={1} marginRight={2}>
      {messages.map((msg) => (
        <Text key={msg.id} color={COLORS[msg.type]}>
          {msg.text}
        </Text>
      ))}
    </Box>
  );
}
