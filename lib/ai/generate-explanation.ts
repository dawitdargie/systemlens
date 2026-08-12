import { ProjectProfile, Audience, Explanation } from "@/types";
import { getAIClient, getAIModel } from "./ai-client";
import { AIError } from "./errors";
import { RateLimitError, isRateLimitError, getRetryAfterSeconds } from "./rate-limit";
import {
  sanitizeMermaid,
  isValidMermaid,
  buildFallbackDiagram,
} from "./mermaid-utils";

export interface GenerateExplanationInput {
  projectProfile: ProjectProfile;
  audience: Audience;
}

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 30_000;

/** Delimiter separating content from diagram in the streaming format. */
const DIAGRAM_DELIMITER = "\n---DIAGRAM---\n";

function parseAIResponse(text: string): { content: string; diagram: string } {
  // Strip markdown code fences if the AI wraps the JSON in ```json ... ```
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return {
    content: typeof parsed.content === "string" ? parsed.content : "",
    diagram: typeof parsed.diagram === "string" ? parsed.diagram : "",
  };
}

/**
 * Streaming variant of generateExplanation.
 *
 * Uses a delimiter-based plain-text format (robust for streaming, unlike
 * partial-JSON parsing): the model streams the content text, then a delimiter
 * line, then the Mermaid diagram. The `onContent` callback is invoked with
 * each content chunk as it arrives so the client can display text immediately.
 *
 * Returns the final Explanation (content + validated/sanitized diagram).
 */
export async function streamExplanation(
  input: GenerateExplanationInput,
  onContent: (chunk: string) => void
): Promise<Explanation> {
  const client = getAIClient();
  const model = getAIModel();
  const { projectProfile, audience } = input;

  const prompt = buildStreamPrompt(projectProfile, audience);

  console.time("streamExplanation");

  // AbortController actually cancels the underlying HTTP request on
  // timeout, rather than leaving it hanging in the background.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;
  try {
    response = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
        stream: true,
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);

    if (controller.signal.aborted) {
      throw new AIError(
        `AI request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      );
    }

    if (isRateLimitError(error)) {
      throw new RateLimitError(getRetryAfterSeconds(error));
    }

    throw error;
  }

  let fullText = "";
  let contentDone = false;
  let content = "";
  let diagram = "";

  for await (const chunk of response) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (!delta) continue;

    fullText += delta;

    // Check if we've crossed the delimiter into the diagram section
    const delimiterIndex = fullText.indexOf(DIAGRAM_DELIMITER);
    if (delimiterIndex !== -1) {
      if (!contentDone) {
        contentDone = true;
        content = fullText.slice(0, delimiterIndex).trim();
      }
      diagram += delta;
    } else if (!contentDone) {
      content += delta;
      onContent(delta);
    }
  }

  // If delimiter never appeared, treat everything as content
  if (!contentDone) {
    content = fullText.trim();
  }

  // Sanitize + validate the diagram
  const sanitizedDiagram = sanitizeMermaid(diagram);
  const diagramValid = isValidMermaid(sanitizedDiagram);
  const finalDiagram = diagramValid
    ? sanitizedDiagram
    : buildFallbackDiagram(projectProfile);

  if (!diagramValid) {
    console.warn(
      "[streamExplanation] AI diagram invalid; using fallback diagram."
    );
  }

  console.timeEnd("streamExplanation");
  return {
    audience,
    content: content || "No explanation generated.",
    diagram: finalDiagram,
  };
}

export async function generateExplanation(
  input: GenerateExplanationInput
): Promise<Explanation> {
  const client = getAIClient();
  const model = getAIModel();
  const { projectProfile, audience } = input;

  const prompt = buildPrompt(projectProfile, audience);
  const repairPrompt = buildRepairPrompt(projectProfile, audience);

  console.time("generateExplanation");

  let lastError: Error | null = null;
  let bestContent = "";
  let bestDiagram = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // AbortController actually cancels the underlying HTTP request on
    // timeout, rather than leaving it hanging in the background.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const isRepair = attempt > 1;
      const response = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: "user", content: isRepair ? repairPrompt : prompt },
          ],
          temperature: isRepair ? 0.1 : 1,
          top_p: 1,
          max_tokens: 4096,
          stream: false,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("Empty response from AI.");
      }

      const parsed = parseAIResponse(text);

      // Sanitize the diagram before validation
      const sanitizedDiagram = sanitizeMermaid(parsed.diagram);

      const contentValid = Boolean(parsed.content && parsed.content.trim());
      const diagramValid = isValidMermaid(sanitizedDiagram);

      // Track the best content/diagram we've seen so far
      if (contentValid && !bestContent) bestContent = parsed.content;
      if (diagramValid && !bestDiagram) bestDiagram = sanitizedDiagram;

      // Success: both valid
      if (contentValid && diagramValid) {
        console.timeEnd("generateExplanation");
        return {
          audience,
          content: parsed.content,
          diagram: sanitizedDiagram,
        };
      }

      // Partial success: content valid, diagram invalid.
      // If this is the last attempt, don't throw away the good content —
      // return it with a fallback diagram.
      if (contentValid && !diagramValid && attempt === MAX_ATTEMPTS) {
        const fallback = buildFallbackDiagram(projectProfile);
        console.timeEnd("generateExplanation");
        console.warn(
          "[generateExplanation] AI diagram invalid after retries; using fallback."
        );
        return {
          audience,
          content: parsed.content,
          diagram: fallback,
        };
      }

      // Otherwise record what was missing and retry
      lastError = new Error(
        !contentValid
          ? "AI returned empty or too-short content."
          : "AI returned invalid Mermaid diagram syntax."
      );
    } catch (error) {
      clearTimeout(timeout);

      if (controller.signal.aborted) {
        // Timeouts — don't retry, surface immediately.
        console.timeEnd("generateExplanation");
        throw new AIError(
          `AI request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
        );
      }

      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // All attempts exhausted. If we at least got valid content, return it with
  // a fallback diagram rather than showing the user nothing.
  console.timeEnd("generateExplanation");
  if (bestContent) {
    const fallback = bestDiagram || buildFallbackDiagram(projectProfile);
    console.warn(
      "[generateExplanation] All attempts failed; returning best content with fallback diagram."
    );
    return {
      audience,
      content: bestContent,
      diagram: fallback,
    };
  }

  throw new Error(
    `Failed to generate explanation: ${lastError?.message || "Unknown error"}`
  );
}

