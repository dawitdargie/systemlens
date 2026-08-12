import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateUnderstanding } from "./generate-understanding";
import type { GenerateUnderstandingInput } from "./generate-understanding";

const mockCreate = vi.fn();

vi.mock("./ai-client", () => ({
  getAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
  getAIModel: () => "meta/llama-3.3-70b-instruct",
}));

vi.mock("@/lib/env", () => ({
  getEnvVar: () => "fake-key",
}));

const mockRepo = {
  name: "gin",
  owner: "gin-gonic",
  url: "https://github.com/gin-gonic/gin",
  defaultBranch: "master",
};

const mockTechFacts = {
  language: "Go",
  framework: "Gin",
  deployment: "Docker",
};

const README_CONTENT = `# Gin

Gin is a web framework written in Go.`;

const ENTRY_CONTENT = `package main

import "github.com/gin-gonic/gin"

func main() {
  r := gin.Default()
  r.Run()
}`;

const VALID_JSON = JSON.stringify({
  purpose: "Gin is a web framework for Go.",
  mainModules: [
    { name: "Routing", description: "HTTP routing." },
    { name: "Middleware", description: "Middleware support." },
  ],
  architectureSummary: "Layered HTTP framework.",
  keyFeatures: ["Fast", "Middleware", "JSON validation"],
  techStackDetails: "Go with Gin for HTTP routing.",
  dataFlow: "Request -> Router -> Handler -> Response.",
});

describe("generateUnderstanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed understanding from valid JSON", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_JSON } }],
    });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: README_CONTENT,
      entryPointContent: ENTRY_CONTENT,
    };

    const result = await generateUnderstanding(input);

    expect(result.purpose).toBe("Gin is a web framework for Go.");
    expect(result.mainModules).toHaveLength(2);
    expect(result.mainModules[0].name).toBe("Routing");
    expect(result.architectureSummary).toBe("Layered HTTP framework.");
    expect(result.keyFeatures).toContain("Fast");
    expect(result.techStackDetails).toBe("Go with Gin for HTTP routing.");
    expect(result.dataFlow).toBe("Request -> Router -> Handler -> Response.");
    // Single attempt when first response is valid
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws on empty response text after retries", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: null,
      entryPointContent: null,
    };

    await expect(generateUnderstanding(input)).rejects.toThrow(
      "Unable to generate project understanding."
    );
    // Retries once before giving up
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws on invalid JSON response after retries", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: null,
      entryPointContent: null,
    };

    await expect(generateUnderstanding(input)).rejects.toThrow(
      "Unable to generate project understanding."
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("retries and succeeds on second attempt after invalid first attempt", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "not json" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: VALID_JSON } }] });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: null,
      entryPointContent: null,
    };

    const result = await generateUnderstanding(input);
    expect(result.purpose).toBe("Gin is a web framework for Go.");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws on missing required fields after retries", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ purpose: "" }) } }],
    });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: null,
      entryPointContent: null,
    };

    await expect(generateUnderstanding(input)).rejects.toThrow(
      "Unable to generate project understanding."
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("works without README and entry point", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: VALID_JSON } }],
    });

    const input: GenerateUnderstandingInput = {
      repository: mockRepo,
      technicalFacts: mockTechFacts,
      readmeContent: null,
      entryPointContent: null,
    };

    const result = await generateUnderstanding(input);
    expect(result.purpose).toBeDefined();
  });
});