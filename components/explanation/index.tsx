"use client";

import { useEffect, useState } from "react";
import MermaidDiagram from "@/components/mermaid-diagram";

interface ExplanationViewProps {
  audience: string;
  content: string | null;
  diagram: string | null;
  loading: boolean;
  error: string | null;
  retryAfterSeconds?: number;
  onRetry?: () => void;
}

function formatRetryTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const AUDIENCE_COLORS: Record<string, string> = {
  CEO: "bg-purple-500",
  PM: "bg-blue-500",
  Developer: "bg-accent-500",
  QA: "bg-yellow-500",
  Customer: "bg-green-500",
};

const AUDIENCE_ACCENT: Record<string, string> = {
  CEO: "#a855f7",
  PM: "#3b82f6",
  Developer: "#00d4ff",
  QA: "#eab308",
  Customer: "#22c55e",
};

export default function ExplanationView({
  audience,
  content,
  diagram,
  loading,
  error,
  retryAfterSeconds,
  onRetry,
}: ExplanationViewProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (content && !loading) {
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [content, loading]);

  // Loading state — only show skeleton if no content yet (streaming hasn't started)
  if (loading && !content) {
    return (
      <div className="w-full glass-card rounded-2xl p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-surface-300 dark:bg-surface-700" />
          <div className="h-4 w-40 rounded bg-surface-200 dark:bg-surface-800" />
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded bg-surface-200 dark:bg-surface-800" />
          <div className="h-3 w-11/12 rounded bg-surface-200 dark:bg-surface-800" />
          <div className="h-3 w-3/4 rounded bg-surface-200 dark:bg-surface-800" />
          <div className="h-3 w-5/6 rounded bg-surface-200 dark:bg-surface-800" />
        </div>
        <div className="h-32 rounded-xl bg-surface-200 dark:bg-surface-800" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full glass-card rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-2">
              Failed to generate explanation
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mb-4">
              {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={typeof retryAfterSeconds === "number" && retryAfterSeconds > 0}
                className={`text-xs font-medium transition-colors ${
                  typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
                    ? "text-surface-400 dark:text-surface-600 cursor-not-allowed"
                    : "text-accent-500 hover:text-accent-400"
                }`}
              >
                {typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
                  ? `Retry in ${formatRetryTime(retryAfterSeconds)}`
                  : "Try again"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!content) {
    return (
      <div className="w-full glass-card rounded-2xl p-6">
        <p className="text-sm text-surface-400 dark:text-surface-500">
          No explanation available.
        </p>
      </div>
    );
  }

  // Success state
  const dotColor = AUDIENCE_COLORS[audience] || "bg-surface-400";
  const accentColor = AUDIENCE_ACCENT[audience] || "#7a85b0";
  const paragraphs = content.split("\n\n").filter(Boolean);

  // Extract first sentence of each paragraph for key takeaways
  const takeaways = paragraphs
    .map((p) => {
      const firstSentence = p.split(".")[0];
      return firstSentence.length > 10 && firstSentence.length < 150
        ? firstSentence + "."
        : null;
    })
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="w-full glass-card rounded-2xl p-6 space-y-6">
      {/* Audience badge */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} ${visible ? "animate-pulse" : ""}`} />
        <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
          {audience} Perspective
        </span>
      </div>

      {/* Key Takeaways callout */}
      {takeaways.length > 0 && (
        <div
          className={`rounded-xl border p-4 bg-surface-50/50 dark:bg-surface-900/50 border-surface-200 dark:border-surface-800 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
            Key Takeaways
          </h4>
          <ul className="space-y-2">
            {takeaways.map((takeaway, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-300 leading-relaxed"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                {takeaway}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation paragraphs — each as a separate card */}
      <div className="space-y-6">
        {paragraphs.map((paragraph, i) => (
          <div
            key={i}
            className={`rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-6 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionDelay: `${i * 120}ms`,
              borderTop: `3px solid ${accentColor}`,
            }}
          >
            <p className="text-sm text-foreground leading-7">
              {paragraph}
            </p>
          </div>
        ))}
      </div>

      {/* Mermaid diagram */}
      {diagram && (
        <div
          className={`pt-5 border-t border-[var(--card-border)] transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${paragraphs.length * 120}ms` }}
        >
          <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-4">
            Architecture Diagram
          </h4>
          <MermaidDiagram diagram={diagram} onRetry={onRetry} />
        </div>
      )}
    </div>
  );
}