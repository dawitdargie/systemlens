import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  answerQuestion,
  streamAnswer,
  buildSystemPrompt,
  buildMessages,
  capHistory,
} from "./answer-chat";
import type { AnswerChatInput } from "./answer-chat";
import type { ProjectProfile, ChatMessage } from "@/types";

const mockCreate = vi.fn();

vi.mock("./ai-client", () => ({
  getAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
  getAIModel: () => "meta/llama-3.3-70b-instruct",
}));

vi.mock("@/lib/env", () => ({
  getEnvVar: () => "fake-key",
}));

const mockProfile: ProjectProfile = {
  repository: {
    name: "gin",
    owner: "gin-gonic",
    url: "https://github.com/gin-gonic/gin",
    defaultBranch: "master",
  },
  technicalFacts: {
    language: "Go",
    framework: "Gin",
    deployment: "Docker",
  },
  understanding: {
    purpose: "HTTP web framework",
    mainModules: [
      { name: "Routing", description: "HTTP routing" },
      { name: "Middleware", description: "Middleware support" },
    ],
    architectureSummary: "Layered HTTP framework",
    keyFeatures: ["Fast", "Middleware"],
    techStackDetails: "Go with Gin",
    dataFlow: "Request -> Router -> Handler -> Response",
  },
};

function makeInput(overrides?: Partial<AnswerChatInput>): AnswerChatInput {
  return {
    question: "What does this project do?",
    projectProfile: mockProfile,
    audience: "Developer",
    history: [],
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes project profile information", () => {
    const prompt = buildSystemPrompt(makeInput());

    expect(prompt).toContain("gin-gonic/gin");
    expect(prompt).toContain("Go");
    expect(prompt).toContain("Gin");
    expect(prompt).toContain("HTTP web framework");
    expect(prompt).toContain("Layered HTTP framework");
  });

  it("includes audience in the prompt", () => {
    const prompt = buildSystemPrompt(makeInput({ audience: "CEO" }));

    expect(prompt).toContain("CEO");
  });

  it("includes code context when provided", () => {
    const prompt = buildSystemPrompt(
      makeInput({
        codeContext: [
          { path: "main.go", content: "package main\nfunc main() {}" },
        ],
      })
    );

    expect(prompt).toContain("Relevant Source Files");
    expect(prompt).toContain("main.go");
    expect(prompt).toContain("package main");
  });

  it("omits code context section when not provided", () => {
    const prompt = buildSystemPrompt(makeInput());

    expect(prompt).not.toContain("Relevant Source Files");
  });

  it("omits code context section when empty array", () => {
    const prompt = buildSystemPrompt(makeInput({ codeContext: [] }));

    expect(prompt).not.toContain("Relevant Source Files");
  });

  it("truncates long file content", () => {
    const longContent = "x".repeat(5000);
    const prompt = buildSystemPrompt(
      makeInput({
        codeContext: [{ path: "big.go", content: longContent }],
      })
    );

    expect(prompt).toContain("truncated");
    expect(prompt).not.toContain("x".repeat(5000));
  });

  it("includes key features", () => {
    const prompt = buildSystemPrompt(makeInput());

    expect(prompt).toContain("Fast");
    expect(prompt).toContain("Middleware");
  });

  it("includes main modules", () => {
    const prompt = buildSystemPrompt(makeInput());

    expect(prompt).toContain("Routing");
    expect(prompt).toContain("HTTP routing");
  });
});

describe("capHistory", () => {
  it("returns history as-is when under limit", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];

    expect(capHistory(history)).toHaveLength(2);
  });

  it("caps to last 10 messages when over limit", () => {
    const history: ChatMessage[] = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const capped = capHistory(history);

    expect(capped).toHaveLength(10);
    expect(capped[0].content).toBe("Message 5");
    expect(capped[9].content).toBe("Message 14");
  });

  it("handles empty history", () => {
    expect(capHistory([])).toEqual([]);
  });
});

describe("buildMessages", () => {
  it("creates system + user messages for empty history", () => {
    const messages = buildMessages(makeInput());

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("What does this project do?");
  });

  it("includes history messages between system and user", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "What is Gin?" },
      { role: "assistant", content: "Gin is a web framework." },
    ];

    const messages = buildMessages(makeInput({ history }));

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("What is Gin?");
    expect(messages[2].role).toBe("assistant");
    expect(messages[3].role).toBe("user");
    expect(messages[3].content).toBe("What does this project do?");
  });

  it("caps long history", () => {
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const messages = buildMessages(makeInput({ history }));

    // 1 system + 10 history + 1 user = 12
    expect(messages).toHaveLength(12);
  });
});

describe("answerQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full answer text", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "This is a web framework." } }],
    });

    const result = await answerQuestion(makeInput());

    expect(result).toBe("This is a web framework.");
  });

  it("throws on empty response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    await expect(answerQuestion(makeInput())).rejects.toThrow(
      "Empty response from AI."
    );
  });

  it("passes messages array to AI client", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Answer" } }],
    });

    await answerQuestion(makeInput());

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toBeDefined();
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.stream).toBe(false);
  });
});

describe("streamAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onChunk with each delta and returns full text", async () => {
    const chunks = [
      { choices: [{ delta: { content: "Hello" } }] },
      { choices: [{ delta: { content: " world" } }] },
      { choices: [{ delta: { content: "!" } }] },
    ];

    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    const received: string[] = [];
    const result = await streamAnswer(makeInput(), (chunk) => {
      received.push(chunk);
    });

    expect(received).toEqual(["Hello", " world", "!"]);
    expect(result).toBe("Hello world!");
  });

  it("returns fallback message when stream produces no content", async () => {
    const chunks = [
      { choices: [{ delta: {} }] },
      { choices: [{ delta: { content: null } }] },
    ];

    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    const result = await streamAnswer(makeInput(), () => {});

    expect(result).toBe(
      "I was unable to generate an answer. Please try again."
    );
  });

  it("passes stream: true to AI client", async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: "Hi" } }] };
      },
    });

    await streamAnswer(makeInput(), () => {});

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.stream).toBe(true);
  });
});