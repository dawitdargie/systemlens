import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectProfile } from "@/types";

// Import modules to be mocked first
import { fetchRepository } from "./fetch-repository";
import { fetchRepositoryTree } from "./fetch-tree";
import { fetchFileContent } from "./fetch-file";
import { analyzeTechnicalFacts } from "@/lib/analyzer";
import { generateUnderstanding } from "@/lib/ai";
import { buildProfile } from "@/lib/profile";

// Now set up mocks (these calls are hoisted)
vi.mock("./fetch-repository", () => ({ fetchRepository: vi.fn() }));
vi.mock("./fetch-tree", () => ({ fetchRepositoryTree: vi.fn() }));
vi.mock("./fetch-file", () => ({ fetchFileContent: vi.fn() }));
vi.mock("@/lib/analyzer", () => ({ analyzeTechnicalFacts: vi.fn() }));
vi.mock("@/lib/ai", () => ({ generateUnderstanding: vi.fn() }));
vi.mock("@/lib/profile", () => ({ buildProfile: vi.fn() }));
vi.mock("@/lib/cache/analysis-cache", () => ({
  getCachedAnalysis: vi.fn(() => null),
  setCachedAnalysis: vi.fn(),
}));

// Get typed references to the mocked functions
const mockFetchRepository = vi.mocked(fetchRepository);
const mockFetchRepositoryTree = vi.mocked(fetchRepositoryTree);
const mockFetchFileContent = vi.mocked(fetchFileContent);
const mockAnalyzeTechnicalFacts = vi.mocked(analyzeTechnicalFacts);
const mockGenerateUnderstanding = vi.mocked(generateUnderstanding);
const mockBuildProfile = vi.mocked(buildProfile);

// Now import the module under test
import { analyzeRepository } from "./analyze-repository";

const mockRepo = {
  name: "gin",
  owner: "gin-gonic",
  url: "https://github.com/gin-gonic/gin",
  defaultBranch: "master",
};

const mockTree = [
  { path: "README.md", type: "blob" as const, size: 5000 },
  { path: "go.mod", type: "blob" as const, size: 200 },
  { path: "Dockerfile", type: "blob" as const, size: 800 },
  { path: "main.go", type: "blob" as const, size: 3000 },
];

const mockTechFacts = {
  language: "Go",
  framework: "Gin",
  deployment: "Docker",
};

const mockUnderstanding = {
  purpose: "Gin is a web framework for Go.",
  mainModules: [{ name: "Routing", description: "HTTP routing." }],
  architectureSummary: "Layered HTTP framework.",
  keyFeatures: ["Fast", "Middleware"],
  techStackDetails: "Go with Gin for HTTP routing.",
  dataFlow: "Request -> Router -> Handler -> Response.",
};

const mockProfile: ProjectProfile = {
  repository: mockRepo,
  technicalFacts: mockTechFacts,
  understanding: mockUnderstanding,
};

beforeEach(() => {
  mockFetchRepository.mockReset();
  mockFetchRepositoryTree.mockReset();
  mockFetchFileContent.mockReset();
  mockAnalyzeTechnicalFacts.mockReset();
  mockGenerateUnderstanding.mockReset();
  mockBuildProfile.mockReset();
});

describe("analyzeRepository", () => {
  it("returns complete ProjectProfile for a valid URL", async () => {
    mockFetchRepository.mockResolvedValue(mockRepo);
    mockFetchRepositoryTree.mockResolvedValue(mockTree);
    mockAnalyzeTechnicalFacts.mockResolvedValue(mockTechFacts);
    mockFetchFileContent.mockResolvedValue("file content");
    mockGenerateUnderstanding.mockResolvedValue(mockUnderstanding);
    mockBuildProfile.mockReturnValue(mockProfile);

    const result = await analyzeRepository("https://github.com/gin-gonic/gin");

    expect(result).toEqual(mockProfile);
    expect(mockFetchRepository).toHaveBeenCalledWith("gin-gonic", "gin");
    // Tree is fetched in parallel with repo metadata using "HEAD" first
    expect(mockFetchRepositoryTree).toHaveBeenCalledWith("gin-gonic", "gin", "HEAD");
    expect(mockAnalyzeTechnicalFacts).toHaveBeenCalled();
    expect(mockGenerateUnderstanding).toHaveBeenCalled();
    expect(mockBuildProfile).toHaveBeenCalledWith(mockRepo, mockTechFacts, mockUnderstanding);
  });

  it("throws on invalid URL", async () => {
    await expect(analyzeRepository("not-a-url")).rejects.toThrow(
      "Invalid GitHub repository URL."
    );
  });

  it("propagates errors from fetchRepository", async () => {
    mockFetchRepository.mockRejectedValue(
      new Error("Repository not found.")
    );
    // Tree fetch is also called in parallel; it must resolve (or reject)
    // so the Promise.all doesn't fail on undefined.
    mockFetchRepositoryTree.mockResolvedValue([]);

    await expect(
      analyzeRepository("https://github.com/owner/nonexistent")
    ).rejects.toThrow("Repository not found.");
  });

  it("throws when AI understanding generation fails", async () => {
    const fallbackTechFacts = {
      language: "Unknown",
      framework: "Unknown",
      deployment: "None",
    };

    mockFetchRepository.mockResolvedValue({
      name: "repo",
      owner: "owner",
      url: "https://github.com/owner/repo",
      defaultBranch: "main",
    });
    mockFetchRepositoryTree.mockResolvedValue([
      { path: "random.txt", type: "blob" as const, size: 100 },
    ]);
    mockAnalyzeTechnicalFacts.mockResolvedValue(fallbackTechFacts);
    mockGenerateUnderstanding.mockRejectedValue(new Error("AI failed"));

    await expect(
      analyzeRepository("https://github.com/owner/repo")
    ).rejects.toThrow("AI project understanding failed: AI failed");
  });

  it("fetches README and entry point when available", async () => {
    const testRepo = {
      name: "repo",
      owner: "owner",
      url: "https://github.com/owner/repo",
      defaultBranch: "main",
    };

    const testTechFacts = {
      language: "Go",
      framework: "Unknown",
      deployment: "None",
    };

    const testUnderstanding = {
      purpose: "A Go project.",
      mainModules: [],
      architectureSummary: "N/A",
      keyFeatures: [],
      techStackDetails: "N/A",
      dataFlow: "N/A",
    };

    mockFetchRepository.mockResolvedValue(testRepo);
    mockFetchRepositoryTree.mockResolvedValue([
      { path: "README.md", type: "blob" as const, size: 5000 },
      { path: "main.go", type: "blob" as const, size: 3000 },
    ]);
    mockAnalyzeTechnicalFacts.mockResolvedValue(testTechFacts);
    mockFetchFileContent.mockResolvedValue("file content");
    mockGenerateUnderstanding.mockResolvedValue(testUnderstanding);
    mockBuildProfile.mockReturnValue({
      repository: testRepo,
      technicalFacts: testTechFacts,
      understanding: testUnderstanding,
    } as ProjectProfile);

    const result = await analyzeRepository("https://github.com/owner/repo");

    // All important files are fetched in parallel upfront
    expect(mockFetchFileContent).toHaveBeenCalledWith("owner", "repo", "README.md", "main");
    expect(mockFetchFileContent).toHaveBeenCalledWith("owner", "repo", "main.go", "main");
    expect(mockGenerateUnderstanding).toHaveBeenCalledWith({
      repository: testRepo,
      technicalFacts: testTechFacts,
      readmeContent: "file content",
      entryPointContent: "file content",
    });
    expect(result.understanding.purpose).toBe("A Go project.");
  });
});