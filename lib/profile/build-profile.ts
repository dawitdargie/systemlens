import { ProjectProfile } from "@/types";

/**
 * Builds a complete ProjectProfile by combining repository information,
 * technical facts, and project understanding.
 *
 * This is a pure function — no API calls, no side effects.
 *
 * @param repository - Repository metadata from GitHub
 * @param technicalFacts - Deterministic facts from the Light Analyzer
 * @param understanding - AI-generated project understanding
 * @returns A complete ProjectProfile
 */
export function buildProfile(
  repository: import("@/types").Repository,
  technicalFacts: import("@/types").TechnicalFacts,
  understanding: import("@/types").ProjectUnderstanding
): ProjectProfile {
  return {
    repository,
    technicalFacts,
    understanding,
  };
}