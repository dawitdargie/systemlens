import { describe, it, expect } from "vitest";
import { buildProfile } from "./build-profile";
import type { ProjectProfile, Repository, TechnicalFacts, ProjectUnderstanding } from "@/types";

const mockRepository: Repository = {
  name: "gin",
  owner: "gin-gonic",
  url: "https://github.com/gin-gonic/gin",
  defaultBranch: "master",
};

const mockTechnicalFacts: TechnicalFacts = {
  language: "Go",
  framework: "Gin",
  deployment: "Docker",
};

const mockUnderstanding: ProjectUnderstanding = {
  purpose: "Gin is a web framework for Go.",
  mainModules: [
    { name: "Routing", description: "HTTP routing." },
  ],
  architectureSummary: "Layered HTTP framework.",
  keyFeatures: ["Fast", "Middleware"],
  techStackDetails: "Go with Gin for HTTP routing.",
  dataFlow: "Request -> Router -> Handler -> Response.",
};

describe("buildProfile", () => {
  it("combines repository, technical facts, and understanding into ProjectProfile", () => {
    const result = buildProfile(mockRepository, mockTechnicalFacts, mockUnderstanding);

    expect(result).toEqual<ProjectProfile>({
      repository: mockRepository,
      technicalFacts: mockTechnicalFacts,
      understanding: mockUnderstanding,
    });
  });

  it("returns a new object each time", () => {
    const result1 = buildProfile(mockRepository, mockTechnicalFacts, mockUnderstanding);
    const result2 = buildProfile(mockRepository, mockTechnicalFacts, mockUnderstanding);

    expect(result1).toEqual(result2);
    expect(result1).not.toBe(result2);
  });
});