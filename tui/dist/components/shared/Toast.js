import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Box, Text } from "ink";
let toastId = 0;
const listeners = new Set();
export function showToast(text, type = "info") {
    const msg = { id: ++toastId, text, type };
    listeners.forEach((fn) => fn(msg));
}
const COLORS = {
    info: "blue",
    success: "green",
    error: "red",
};
export function ToastContainer() {
    const [messages, setMessages] = useState([]);
    useEffect(() => {
        const handler = (msg) => {
            setMessages((prev) => [...prev.slice(-2), msg]);
            setTimeout(() => {
                setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            }, 3000);
        };
        listeners.add(handler);
        return () => { listeners.delete(handler); };
    }, []);
    if (messages.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "column", position: "absolute", marginTop: 1, marginRight: 2, children: messages.map((msg) => (_jsx(Text, { color: COLORS[msg.type], children: msg.text }, msg.id))) }));
}
