import { NextRequest } from "next/server";
import { streamExplanation, RateLimitError } from "@/lib/ai";
import {
  getCachedExplanation,
  cacheExplanation,
  pruneExpired,
} from "@/lib/ai";
import { Audience, ProjectProfile } from "@/types";

const VALID_AUDIENCES: Audience[] = [
  "CEO",
  "PM",
  "Developer",
  "QA",
  "Customer",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectProfile, audience } = body;

    if (!projectProfile || !audience) {
      return new Response(
        JSON.stringify({ error: "Invalid request." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!VALID_AUDIENCES.includes(audience)) {
      return new Response(
        JSON.stringify({ error: "Unsupported audience." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    pruneExpired();

    // If already cached, return instantly as a single JSON response.
    const cached = getCachedExplanation(projectProfile, audience);
    if (cached) {
      return new Response(
        JSON.stringify({
          explanation: cached.content,
          diagram: cached.diagram,
          cached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: object) => {
          controller.enqueue(
            encoder.encode(JSON.stringify(event) + "\n")
          );
        };

        // Lazy generation: only generate the requested audience. Other
        // audiences are generated on demand when clicked, avoiding 4
        // unnecessary AI calls per request.
        try {
          const result = await streamExplanation(
            { projectProfile, audience },
            (chunk) => {
              send({ type: "chunk", content: chunk });
            }
          );
          cacheExplanation(projectProfile, audience, result);
          send({ type: "diagram", diagram: result.diagram });
          send({ type: "done" });
        } catch (error) {
          if (error instanceof RateLimitError) {
            send({ type: "error", error: error.message, retryAfterSeconds: error.retryAfterSeconds });
          } else {
            const message =
              error instanceof Error ? error.message : "Unable to generate explanation.";
            send({ type: "error", error: message });
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
          : "Unable to generate explanation.";
    console.error("Explain route error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}