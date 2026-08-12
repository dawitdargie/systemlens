import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateExplanation } from "./generate-explanation";
import type { GenerateExplanationInput } from "./generate-explanation";
import type { ProjectProfile, Audience } from "@/types";

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

const mockProfile: ProjectProfile = {
  repository: {
    name: "gin",
    owner: "gin-gonic",
    url: "https://github.com/gin-gonic/gin",
    defaultBranch: "master",
  },
  technicalFacts: {
    language: "Go",
    framework: "Gin",
    deployment: "Docker",
  },
  understanding: {
    purpose: "Gin is a web framework for Go.",
    mainModules: [
      { name: "Routing", description: "HTTP routing." },
      { name: "Middleware", description: "Middleware support." },
    ],
    architectureSummary: "Layered HTTP framework.",
    keyFeatures: ["Fast", "Middleware", "JSON validation"],
    techStackDetails: "Go with Gin for HTTP routing.",
    dataFlow: "Request -> Router -> Handler -> Response.",
  },
};

const VALID_CONTENT =
  "Gin is a high-performance web framework for Go. It provides a simple API for building HTTP services. The framework is built around a fast router that handles request dispatching. Middleware support allows for cross-cutting concerns like logging and authentication. The framework is production-ready and widely used in the Go community.";

const VALID_DIAGRAM =
  "graph TD\n    A[Client] --> B[Router]\n    B --> C[Middleware]\n    C --> D[Handler]\n    D --> E[Response]";

const VALID_JSON = JSON.stringify({
  content: VALID_CONTENT,
  diagram: VALID_DIAGRAM,
});

// Helper: create a mock response with finish_reason
function mockResponse(content: string, finishReason: string = "stop") {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
  };
}

describe("generateExplanation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed explanation from valid JSON", async () => {
    mockCreate.mockResolvedValue(mockResponse(VALID_JSON));

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);

    expect(result.audience).toBe("Developer");
    expect(result.content).toContain("Gin is a high-performance web framework");
    expect(result.diagram).toContain("graph TD");
    // Single attempt when first response is valid
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("throws on empty response text after retries", async () => {
    mockCreate.mockResolvedValue(mockResponse(""));

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    await expect(generateExplanation(input)).rejects.toThrow(
      /Failed to generate explanation/
    );
    // Retries once before giving up
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws on invalid JSON response after retries", async () => {
    mockCreate.mockResolvedValue(mockResponse("not json"));

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    await expect(generateExplanation(input)).rejects.toThrow(
      /Failed to generate explanation/
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("retries and succeeds on second attempt after invalid first attempt", async () => {
    mockCreate
      .mockResolvedValueOnce(mockResponse("not json"))
      .mockResolvedValueOnce(mockResponse(VALID_JSON));

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);

    expect(result.content).toContain("Gin is a high-performance web framework");
    expect(result.diagram).toContain("graph TD");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns fallback diagram when content is valid but diagram is invalid after retries", async () => {
    // Both attempts return valid content but invalid diagram
    mockCreate.mockResolvedValue(
      mockResponse(
        JSON.stringify({ content: VALID_CONTENT, diagram: "invalid syntax" })
      )
    );

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);

    // Content is preserved
    expect(result.content).toBe(VALID_CONTENT);
    // Diagram is a deterministic fallback built from the profile
    expect(result.diagram).toContain("graph TD");
    expect(result.diagram).toContain("Client Request");
    expect(result.diagram).toContain("Response");
    // Retried once
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("strips markdown code fences from JSON response", async () => {
    mockCreate.mockResolvedValue(
      mockResponse(
        '```json\n{"content":"Explanation.","diagram":"graph TD\\nA-->B"}\n```'
      )
    );

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);
    expect(result.content).toBe("Explanation.");
    expect(result.diagram).toBe("graph TD\nA-->B");
  });

  it("accepts case-insensitive diagram prefixes", async () => {
    mockCreate.mockResolvedValue(
      mockResponse(
        JSON.stringify({
          content: VALID_CONTENT,
          diagram: "FLOWCHART TD\nA-->B",
        })
      )
    );

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);
    expect(result.diagram).toBe("FLOWCHART TD\nA-->B");
  });

  it("sanitizes sequence-diagram arrows in graph diagrams", async () => {
    mockCreate.mockResolvedValue(
      mockResponse(
        JSON.stringify({
          content: VALID_CONTENT,
          diagram: "graph TD\nA[Client] -->> B[Server]",
        })
      )
    );

    const input: GenerateExplanationInput = {
      projectProfile: mockProfile,
      audience: "Developer" as Audience,
    };

    const result = await generateExplanation(input);
    // -->> should be converted to -->
    expect(result.diagram).toContain("-->");
    expect(result.diagram).not.toContain("-->>");
  });

  it("works with different audiences", async () => {
    const audiences: Audience[] = ["CEO", "PM", "Developer", "QA", "Customer"];

    for (const audience of audiences) {
      vi.clearAllMocks();
      mockCreate.mockResolvedValue(mockResponse(VALID_JSON));

      const input: GenerateExplanationInput = {
        projectProfile: mockProfile,
        audience,
      };

      const result = await generateExplanation(input);
      expect(result.audience).toBe(audience);
      expect(result.content).toBeDefined();
      expect(result.diagram).toBeDefined();
    }
  });
});