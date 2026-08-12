import OpenAI from "openai";
import { getEnvVar } from "@/lib/env";

let client: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (!client) {
    // Use Groq for significantly faster inference while keeping 70B quality.
    // Override provider via AI_BASE_URL / AI_API_KEY env vars if needed.
    const apiKey = process.env.AI_API_KEY || getEnvVar("GROQ_API_KEY");
    const baseURL =
      process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
    client = new OpenAI({
      baseURL,
      apiKey,
    });
  }
  return client;
}

/**
 * Returns the AI model to use for completions.
 * Configurable via the AI_MODEL env var; defaults to llama-3.3-70b-versatile
 * on Groq, which is dramatically faster than the generic 70B on NVIDIA while
 * keeping comparable quality for structured JSON + Mermaid.
 */
export function getAIModel(): string {
  return process.env.AI_MODEL || "llama-3.3-70b-versatile";
}
