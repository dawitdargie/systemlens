"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { ProjectProfile, Audience, ChatMessage } from "@/types";

/**
 * Renders assistant text, wrapping fenced code blocks (``` ``` ```) in styled
 * <pre> boxes. Prose stays as plain text. Streaming-safe: renders an open
 * code block even before the closing ``` arrives.
 */
function renderCodeBlocks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/^```(\w*)\s*$/m);
  let key = 0;

  // parts alternates: [prose, lang, code, lang, code, ...]
  // If the text ends with an unclosed ``` (e.g. truncated midway through a
  // code block), the parts array will have an extra trailing prose segment
  // that actually contains the unclosed fence + the code that followed it.
  // We detect this: if the last matched token was a code fence opening (i %
  // 3 === 1) and there's a trailing prose part, render that prose as code.
  let lastMatchWasFence = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 3 === 0) {
      // Prose segment
      if (part) {
        // If the previous segment was a language label and there's no
        // corresponding code segment after us, this prose is actually an
        // unclosed code block — render it as <pre>.
        if (lastMatchWasFence) {
          nodes.push(
            <pre
              key={key++}
              className="my-2 p-3 rounded-lg overflow-x-auto text-xs leading-relaxed font-mono bg-surface-950/90 dark:bg-surface-950 border border-[var(--input-border)] text-surface-200 dark:text-surface-300"
            >
              {part}
            </pre>
          );
          lastMatchWasFence = false;
        } else {
          nodes.push(
            <span key={key++} className="whitespace-pre-wrap">
              {part}
            </span>
          );
        }
      }
    } else if (i % 3 === 1) {
      // Language label — if non-empty, it's an opening fence; next segment
      // is code. If empty, it's a closing fence; next segment is prose.
      lastMatchWasFence = part.length > 0;
    } else {
      // Code segment (properly closed fence)
      nodes.push(
        <pre
          key={key++}
          className="my-2 p-3 rounded-lg overflow-x-auto text-xs leading-relaxed font-mono bg-surface-950/90 dark:bg-surface-950 border border-[var(--input-border)] text-surface-200 dark:text-surface-300"
        >
          {part}
        </pre>
      );
      lastMatchWasFence = false;
    }
  }

  // If the text ends with a fence opening (```lang) with no closing, the
  // language label is the last element with no code following it — it was
  // already handled as unclosed via lastMatchWasFence above, but there's
  // one edge case: if the text ends immediately after a ``` with no lang
  // or trailing code, it's just an empty fence.
  return nodes;
}

interface ChatProps {
  projectProfile: ProjectProfile;
  audience: Audience;
}

function formatRetryTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const SUGGESTED_QUESTIONS = [
  "What does this project do?",
  "How is the code organized?",
  "What are the main components?",
  "How does data flow through the system?",
];

