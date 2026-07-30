import { describe, it, expect } from "vitest";
import {
  parseDockerfile,
  parseDockerCompose,
  parseDocker,
} from "./docker-parser";

// ── Sample file contents ──

const DOCKERFILE_FULL = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;

const DOCKERFILE_MINIMAL = `FROM golang:1.21`;

const DOCKERFILE_MULTI_STAGE = `FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /myapp

FROM alpine:3.18
COPY --from=builder /myapp /myapp
CMD ["/myapp"]`;

const DOCKER_COMPOSE_FULL = `version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret`;

const DOCKER_COMPOSE_MINIMAL = `services:
  app:
    image: nginx`;

// ── Tests ──

describe("parseDockerfile", () => {
  it("detects Docker from a full Dockerfile", () => {
    const result = parseDockerfile(DOCKERFILE_FULL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("detects Docker from a minimal Dockerfile", () => {
    const result = parseDockerfile(DOCKERFILE_MINIMAL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("detects Docker from a multi-stage Dockerfile", () => {
    const result = parseDockerfile(DOCKERFILE_MULTI_STAGE);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("returns None for empty content", () => {
    const result = parseDockerfile("");
    expect(result).toEqual({ deployment: "None" });
  });

  it("returns None for whitespace-only content", () => {
    const result = parseDockerfile("   \n  \n  ");
    expect(result).toEqual({ deployment: "None" });
  });

  it("returns None for non-Docker content", () => {
    const result = parseDockerfile("Hello world\nThis is not a Dockerfile");
    expect(result).toEqual({ deployment: "None" });
  });

  it("detects Docker from partial Dockerfile with only RUN", () => {
    const result = parseDockerfile("RUN npm install");
    expect(result).toEqual({ deployment: "Docker" });
  });
});

describe("parseDockerCompose", () => {
  it("detects Docker from a full docker-compose.yml", () => {
    const result = parseDockerCompose(DOCKER_COMPOSE_FULL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("detects Docker from a minimal docker-compose.yml", () => {
    const result = parseDockerCompose(DOCKER_COMPOSE_MINIMAL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("returns None for empty content", () => {
    const result = parseDockerCompose("");
    expect(result).toEqual({ deployment: "None" });
  });

  it("returns None for YAML without services key", () => {
    const result = parseDockerCompose(`version: "3.8"\nnetworks:\n  default:`);
    expect(result).toEqual({ deployment: "None" });
  });

  it("returns None for non-YAML content", () => {
    const result = parseDockerCompose("Hello world");
    expect(result).toEqual({ deployment: "None" });
  });
});

describe("parseDocker", () => {
  it("dispatches to parseDockerfile for Dockerfile", () => {
    const result = parseDocker("Dockerfile", DOCKERFILE_FULL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("dispatches to parseDockerCompose for docker-compose.yml", () => {
    const result = parseDocker("docker-compose.yml", DOCKER_COMPOSE_FULL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("dispatches to parseDockerCompose for docker-compose.yaml", () => {
    const result = parseDocker("docker-compose.yaml", DOCKER_COMPOSE_MINIMAL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("is case-insensitive for Dockerfile", () => {
    const result = parseDocker("DOCKERFILE", DOCKERFILE_MINIMAL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("is case-insensitive for docker-compose.yml", () => {
    const result = parseDocker("DOCKER-COMPOSE.YML", DOCKER_COMPOSE_MINIMAL);
    expect(result).toEqual({ deployment: "Docker" });
  });

  it("returns null for unknown filename", () => {
    const result = parseDocker("random.txt", "some content");
    expect(result).toBeNull();
  });

  it("returns null for non-Docker filename", () => {
    const result = parseDocker("Makefile", "build:\n\tgo build");
    expect(result).toBeNull();
  });
});