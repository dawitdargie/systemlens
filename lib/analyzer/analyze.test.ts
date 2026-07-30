import { describe, it, expect } from "vitest";
import { analyzeTechnicalFacts } from "./analyze";
import type { ImportantFiles } from "@/lib/github";

// ── Sample file contents ──

const GO_MOD_CONTENT = `module github.com/example/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
)`;

const PACKAGE_JSON_CONTENT = JSON.stringify({
  name: "my-app",
  dependencies: {
    next: "14.2.0",
    react: "19.0.0",
    "react-dom": "19.0.0",
  },
  devDependencies: {
    typescript: "^5.0.0",
  },
});

const REQUIREMENTS_CONTENT = `django==4.2.0
djangorestframework==3.14.0`;

const DOCKERFILE_CONTENT = `FROM node:18-alpine
WORKDIR /app
COPY . .
CMD ["npm", "start"]`;

const DOCKER_COMPOSE_CONTENT = `version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"`;

// ── Helper to create a mock fetchFile function ──

function createMockFetchFile(files: Record<string, string>) {
  return (path: string): Promise<string> => {
    if (path in files) {
      return Promise.resolve(files[path]);
    }
    return Promise.reject(new Error(`File not found: ${path}`));
  };
}

// ── Tests ──

describe("analyzeTechnicalFacts", () => {
  it("analyzes Go project with Docker", async () => {
    const importantFiles: ImportantFiles = {
      readme: "README.md",
      manifest: "go.mod",
      docker: "Dockerfile",
      entryPoint: "main.go",
    };

    const fetchFile = createMockFetchFile({
      "go.mod": GO_MOD_CONTENT,
      Dockerfile: DOCKERFILE_CONTENT,
    });

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Go",
      framework: "Gin",
      deployment: "Docker",
    });
  });

  it("analyzes Next.js project without Docker", async () => {
    const importantFiles: ImportantFiles = {
      readme: "README.md",
      manifest: "package.json",
      docker: null,
      entryPoint: "index.ts",
    };

    const fetchFile = createMockFetchFile({
      "package.json": PACKAGE_JSON_CONTENT,
    });

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "TypeScript",
      framework: "Next.js",
      deployment: "None",
    });
  });

  it("analyzes Python project with docker-compose", async () => {
    const importantFiles: ImportantFiles = {
      readme: "README.md",
      manifest: "requirements.txt",
      docker: "docker-compose.yml",
      entryPoint: "main.py",
    };

    const fetchFile = createMockFetchFile({
      "requirements.txt": REQUIREMENTS_CONTENT,
      "docker-compose.yml": DOCKER_COMPOSE_CONTENT,
    });

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Python",
      framework: "Django",
      deployment: "Docker",
    });
  });

  it("handles no manifest and no Docker", async () => {
    const importantFiles: ImportantFiles = {
      readme: "README.md",
      manifest: null,
      docker: null,
      entryPoint: null,
    };

    const fetchFile = createMockFetchFile({});

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Unknown",
      framework: "Unknown",
      deployment: "None",
    });
  });

  it("handles manifest but no Docker", async () => {
    const importantFiles: ImportantFiles = {
      readme: null,
      manifest: "go.mod",
      docker: null,
      entryPoint: "main.go",
    };

    const fetchFile = createMockFetchFile({
      "go.mod": GO_MOD_CONTENT,
    });

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Go",
      framework: "Gin",
      deployment: "None",
    });
  });

  it("handles Docker but no manifest", async () => {
    const importantFiles: ImportantFiles = {
      readme: null,
      manifest: null,
      docker: "Dockerfile",
      entryPoint: null,
    };

    const fetchFile = createMockFetchFile({
      Dockerfile: DOCKERFILE_CONTENT,
    });

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Unknown",
      framework: "Unknown",
      deployment: "Docker",
    });
  });

  it("handles file fetch errors gracefully", async () => {
    const importantFiles: ImportantFiles = {
      readme: null,
      manifest: "go.mod",
      docker: "Dockerfile",
      entryPoint: null,
    };

    // fetchFile always rejects
    const fetchFile = (): Promise<string> =>
      Promise.reject(new Error("Network error"));

    const result = await analyzeTechnicalFacts(importantFiles, fetchFile);

    expect(result).toEqual({
      language: "Unknown",
      framework: "Unknown",
      deployment: "None",
    });
  });
});