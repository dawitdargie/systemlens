export interface DockerResult {
  deployment: string;
}

// ── Dockerfile instruction patterns ──
const DOCKERFILE_INSTRUCTIONS = [
  "FROM",
  "RUN",
  "COPY",
  "WORKDIR",
  "CMD",
  "ENTRYPOINT",
  "ENV",
  "EXPOSE",
  "ADD",
  "ARG",
  "LABEL",
  "VOLUME",
  "USER",
];

/**
 * Parses a Dockerfile to detect Docker usage.
 *
 * A valid Dockerfile must contain at least a FROM instruction.
 *
 * @param content - The raw content of a Dockerfile
 * @returns DockerResult with deployment "Docker" or "None"
 */
export function parseDockerfile(content: string): DockerResult {
  if (!content || !content.trim()) {
    return { deployment: "None" };
  }

  const lines = content.split("\n");
  const hasFrom = lines.some((line) => {
    const trimmed = line.trim().toUpperCase();
    return trimmed.startsWith("FROM ") || trimmed === "FROM";
  });

  if (hasFrom) {
    return { deployment: "Docker" };
  }

  // Check if any Dockerfile instruction is present (might be a partial file)
  const hasAnyInstruction = lines.some((line) => {
    const trimmed = line.trim().toUpperCase();
    return DOCKERFILE_INSTRUCTIONS.some((instr) =>
      trimmed.startsWith(instr + " ")
    );
  });

  return { deployment: hasAnyInstruction ? "Docker" : "None" };
}

/**
 * Parses a docker-compose file to detect Docker usage.
 *
 * A valid docker-compose file must contain a `services:` key.
 *
 * @param content - The raw content of a docker-compose.yml file
 * @returns DockerResult with deployment "Docker" or "None"
 */
export function parseDockerCompose(content: string): DockerResult {
  if (!content || !content.trim()) {
    return { deployment: "None" };
  }

  // Simple check: look for "services:" key in the YAML content
  // This avoids needing a YAML parser dependency for the MVP
  const hasServices = content
    .split("\n")
    .some((line) => {
      const trimmed = line.trim();
      return trimmed === "services:" || trimmed.startsWith("services:");
    });

  return { deployment: hasServices ? "Docker" : "None" };
}

/**
 * Dispatches to the correct Docker parser based on filename.
 *
 * @param filename - The Docker file name (e.g. "Dockerfile", "docker-compose.yml")
 * @param content - The raw file content
 * @returns Parsed result or null if the file type is unsupported
 */
export function parseDocker(
  filename: string,
  content: string
): DockerResult | null {
  const lower = filename.toLowerCase();

  if (lower === "dockerfile") {
    return parseDockerfile(content);
  }

  if (lower === "docker-compose.yml" || lower === "docker-compose.yaml") {
    return parseDockerCompose(content);
  }

  return null;
}