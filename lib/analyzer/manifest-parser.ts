export interface ManifestResult {
  language: string;
  framework: string;
}

// ── Go framework patterns ──
const GO_FRAMEWORKS: Array<{ pattern: string; name: string }> = [
  { pattern: "github.com/gin-gonic/gin", name: "Gin" },
  { pattern: "github.com/labstack/echo", name: "Echo" },
  { pattern: "github.com/gofiber/fiber", name: "Fiber" },
  { pattern: "github.com/go-chi/chi", name: "Chi" },
  { pattern: "github.com/gorilla/mux", name: "Gorilla Mux" },
];

// ── JavaScript/TypeScript framework patterns ──
const JS_FRAMEWORKS: Array<{ pattern: string; name: string }> = [
  { pattern: "next", name: "Next.js" },
  { pattern: "express", name: "Express" },
  { pattern: "vue", name: "Vue" },
  { pattern: "@angular/core", name: "Angular" },
  { pattern: "svelte", name: "Svelte" },
  { pattern: "fastify", name: "Fastify" },
];

// ── Python framework patterns ──
const PYTHON_FRAMEWORKS: Array<{ pattern: string; name: string }> = [
  { pattern: "django", name: "Django" },
  { pattern: "flask", name: "Flask" },
  { pattern: "fastapi", name: "FastAPI" },
  { pattern: "tornado", name: "Tornado" },
];

/**
 * Parses a go.mod file to detect the Go framework.
 *
 * @param content - The raw content of go.mod
 * @returns Language ("Go") and detected framework name
 */
export function parseGoMod(content: string): ManifestResult {
  for (const { pattern, name } of GO_FRAMEWORKS) {
    if (content.includes(pattern)) {
      return { language: "Go", framework: name };
    }
  }
  return { language: "Go", framework: "Unknown" };
}

/**
 * Parses a package.json file to detect language (JS/TS) and framework.
 *
 * @param content - The raw content of package.json
 * @returns Language and detected framework name
 */
export function parsePackageJson(content: string): ManifestResult {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(content);
  } catch {
    return { language: "JavaScript", framework: "Unknown" };
  }

  const dependencies = (parsed.dependencies ?? {}) as Record<string, string>;
  const devDependencies = (parsed.devDependencies ?? {}) as Record<string, string>;

  // Detect TypeScript
  const hasTypeScript =
    "typescript" in devDependencies ||
    "typescript" in dependencies ||
    Object.keys(devDependencies).some((key) => key.startsWith("@types/"));

  const language = hasTypeScript ? "TypeScript" : "JavaScript";

  // Detect framework — check dependencies first, then devDependencies
  const allDeps = { ...dependencies, ...devDependencies };

  // Special case: React without Next.js
  const hasNext = "next" in allDeps;
  const hasReact = "react" in allDeps && "react-dom" in allDeps;

  if (hasNext) {
    return { language, framework: "Next.js" };
  }

  if (hasReact) {
    return { language, framework: "React" };
  }

  // Check other frameworks
  for (const { pattern, name } of JS_FRAMEWORKS) {
    if (pattern === "next") continue; // already handled
    if (pattern in allDeps) {
      return { language, framework: name };
    }
  }

  return { language, framework: "Unknown" };
}

/**
 * Parses a requirements.txt file to detect the Python framework.
 *
 * @param content - The raw content of requirements.txt
 * @returns Language ("Python") and detected framework name
 */
export function parseRequirementsTxt(content: string): ManifestResult {
  const lines = content.toLowerCase().split("\n");

  for (const { pattern, name } of PYTHON_FRAMEWORKS) {
    const found = lines.some((line) => {
      const trimmed = line.trim();
      // Match "django", "django==4.2", "django>=4.0", "Django" etc.
      return trimmed === pattern || trimmed.startsWith(pattern + "==") || trimmed.startsWith(pattern + ">=") || trimmed.startsWith(pattern + "<=") || trimmed.startsWith(pattern + "~=") || trimmed.startsWith(pattern + ">");
    });
    if (found) {
      return { language: "Python", framework: name };
    }
  }

  return { language: "Python", framework: "Unknown" };
}

/**
 * Dispatches to the correct manifest parser based on filename.
 *
 * @param filename - The manifest filename (e.g. "go.mod", "package.json")
 * @param content - The raw file content
 * @returns Parsed result or null if the manifest type is unsupported
 */
export function parseManifest(
  filename: string,
  content: string
): ManifestResult | null {
  const lower = filename.toLowerCase();

  if (lower === "go.mod") {
    return parseGoMod(content);
  }

  if (lower === "package.json") {
    return parsePackageJson(content);
  }

  if (lower === "requirements.txt") {
    return parseRequirementsTxt(content);
  }

  return null;
}