import { ProjectUnderstanding, Repository, TechnicalFacts } from "@/types";
import { getAIClient, getAIModel } from "./ai-client";
import { AIError, AIErrors } from "./errors";
import { RateLimitError, isRateLimitError, getRetryAfterSeconds } from "./rate-limit";

export interface GenerateUnderstandingInput {
  repository: Repository;
  technicalFacts: TechnicalFacts;
  readmeContent: string | null;
  entryPointContent: string | null;
}

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 50_000;

export async function generateUnderstanding(
  input: GenerateUnderstandingInput
): Promise<ProjectUnderstanding> {
  const client = getAIClient();
  const model = getAIModel();
  const { repository, technicalFacts, readmeContent, entryPointContent } =
    input;

  const prompt = buildPrompt({
    repository,
    technicalFacts,
    readmeContent,
    entryPointContent,
  });

  console.time("generateUnderstanding");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // AbortController actually cancels the underlying HTTP request on
    // timeout, rather than leaving it hanging in the background.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 1,
          top_p: 1,
          max_tokens: 4096,
          stream: false,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("Empty response from AI.");
      }

      const parsed = parseUnderstandingJson(text);

      clearTimeout(timeout);
      console.timeEnd("generateUnderstanding");
      return parsed;
    } catch (error) {
      clearTimeout(timeout);

      if (controller.signal.aborted) {
        // Timeouts — don't retry, surface immediately.
        console.timeEnd("generateUnderstanding");
        throw new AIError(
          `AI request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
        );
      }

      // If rate limited, throw immediately — don't retry (hitting the same
      // endpoint again would just waste quota and time).
      if (isRateLimitError(error)) {
        clearTimeout(timeout);
        console.timeEnd("generateUnderstanding");
        throw new RateLimitError(getRetryAfterSeconds(error));
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Log and retry for non-rate-limit failures (JSON parse, validation, etc.)
      console.error(
        `[generateUnderstanding] Attempt ${attempt} failed: ${lastError.message}`
      );
    }
  }

  console.error(
    "[generateUnderstanding] AI project understanding failed after all retries:",
    lastError
  );
  console.timeEnd("generateUnderstanding");
  throw AIErrors.GENERATION_FAILED();
}

/**
 * Parse and validate the AI's JSON response into a ProjectUnderstanding.
 * Strips markdown code fences if present and validates required fields.
 */
function parseUnderstandingJson(text: string): ProjectUnderstanding {
  // Strip markdown code fences if the AI wraps the JSON in ```json ... ```
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<ProjectUnderstanding>;

  if (
    !parsed.purpose ||
    !Array.isArray(parsed.mainModules) ||
    !parsed.architectureSummary ||
    !Array.isArray(parsed.keyFeatures) ||
    !parsed.techStackDetails ||
    !parsed.dataFlow
  ) {
    throw AIErrors.INVALID_RESPONSE();
  }

  return {
    purpose: parsed.purpose,
    mainModules: parsed.mainModules.map((m) => ({
      name: m.name || "Unknown",
      description: m.description || "",
    })),
    architectureSummary: parsed.architectureSummary,
    keyFeatures: parsed.keyFeatures,
    techStackDetails: parsed.techStackDetails,
    dataFlow: parsed.dataFlow,
  };
}

function buildPrompt(input: GenerateUnderstandingInput): string {
  const { repository, technicalFacts, readmeContent, entryPointContent } =
    input;

  const lines = [
    `You are a software architecture analyst. Analyze the following GitHub repository and respond with structured JSON.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `URL: ${repository.url}`,
    `Default Branch: ${repository.defaultBranch}`,
    ``,
    `Detected Technical Facts:`,
    `- Language: ${technicalFacts.language}`,
    `- Framework: ${technicalFacts.framework}`,
    `- Deployment: ${technicalFacts.deployment}`,
    ``,
  ];

  if (readmeContent) {
    const truncated = readmeContent.length > 1500
      ? readmeContent.slice(0, 1500) + "\n... (truncated)"
      : readmeContent;
    lines.push(`README.md content:`, truncated, "");
  }

  if (entryPointContent) {
    const truncated = entryPointContent.length > 800
      ? entryPointContent.slice(0, 800) + "\n... (truncated)"
      : entryPointContent;
    lines.push(`Entry point file content:`, truncated, "");
  }

  lines.push(
    `Respond with ONLY a JSON object matching this exact shape:`,
    `{`,
    `  "purpose": string,`,
    `  "mainModules": [ { "name": string, "description": string } ],`,
    `  "architectureSummary": string,`,
    `  "keyFeatures": string[],`,
    `  "techStackDetails": string,`,
    `  "dataFlow": string`,
    `}`,
    ``,
    `Rules:`,
    `- purpose: 2-3 sentences explaining what this project does.`,
    `- mainModules: array of 3-5 key modules/components. Each must have a name and a 1-sentence description.`,
    `- architectureSummary: 3-5 sentences describing the architecture pattern, layer organization, and key design decisions.`,
    `- keyFeatures: array of 3-6 main capabilities or features.`,
    `- techStackDetails: 1-2 sentences explaining how the detected tech stack is used in this project.`,
    `- dataFlow: 2-4 sentences describing how data enters, moves through, and exits the system, including key transformations.`,
    `- Do not add markdown formatting or explanations. Output raw JSON only.`,
  );

  return lines.join("\n");
}