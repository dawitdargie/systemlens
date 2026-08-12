import { ProjectProfile } from "@/types";
import type { TreeItem } from "@/lib/github";
import { getAIClient, getAIModel } from "./ai-client";
import { AIError } from "./errors";
import { RateLimitError, isRateLimitError, getRetryAfterSeconds } from "./rate-limit";

export interface ChooseFilesInput {
  question: string;
  projectProfile: ProjectProfile;
  fileTree: TreeItem[];
}

export interface ChooseFilesResult {
  needsFiles: boolean;
  filePaths: string[];
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_FILES = 5;
const MAX_TREE_PATHS = 200;

/**
 * Asks the AI whether specific source files are needed to answer the user's
 * question and, if so, which file paths to fetch.
 *
 * This is a fast, non-streaming call because the output is tiny (a JSON object
 * with 0-5 file paths). On any failure it returns a graceful fallback so the
 * chat can still answer without code context.
 */
export async function chooseFiles(
  input: ChooseFilesInput
): Promise<ChooseFilesResult> {
  const client = getAIClient();
  const model = getAIModel();
  const prompt = buildPrompt(input);

  console.time("chooseFiles");

  // AbortController actually cancels the underlying HTTP request on
  // timeout, rather than leaving it hanging in the background.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        top_p: 1,
        max_tokens: 512,
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

    const result = parseChooseFilesJson(text);
    console.timeEnd("chooseFiles");
    return result;
  } catch (error) {
    clearTimeout(timeout);
    console.timeEnd("chooseFiles");

    // Rate limits should NOT be silently swallowed — propagate them
    // so the route can show the user a retry countdown.
    if (isRateLimitError(error)) {
      throw new RateLimitError(getRetryAfterSeconds(error));
    }

    console.error(
      "[chooseFiles] Failed, falling back to no-code answer:",
      error instanceof Error ? error.message : error
    );
    // Graceful fallback: answer without code context
    return { needsFiles: false, filePaths: [] };
  }
}

/**
 * Parse and validate the AI's JSON response.
 * Strips markdown code fences if present.
 */
function parseChooseFilesJson(text: string): ChooseFilesResult {
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<ChooseFilesResult>;

  const needsFiles = Boolean(parsed.needsFiles);
  const filePaths = Array.isArray(parsed.filePaths)
    ? parsed.filePaths
        .filter((p): p is string => typeof p === "string" && p.length > 0)
        .slice(0, MAX_FILES)
    : [];

  return { needsFiles, filePaths };
}

/**
 * Builds the prompt for file selection.
 * Truncates the file tree to keep the prompt small.
 */
function buildPrompt(input: ChooseFilesInput): string {
  const { question, projectProfile, fileTree } = input;
  const { repository, understanding } = projectProfile;

  // Truncate tree to keep prompt small - sort by size ascending to prefer
  // smaller (more likely source) files, then take the first MAX_TREE_PATHS.
  const paths = fileTree
    .slice()
    .sort((a, b) => a.size - b.size)
    .slice(0, MAX_TREE_PATHS)
    .map((item) => item.path);

  const treeText =
    paths.length > 0
      ? paths.join("\n")
      : "(no files available)";

  const modulesText = understanding.mainModules
    .map((m) => `- ${m.name}: ${m.description}`)
    .join("\n");

  const lines = [
    `You are a code analysis assistant. Determine if specific source files are needed to answer a question about a repository.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `URL: ${repository.url}`,
    ``,
    `Project Purpose: ${understanding.purpose}`,
    `Architecture: ${understanding.architectureSummary}`,
    ``,
    `Main Modules:`,
    modulesText,
    ``,
    `Available files (showing ${paths.length} of ${fileTree.length}):`,
    treeText,
    ``,
    `Question: ${question}`,
    ``,
    `Respond with ONLY a JSON object matching this exact shape:`,
    `{`,
    `  "needsFiles": boolean,`,
    `  "filePaths": string[]`,
    `}`,
    ``,
    `Rules:`,
    `- needsFiles: true if the question is about specific code, implementation details, or how something works internally.`,
    `- needsFiles: false if the question can be answered from the project profile alone (purpose, architecture, features, tech stack).`,
    `- filePaths: Select at most ${MAX_FILES} files directly relevant to the question.`,
    `- Only select files that exist in the available files list above.`,
    `- Prefer source files (.ts, .js, .go, .py, .java, etc.) over config or documentation files.`,
    `- If needsFiles is false, return an empty filePaths array.`,
    `- Do not add markdown formatting or explanations. Output raw JSON only.`,
  ];

  return lines.join("\n");
}
