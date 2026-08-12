import { NextRequest } from "next/server";
import { analyzeRepository } from "@/lib/github/analyze-repository";
import { GitHubError } from "@/lib/github";
import { RateLimitError } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryUrl } = body;

    if (!repositoryUrl || typeof repositoryUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub repository URL." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a stream for real-time progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "progress", step }) + "\n")
          );
        };

        // Hard 60s timeout on the entire analysis
        const timeout = setTimeout(() => {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: "Analysis timed out after 60 seconds. The repository may be too large or the AI service is slow. Try again later.",
              }) + "\n"
            )
          );
          controller.close();
        }, 60000);

        try {
          const result = await analyzeRepository(repositoryUrl, sendProgress);
          clearTimeout(timeout);

          // Send the final result
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "result", data: result }) + "\n"
            )
          );
        } catch (error) {
          clearTimeout(timeout);

          // Rate-limit: include retryAfterSeconds so the client can show a
          // countdown timer.
          if (error instanceof RateLimitError) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "error",
                  error: error.message,
                  retryAfterSeconds: error.retryAfterSeconds,
                }) + "\n"
              )
            );
          } else {
            const message =
              error instanceof GitHubError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Unable to analyze repository.";

            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "error", error: message }) + "\n"
              )
            );
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Invalid request body."
        : error instanceof Error
          ? error.message
          : "Unable to analyze repository.";

    console.error("Analyze route unexpected error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}