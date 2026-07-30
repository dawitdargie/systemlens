import { describe, it, expect } from "vitest";
import { identifyImportantFiles } from "./identify-important-files";
import type { TreeItem } from "./fetch-tree";

function makeTreeItem(path: string, size = 100): TreeItem {
  return { path, type: "blob", size };
}

describe("identifyImportantFiles", () => {
  it("detects README.md", () => {
    const tree = [makeTreeItem("README.md")];
    const result = identifyImportantFiles(tree);
    expect(result.readme).toBe("README.md");
  });

  it("detects README.md case-insensitively", () => {
    const tree = [makeTreeItem("Readme.md")];
    const result = identifyImportantFiles(tree);
    expect(result.readme).toBe("Readme.md");
  });

  it("returns null for readme when not present", () => {
    const tree: TreeItem[] = [];
    const result = identifyImportantFiles(tree);
    expect(result.readme).toBeNull();
  });

  it("detects package.json as manifest", () => {
    const tree = [makeTreeItem("package.json")];
    const result = identifyImportantFiles(tree);
    expect(result.manifest).toBe("package.json");
  });

  it("prefers go.mod over package.json when both exist", () => {
    const tree = [makeTreeItem("package.json"), makeTreeItem("go.mod")];
    const result = identifyImportantFiles(tree);
    expect(result.manifest).toBe("go.mod");
  });

  it("detects requirements.txt as manifest", () => {
    const tree = [makeTreeItem("requirements.txt")];
    const result = identifyImportantFiles(tree);
    expect(result.manifest).toBe("requirements.txt");
  });

  it("returns null for manifest when no manifest files present", () => {
    const tree = [makeTreeItem("random.js")];
    const result = identifyImportantFiles(tree);
    expect(result.manifest).toBeNull();
  });

  it("detects Dockerfile", () => {
    const tree = [makeTreeItem("Dockerfile")];
    const result = identifyImportantFiles(tree);
    expect(result.docker).toBe("Dockerfile");
  });

  it("detects docker-compose.yml", () => {
    const tree = [makeTreeItem("docker-compose.yml")];
    const result = identifyImportantFiles(tree);
    expect(result.docker).toBe("docker-compose.yml");
  });

  it("returns null for docker when no docker files present", () => {
    const tree: TreeItem[] = [];
    const result = identifyImportantFiles(tree);
    expect(result.docker).toBeNull();
  });

  it("detects main.go as entry point", () => {
    const tree = [makeTreeItem("main.go")];
    const result = identifyImportantFiles(tree);
    expect(result.entryPoint).toBe("main.go");
  });

  it("detects index.js as entry point", () => {
    const tree = [makeTreeItem("index.js")];
    const result = identifyImportantFiles(tree);
    expect(result.entryPoint).toBe("index.js");
  });

  it("detects index.ts as entry point", () => {
    const tree = [makeTreeItem("index.ts")];
    const result = identifyImportantFiles(tree);
    expect(result.entryPoint).toBe("index.ts");
  });

  it("detects main.py as entry point", () => {
    const tree = [makeTreeItem("main.py")];
    const result = identifyImportantFiles(tree);
    expect(result.entryPoint).toBe("main.py");
  });

  it("returns null for entry point when none found", () => {
    const tree = [makeTreeItem("test.ts")];
    const result = identifyImportantFiles(tree);
    expect(result.entryPoint).toBeNull();
  });

  it("detects all file types in a realistic tree", () => {
    const tree = [
      makeTreeItem("README.md"),
      makeTreeItem("package.json"),
      makeTreeItem("index.ts"),
      makeTreeItem("Dockerfile"),
      makeTreeItem(".gitignore"),
      makeTreeItem("tsconfig.json"),
    ];
    const result = identifyImportantFiles(tree);
    expect(result.readme).toBe("README.md");
    expect(result.manifest).toBe("package.json");
    expect(result.docker).toBe("Dockerfile");
    expect(result.entryPoint).toBe("index.ts");
  });

  it("returns all null for empty tree", () => {
    const result = identifyImportantFiles([]);
    expect(result).toEqual({
      readme: null,
      manifest: null,
      docker: null,
      entryPoint: null,
    });
  });
});