import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/github/analyze-repository";
import { GitHubError } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryUrl } = body;

    if (!repositoryUrl || typeof repositoryUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL." },
        { status: 400 }
      );
    }

    const result = await analyzeRepository(repositoryUrl);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GitHubError) {
      const status = error.message.includes("not found")
        ? 404
        : error.message.includes("Invalid")
          ? 400
          : 500;

      return NextResponse.json({ error: error.message }, { status });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unable to analyze repository.";
    console.error("Analyze route unexpected error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}