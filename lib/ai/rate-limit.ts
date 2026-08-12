/**
 * Rate-limit error handling for Groq (OpenAI-compatible) API calls.
 *
 * When the API returns a 429 (Too Many Requests), the OpenAI SDK throws an
 * `OpenAI.APIError` with `status: 429` and a `Retry-After` header.
 * This module provides typed detection and extraction helpers.
 */

export class RateLimitError extends Error {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `Rate limit hit. Try again in ${formatRetryTime(retryAfterSeconds)}.`
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function formatRetryTime(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${m}m ${s}s`;
}

/**
 * Returns `true` if the given error is an OpenAI API 429 rate-limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // The OpenAI SDK's APIError has `status` as a number and optional `headers`.
  const err = error as Record<string, unknown>;
  return err.status === 429;
}

/**
 * Extracts the `Retry-After` header value in seconds.
 * Falls back to 30 seconds if the header is missing or unparseable.
 */
export function getRetryAfterSeconds(error: unknown): number {
  if (!error || typeof error !== "object") return 30;

  const err = error as Record<string, unknown>;
  const headers = err.headers as unknown;

  // Case 1: `headers` is a fetch `Headers` instance (OpenAI SDK v4+).
  if (headers instanceof Headers) {
    const retryAfter = headers.get("retry-after");
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // Groq-specific: `x-ratelimit-reset-tokens` is a Unix timestamp (ms).
    const resetTokens = headers.get("x-ratelimit-reset-tokens");
    if (resetTokens) {
      const resetMs = parseInt(resetTokens, 10);
      if (!isNaN(resetMs) && resetMs > 0) {
        const seconds = Math.ceil((resetMs - Date.now()) / 1000);
        if (seconds > 0) return seconds;
      }
    }

    // Groq-specific: `x-ratelimit-remaining-tokens` + `x-ratelimit-limit-tokens`
    // can be used to estimate, but `reset-tokens` is more accurate.
    const resetRequests = headers.get("x-ratelimit-reset-requests");
    if (resetRequests) {
      const resetMs = parseInt(resetRequests, 10);
      if (!isNaN(resetMs) && resetMs > 0) {
        const seconds = Math.ceil((resetMs - Date.now()) / 1000);
        if (seconds > 0) return seconds;
      }
    }
  }

  // Case 2: `headers` is a plain object (older SDK or test mocks).
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, unknown>;

    if (typeof h["retry-after"] === "string") {
      const parsed = parseInt(h["retry-after"], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    if (typeof h["retry-after"] === "number") {
      const val = h["retry-after"] as number;
      if (val > 0) return Math.ceil(val);
    }

    // Groq-specific plain-object headers
    if (typeof h["x-ratelimit-reset-tokens"] === "string") {
      const resetMs = parseInt(h["x-ratelimit-reset-tokens"], 10);
      if (!isNaN(resetMs) && resetMs > 0) {
        const seconds = Math.ceil((resetMs - Date.now()) / 1000);
        if (seconds > 0) return seconds;
      }
    }
  }

  // Case 3: error body may contain `retry_after` or `retryAfter` (OpenAI style).
  const body = err.body as Record<string, unknown> | undefined;
  if (body) {
    const retryAfter = body.retry_after ?? body.retryAfter;
    if (typeof retryAfter === "number" && retryAfter > 0) {
      return Math.ceil(retryAfter);
    }
    if (typeof retryAfter === "string") {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  return 30; // sensible default
}