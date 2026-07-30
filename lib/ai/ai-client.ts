import OpenAI from "openai";
import { getEnvVar } from "@/lib/env";

let client: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (!client) {
    const apiKey = getEnvVar("NVIDIA_API_KEY");
    client = new OpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey,
    });
  }
  return client;
}