function buildPrompt(profile: ProjectProfile, audience: Audience): string {
  const { repository, technicalFacts, understanding } = profile;

  const audienceGuidance: Record<Audience, string> = {
    CEO: "Focus on business value, ROI, market positioning, and strategic technical decisions.",
    PM: "Focus on key features, project milestones, and delivery scope — practical, business-focused, and concise.",
    Developer: "Focus on architecture, code organization, design patterns, and technical implementation details.",
    QA: "Focus on testing strategy, edge cases, quality concerns, and areas that need careful testing.",
    Customer: "Focus on what the product does, how it benefits users, and why it matters in plain language.",
  };

  const modulesText = understanding.mainModules
    .map((m) => `- ${m.name}: ${m.description}`)
    .join("\n");

  const featuresText = understanding.keyFeatures
    .map((f) => `- ${f}`)
    .join("\n");

  const contentRule =
    audience === "PM"
      ? `- content: Write 2-3 CONCISE paragraphs for the PM audience. Cover key features, project scope, and milestones briefly, in a practical business-focused tone. Use plain text, no markdown.`
      : `- content: Write 3-5 paragraphs tailored to the ${audience} perspective. Use plain text, no markdown.`;

  const lines = [
    `You are a software architecture analyst. Explain this project for a ${audience}.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `URL: ${repository.url}`,
    ``,
    `Technical Facts:`,
    `- Language: ${technicalFacts.language}`,
    `- Framework: ${technicalFacts.framework}`,
    `- Deployment: ${technicalFacts.deployment}`,
    ``,
    `Project Understanding:`,
    `- Purpose: ${understanding.purpose}`,
    `- Architecture: ${understanding.architectureSummary}`,
    `- Tech Stack Details: ${understanding.techStackDetails}`,
    `- Data Flow: ${understanding.dataFlow}`,
    ``,
    `Key Features:`,
    featuresText,
    ``,
    `Main Modules:`,
    modulesText,
    ``,
    `Audience-specific guidance:`,
    audienceGuidance[audience],
    ``,
    `Respond with ONLY a JSON object matching this exact shape:`,
    `{`,
    `  "content": string,`,
    `  "diagram": string`,
    `}`,
    ``,
    `Rules:`,
    contentRule,
    `- diagram: Provide a valid Mermaid diagram showing the project's architecture.`,
    `- Use "graph TD" for the diagram type.`,
    `- Keep the diagram simple (5-10 nodes max).`,
    `- Mermaid syntax for graph TD: use --> for arrows, node labels in brackets like Node[Label].`,
    `- CRITICAL: Node labels must contain ONLY letters, numbers, and spaces. Do NOT use parentheses (), brackets [], braces {}, quotes, or the # character inside node labels.`,
    `- Example of VALID diagram:`,
    `  graph TD`,
    `      A[Client] --> B[API Server]`,
    `      B --> C[Database]`,
    `- Example of INVALID diagram (do NOT do this):`,
    `  graph TD`,
    `      A[Client (Web)] --> B[API Server]`,
    `      B --> C[(Database)]`,
    `- Do NOT use ->> or -->> arrows (those are for sequence diagrams, not graph TD).`,
    `- Do not add markdown formatting or explanations. Output raw JSON only.`,
  ];

  return lines.join("\n");
}

