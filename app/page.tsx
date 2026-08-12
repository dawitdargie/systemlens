"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import Image from "next/image";
import AudiencePicker from "@/components/audience-picker";
import ExplanationView from "@/components/explanation";
import Chat from "@/components/chat";
import type { Audience, ProjectProfile } from "@/types";

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<ProjectProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [explanationContent, setExplanationContent] = useState<string | null>(null);
  const [explanationDiagram, setExplanationDiagram] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  const explanationRef = useRef<HTMLDivElement>(null);

  function formatRetryTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

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
  const audienceSectionRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  // ── Theme toggle (requirement #7) ──
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Initialize theme: prefer stored choice, fall back to system preference.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      const sys = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
      setTheme(sys);
    }
  }, []);

  // Apply theme to <html> and persist the user's choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const scrollToAudience = useCallback(() => {
    audienceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToChat = useCallback(() => {
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleExplain = useCallback(async (audience: string) => {
    if (!result) return;
    setSelectedAudience(audience);
    setExplaining(true);
    setExplanationError(null);
    setExplanationContent(null);
    setExplanationDiagram(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectProfile: result, audience }),
      });

      const contentType = response.headers.get("Content-Type") || "";

      // Cached response — plain JSON, return immediately.
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          setExplanationError(data.error || "Unable to generate explanation.");
          return;
        }
        setExplanationContent(data.explanation);
        setExplanationDiagram(data.diagram);
        setExplaining(false);
        return;
      }

      // Streaming response (SSE) — read chunks progressively.
      const reader = response.body?.getReader();
      if (!reader) {
        setExplanationError("Unable to read response stream.");
        setExplaining(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "chunk") {
              streamedContent += event.content;
              setExplanationContent(streamedContent);
            } else if (event.type === "diagram") {
              setExplanationDiagram(event.diagram);
            } else if (event.type === "error") {
              setExplanationError(event.error);
              if (event.retryAfterSeconds) {
                setRetryAfterSeconds(event.retryAfterSeconds);
              }
            } else if (event.type === "done") {
              // Stream complete
            }
          } catch {
            // Incomplete line, keep in buffer
            buffer = line;
          }
        }
      }
    } catch {
      setExplanationError("Network error. Please check your connection.");
    } finally {
      setExplaining(false);
    }
  }, [result]);

  // Scroll to explanation when it loads
  useEffect(() => {
    if (explanationContent && explanationRef.current) {
      explanationRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [explanationContent]);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    let completed = false;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setExplanationContent(null);
    setExplanationDiagram(null);
    setExplaining(false);
    setExplanationError(null);
    setSelectedAudience(null);
    setStatusText("Fetching repository metadata...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: url }),
      });

      // Check if it's a streaming response (SSE) or a regular JSON error
      const contentType = response.headers.get("Content-Type") || "";

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Unable to analyze repository.");
        return;
      }

      if (contentType.includes("text/event-stream")) {
        // Streaming response — read progress events
        const reader = response.body?.getReader();
        if (!reader) {
          setError("Unable to read response stream.");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line);

              if (event.type === "progress") {
                setStatusText(event.step);
              } else if (event.type === "result") {
                setResult(event.data);
                completed = true;
              } else if (event.type === "error") {
                setError(event.error);
                if (event.retryAfterSeconds) {
                  setRetryAfterSeconds(event.retryAfterSeconds);
                }
                completed = true;
              }
            } catch {
              // Incomplete line, keep in buffer
              buffer = line;
            }
          }
        }
      } else {
        // Non-streaming response (fallback)
        const data = await response.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        setResult(data);
        completed = true;
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setAnalyzing(false);
      if (!completed) {
        setStatusText("");
      }
    }
  };

  // Helper: section card for project understanding (memoized to avoid re-renders)
  const SectionCard = memo(function SectionCard({
    title,
    children,
    accentColor = "var(--color-accent-500)",
  }: {
    title: string;
    children: React.ReactNode;
    accentColor?: string;
}) {
    return (
      <div className="glass-card rounded-xl p-5 border-l-2 hover:border-l-[3px] transition-all duration-200"
           style={{ borderLeftColor: accentColor }}>
        <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
        <div className="text-sm text-foreground leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    );
  });

// Project Understanding layout (memoized — only re-renders when the
  // underlying understanding data changes, not on chat/explanation state changes)
  const ProjectUnderstanding = memo(function ProjectUnderstanding({
    understanding,
  }: {
    understanding: ProjectProfile["understanding"];
  }) {
    return (
      <div className="space-y-4">
        <SectionCard title="Purpose" accentColor="#00d4ff">
          <p>{understanding.purpose}</p>
        </SectionCard>

        <SectionCard title="Key Features" accentColor="#7b61ff">
          <ul className="space-y-2">
            {understanding.keyFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-2 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Main Modules" accentColor="#7b61ff">
          <div className="grid grid-cols-1 gap-3">
            {understanding.mainModules.map((module, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-accent-500/30 transition-colors duration-200">
                <h5 className="text-sm font-semibold text-foreground">{module.name}</h5>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1 leading-relaxed">{module.description}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Architecture" accentColor="#00d4ff">
          <p>{understanding.architectureSummary}</p>
        </SectionCard>

        <SectionCard title="Tech Stack Details" accentColor="#00d4ff">
          <p>{understanding.techStackDetails}</p>
        </SectionCard>

        <SectionCard title="Data Flow" accentColor="#00d4ff">
          <p>{understanding.dataFlow}</p>
        </SectionCard>
      </div>
    );
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid">
      <div className="bg-animated-blob -top-32 -left-24 w-96 h-96" />
      <div className="bg-animated-blob -bottom-32 -right-24 w-96 h-96" style={{ animationDelay: "2s" }} />
      <div className="glow -top-40 -left-40" />
      <div className="glow -bottom-40 -right-40" style={{ animationDelay: "2s" }} />

      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="SystemLens" width={28} height={28} className="opacity-80" />
          <span className="text-sm font-medium tracking-tight text-surface-500 dark:text-surface-400">SystemLens</span>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className="text-xs text-surface-400 dark:text-surface-500">
              Analysis complete
            </span>
          )}
          {/* Theme toggle button (requirement #7) */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-toggle relative w-9 h-9 rounded-xl glass-card flex items-center justify-center transition-all duration-300 hover:scale-105"
          >
            {theme === "dark" ? (
              /* Sun icon (dark mode → click for light) */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* Moon icon (light mode → click for dark) */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-500">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-20 sm:pt-24 pb-32 sm:pb-40">
        {/* Hero section - only shown before analysis */}
        {!result && (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6 sm:mb-8 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400 tracking-wide uppercase">Understand Systems Faster.</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-center leading-[1.05] animate-fade-in">
              <span className="gradient-text">Understand</span>
              <br />
              <span className="text-foreground">any repository</span>
              <br />
              <span className="text-surface-300 dark:text-surface-700">instantly.</span>
            </h1>

            <p className="mt-6 max-w-lg text-center text-surface-400 dark:text-surface-500 text-base sm:text-lg leading-relaxed animate-fade-in">
              Paste a GitHub URL. Get a complete project profile, audience-tailored
              explanations + visual diagram, and AI-powered answers to your questions.
            </p>

            {/* Hero image — decorative, responsive, below the hero text */}
            <div className="relative w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto mt-10 sm:mt-14 animate-slide-up" style={{ animationDelay: "0.35s" }}>
              <div className="bg-animated-blob -top-10 -left-10 w-40 h-40 sm:w-56 sm:h-56" />
              <div className="bg-animated-blob -bottom-10 -right-10 w-40 h-40 sm:w-56 sm:h-56" style={{ animationDelay: "1.5s" }} />
              <div className="hero-image-frame">
                <div className="hero-image-inner">
                  <Image
                    src="https://i.ibb.co/VcQDDxFf/systemlens.jpg"
                    alt="SystemLens — understand any repository"
                    width={1024}
                    height={640}
                    priority
                    className="w-full h-auto object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 448px, 512px"
                  />
                  <div className="hero-image-shine" />
                </div>
              </div>
            </div>

            {/* What You Get — feature cards (requirement #2) */}
            <div className="w-full max-w-4xl mx-auto mt-16 sm:mt-20 animate-slide-up" style={{ animationDelay: "0.45s" }}>
              <div className="flex items-center justify-center gap-3 mb-8">
                <h2 className="section-gradient-heading text-xl sm:text-2xl font-bold tracking-tight">What You Get</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Project Profile */}
                <div className="gradient-border rounded-2xl p-5 card-hover-lift">
                  <div className="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-500">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Project Profile</h3>
                  <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
                    Tech stack, purpose, architecture, key features, and data flow instantly extracted.
                  </p>
                </div>

                {/* Card 2: Audience-Specific Explanation */}
                <div className="gradient-border rounded-2xl p-5 card-hover-lift">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Audience-Specific Explanation</h3>
                  <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
                    Tailored walkthroughs for CEOs, PMs, Developers, QA, and Customers.
                  </p>
                </div>

                {/* Card 3: Architecture Visualization */}
                <div className="gradient-border rounded-2xl p-5 card-hover-lift">
                  <div className="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-500">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Architecture Visualization</h3>
                  <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
                    Interactive system diagrams that make the structure immediately visible.
                  </p>
                </div>

                {/* Card 4: Ask the Codebase */}
                <div className="gradient-border rounded-2xl p-5 card-hover-lift">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Ask the Codebase</h3>
                  <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
                    Chat with the repo, get answers grounded in the actual source code.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Input bar - always visible */}
        <div className="w-full max-w-3xl glass-card rounded-2xl p-2 animate-slide-up mt-10" style={{ animationDelay: "0.2s" }}>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !analyzing && !url.trim() === false && handleAnalyze()}
                className="input-glow w-full pl-11 pr-4 py-3.5 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground placeholder:text-surface-400 dark:placeholder:text-surface-600 transition-all duration-300"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="btn-gradient px-8 py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap transition-all duration-300"
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        {analyzing && statusText && (
          <div className="mt-4 w-full max-w-3xl flex items-center gap-3 animate-fade-in">
            <svg className="animate-spin h-4 w-4 text-accent-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-surface-400 dark:text-surface-500">{statusText}</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-6 w-full max-w-3xl glass-card rounded-xl p-4 animate-slide-up border-red-500/20">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">{error}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={retryAfterSeconds > 0}
                    className={`text-xs font-semibold transition-colors ${
                      retryAfterSeconds > 0
                        ? "text-surface-400 dark:text-surface-600 cursor-not-allowed"
                        : "text-accent-500 hover:text-accent-400"
                    }`}
                  >
                    {retryAfterSeconds > 0
                      ? `Retry in ${formatRetryTime(retryAfterSeconds)}`
                      : "Try Again"}
                  </button>
                  <button onClick={() => { setError(null); setRetryAfterSeconds(0); }} className="text-xs text-surface-400 dark:text-surface-500 hover:text-foreground transition-colors">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        )}

{/* Results - Single Column */}
        {result && (
          <div className="mt-8 w-full max-w-3xl animate-fade-in space-y-8">
            {/* Explore CTA (compact) — at the top of project profile */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">Explore This Project</span>
                  <span className="hidden sm:inline text-sm text-surface-400 dark:text-surface-500">
                    Dive deeper with <span className="gradient-text font-medium">SystemLens</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={scrollToAudience}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground hover:border-accent-500/50 transition-all duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-500">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Tailored Explanations
                  </button>
                  <button
                    onClick={scrollToChat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] text-foreground hover:border-primary-400/50 transition-all duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Ask Questions
                  </button>
                </div>
              </div>
            </div>

            {/* Repository header */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{result.repository.owner}/{result.repository.name}</h2>
                  <a href={result.repository.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-500 hover:text-accent-400 transition-colors">View on GitHub</a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-400 dark:text-surface-500">Branch:</span>
                  <span className="text-xs font-mono text-foreground px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">{result.repository.defaultBranch}</span>
                </div>
              </div>

              {/* Technical Facts */}
              <div className="pt-4 border-t border-[var(--card-border)]">
                <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-3">Technical Facts</h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                    <span className="w-2 h-2 rounded-full bg-accent-500" />
                    <span className="text-xs text-surface-400 dark:text-surface-500">Language</span>
                    <span className="text-sm font-semibold text-foreground">{result.technicalFacts.language}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                    <span className="w-2 h-2 rounded-full bg-primary-400" />
                    <span className="text-xs text-surface-400 dark:text-surface-500">Framework</span>
                    <span className="text-sm font-semibold text-foreground">{result.technicalFacts.framework}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                    <span className={`w-2 h-2 rounded-full ${result.technicalFacts.deployment === "Docker" ? "bg-green-500" : "bg-surface-300 dark:bg-surface-700"}`} />
                    <span className="text-xs text-surface-400 dark:text-surface-500">Deployment</span>
                    <span className="text-sm font-semibold text-foreground">{result.technicalFacts.deployment}</span>
                  </div>
                </div>
              </div>
            </div>

{/* Project Understanding */}
            <div className="pt-2">
              <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-3">Project Understanding</h3>
              <ProjectUnderstanding understanding={result.understanding} />
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--card-border)]" />

            {/* Audience Picker + Explanation */}
            <div ref={audienceSectionRef} className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="section-gradient-heading text-lg sm:text-xl font-bold tracking-tight">Audience-Based Explanation</h3>
              </div>
              <p className="text-sm text-surface-400 dark:text-surface-500 leading-relaxed">
                Choose your perspective and see this project explained specifically for your role.
              </p>

              {/* Audience Picker */}
              <div className="glass-card rounded-2xl p-4 sm:p-5">
                <AudiencePicker
                  audiences={["CEO", "PM", "Developer", "QA", "Customer"]}
                  selected={selectedAudience}
                  onSelect={handleExplain}
                />
              </div>

              {/* Explanation Output */}
              {(explaining || explanationContent || explanationError) && (
                <ExplanationView
                  audience={selectedAudience || ""}
                  content={explanationContent}
                  diagram={explanationDiagram}
                  loading={explaining}
                  error={explanationError}
                  retryAfterSeconds={retryAfterSeconds}
                  onRetry={() => { setRetryAfterSeconds(0); selectedAudience && handleExplain(selectedAudience); }}
                />
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--card-border)]" />

            {/* Chat Interface */}
            <div ref={chatSectionRef} className="space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="section-gradient-heading text-lg sm:text-xl font-bold tracking-tight">Ask Questions</h3>
              </div>
              <p className="text-sm text-surface-400 dark:text-surface-500 leading-relaxed">
                Ask anything about this project's architecture, code, and flow — get instant answers.
              </p>
              <Chat
                projectProfile={result}
                audience={(selectedAudience as Audience) || "Developer"}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-32 text-center animate-fade-in">
          <p className="text-xs text-surface-400 dark:text-surface-600">SystemLens. Open source.</p>
        </footer>
      </main>
    </div>
  );
}
