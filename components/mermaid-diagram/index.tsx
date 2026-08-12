"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import type { Mermaid } from "mermaid";

// Lazy-load mermaid only when a diagram actually needs to render.
// This keeps mermaid's large JS bundle out of the initial page load,
// improving Time-to-Interactive on the main page.
let mermaidPromise: Promise<Mermaid> | null = null;
function getMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
      });
      return m;
    });
  }
  return mermaidPromise;
}

interface MermaidDiagramProps {
  diagram: string;
  className?: string;
  onRetry?: () => void;
}

export default function MermaidDiagram({ diagram, className, onRetry }: MermaidDiagramProps) {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Store SVG in a ref so we can re-apply it when containerRef changes (e.g. fullscreen toggle)
  const svgRef = useRef<string | null>(null);

  // Render mermaid diagram when diagram changes
  useEffect(() => {
    let mounted = true;
    setError(false);
    setLoading(true);
    setZoom(1);

    const render = async () => {
      try {
        const mermaid = await getMermaid();
        const { svg } = await mermaid.render(`mermaid-svg-${reactId}`, diagram);
        if (mounted) {
          svgRef.current = svg;
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
          setLoading(false);
        }
      } catch {
        if (mounted) {
          // Clean up any broken SVG element mermaid left in the DOM
          const errorElement = document.getElementById(`mermaid-svg-${reactId}`);
          if (errorElement) {
            errorElement.remove();
          }
          setError(true);
          setLoading(false);
        }
      }
    };

    render();
    return () => {
      mounted = false;
    };
  }, [diagram]);

  // Re-apply SVG when fullscreen toggles (containerRef moves to a new div)
  useEffect(() => {
    if (svgRef.current && containerRef.current) {
      containerRef.current.innerHTML = svgRef.current;
    }
  }, [isFullscreen]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 rounded-xl bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 min-h-[120px]">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-surface-400 dark:text-surface-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            <path d="M21 3v5h-5" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <p className="text-sm text-surface-500 dark:text-surface-400">Diagram could not be rendered</p>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 mb-3">The AI generated invalid diagram syntax.</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Toolbar buttons (shared between inline and fullscreen)
  const Toolbar = ({ dark = false }: { dark?: boolean }) => (
    <div className={`flex items-center gap-1 ${dark ? "" : "opacity-0 group-hover:opacity-100 transition-opacity duration-200"}`}>
      <button
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        className={`w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors ${
          dark
            ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
            : "bg-white/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-700"
        }`}
        title="Zoom out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <span className={`text-[10px] font-mono w-10 text-center select-none ${
        dark ? "text-white/70" : "text-surface-500 dark:text-surface-400"
      }`}>
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        className={`w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors ${
          dark
            ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
            : "bg-white/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-700"
        }`}
        title="Zoom in"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button
        onClick={resetZoom}
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
          dark
            ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
            : "bg-white/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-700"
        }`}
        title="Reset zoom"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
      <div className={`w-px h-4 mx-0.5 ${dark ? "bg-white/20" : "bg-surface-200 dark:bg-surface-700"}`} />
      <button
        onClick={toggleFullscreen}
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
          dark
            ? "bg-white/10 border border-white/20 text-white hover:bg-white/20"
            : "bg-white/90 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-700"
        }`}
        title="View fullscreen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  );

  // Fullscreen overlay — only render this when fullscreen (no duplicate containerRef)
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
        <div className="relative w-full h-full max-w-[95vw] max-h-[95vh]">
          {/* Close button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Close fullscreen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Toolbar */}
          <div className="absolute top-4 left-4 z-10">
            <Toolbar dark />
          </div>

          {/* Diagram — containerRef is here, always rendered */}
          <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
            {loading && (
              <div className="animate-pulse">
                <div className="h-24 w-48 rounded bg-white/10" />
              </div>
            )}
            <div
              ref={containerRef}
              className={className}
              style={{
                transform: `scale(${zoom})`,
                transition: "transform 0.2s ease",
                visibility: loading ? "hidden" : "visible",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Inline view — containerRef is here, always rendered (no loading conditional that hides it)
  return (
    <div className="relative group">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10">
        <Toolbar />
      </div>

      {/* Diagram container — always rendered, containerRef always available */}
      <div className="overflow-auto rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 flex items-center justify-center min-h-[120px]" style={{ maxHeight: "400px" }}>
        {loading && (
          <div className="animate-pulse absolute">
            <div className="h-24 w-48 rounded bg-surface-200 dark:bg-surface-800" />
          </div>
        )}
        <div
          ref={containerRef}
          className={className}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease",
            visibility: loading ? "hidden" : "visible",
          }}
        />
      </div>
    </div>
  );
}