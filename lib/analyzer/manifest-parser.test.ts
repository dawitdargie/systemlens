import { describe, it, expect } from "vitest";
import {
  parseGoMod,
  parsePackageJson,
  parseRequirementsTxt,
  parseManifest,
} from "./manifest-parser";

// ── Sample file contents ──

const GO_MOD_GIN = `module github.com/example/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4
)`;

const GO_MOD_ECHO = `module github.com/example/myapp

go 1.21

require (
	github.com/labstack/echo/v4 v4.11.4
)`;

const GO_MOD_NO_FRAMEWORK = `module github.com/example/myapp

go 1.21

require (
	github.com/google/uuid v1.5.0
)`;

const PACKAGE_JSON_NEXT = JSON.stringify({
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

const PACKAGE_JSON_EXPRESS = JSON.stringify({
  name: "api-server",
  dependencies: {
    express: "4.18.2",
  },
});

const PACKAGE_JSON_REACT = JSON.stringify({
  name: "react-app",
  dependencies: {
    react: "18.2.0",
    "react-dom": "18.2.0",
  },
});

const PACKAGE_JSON_UNKNOWN = JSON.stringify({
  name: "utils",
  dependencies: {
    lodash: "4.17.21",
  },
});

const PACKAGE_JSON_TS_WITH_TYPES = JSON.stringify({
  name: "ts-app",
  dependencies: {},
  devDependencies: {
    "@types/node": "^20.0.0",
  },
});

const PACKAGE_JSON_MALFORMED = `{ name: "broken", dependencies: { }`;

const REQUIREMENTS_DJANGO = `django==4.2.0
djangorestframework==3.14.0
psycopg2-binary==2.9.7`;

const REQUIREMENTS_FLASK = `flask==3.0.0
flask-cors==4.0.0
gunicorn==21.2.0`;

const REQUIREMENTS_FASTAPI = `fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.6.0`;

const REQUIREMENTS_UNKNOWN = `requests==2.31.0
numpy==1.26.3
pandas==2.1.4`;

// ── Tests ──

describe("parseGoMod", () => {
  it("detects Gin framework", () => {
    const result = parseGoMod(GO_MOD_GIN);
    expect(result).toEqual({ language: "Go", framework: "Gin" });
  });

  it("detects Echo framework", () => {
    const result = parseGoMod(GO_MOD_ECHO);
    expect(result).toEqual({ language: "Go", framework: "Echo" });
  });

  it("returns Unknown for no known framework", () => {
    const result = parseGoMod(GO_MOD_NO_FRAMEWORK);
    expect(result).toEqual({ language: "Go", framework: "Unknown" });
  });

  it("returns Unknown for empty content", () => {
    const result = parseGoMod("");
    expect(result).toEqual({ language: "Go", framework: "Unknown" });
  });
});

describe("parsePackageJson", () => {
  it("detects Next.js with TypeScript", () => {
    const result = parsePackageJson(PACKAGE_JSON_NEXT);
    expect(result).toEqual({ language: "TypeScript", framework: "Next.js" });
  });

  it("detects Express with JavaScript", () => {
    const result = parsePackageJson(PACKAGE_JSON_EXPRESS);
    expect(result).toEqual({ language: "JavaScript", framework: "Express" });
  });

  it("detects React without Next.js", () => {
    const result = parsePackageJson(PACKAGE_JSON_REACT);
    expect(result).toEqual({ language: "JavaScript", framework: "React" });
  });

  it("returns Unknown for no known framework", () => {
    const result = parsePackageJson(PACKAGE_JSON_UNKNOWN);
    expect(result).toEqual({ language: "JavaScript", framework: "Unknown" });
  });

  it("detects TypeScript from @types/ packages", () => {
    const result = parsePackageJson(PACKAGE_JSON_TS_WITH_TYPES);
    expect(result.language).toBe("TypeScript");
  });

  it("handles malformed JSON gracefully", () => {
    const result = parsePackageJson(PACKAGE_JSON_MALFORMED);
    expect(result).toEqual({ language: "JavaScript", framework: "Unknown" });
  });

  it("handles empty content", () => {
    const result = parsePackageJson("");
    expect(result).toEqual({ language: "JavaScript", framework: "Unknown" });
  });
});

describe("parseRequirementsTxt", () => {
  it("detects Django", () => {
    const result = parseRequirementsTxt(REQUIREMENTS_DJANGO);
    expect(result).toEqual({ language: "Python", framework: "Django" });
  });

  it("detects Flask", () => {
    const result = parseRequirementsTxt(REQUIREMENTS_FLASK);
    expect(result).toEqual({ language: "Python", framework: "Flask" });
  });

  it("detects FastAPI", () => {
    const result = parseRequirementsTxt(REQUIREMENTS_FASTAPI);
    expect(result).toEqual({ language: "Python", framework: "FastAPI" });
  });

  it("returns Unknown for no known framework", () => {
    const result = parseRequirementsTxt(REQUIREMENTS_UNKNOWN);
    expect(result).toEqual({ language: "Python", framework: "Unknown" });
  });

  it("handles empty content", () => {
    const result = parseRequirementsTxt("");
    expect(result).toEqual({ language: "Python", framework: "Unknown" });
  });
});

describe("parseManifest", () => {
  it("dispatches to parseGoMod for go.mod", () => {
    const result = parseManifest("go.mod", GO_MOD_GIN);
    expect(result).toEqual({ language: "Go", framework: "Gin" });
  });

  it("dispatches to parsePackageJson for package.json", () => {
    const result = parseManifest("package.json", PACKAGE_JSON_NEXT);
    expect(result).toEqual({ language: "TypeScript", framework: "Next.js" });
  });

  it("dispatches to parseRequirementsTxt for requirements.txt", () => {
    const result = parseManifest("requirements.txt", REQUIREMENTS_DJANGO);
    expect(result).toEqual({ language: "Python", framework: "Django" });
  });

  it("is case-insensitive for filename", () => {
    const result = parseManifest("GO.MOD", GO_MOD_GIN);
    expect(result).toEqual({ language: "Go", framework: "Gin" });
  });

  it("returns null for unsupported manifest type", () => {
    const result = parseManifest("Cargo.toml", '[package]\nname = "test"');
    expect(result).toBeNull();
  });

  it("returns null for unknown filename", () => {
    const result = parseManifest("random.txt", "some content");
    expect(result).toBeNull();
  });
});