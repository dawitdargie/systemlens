import { ProjectUnderstanding, Repository, TechnicalFacts } from "@/types";
import { getAIClient } from "./ai-client";
import { AIError, AIErrors } from "./errors";

export interface GenerateUnderstandingInput {
  repository: Repository;
  technicalFacts: TechnicalFacts;
  readmeContent: string | null;
  entryPointContent: string | null;
}

export async function generateUnderstanding(
  input: GenerateUnderstandingInput
): Promise<ProjectUnderstanding> {
  const client = getAIClient();

  const { repository, technicalFacts, readmeContent, entryPointContent } = input;

  const prompt = buildPrompt({
    repository,
    technicalFacts,
    readmeContent,
    entryPointContent,
  });

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new AIError("AI request timed out after 60 seconds.")),
          60000
        )
      ),
    ]);

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw AIErrors.GENERATION_FAILED();
    }

    const parsed = JSON.parse(text) as Partial<ProjectUnderstanding>;

    if (
      !parsed.purpose ||
      !Array.isArray(parsed.mainModules) ||
      !parsed.architectureSummary ||
      !Array.isArray(parsed.keyFeatures) ||
      !parsed.techStackDetails ||
      !parsed.dataFlow
    ) {
      throw AIErrors.INVALID_RESPONSE();
    }

    return {
      purpose: parsed.purpose,
      mainModules: parsed.mainModules.map((m) => ({
        name: m.name || "Unknown",
        description: m.description || "",
      })),
      architectureSummary: parsed.architectureSummary,
      keyFeatures: parsed.keyFeatures,
      techStackDetails: parsed.techStackDetails,
      dataFlow: parsed.dataFlow,
    };
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw AIErrors.GENERATION_FAILED();
  }
}

function buildPrompt(input: GenerateUnderstandingInput): string {
  const { repository, technicalFacts, readmeContent, entryPointContent } =
    input;

  const lines = [
    `You are a software architecture analyst. Analyze the following GitHub repository and respond with structured JSON.`,
    ``,
    `Repository: ${repository.owner}/${repository.name}`,
    `URL: ${repository.url}`,
    `Default Branch: ${repository.defaultBranch}`,
    ``,
    `Detected Technical Facts:`,
    `- Language: ${technicalFacts.language}`,
    `- Framework: ${technicalFacts.framework}`,
    `- Deployment: ${technicalFacts.deployment}`,
    ``,
  ];

  if (readmeContent) {
    lines.push(`README.md content:`);
    lines.push(
      readmeContent.length > 4000
        ? readmeContent.slice(0, 4000) + "\n... (truncated)"
        : readmeContent
    );
    lines.push("");
  }

  if (entryPointContent) {
    lines.push(`Entry point file content:`);
    lines.push(
      entryPointContent.length > 2000
        ? entryPointContent.slice(0, 2000) + "\n... (truncated)"
        : entryPointContent
    );
    lines.push("");
  }

  lines.push(
    `Respond with ONLY a JSON object matching this exact shape:`,
    `{`,
    `  "purpose": string,`,
    `  "mainModules": [ { "name": string, "description": string } ],`,
    `  "architectureSummary": string,`,
    `  "keyFeatures": string[],`,
    `  "techStackDetails": string,`,
    `  "dataFlow": string`,
    `}`,
    ``,
    `Rules:`,
    `- purpose: 2-3 sentences explaining what this project does.`,
    `- mainModules: array of 3-5 key modules/components. Each must have a name and a 1-sentence description.`,
    `- architectureSummary: 3-5 sentences describing the architecture pattern, layer organization, and key design decisions.`,
    `- keyFeatures: array of 3-6 main capabilities or features.`,
    `- techStackDetails: 1-2 sentences explaining how the detected tech stack is used in this project.`,
    `- dataFlow: 2-4 sentences describing how data enters, moves through, and exits the system, including key transformations.`,
    `- Do not add markdown formatting or explanations. Output raw JSON only.`,
  );

  return lines.join("\n");
}