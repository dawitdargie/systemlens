import { describe, it, expect, vi, beforeEach } from "vitest";
import { chooseFiles } from "./choose-files";
import type { ChooseFilesInput } from "./choose-files";
import type { ProjectProfile } from "@/types";
import type { TreeItem } from "@/lib/github";

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
    purpose: "HTTP web framework",
    mainModules: [
      { name: "Routing", description: "HTTP routing" },
      { name: "Middleware", description: "Middleware support" },
    ],
    architectureSummary: "Layered HTTP framework",
    keyFeatures: ["Fast", "Middleware"],
    techStackDetails: "Go with Gin",
    dataFlow: "Request -> Router -> Handler -> Response",
  },
};

const mockTree: TreeItem[] = [
  { path: "main.go", type: "blob", size: 1000 },
  { path: "router.go", type: "blob", size: 2000 },
  { path: "middleware.go", type: "blob", size: 1500 },
  { path: "README.md", type: "blob", size: 5000 },
  { path: "go.mod", type: "blob", size: 100 },
];

describe("chooseFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns needsFiles=false for general questions", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ needsFiles: false, filePaths: [] }),
          },
        },
      ],
    });

    const input: ChooseFilesInput = {
      question: "What does this project do?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(false);
    expect(result.filePaths).toEqual([]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns needsFiles=true with file paths for code questions", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              needsFiles: true,
              filePaths: ["router.go", "middleware.go"],
            }),
          },
        },
      ],
    });

    const input: ChooseFilesInput = {
      question: "How does the routing work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(true);
    expect(result.filePaths).toEqual(["router.go", "middleware.go"]);
  });

  it("caps file paths at 5 maximum", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              needsFiles: true,
              filePaths: ["a.go", "b.go", "c.go", "d.go", "e.go", "f.go", "g.go"],
            }),
          },
        },
      ],
    });

    const input: ChooseFilesInput = {
      question: "Explain everything",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.filePaths).toHaveLength(5);
  });

  it("returns graceful fallback on AI error", async () => {
    mockCreate.mockRejectedValue(new Error("AI service down"));

    const input: ChooseFilesInput = {
      question: "How does routing work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(false);
    expect(result.filePaths).toEqual([]);
  });

  it("returns graceful fallback on JSON parse error", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not valid json" } }],
    });

    const input: ChooseFilesInput = {
      question: "How does routing work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(false);
    expect(result.filePaths).toEqual([]);
  });

  it("returns graceful fallback on empty response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    const input: ChooseFilesInput = {
      question: "How does routing work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(false);
    expect(result.filePaths).toEqual([]);
  });

  it("filters out non-string file paths", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              needsFiles: true,
              filePaths: ["valid.go", 123, null, "", "also-valid.go"],
            }),
          },
        },
      ],
    });

    const input: ChooseFilesInput = {
      question: "How does routing work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.filePaths).toEqual(["valid.go", "also-valid.go"]);
  });

  it("strips markdown code fences from response", async () => {
    const jsonContent = JSON.stringify({
      needsFiles: true,
      filePaths: ["main.go"],
    });
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "```json\n" + jsonContent + "\n```",
          },
        },
      ],
    });

    const input: ChooseFilesInput = {
      question: "How does the main function work?",
      projectProfile: mockProfile,
      fileTree: mockTree,
    };

    const result = await chooseFiles(input);

    expect(result.needsFiles).toBe(true);
    expect(result.filePaths).toEqual(["main.go"]);
  });
});
