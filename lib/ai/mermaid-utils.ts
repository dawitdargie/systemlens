import type { ProjectProfile } from "@/types";

/**
 * Utilities for sanitizing, validating, and generating fallback Mermaid diagrams.
 *
 * The AI frequently produces *almost*-valid Mermaid that breaks on small syntax
 * issues (markdown fences, wrong arrow style, special characters in labels).
 * These helpers clean up common issues so the browser-side `mermaid.render()`
 * succeeds far more often, and provide a deterministic fallback when the AI
 * output is unfixable.
 */

const VALID_DIAGRAM_TYPES = [
  "graph",
  "flowchart",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "erdiagram",
] as const;

/**
 * Strip markdown code fences and leading/trailing whitespace from a raw diagram
 * string. The AI sometimes wraps the diagram (or the whole JSON) in ``` fences.
 */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:mermaid|json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/**
 * Sanitize a Mermaid diagram string to fix the most common AI mistakes:
 *  - markdown fences around the whole block
 *  - sequence-diagram arrows (`->>`, `-->>`) used inside `graph`/`flowchart`
 *  - special characters in node labels that break the parser
 *  - CRLF line endings
 *  - stray leading whitespace on the first line
 *
 * Returns the cleaned diagram, or "" if it cannot be salvaged.
 */
export function sanitizeMermaid(raw: string): string {
  let diagram = stripCodeFences(raw);
  if (!diagram) return "";

  // Normalize line endings
  diagram = diagram.replace(/\r\n?/g, "\n");

  // Fix sequence-diagram arrows used in graph/flowchart contexts.
  // Only do this for graph/flowchart diagrams (sequence diagrams legitimately use ->>).
  const lower = diagram.toLowerCase();
  const isGraphLike =
    lower.startsWith("graph") || lower.startsWith("flowchart");
  if (isGraphLike) {
    diagram = diagram.replace(/-->>/g, "-->");
    diagram = diagram.replace(/->>/g, "-->");
    diagram = diagram.replace(/<-</g, "<--");
    diagram = diagram.replace(/<<-/g, "<--");
  }

  // Escape characters in node labels that Mermaid treats as syntax.
  // We only target text inside [...] and ("...") label brackets.
  diagram = escapeLabelSpecialChars(diagram);

  // Remove any blank lines (Mermaid tolerates them but they sometimes cause
  // issues when combined with other minor syntax errors).
  diagram = diagram
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return diagram;
}

/**
 * Escape special characters inside Mermaid node labels.
 * Mermaid uses ()[]{}|#" as syntax; labels containing these break the parser.
 * We wrap offending label text in double quotes, which Mermaid allows for
 * arbitrary label text.
 */
function escapeLabelSpecialChars(diagram: string): string {
  // Match node label brackets: A[Label], A(Label), A((Label)), A{Label}, A>Label]
  // We focus on the two most common: [...] and (...)
  const labelPattern = /(\w+)\[([^\]]*)\]/g;
  const parenPattern = /(\w+)\(([^)]*)\)/g;

  const escapeLabel = (text: string): string => {
    // If the label contains characters that break Mermaid, wrap in quotes and
    // escape inner quotes.
    if (/[(){}\[\]|#"]/.test(text)) {
      const escaped = text.replace(/"/g, "#quot;");
      return `"${escaped}"`;
    }
    return text;
  };

  diagram = diagram.replace(labelPattern, (_match, id: string, label: string) => {
    return `${id}[${escapeLabel(label)}]`;
  });
  diagram = diagram.replace(parenPattern, (_match, id: string, label: string) => {
    return `${id}(${escapeLabel(label)})`;
  });

  return diagram;
}

/**
 * Lightweight structural validation of a Mermaid diagram.
 * This is NOT a full parser — it catches the common failure modes that
 * `mermaid.render()` would reject, so we can retry/fallback before sending
 * to the client.
 */
export function isValidMermaid(raw: string): boolean {
  const diagram = raw.trim();
  if (!diagram) return false;

  const lower = diagram.toLowerCase();
  const hasValidType = VALID_DIAGRAM_TYPES.some((t) =>
    lower.startsWith(t)
  );
  if (!hasValidType) return false;

  const lines = diagram.split("\n");

  // For graph/flowchart, every non-empty, non-comment line should look like a
  // node declaration or edge. We do a permissive check: reject lines that
  // contain obviously broken syntax.
  const isGraphLike =
    lower.startsWith("graph") || lower.startsWith("flowchart");

  if (isGraphLike) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("%%")) continue;

      // First line is the diagram type declaration (e.g. "graph TD")
      if (i === 0) {
        if (!/^(graph|flowchart)\s+(td|tb|lr|rl|bt)$/i.test(line)) {
          // Some valid diagrams have just "graph" with no direction; allow that.
          if (!/^(graph|flowchart)$/i.test(line)) return false;
        }
        continue;
      }

      // Reject lines that still contain sequence-diagram arrows in a graph
      if (/->>|-->>/.test(line)) return false;

      // Reject lines with unbalanced brackets in labels
      if (hasUnbalancedBrackets(line)) return false;
    }
  }

  return true;
}

function hasUnbalancedBrackets(line: string): boolean {
  const pairs: Record<string, string> = { "[": "]", "(": ")", "{": "}" };
  const stack: string[] = [];
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;

    if (ch in pairs) {
      stack.push(ch);
    } else if (ch === "]" || ch === ")" || ch === "}") {
      const opener = stack.pop();
      if (!opener || pairs[opener] !== ch) return true;
    }
  }
  return stack.length > 0;
}

/**
 * Build a deterministic, always-valid Mermaid diagram from the project profile.
 * Used as a fallback when the AI diagram fails validation after retries.
 *
 * Produces a simple linear flow: Client -> Module1 -> Module2 -> ... -> Response
 * derived from `mainModules` and `dataFlow`.
 */
export function buildFallbackDiagram(profile: ProjectProfile): string {
  const modules = profile.understanding.mainModules
    .map((m) => m.name)
    .filter(Boolean)
    .slice(0, 6);

  // Sanitize module names for use as node labels (alphanumeric + spaces only)
  const cleanNames = modules.map((name) =>
    name.replace(/[^\w\s]/g, "").trim() || "Component"
  );

  const lines: string[] = ["graph TD"];

  // Always start with a Client/Request node
  lines.push("A[Client Request]");

  let prev = "A";
  const usedIds = new Set<string>(["A"]);
  cleanNames.forEach((name, idx) => {
    const id = String.fromCharCode(66 + idx); // B, C, D, ...
    if (usedIds.has(id)) return;
    usedIds.add(id);
    lines.push(`${prev} --> ${id}[${name}]`);
    prev = id;
  });

  // End with a Response node
  const responseId = "Z";
  lines.push(`${prev} --> ${responseId}[Response]`);

  return lines.join("\n");
}