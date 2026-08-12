import { ProjectProfile, Audience, ChatMessage } from "@/types";
import { getAIClient, getAIModel } from "./ai-client";
import { AIError } from "./errors";
import { RateLimitError, isRateLimitError, getRetryAfterSeconds } from "./rate-limit";

export interface CodeFile {
  path: string;
  content: string;
}

export interface AnswerChatInput {
  question: string;
  projectProfile: ProjectProfile;
  audience: Audience;
  history: ChatMessage[];
  codeContext?: CodeFile[];
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_FILE_CONTENT_CHARS = 4000;
const MAX_CODE_FILES = 3;

/**
 * Streaming variant of answerQuestion.
 *
 * Uses the OpenAI messages array (system + history + user) and streams the
 * response. The onChunk callback is invoked with each text chunk as it arrives
 * so the client can display text immediately.
 *
 * Returns the full answer text.
 */
export async function streamAnswer(
  input: AnswerChatInput,
  onChunk: (chunk: string) => void,
  onTruncated?: () => void
): Promise<string> {
  const client = getAIClient();
  const model = getAIModel();
  const messages = buildMessages(input);

  console.time("streamAnswer");

  // No Promise.race here: with streaming, create() resolves when the first
  // token arrives. The route guards the pre-answer phase separately, and we
  // deliberately let the stream run to completion so a long answer is never
  // cut off mid-stream.
  let response;
  try {
    response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 32768,
      stream: true,
    });
  } catch (error) {
    // Convert 429 rate-limit errors to RateLimitError so the route can
    // emit retryAfterSeconds and the client can show a countdown.
    if (isRateLimitError(error)) {
      throw new RateLimitError(getRetryAfterSeconds(error));
    }
    throw error;
  }

  let fullText = "";
  let hitTokenLimit = false;

  for await (const chunk of response) {
    const finishReason = chunk.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      hitTokenLimit = true;
    }

    const delta = chunk.choices?.[0]?.delta?.content;
    if (!delta) continue;

    fullText += delta;
    onChunk(delta);
  }

  if (hitTokenLimit && onTruncated) {
    onTruncated();
  }

  console.timeEnd("streamAnswer");
  return fullText || "I was unable to generate an answer. Please try again.";
}

/**
 * Non-streaming variant of answerQuestion.
 *
 * Used for tests and as a fallback. Returns the full answer text.
 */
export async function answerQuestion(
  input: AnswerChatInput
): Promise<string> {
  const client = getAIClient();
  const model = getAIModel();
  const messages = buildMessages(input);

  console.time("answerQuestion");

  // AbortController actually cancels the underlying HTTP request on
  // timeout, rather than leaving it hanging in the background.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 32768,
        stream: false,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text = response.choices[0]?.message?.content?.trim();
    console.timeEnd("answerQuestion");

    if (!text) {
      throw new Error("Empty response from AI.");
    }

    return text;
  } catch (error) {
    clearTimeout(timeout);

    if (controller.signal.aborted) {
      console.timeEnd("answerQuestion");
      throw new AIError(
        `answerQuestion timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`
      );
    }

    if (isRateLimitError(error)) {
      throw new RateLimitError(getRetryAfterSeconds(error));
    }

    throw error;
  }
}

/**
 * Builds the OpenAI messages array for the chat completion.
 *
 * Structure:
 *   1. System message (project context + audience + code context)
 *   2. Conversation history (capped to last MAX_HISTORY_MESSAGES)
 *   3. User question
 */
export function buildMessages(input: AnswerChatInput): Array<{
  role: "system" | "user" | "assistant";
  content: string;
}> {
  const systemContent = buildSystemPrompt(input);
  const history = capHistory(input.history);

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemContent }];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: input.question });

  return messages;
}

/**
 * Caps conversation history to the last MAX_HISTORY_MESSAGES entries
 * to prevent context window overflow.
 */
export function capHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }
  return history.slice(-MAX_HISTORY_MESSAGES);
}

/**
 * Builds the system prompt containing project context, audience guidance,
 * and optional code context.
 */
export function buildSystemPrompt(input: AnswerChatInput): string {
  const { projectProfile, audience, codeContext } = input;
  const { repository, technicalFacts, understanding } = projectProfile;

  const modulesText = understanding.mainModules
    .map((m) => `- ${m.name}: ${m.description}`)
    .join("\n");

  const featuresText = understanding.keyFeatures
    .map((f) => `- ${f}`)
    .join("\n");

  const lines = [
    `You are a software architecture assistant helping a ${audience} understand a project.`,
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
  ];

  if (codeContext && codeContext.length > 0) {
    const files = codeContext.slice(0, MAX_CODE_FILES);
    lines.push(`Relevant Source Files:`);
    for (const file of files) {
      const truncated =
        file.content.length > MAX_FILE_CONTENT_CHARS
          ? file.content.slice(0, MAX_FILE_CONTENT_CHARS) +
            "\n... (truncated)"
          : file.content;
      lines.push(`--- ${file.path} ---`, truncated, `--- end ${file.path} ---`, ``);
    }
  }

  lines.push(
    `Instructions:`,
    `- Answer clearly and concisely for a ${audience}.`,
    `- Reference specific files when discussing code.`,
    `- If you don't know something, say so honestly.`,
    `- When explaining code, wrap code snippets in triple backticks (\`\`\`). Keep prose as plain text.`,
    `- Keep answers focused and relevant to the question.`
  );

  return lines.join("\n");
}
