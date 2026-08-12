export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

export const AIErrors = {
  NO_API_KEY: () => new AIError("AI API key is not configured."),
  GENERATION_FAILED: () =>
    new AIError("Unable to generate project understanding."),
  INVALID_RESPONSE: () =>
    new AIError("Received invalid response from AI."),
  DIAGRAM_FALLBACK: () =>
    new AIError(
      "AI diagram was invalid after retries; a simplified fallback diagram was used."
    ),
} as const;