export default function Chat({ projectProfile, audience }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // ── Rate-limit countdown ──
  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const interval = setInterval(() => {
      setRetryAfterSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfterSeconds]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change (but not on initial mount,
  // which would pull the whole page down to the chat section)
  useEffect(() => {
    if (messages.length > 0 || statusText) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, statusText]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;

      const userMessage: ChatMessage = { role: "user", content: question };
      const currentHistory = [...messages];
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsStreaming(true);
      setStatusText("Analyzing question...");
      setError(null);
      setWasTruncated(false);
      setRetryAfterSeconds(0);

      // Add a placeholder assistant message that we'll update as chunks arrive
      const assistantIndex = newMessages.length;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectProfile,
            audience,
            history: currentHistory,
            question,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Unable to answer question.");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Unable to read response stream.");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let streamedContent = "";

        // Batch streaming updates to avoid a React re-render per chunk.
        // Flush accumulated chunks on every animation frame (max ~60fps).
        let flushTimer: ReturnType<typeof requestAnimationFrame> | null = null;
        let pendingContent = "";

        const flushPending = () => {
          if (!pendingContent) {
            flushTimer = null;
            return;
          }
          const content = pendingContent;
          pendingContent = "";
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIndex] = {
              role: "assistant",
              content,
            };
            return updated;
          });
          flushTimer = null;
        };

        const scheduleFlush = () => {
          if (flushTimer === null) {
            flushTimer = requestAnimationFrame(flushPending);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown> | null = null;
            try {
              event = JSON.parse(line);
            } catch {
              // Incomplete line, keep in buffer
              buffer = line;
              continue;
            }
            if (!event) continue;

            if (event.type === "status") {
              setStatusText(event.step as string);
            } else if (event.type === "chunk") {
              streamedContent += event.content as string;
              pendingContent = streamedContent;
              setStatusText(null);
              scheduleFlush();
            } else if (event.type === "truncated") {
              setWasTruncated(true);
            } else if (event.type === "error") {
              if (event.retryAfterSeconds) {
                setRetryAfterSeconds(event.retryAfterSeconds as number);
              }
              throw new Error(event.error as string);
            } else if (event.type === "done") {
              // Stream complete
            }
          }
        }

        // Flush any remaining pending content now that the stream is done.
        if (flushTimer !== null) {
          cancelAnimationFrame(flushTimer);
        }
        if (pendingContent) {
          flushPending();
        }

        // Process any leftover partial line that arrived without a trailing
        // newline so the final event/content is never dropped.
        if (buffer.trim()) {
          const line = buffer;
          buffer = "";
          try {
            const event = JSON.parse(line);
            if (event.type === "chunk") {
              streamedContent += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIndex] = {
                  role: "assistant",
                  content: streamedContent,
                };
                return updated;
              });
            } else if (event.type === "truncated") {
              setWasTruncated(true);
            }
          } catch {
            // Unparseable trailing data; ignore to avoid a crash
          }
        }

        // If no content was streamed, remove the empty placeholder
        setMessages((prev) => {
          if (prev[assistantIndex]?.content === "") {
            return prev.slice(0, assistantIndex);
          }
          return prev;
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Network error. Please try again."
        );
        // Remove the empty assistant placeholder on error
        setMessages((prev) => {
          if (prev[assistantIndex]?.content === "") {
            return prev.slice(0, assistantIndex);
          }
          return prev;
        });
      } finally {
        setIsStreaming(false);
        setStatusText(null);
        inputRef.current?.focus();
      }
    },
    [messages, isStreaming, projectProfile, audience]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleRetry = () => {
    if (retryAfterSeconds > 0) return; // still counting down
    setRetryAfterSeconds(0);

    // Find the last user message and re-send it
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      // Remove all messages after the last user message
      const lastUserIndex = messages.lastIndexOf(lastUserMessage);
      setMessages(messages.slice(0, lastUserIndex));
      sendMessage(lastUserMessage.content);
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--card-border)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-500" />
          <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
            Ask Questions
          </span>
        </div>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
          Ask anything about this project. Code questions will fetch relevant files.
        </p>
      </div>

      {/* Messages area */}
      <div className="px-5 py-4 max-h-[400px] overflow-y-auto space-y-4 min-h-[120px]">
        {/* Empty state with suggested questions */}
        {messages.length === 0 && !isStreaming && !error && (
          <div className="space-y-3">
            <p className="text-sm text-surface-400 dark:text-surface-500 text-center py-4">
              Start by asking a question:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestedQuestion(q)}
                  className="chat-chip px-3 py-1.5 rounded-lg text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-surface-500 dark:text-surface-400 hover:border-accent-500/50 hover:text-foreground transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-accent-500/10 border border-accent-500/20 text-foreground"
                  : "bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground"
              }`}
            >
              {message.role === "assistant" && message.content
                ? renderCodeBlocks(message.content)
                : message.content || (
                    <span className="text-surface-400 dark:text-surface-500 italic">
                      ...
                    </span>
                  )}
            </div>
          </div>
        ))}

        {/* Status indicator while streaming */}
        {isStreaming && statusText && (
          <div className="flex items-center gap-2 text-xs text-surface-400 dark:text-surface-500">
            <svg
              className="animate-spin h-3 w-3 text-accent-500 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{statusText}</span>
          </div>
        )}

        {/* Truncation notice */}
        {wasTruncated && !isStreaming && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Response was cut off because it reached the length limit. Consider
              asking a more specific or shorter question.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-foreground">{error}</p>
              <button
                onClick={handleRetry}
                disabled={retryAfterSeconds > 0}
                className={`text-xs font-medium transition-colors mt-1 ${
                  retryAfterSeconds > 0
                    ? "text-surface-400 dark:text-surface-600 cursor-not-allowed"
                    : "text-accent-500 hover:text-accent-400"
                }`}
              >
                {retryAfterSeconds > 0
                  ? `Retry in ${formatRetryTime(retryAfterSeconds)}`
                  : "Try again"}
              </button>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 py-4 border-t border-[var(--card-border)]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask a question..."
            rows={1}
            className="input-glow flex-1 px-4 py-2.5 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground placeholder:text-surface-400 dark:placeholder:text-surface-600 transition-all duration-300 resize-none disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="btn-gradient px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap transition-all duration-300 flex-shrink-0"
          >
            {isStreaming ? (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}