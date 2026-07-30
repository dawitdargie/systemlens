import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./parse-url";

describe("parseGitHubUrl", () => {
  it("parses a standard https GitHub URL", () => {
    const result = parseGitHubUrl("https://github.com/gin-gonic/gin");
    expect(result).toEqual({ owner: "gin-gonic", repo: "gin" });
  });

  it("parses a URL with .git suffix", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses a URL without protocol", () => {
    const result = parseGitHubUrl("github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses a URL with http protocol", () => {
    const result = parseGitHubUrl("http://github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses a URL with trailing slash", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("handles owner and repo with hyphens and dots", () => {
    const result = parseGitHubUrl("https://github.com/my-org/my-repo");
    expect(result).toEqual({ owner: "my-org", repo: "my-repo" });
  });

  it("trims whitespace", () => {
    const result = parseGitHubUrl("  https://github.com/owner/repo  ");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("throws for empty string", () => {
    expect(() => parseGitHubUrl("")).toThrow("Invalid GitHub repository URL.");
  });

  it("throws for URL missing repo name", () => {
    expect(() => parseGitHubUrl("https://github.com/owner")).toThrow(
      "Invalid GitHub repository URL."
    );
  });

  it("throws for non-github URL", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/owner/repo")).toThrow(
      "Invalid GitHub repository URL."
    );
  });

  it("throws for random string", () => {
    expect(() => parseGitHubUrl("not-a-url")).toThrow(
      "Invalid GitHub repository URL."
    );
  });
});