/**
 * Prompt for the streaming variant. Instructs the model to output plain text
 * content first, then a delimiter line, then the Mermaid diagram. This avoids
 * fragile partial-JSON parsing during streaming.
 */
function buildStreamPrompt(profile: ProjectProfile, audience: Audience): string {
  const { repository, technicalFacts, understanding } = profile;

  const audienceGuidance: Record<Audience, string> = {
    CEO: "Focus on business value, ROI, market positioning, and strategic technical decisions.",
    PM: "Focus on key features, project milestones, and delivery scope — practical, business-focused, and concise.",
    Developer: "Focus on architecture, code organization, design patterns, and technical implementation details.",
    QA: "Focus on testing strategy, edge cases, quality concerns, and areas that need careful testing.",
    Customer: "Focus on what the product does, how it benefits users, and why it matters in plain language.",
  };

  const modulesText = understanding.mainModules
    .map((m) => `- ${m.name}: ${m.description}`)
    .join("\n");

  const featuresText = understanding.keyFeatures
    .map((f) => `- ${f}`)
    .join("\n");

  const contentRule =
    audience === "PM"
      ? `Write 2-3 CONCISE paragraphs for the PM audience. Cover key features, project scope, and milestones briefly, in a practical business-focused tone. Use plain text, no markdown.`
      : `Write 3-5 paragraphs tailored to the ${audience} perspective. Use plain text, no markdown.`;

  return [
    `You are a software architecture analyst. Explain this project for a ${audience}.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `URL: ${repository.url}`,
    ``,
    `Technical Facts:`,
    `- Language: ${technicalFacts.language}`,
    `- Framework: ${technicalFacts.framework}`,
    `- Deployment: ${technicalFacts.deployment}`,
    ``,
    `Project Understanding:`,
    `- Purpose: ${understanding.purpose}`,
    `- Architecture: ${understanding.architectureSummary}`,
    `- Tech Stack Details: ${understanding.techStackDetails}`,
    `- Data Flow: ${understanding.dataFlow}`,
    ``,
    `Key Features:`,
    featuresText,
    ``,
    `Main Modules:`,
    modulesText,
    ``,
    `Audience-specific guidance:`,
    audienceGuidance[audience],
    ``,
    `Output format (IMPORTANT):`,
    `1. First, write the explanation content as plain text paragraphs. ${contentRule}`,
    `2. Then, on its own line, write exactly: ---DIAGRAM---`,
    `3. After that line, write ONLY the Mermaid diagram (no extra text).`,
    ``,
    `Mermaid diagram rules:`,
    `- Use "graph TD" for the diagram type.`,
    `- Keep it simple (5-10 nodes max).`,
    `- Use --> for arrows, node labels in brackets like Node[Label].`,
    `- CRITICAL: Node labels must contain ONLY letters, numbers, and spaces. Do NOT use parentheses (), brackets [], braces {}, quotes, or the # character inside node labels.`,
    `- Example:`,
    `  graph TD`,
    `      A[Client] --> B[API Server]`,
    `      B --> C[Database]`,
    `- Do NOT use ->> or -->> arrows.`,
    `- Do not add markdown formatting or any text after the diagram.`,
  ].join("\n");
}

/**
 * A stricter prompt used on retry when the first attempt produced invalid
 * output. Emphasizes the exact Mermaid constraints and asks for a minimal,
 * safe diagram.
 */
function buildRepairPrompt(
  profile: ProjectProfile,
  audience: Audience
): string {
  const { repository, understanding } = profile;

  const modulesText = understanding.mainModules
    .map((m) => `- ${m.name}`)
    .join("\n");

  return [
    `Your previous response was invalid. Try again, and be extremely careful about Mermaid syntax.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `Audience: ${audience}`,
    `Main modules:`,
    modulesText,
    ``,
    `Respond with ONLY a JSON object:`,
    `{ "content": string, "diagram": string }`,
    ``,
    `STRICT RULES:`,
    `1. content: 3-5 paragraphs of plain text (no markdown) tailored to the ${audience}.`,
    `2. diagram: A valid Mermaid "graph TD" diagram with 4-8 nodes.`,
    `3. Node labels MUST be alphanumeric words only. NO parentheses, NO brackets, NO quotes, NO special characters inside labels.`,
    `4. Use only --> arrows. Never use ->> or -->>.`,
    `5. Output raw JSON only — no markdown fences, no commentary.`,
    ``,
    `Correct example:`,
    `{"content":"This project...","diagram":"graph TD\\nA[Client] --> B[Router]\\nB --> C[Handler]\\nC --> D[Database]"}`,
  ].join("\n");
}