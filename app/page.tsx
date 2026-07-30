"use client";

import { useState } from "react";
import Image from "next/image";
import AudiencePicker from "@/components/audience-picker";

interface RepositoryInfo {
  name: string;
  owner: string;
  url: string;
  defaultBranch: string;
}

interface ImportantFiles {
  readme: string | null;
  manifest: string | null;
  docker: string | null;
  entryPoint: string | null;
}

interface TechnicalFacts {
  language: string;
  framework: string;
  deployment: string;
}

interface AnalysisResult {
  repository: RepositoryInfo;
  technicalFacts: TechnicalFacts;
  understanding: import("@/types").ProjectUnderstanding;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    // Simulate progress steps while waiting for the API
    const steps = [
      "Fetching repository metadata...",
      "Scanning file tree...",
      "Analyzing technical facts...",
      "Generating project understanding...",
    ];
    let stepIndex = 0;
    setStatusText(steps[0]);
    const progressInterval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setStatusText(steps[stepIndex]);
    }, 2000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to analyze repository.");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      clearInterval(progressInterval);
      setAnalyzing(false);
      setStatusText("");
    }
  };

  const fileBadge = (label: string, path: string | null) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)]">
      <span
        className={`w-2 h-2 rounded-full ${path ? "bg-accent-500" : "bg-surface-300 dark:bg-surface-700"}`}
      />
      <span className="text-xs font-medium text-foreground">{label}</span>
      {path && (
        <span className="text-xs text-surface-400 dark:text-surface-500 font-mono truncate max-w-[120px]">
          {path}
        </span>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="glow -top-40 -left-40" />
      <div className="glow -bottom-40 -right-40" style={{ animationDelay: "2s" }} />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="SystemLens"
            width={28}
            height={28}
            className="opacity-80"
          />
          <span className="text-sm font-medium tracking-tight text-surface-500 dark:text-surface-400">
            SystemLens
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-surface-400 dark:text-surface-500">
            Analyze any public repository
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-24 pb-32 sm:pt-32 sm:pb-40">
        {/* Tagline */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          <span className="text-xs font-medium text-surface-500 dark:text-surface-400 tracking-wide uppercase">
            GitHub Repository Analyzer
          </span>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-center leading-[1.05] animate-fade-in">
          <span className="gradient-text">Understand</span>
          <br />
          <span className="text-foreground">any repository</span>
          <br />
          <span className="text-surface-300 dark:text-surface-700">instantly.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-lg text-center text-surface-400 dark:text-surface-500 text-base sm:text-lg leading-relaxed animate-fade-in">
          Paste a GitHub URL. Get a complete project profile, audience-tailored
          explanations, and AI-powered answers to any code question.
        </p>

        {/* Input Card */}
        <div
          className="mt-10 w-full max-w-2xl glass-card rounded-2xl p-2 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 pointer-events-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                  Analyzing...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
        </div>

        {/* Progress indicator while analyzing */}
        {analyzing && statusText && (
          <div className="mt-4 w-full max-w-2xl flex items-center gap-3 animate-fade-in">
            <svg
              className="animate-spin h-4 w-4 text-accent-500 flex-shrink-0"
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
            <span className="text-sm text-surface-400 dark:text-surface-500">
              {statusText}
            </span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 w-full max-w-2xl glass-card rounded-xl p-4 animate-slide-up border-red-500/20">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-xs text-surface-400 dark:text-surface-500 hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {result && (
          <div className="mt-6 w-full max-w-2xl glass-card rounded-2xl p-6 animate-slide-up">
            {/* Repository header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {result.repository.owner}/{result.repository.name}
                </h2>
                <a
                  href={result.repository.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-500 hover:text-accent-400 transition-colors"
                >
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Branch info */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-surface-400 dark:text-surface-500">Branch:</span>
              <span className="text-xs font-mono text-foreground px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">
                {result.repository.defaultBranch}
              </span>
            </div>

            {/* Technical Facts */}
            <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
              <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-3">
                Technical Facts
              </h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                  <span className="w-2 h-2 rounded-full bg-accent-500" />
                  <span className="text-xs text-surface-400 dark:text-surface-500">Language</span>
                  <span className="text-sm font-semibold text-foreground">
                    {result.technicalFacts.language}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                  <span className="w-2 h-2 rounded-full bg-primary-400" />
                  <span className="text-xs text-surface-400 dark:text-surface-500">Framework</span>
                  <span className="text-sm font-semibold text-foreground">
                    {result.technicalFacts.framework}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                  <span className={`w-2 h-2 rounded-full ${result.technicalFacts.deployment === "Docker" ? "bg-green-500" : "bg-surface-300 dark:bg-surface-700"}`} />
                  <span className="text-xs text-surface-400 dark:text-surface-500">Deployment</span>
                  <span className="text-sm font-semibold text-foreground">
                    {result.technicalFacts.deployment}
                  </span>
                </div>
              </div>
            </div>

            {/* Project Understanding */}
            <div className="mt-6 pt-6 border-t border-[var(--card-border)] space-y-6">
              <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                Project Understanding
              </h3>

              {/* Purpose */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">Purpose</h4>
                <p className="text-sm text-surface-300 dark:text-surface-400 leading-relaxed">
                  {result.understanding.purpose}
                </p>
              </div>

              {/* Key Features */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Key Features</h4>
                <ul className="space-y-1.5">
                  {result.understanding.keyFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-300 dark:text-surface-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-1.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Main Modules */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Main Modules</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.understanding.mainModules.map((module, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                      <h5 className="text-sm font-semibold text-foreground">{module.name}</h5>
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 leading-relaxed">{module.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Architecture Summary */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">Architecture</h4>
                <p className="text-sm text-surface-300 dark:text-surface-400 leading-relaxed">
                  {result.understanding.architectureSummary}
                </p>
              </div>

              {/* Tech Stack Details */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">Tech Stack Details</h4>
                <p className="text-sm text-surface-300 dark:text-surface-400 leading-relaxed">
                  {result.understanding.techStackDetails}
                </p>
              </div>

              {/* Data Flow */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">Data Flow</h4>
                <p className="text-sm text-surface-300 dark:text-surface-400 leading-relaxed">
                  {result.understanding.dataFlow}
                </p>
              </div>
            </div>

            {/* Audience Selection */}
            <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
              <AudiencePicker
                audiences={["Developer", "Product Manager", "QA Engineer", "CTO", "Customer"]}
                selected={selectedAudience}
                onSelect={setSelectedAudience}
              />
            </div>
          </div>
        )}

        {/* Feature preview cards */}
        {!result && !error && (
          <div className="mt-20 w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            {[
              {
                label: "Project Profile",
                desc: "Purpose, tech stack, components, and architecture — automatically extracted.",
                gradient: "from-accent-500/20 to-primary-500/20",
              },
              {
                label: "Audience Explanations",
                desc: "CEO, PM, Developer, QA, or Customer — one project, many perspectives.",
                gradient: "from-primary-500/20 to-accent-500/20",
              },
              {
                label: "Code Chat",
                desc: "Ask anything about the codebase. Get answers with relevant source context.",
                gradient: "from-accent-500/10 to-primary-500/30",
              },
            ].map((feature, i) => (
              <div
                key={feature.label}
                className="glass-card rounded-xl p-6 group hover:border-accent-500/30 transition-all duration-500"
                style={{ animationDelay: `${0.4 + i * 0.15}s` }}
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} mb-4 flex items-center justify-center`}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-accent-500/50" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {feature.label}
                </h3>
                <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Placeholder sections for future components */}
        {!result && !error && (
          <div className="mt-20 w-full max-w-5xl space-y-8" id="project-profile-section">
            {/* Project Profile placeholder */}
            <div className="glass-card rounded-xl p-8 opacity-30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-surface-300 dark:bg-surface-700" />
                <div className="h-4 w-32 rounded bg-surface-200 dark:bg-surface-800" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 rounded-lg bg-surface-100 dark:bg-surface-900/50" />
                <div className="h-20 rounded-lg bg-surface-100 dark:bg-surface-900/50" />
              </div>
            </div>

            {/* Explanation placeholder */}
            <div className="glass-card rounded-xl p-8 opacity-20" id="explanation-section">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-surface-300 dark:bg-surface-700" />
                <div className="h-4 w-40 rounded bg-surface-200 dark:bg-surface-800" />
              </div>
              <div className="h-40 rounded-lg bg-surface-100 dark:bg-surface-900/50" />
            </div>

            {/* Chat placeholder */}
            <div className="glass-card rounded-xl p-8 opacity-10" id="chat-section">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-surface-300 dark:bg-surface-700" />
                <div className="h-4 w-24 rounded bg-surface-200 dark:bg-surface-800" />
              </div>
              <div className="h-32 rounded-lg bg-surface-100 dark:bg-surface-900/50" />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-32 text-center animate-fade-in">
          <p className="text-xs text-surface-400 dark:text-surface-600">
            SystemLens &mdash; Open source. No authentication required. No data stored.
          </p>
        </footer>
      </main>
    </div>
  );
}