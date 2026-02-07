import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Square, Trash2 } from "lucide-react";
import { streamClaudePrompt } from "@/lib/api";

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
}

export function ClaudeTerminal() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setCurrentResponse("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setCurrentResponse("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await streamClaudePrompt(prompt);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) {
          reader.cancel();
          break;
        }

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split("\n\n");
        // Keep last potentially incomplete event
        sseBuffer = events.pop() || "";

        for (const event of events) {
          const dataLine = event.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(dataLine.slice(6));
            if (parsed.type === "content") {
              accumulated += parsed.text;
              setCurrentResponse(accumulated);
            } else if (parsed.type === "error") {
              accumulated += parsed.text;
              setCurrentResponse(accumulated);
            } else if (parsed.type === "done") {
              // handled below
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (accumulated) {
        setMessages((prev) => [...prev, { role: "assistant", text: accumulated }]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errText = err instanceof Error ? err.message : "Request failed";
        setMessages((prev) => [...prev, { role: "error", text: errText }]);
      }
    } finally {
      setCurrentResponse("");
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const hasContent = messages.length > 0 || currentResponse;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Claude</CardTitle>
        {hasContent && (
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={streaming}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Output area */}
        {hasContent && (
          <div
            ref={outputRef}
            className="font-mono text-sm bg-muted rounded-md p-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words"
          >
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "mb-2" : "mb-3"}>
                {msg.role === "user" ? (
                  <span className="text-muted-foreground">
                    <span className="text-primary font-semibold">&gt; </span>
                    {msg.text}
                  </span>
                ) : msg.role === "error" ? (
                  <span className="text-destructive">{msg.text}</span>
                ) : (
                  <span>{msg.text}</span>
                )}
              </div>
            ))}
            {currentResponse && (
              <div>
                <span>{currentResponse}</span>
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask Claude..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            className="flex-1"
          />
          {streaming ? (
            <Button type="button" variant="destructive" size="sm" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} size="sm">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
